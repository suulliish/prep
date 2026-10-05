// Аналитика для командира (вкладка «Аналитика») и для разбора вне сайта (scripts/analytics/report.mjs):
// из ответов (save.attempts), поведения (save.usage, src/lib/track.svelte.ts), вспоминаний, «Дәптер» и разговоров с Битом.
// Чистые функции без сайта и без сети. Только `import type`: файл запускается и в Node (node сам убирает типы).
import type { Save, Attempt, UsageDay, StepLog } from './types';

export interface AnalyticsOpts {
  today: string;
  days?: number;                                  // окно, по умолчанию 14
  tzMin?: number;                                 // смещение часового пояса, мин (Казахстан +300); по умолчанию — как у устройства
  title?: (skill: string) => string;              // название темы (ru)
  mistake?: (tag: string) => string;              // название ошибки (ru)
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const shift = (day: string, n: number) => new Date(Date.parse(day) + n * 864e5).toISOString().slice(0, 10);
const min = (ms: number) => Math.round(ms / 60000);

/** Подписи шагов урока (ru) — для командира. */
export const STEP_RU: Record<string, string> = {
  goal: 'Цель', say: 'Объяснение', widget: 'Руками', example: 'Видео «Көр»', predict: 'Прогноз', why: '«Почему?»', quiz: 'Вопрос',
  faded: '«Сам» (пропуски)', bug: 'Ошибка Глитча', blitz: 'Блиц', rule: 'Правило «Есте сақта»', final: 'Финал',
};
export const PLACE_RU = (p: string) => p.startsWith('lesson:') ? `Урок · ${STEP_RU[p.slice(7)] ?? p.slice(7)}` :
  ({ review: 'Разбор ошибки', recall: 'Еске түсір', notebook: 'Дәптер', intro: 'Заставка', session: 'Задачи', lesson: 'Урок' } as Record<string, string>)[p] ?? p;

export interface DayRow {
  day: string; activeMin: number; sessions: number; from: string; to: string;
  answers: number; correct: number; honest: number; fast: number; guesses: number; hints: number;
  nope: number; awayMin: number; steps: number; exits: number; minutes: number;
}
export interface SkillRow { skill: string; title: string; n: number; acc: number; prevAcc: number | null; fast: number; guesses: number; hints: number; status: string }
export interface MistakeRow { tag: string; name: string; n: number; skills: string[]; last: string }
export interface Bucket { label: string; n: number; acc: number; fast: number }
export interface StepRow { type: string; label: string; n: number; withNope: number; medianSec: number; needSec: number; readRatio: number; awayN: number }
export interface Analytics {
  from: string; to: string; days: DayRow[];
  totals: { activeMin: number; daysActive: number; answers: number; acc: number; honest: number; fast: number; guesses: number; nope: number; awayMin: number; exits: number };
  nopeBy: { place: string; label: string; n: number }[];
  steps: StepRow[];
  reviews: { n: number; medianSec: number; withNope: number };
  skills: SkillRow[];
  mistakes: MistakeRow[];
  hours: Bucket[];
  fatigue: Bucket[];
  confidence: { label: string; n: number; acc: number }[];
  recall: { n: number; clean: number; hinted: number; failed: number };
  teach: Record<string, number>;
  notebook: { n: number; marks: Record<string, Record<string, number>>; unreadable: number };
  ai: { n: number; voice: number };
  errors: { at: number; v: string }[];            // сбои экрана (App.svelte, 02.10): последние 10
  awayAnswers: number;                            // ответов, во время которых приложение было свёрнуто (Attempt.away)
  flags: string[];
}

function inRange(day: string, from: string, to: string) { return day >= from && day <= to; }

function bucket(label: string, list: Attempt[]): Bucket {
  return { label, n: list.length, acc: pct(list.filter(a => a.correct).length, list.length), fast: pct(list.filter(a => a.fast).length, list.length) };
}

export function analyze(save: Save, o: AnalyticsOpts): Analytics {
  const days = o.days ?? 14;
  const to = o.today, from = shift(to, -(days - 1));
  const prevFrom = shift(from, -days), prevTo = shift(from, -1);
  const tz = o.tzMin ?? -new Date().getTimezoneOffset();
  const title = o.title ?? ((s: string) => s);
  const mname = o.mistake ?? ((t: string) => t);
  const clock = (ms: number) => { const d = new Date(ms + tz * 60000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
  const hourOf = (ms: number) => new Date(ms + tz * 60000).getUTCHours();

  // ответы шагов урока (src/engine/lessonlog.ts) в разбор практики не идут; inline: этот файл запускается в чистом Node без импортов кода
  const all = save.attempts ?? [];
  const att = all.filter(a => inRange(a.day, from, to) && a.mode !== 'diagnostic' && !(a.mode === 'lesson' && a.source?.startsWith('lesson:')));
  const prev = all.filter(a => inRange(a.day, prevFrom, prevTo) && a.mode !== 'diagnostic' && !(a.mode === 'lesson' && a.source?.startsWith('lesson:')));
  const usage = (save.usage ?? []).filter(u => inRange(u.day, from, to));
  const uOf = new Map<string, UsageDay>(usage.map(u => [u.day, u]));
  const steps: StepLog[] = usage.flatMap(u => u.steps);
  const reviews = usage.flatMap(u => u.reviews);
  const events = usage.flatMap(u => u.events);
  const guess = (a: Attempt) => !!a.fast && !a.correct;

  // ---- по дням ----
  const dayRows: DayRow[] = [];
  for (let d = to; d >= from; d = shift(d, -1)) {
    const u = uOf.get(d), list = att.filter(a => a.day === d), rec = save.days?.[d];
    if (!u && !list.length && !rec) continue;
    dayRows.push({
      day: d, activeMin: min(u?.activeMs ?? 0), sessions: u?.sessions ?? 0,
      from: u?.firstAt ? clock(u.firstAt) : list.length ? clock(list[0].at) : '', to: u?.lastAt ? clock(u.lastAt) : list.length ? clock(list[list.length - 1].at) : '',
      answers: list.length, correct: pct(list.filter(a => a.correct).length, list.length), honest: pct(list.filter(a => a.honest).length, list.length),
      fast: pct(list.filter(a => a.fast).length, list.length), guesses: list.filter(guess).length, hints: list.filter(a => a.hintLevel > 0).length,
      nope: Object.values(u?.nope ?? {}).reduce((x, y) => x + y, 0), awayMin: min(u?.awayMs ?? 0), steps: u?.steps.length ?? 0,
      exits: Object.values(u?.exits ?? {}).reduce((x, y) => x + y, 0), minutes: Math.round(rec?.minutesToday ?? 0),
    });
  }

  // ---- ранние нажатия ----
  const nopeMap: Record<string, number> = {};
  for (const u of usage) for (const [p, n] of Object.entries(u.nope)) nopeMap[p] = (nopeMap[p] ?? 0) + n;
  const nopeBy = Object.entries(nopeMap).sort((a, b) => b[1] - a[1]).map(([place, n]) => ({ place, label: PLACE_RU(place), n }));

  // ---- шаги урока: сколько читал против нужного ----
  const types = [...new Set(steps.map(s => s.type))];
  const stepRows: StepRow[] = types.map(t => {
    const ss = steps.filter(s => s.type === t && s.done);
    const withNeed = ss.filter(s => s.need > 0);
    return {
      type: t, label: STEP_RU[t] ?? t, n: ss.length, withNope: ss.filter(s => s.nope > 0).length,
      medianSec: Math.round(median(ss.map(s => s.ms)) / 1000), needSec: Math.round(median(withNeed.map(s => s.need)) / 1000),
      readRatio: withNeed.length ? Math.round(median(withNeed.map(s => s.ms / s.need)) * 100) / 100 : 0,
      awayN: ss.filter(s => s.away > 10000).length,
    };
  }).sort((a, b) => b.n - a.n);

  // ---- темы ----
  const bySkill = new Map<string, Attempt[]>();
  for (const a of att) bySkill.set(a.skill, [...(bySkill.get(a.skill) ?? []), a]);
  const skillRows: SkillRow[] = [...bySkill.entries()].map(([skill, list]) => {
    const p = prev.filter(a => a.skill === skill);
    return {
      skill, title: title(skill), n: list.length, acc: pct(list.filter(a => a.correct).length, list.length),
      prevAcc: p.length >= 3 ? pct(p.filter(a => a.correct).length, p.length) : null,
      fast: pct(list.filter(a => a.fast).length, list.length), guesses: list.filter(guess).length, hints: list.filter(a => a.hintLevel > 0).length,
      status: save.skills?.[skill]?.status ?? '',
    };
  }).sort((a, b) => a.acc - b.acc || b.n - a.n);

  // ---- повторяющиеся ошибки ----
  const tagMap = new Map<string, Attempt[]>();
  for (const a of att) if (!a.correct && a.tag) tagMap.set(a.tag, [...(tagMap.get(a.tag) ?? []), a]);
  const mistakes: MistakeRow[] = [...tagMap.entries()].map(([tag, list]) => ({
    tag, name: mname(tag), n: list.length, skills: [...new Set(list.map(a => title(a.skill)))], last: list[list.length - 1].day,
  })).sort((a, b) => b.n - a.n).slice(0, 12);

  // ---- время суток и усталость ----
  const H = [['до 12:00', 0, 12], ['12–15', 12, 15], ['15–18', 15, 18], ['18–21', 18, 21], ['после 21:00', 21, 24]] as const;
  const hours = H.map(([l, a, b]) => bucket(l, att.filter(x => hourOf(x.at) >= a && hourOf(x.at) < b))).filter(b => b.n);
  const firstAt = new Map<string, number>();
  for (const a of att) if (!firstAt.has(a.day) || a.at < firstAt.get(a.day)!) firstAt.set(a.day, a.at);
  const into = (a: Attempt) => (a.at - firstAt.get(a.day)!) / 60000;
  const F = [['0–15 мин', 0, 15], ['15–30 мин', 15, 30], ['30–45 мин', 30, 45], ['45+ мин', 45, 1e9]] as const;
  const fatigue = F.map(([l, a, b]) => bucket(l, att.filter(x => into(x) >= a && into(x) < b))).filter(b => b.n);

  // ---- уверенность ----
  const CONF: [string, string][] = [['sure', 'Уверен'], ['maybe', 'Примерно'], ['unsure', 'Не знаю']];
  const confidence = CONF.map(([k, label]) => { const l = att.filter(a => a.confidence === k); return { label, n: l.length, acc: pct(l.filter(a => a.correct).length, l.length) }; }).filter(c => c.n);

  // ---- вспоминания, «Биткә түсіндір», «Дәптер», ИИ ----
  const rc = Object.values(save.recall ?? {}).flatMap(r => r.history).filter(h => inRange(h.day, from, to));
  const recall = { n: rc.length, clean: rc.filter(h => h.ok && h.hint === 0).length, hinted: rc.filter(h => h.ok && h.hint > 0 && h.hint < 3).length, failed: rc.filter(h => !h.ok || h.hint === 3).length };
  const teach: Record<string, number> = {};
  for (const e of events) if (e.k === 'teach' && e.v) teach[e.v] = (teach[e.v] ?? 0) + 1;
  const nbs = Object.values(save.notebook ?? {}).filter(n => n.check && inRange(n.day, from, to));
  const marks: Record<string, Record<string, number>> = {};
  for (const n of nbs) if (n.check!.readable) for (const [f, m] of Object.entries(n.check!.marks)) { marks[f] ??= {}; marks[f][m] = (marks[f][m] ?? 0) + 1; }
  const notebook = { n: nbs.length, marks, unreadable: nbs.filter(n => !n.check!.readable).length };
  const aiList = (save.aiLog ?? []).filter(t => inRange(t.day, from, to));
  const ai = { n: aiList.length, voice: aiList.filter(t => t.voice).length };

  const totals = {
    activeMin: dayRows.reduce((s, d) => s + d.activeMin, 0), daysActive: dayRows.filter(d => d.answers || d.activeMin).length,
    answers: att.length, acc: pct(att.filter(a => a.correct).length, att.length), honest: pct(att.filter(a => a.honest).length, att.length),
    fast: pct(att.filter(a => a.fast).length, att.length), guesses: att.filter(guess).length,
    nope: nopeBy.reduce((s, x) => s + x.n, 0), awayMin: dayRows.reduce((s, d) => s + d.awayMin, 0), exits: dayRows.reduce((s, d) => s + d.exits, 0),
  };
  const rv = { n: reviews.length, medianSec: Math.round(median(reviews.map(r => r.ms)) / 1000), withNope: reviews.filter(r => r.nope > 0).length };

  const a: Analytics = { from, to, days: dayRows, totals, nopeBy, steps: stepRows, reviews: rv, awayAnswers: att.filter(x => (x.away ?? 0) > 0).length, errors: events.filter(e => e.k === 'error').slice(-10).map(e => ({ at: e.at, v: e.v ?? '' })), skills: skillRows, mistakes, hours, fatigue, confidence, recall, teach, notebook, ai, flags: [] };
  a.flags = flags(a);
  return a;
}

/** Выводы простыми словами: что бросается в глаза. Пороги грубые, чтобы не шуметь на малых числах. */
export function flags(a: Analytics): string[] {
  const out: string[] = [];
  const t = a.totals;
  if (t.answers >= 20 && t.fast >= 25) out.push(`Спешит: ${t.fast}% ответов быстрее, чем можно прочитать условие; угаданных наугад (быстро и неверно) — ${t.guesses}.`);
  if (t.answers >= 20 && t.honest < 70) out.push(`Честных ответов только ${t.honest}% (без спешки и без полной подсказки).`);
  const readSteps = a.steps.filter(s => s.needSec > 0 && s.n >= 3);
  for (const s of readSteps) {
    if (s.withNope / s.n >= 0.4) out.push(`«${s.label}»: в ${Math.round((s.withNope / s.n) * 100)}% шагов жмёт «дальше» раньше, чем дочитал.`);
    else if (s.readRatio > 0 && s.readRatio < 1.15) out.push(`«${s.label}»: уходит дальше почти сразу, как кнопка открылась (в ${s.readRatio} раза дольше нужного) — читает по минимуму.`);
  }
  if (a.reviews.n >= 5 && a.reviews.withNope / a.reviews.n >= 0.4) out.push(`Разбор ошибки: в ${Math.round((a.reviews.withNope / a.reviews.n) * 100)}% разборов пытается пролистать.`);
  if (a.errors.length) out.push(`Сбои в приложении: ${a.errors.length} (последний: ${a.errors[a.errors.length - 1].v.slice(0, 120)}). Пришлите отчёт разработчику.`);
  if (a.awayAnswers >= 3) out.push(`Сворачивал приложение посреди задачи (калькулятор, поиск?) в ${a.awayAnswers} ответах — они не засчитаны в минуты.`);
  if (t.awayMin >= 10) out.push(`Сворачивал приложение посреди задания: ${t.awayMin} мин за период.`);
  if (t.exits >= 3) out.push(`Выходил из урока или задач на середине: ${t.exits} раз.`);
  const f = a.fatigue;
  if (f.length >= 2 && f[0].n >= 10 && f[f.length - 1].n >= 10 && f[0].acc - f[f.length - 1].acc >= 15)
    out.push(`Устаёт: в начале занятия ${f[0].acc}% верных, к «${f[f.length - 1].label}» — ${f[f.length - 1].acc}%.`);
  const sure = a.confidence.find(c => c.label === 'Уверен');
  if (sure && sure.n >= 10 && sure.acc < 75) out.push(`Самоуверенность: «уверен» — а верно только ${sure.acc}%.`);
  const dropped = a.skills.filter(s => s.prevAcc !== null && s.n >= 5 && s.prevAcc - s.acc >= 20);
  for (const s of dropped.slice(0, 3)) out.push(`Тема «${s.title}» просела: было ${s.prevAcc}%, стало ${s.acc}%.`);
  const top = a.mistakes[0];
  if (top && top.n >= 4) out.push(`Чаще всего повторяется ошибка: ${top.name} (${top.n} раз; ${top.skills.slice(0, 3).join(', ')}).`);
  if (a.recall.n >= 5 && a.recall.failed / a.recall.n >= 0.4) out.push(`Правила забываются: в ${Math.round((a.recall.failed / a.recall.n) * 100)}% вспоминаний не вспомнил.`);
  if (a.days.length && t.daysActive < Math.min(5, a.days.length)) out.push(`Занимался ${t.daysActive} дн. из периода.`);
  return out;
}

/** Отчёт Markdown: его брат копирует и присылает для разбора. */
export function reportMarkdown(a: Analytics, name = ''): string {
  const L: string[] = [];
  const row = (...c: (string | number)[]) => `| ${c.join(' | ')} |`;
  L.push(`# Аналитика${name ? ` · ${name}` : ''} · ${a.from} — ${a.to}`, '');
  const t = a.totals;
  L.push(`Активно: **${t.activeMin} мин** за ${t.daysActive} дн. Ответов: ${t.answers}, верно ${t.acc}%, честно ${t.honest}%, слишком быстро ${t.fast}%, наугад ${t.guesses}. Ранних нажатий «дальше»: ${t.nope}. Свёрнуто посреди задания: ${t.awayMin} мин. Выходов на середине: ${t.exits}.`, '');
  if (a.flags.length) { L.push('## Главное'); for (const f of a.flags) L.push(`- ${f}`); L.push(''); }
  L.push('## По дням', row('День', 'Акт. мин', 'Заходы', 'Время', 'Ответов', 'Верно %', 'Честно %', 'Быстро %', 'Наугад', 'Подсказки', 'Ранние нажатия', 'Свёрнуто мин', 'Выходы', 'Заработал мин'), row(...Array(14).fill('---')));
  for (const d of a.days) L.push(row(d.day, d.activeMin, d.sessions, d.from && d.to ? `${d.from}–${d.to}` : '', d.answers, d.correct, d.honest, d.fast, d.guesses, d.hints, d.nope, d.awayMin, d.exits, d.minutes));
  L.push('');
  if (a.steps.length) {
    L.push('## Шаги урока: читает ли', row('Шаг', 'Раз', 'С ранним нажатием', 'Медиана, с', 'Нужно, с', 'Читал / нужно', 'Сворачивал'), row(...Array(7).fill('---')));
    for (const s of a.steps) L.push(row(s.label, s.n, s.withNope, s.medianSec, s.needSec || '', s.readRatio || '', s.awayN));
    L.push('');
  }
  if (a.reviews.n) L.push(`Разборы ошибок: ${a.reviews.n}, медиана ${a.reviews.medianSec} с, с попыткой пролистать — ${a.reviews.withNope}.`, '');
  if (a.nopeBy.length) { L.push('## Где жмёт раньше времени'); for (const n of a.nopeBy) L.push(`- ${n.label}: ${n.n}`); L.push(''); }
  if (a.skills.length) {
    L.push('## Темы (слабые сверху)', row('Тема', 'Ответов', 'Верно %', 'Раньше %', 'Быстро %', 'Наугад', 'Подсказки', 'Статус'), row(...Array(8).fill('---')));
    for (const s of a.skills) L.push(row(s.title, s.n, s.acc, s.prevAcc ?? '', s.fast, s.guesses, s.hints, s.status));
    L.push('');
  }
  if (a.mistakes.length) { L.push('## Повторяющиеся ошибки'); for (const m of a.mistakes) L.push(`- ${m.name} — ${m.n} раз (${m.skills.join(', ')}), последний ${m.last}`); L.push(''); }
  if (a.hours.length) { L.push('## Время суток'); for (const h of a.hours) L.push(`- ${h.label}: ${h.n} ответов, верно ${h.acc}%, быстро ${h.fast}%`); L.push(''); }
  if (a.fatigue.length) { L.push('## От начала занятия'); for (const h of a.fatigue) L.push(`- ${h.label}: ${h.n} ответов, верно ${h.acc}%, быстро ${h.fast}%`); L.push(''); }
  if (a.confidence.length) { L.push('## Уверенность'); for (const c of a.confidence) L.push(`- ${c.label}: ${c.n} ответов, верно ${c.acc}%`); L.push(''); }
  L.push('## Память и понимание');
  L.push(`- Еске түсір: ${a.recall.n} вспоминаний — без подсказки ${a.recall.clean}, с подсказкой ${a.recall.hinted}, не вспомнил ${a.recall.failed}`);
  const tv = Object.entries(a.teach);
  const TEACH_RU: Record<string, string> = { got: 'понял', partial: 'частично', skipped: 'без проверки' };
  if (tv.length) L.push(`- Биткә түсіндір: ${tv.map(([k, n]) => `${TEACH_RU[k] ?? k} ${n}`).join(', ')}`);
  if (a.notebook.n) L.push(`- Дәптер по фото: ${a.notebook.n} карточек, нечитаемых ${a.notebook.unreadable}; ${Object.entries(a.notebook.marks).map(([f, m]) => `${f}: ${Object.entries(m).map(([k, n]) => `${k} ${n}`).join(' ')}`).join('; ')}`);
  L.push(`- Вопросы к Биту: ${a.ai.n} (голосом ${a.ai.voice})`);
  if (a.errors.length) { L.push('', '## Сбои'); for (const e of a.errors) L.push(`- ${new Date(e.at).toISOString().slice(0, 16)} ${e.v}`); }
  return L.join('\n');
}
