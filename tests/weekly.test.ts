import { describe, it, expect } from 'vitest';
import { card, alerts, runway, weeklyText, mondayOf, ALERT, silentWriteMs, ruNum, plural, type WeeklyCtx } from '../src/engine/weekly';
import { blankDay } from '../src/engine/planner';

// 2026-10-05 - понедельник; 10-09 пятница; 10-10 суббота; 10-12 следующий понедельник
const save = (x: any = {}): any => ({ version: 1, heroName: 'Муртаза', xp: 0, skills: {}, attempts: [], days: {}, settings: { extraMissionCap: 1, extraTo: 'today', planMinutes: 40 }, diagnosticDone: true, repairShop: [], coins: 0, shipOwned: [], ...x });
const done = (d: string, x: any = {}) => ({ ...blankDay(d), planShare: 1, ...x });
const ex = (id: string, from: string, to: string, kind: 'sick' | 'holiday' = 'sick') => ({ id, from, to, kind, at: 1 });
const att = (day: string, honest: boolean, i = 0, mode = 'practice'): any => ({ at: Date.parse(day) + i, day, skill: 'a', source: `t${i}`, correct: true, hintLevel: 0, honest, timeMs: 5000, mode });
/** n ответов за день, honest из них честных. */
const answers = (day: string, n: number, honest: number) => Array.from({ length: n }, (_, i) => att(day, i < honest, i));
const NOW = Date.parse('2026-10-10T12:00:00');
const ctx = (x: Partial<WeeklyCtx> = {}): WeeklyCtx => ({ nowMs: NOW, ...x });
const ids = (s: any, today: string, c: WeeklyCtx = ctx()) => alerts(s, today, c).map(a => a.id);

describe('карточка недели (K5)', () => {
  it('понедельник недели', () => { expect(['2026-10-05', '2026-10-09', '2026-10-10', '2026-10-11'].map(mondayOf)).toEqual(Array(4).fill('2026-10-05')); expect(mondayOf('2026-10-12')).toBe('2026-10-12'); });
  it('план N из 5; исключение вычитается из знаменателя, а не считается пропуском', () => {
    const s = save({ days: { '2026-10-05': done('2026-10-05'), '2026-10-06': done('2026-10-06'), '2026-10-08': done('2026-10-08') } });
    expect(card(s, '2026-10-10', ctx()).plan).toMatchObject({ done: 3, of: 5 });
    s.exceptions = [ex('a', '2026-10-07', '2026-10-07')];
    const c = card(s, '2026-10-10', ctx());
    expect(c.plan).toMatchObject({ done: 3, of: 4 });
    expect(c.plan.excepted).toEqual([{ day: '2026-10-07', kind: 'sick' }]);
  });
  it('старая отметка дня тоже вычитается; выходные в знаменатель не входят', () => {
    const s = save({ days: { '2026-10-06': { ...blankDay('2026-10-06'), exception: 'holiday' } } });
    expect(card(s, '2026-10-11', ctx()).plan.of).toBe(4);
  });
  it('середина недели: будущие дни не считаются сделанными, но входят в знаменатель', () => {
    const s = save({ days: { '2026-10-05': done('2026-10-05'), '2026-10-08': done('2026-10-08') } });
    expect(card(s, '2026-10-06', ctx()).plan).toMatchObject({ done: 1, of: 5 });
  });
  it('минуты и копилка выходных - сумма по дням этой недели, не прошлой', () => {
    const s = save({ days: { '2026-10-02': done('2026-10-02', { minutesToday: 99, minutesWeekend: 99 }), '2026-10-05': done('2026-10-05', { minutesToday: 60, minutesWeekend: 48 }), '2026-10-06': done('2026-10-06', { minutesToday: 45, minutesWeekend: 36 }) } });
    expect(card(s, '2026-10-10', ctx()).minutes).toEqual({ today: 105, bank: 84 });
  });
  it('честная работа: доля, число ответов, сравнение с прошлой неделей; диагностика не считается; нет ответов - null', () => {
    const s = save({ attempts: [...answers('2026-10-06', 10, 8), ...answers('2026-09-30', 10, 5), att('2026-10-06', false, 77, 'diagnostic')] });
    expect(card(s, '2026-10-10', ctx()).honest).toEqual({ pct: 80, n: 10, prevPct: 50, prevN: 10 });
    expect(card(save(), '2026-10-10', ctx()).honest).toEqual({ pct: null, n: 0, prevPct: null, prevN: 0 });
  });
  it('запас уроков: готовые и ещё не пройденные темы очереди; текущая тема в запас не входит; недели = темы / 3', () => {
    const q = ['a', 'b', 'c', 'd', 'e', 'f', 'g'], ready = new Set(['a', 'b', 'c', 'd', 'e', 'f']);   // у g урока нет
    const s = save({ skills: { a: { lessonDone: true, status: 'mastered' }, b: { lessonDone: false, status: 'learning' }, c: { status: 'available' } } });
    const r = runway(s, { queue: q, lessonReady: id => ready.has(id) });
    expect(r).toEqual({ ready: 4, weeks: 1.3, known: true });           // c d e f: a пройдена, b идёт сейчас, g без урока
  });
  it('поля, которых в игре нет, названы «данных пока нет», а не выдуманы', () => {
    const c = card(save(), '2026-10-10', ctx());
    expect(c.noData).toEqual(['деңгей', 'трещины', 'питомец']);
    const t = weeklyText(c, [], 'Муртаза');
    expect(t).toContain('Деңгей, трещины, питомец: данных пока нет');
    expect(t).toContain('Честная работа: данных пока нет');
    expect(t).toContain('Запас уроков: данных пока нет');             // очередь не передана
  });
  it('сбои - события «error» за неделю; испорченные usage и days не роняют', () => {
    const s = save({ usage: [{ day: '2026-10-06', events: [{ at: 1, k: 'error' }, { at: 2, k: 'teach' }] }, { day: '2026-10-07', events: [{ at: 3, k: 'error' }] }, { day: '2026-09-01', events: [{ at: 1, k: 'error' }] }, null, { day: '2026-10-08', events: 5 }] });
    expect(card(s, '2026-10-10', ctx()).tech.errors).toBe(2);
    expect(() => card(save({ days: { x: null, y: 5 }, attempts: null, usage: 'x', skills: null }), '2026-10-10', ctx({ cloud: { loggedIn: true, devices: 'мусор' as any } }))).not.toThrow();
  });
  it('синхронизация: давность последней записи считается по самому свежему из устройств', () => {
    const c = card(save(), '2026-10-10', ctx({ cloud: { loggedIn: true, status: 'ok', lastSyncMs: NOW - 5 * 864e5, devices: [{ at: NOW - 1 * 864e5 }] } }));
    expect(c.tech.lastWriteDaysAgo).toBe(1);
    expect(card(save(), '2026-10-10', ctx()).tech).toMatchObject({ sync: 'unknown', lastWriteDaysAgo: null });
  });
  it('текст для Telegram: короткий, без длинного тире, с планом, минутами и тревогами', () => {
    const s = save({ days: { '2026-10-05': done('2026-10-05', { minutesToday: 60, minutesWeekend: 48 }) }, attempts: answers('2026-10-06', 25, 25) });
    const c = card(s, '2026-10-10', ctx({ queue: ['a', 'b'], lessonReady: () => true }));
    const al = alerts(s, '2026-10-10', ctx());
    const t = weeklyText(c, al, 'Муртаза');
    expect(t).toContain('План: 1 из 5 дней');
    expect(t).toContain('Заработано: 60 мин, в копилку выходных 48 мин');
    expect(t).toContain('Честная работа: 100% (25 ответов)');
    expect(t).not.toContain('—');
    expect(t.length).toBeLessThan(1000);
  });
});

describe('тревога 1: два учебных дня подряд без выполненного плана', () => {
  const base = () => save({ days: { '2026-10-05': done('2026-10-05'), '2026-10-06': done('2026-10-06'), '2026-10-07': done('2026-10-07') } });   // Пн-Ср сделаны
  it('Чт и Пт пропущены - тревога в субботу и в понедельник; выходные между ними не считаются', () => {
    expect(ids(base(), '2026-10-10')).toContain('no-plan');
    const a = alerts(base(), '2026-10-12', ctx()).find(x => x.id === 'no-plan')!;
    expect(a.since).toBe('2026-10-08');
    expect(a.text).toContain('2');
  });
  it('один пропущенный день тревоги не даёт, даже если после него выходные', () => {
    const s = base(); s.days['2026-10-08'] = done('2026-10-08');
    expect(ids(s, '2026-10-12')).not.toContain('no-plan');
  });
  it('болезнь или праздник на пропущенные дни - не пропуск плана', () => {
    const s = base(); s.exceptions = [ex('a', '2026-10-08', '2026-10-09')];
    expect(ids(s, '2026-10-12')).not.toContain('no-plan');
    const old = base(); old.days['2026-10-08'] = { ...blankDay('2026-10-08'), exception: 'sick' };   // старая отметка дня
    expect(ids(old, '2026-10-12')).not.toContain('no-plan');
    const one = base(); one.exceptions = [ex('a', '2026-10-09', '2026-10-09')];                      // из двух дней один в исключении: остался один пропуск
    expect(ids(one, '2026-10-12')).not.toContain('no-plan');
  });
  it('удалённое исключение пропуск не прощает', () => {
    const s = base(); s.exceptions = [{ ...ex('a', '2026-10-08', '2026-10-09'), deleted: true }];
    expect(ids(s, '2026-10-12')).toContain('no-plan');
  });
  it('молчит, пока не было ни одного выполненного плана, и не считает дни до первого плана', () => {
    expect(ids(save(), '2026-10-12')).toEqual([]);
    expect(ids(save({ days: { '2026-10-08': { ...blankDay('2026-10-08'), minutesToday: 5 } } }), '2026-10-12')).not.toContain('no-plan');
    const late = save({ days: { '2026-10-09': done('2026-10-09') } });          // первый план в пятницу; пропуски Пн-Чт до него не в счёт
    expect(ids(late, '2026-10-12')).not.toContain('no-plan');
    const sat = save({ days: { '2026-10-10': done('2026-10-10') } });            // первый план сделан в субботу: будни до него в счёт не идут
    expect(ids(sat, '2026-10-12')).not.toContain('no-plan');
    expect(ids(sat, '2026-10-14')).toContain('no-plan');                          // а вот Пн и Вт уже после первого плана
  });
  it('сегодняшний день ещё идёт: не выполнен - не считается; выполнен - тревогу снимает', () => {
    const s = save({ days: { '2026-10-05': done('2026-10-05'), '2026-10-06': done('2026-10-06') } });   // Ср и Чт пропущены, сегодня Пт
    expect(ids(s, '2026-10-09')).toContain('no-plan');
    s.days['2026-10-09'] = done('2026-10-09');
    expect(ids(s, '2026-10-09')).not.toContain('no-plan');
    const one = save({ days: { '2026-10-05': done('2026-10-05'), '2026-10-06': done('2026-10-06'), '2026-10-07': done('2026-10-07') } });   // Чт пропущен, сегодня Пт без плана
    expect(ids(one, '2026-10-09')).not.toContain('no-plan');
  });
  it('план, где сделаны все шаги, считается выполненным и без planShare', () => {
    const s = base(); s.days['2026-10-08'] = { ...blankDay('2026-10-08'), plan: { day: '2026-10-08', blocks: [{ id: 'new' }, { id: 'summary' }] }, blocksDone: { new: true, summary: true } };
    expect(ids(s, '2026-10-12')).not.toContain('no-plan');
  });
});

describe('тревога 2: честность ниже 70% за 3 учебных дня при не менее 20 ответах', () => {
  // сегодня Пт 10-09: окно Чт 10-08, Ср 10-07, Вт 10-06
  const mk = (n: number, honest: number, day = '2026-10-07') => save({ attempts: answers(day, n, honest) });
  it('13 из 20 (65%) - тревога; ровно 14 из 20 (70%) - нет', () => {
    expect(ids(mk(20, 13), '2026-10-09')).toContain('honesty');
    expect(ids(mk(20, 14), '2026-10-09')).not.toContain('honesty');
  });
  it('меньше 20 ответов - молчит, даже если все нечестные', () => {
    expect(ids(mk(19, 0), '2026-10-09')).not.toContain('honesty');
    expect(ids(mk(20, 0), '2026-10-09')).toContain('honesty');
  });
  it('ответы считаются по трём дням вместе; четвёртый день назад и сегодняшний в окно не входят', () => {
    const s = save({ attempts: [...answers('2026-10-06', 10, 4), ...answers('2026-10-08', 10, 4)] });
    expect(ids(s, '2026-10-09')).toContain('honesty');
    expect(ids(save({ attempts: answers('2026-10-05', 30, 0) }), '2026-10-09')).not.toContain('honesty');   // Пн - четвёртый день назад
    expect(ids(save({ attempts: answers('2026-10-09', 30, 0) }), '2026-10-09')).not.toContain('honesty');   // сегодня ещё идёт
  });
  it('выходные не считаются днями окна, исключения тоже: плохие ответы в день болезни не в счёт', () => {
    // сегодня Пн 10-12: окно Пт 10-09, Чт 10-08, Ср 10-07
    expect(ids(save({ attempts: answers('2026-10-10', 30, 0) }), '2026-10-12')).not.toContain('honesty');     // суббота
    expect(ids(save({ attempts: answers('2026-10-07', 30, 0) }), '2026-10-12')).toContain('honesty');
    const sick = save({ attempts: answers('2026-10-07', 30, 0), exceptions: [ex('a', '2026-10-07', '2026-10-07')] });   // Ср болел: окно сдвигается на Вт
    expect(ids(sick, '2026-10-12')).not.toContain('honesty');
  });
  it('диагностика не в счёт', () => {
    expect(ids(save({ attempts: Array.from({ length: 30 }, (_, i) => att('2026-10-07', false, i, 'diagnostic')) }), '2026-10-09')).not.toContain('honesty');
  });
});

describe('тревога 3: трещина старше 7 учебных дней (трещин в игре пока нет)', () => {
  it('без данных о трещинах молчит и не падает', () => {
    expect(ids(save(), '2026-10-20')).toEqual([]);
    expect(ids(save(), '2026-10-20', ctx({ cracks: [] }))).toEqual([]);
  });
  it('возраст в учебных днях: 7 - ещё нет, 8 - тревога; выходные не считаются', () => {
    const c = ctx({ cracks: [{ since: '2026-10-01', skill: 'x' }] });     // Чт
    expect(ids(save(), '2026-10-12', c)).not.toContain('old-crack');     // Пт 2, Пн-Пт 5, Пн 12 = 7
    expect(ids(save(), '2026-10-13', c)).toContain('old-crack');         // 8
  });
  it('дни болезни и праздника в возраст трещины не входят', () => {
    const c = ctx({ cracks: [{ since: '2026-10-01' }] });
    const s = save({ exceptions: [ex('a', '2026-10-05', '2026-10-09', 'holiday')] });
    expect(ids(s, '2026-10-13', c)).not.toContain('old-crack');          // 8 минус 5
  });
  it('мусорные записи игнорируются, берётся самая старая', () => {
    const c = ctx({ cracks: [null as any, { since: 'вчера' }, { since: '2030-01-01' }, { since: '2026-09-01' }] });
    const a = alerts(save(), '2026-10-13', c).find(x => x.id === 'old-crack')!;
    expect(a.since).toBe('2026-09-01');
  });
});

describe('тревога 4: запас уроков меньше 3 недель', () => {
  const q = Array.from({ length: 20 }, (_, i) => `t${i}`);
  const c = (readyN: number, x: Partial<WeeklyCtx> = {}) => ctx({ queue: q, lessonReady: id => Number(id.slice(1)) < readyN, ...x });
  it('9 готовых тем = 3 недели - тихо; 8 = 2,6 недели - тревога', () => {
    expect(ids(save(), '2026-10-10', c(9))).not.toContain('runway');
    const a = alerts(save(), '2026-10-10', c(8)).find(x => x.id === 'runway')!;
    expect(a.text).toContain('2,6');
  });
  it('уже пройденные темы в запас не входят', () => {
    const s = save({ skills: { t0: { lessonDone: true }, t1: { lessonDone: true } } });
    expect(ids(s, '2026-10-10', c(10))).toContain('runway');             // готовых 10, пройдено 2 -> 8
    expect(ids(s, '2026-10-10', c(11))).not.toContain('runway');
  });
  it('после даты окончания новых тем не тревожит; без очереди в данных молчит', () => {
    expect(ids(save(), '2027-11-15', c(0))).not.toContain('runway');
    expect(ids(save(), '2027-11-14', c(0))).toContain('runway');
    expect(ids(save(), '2026-10-10', ctx())).not.toContain('runway');
    expect(ids(save(), '2026-10-10', c(0, { newTopicsEnd: '2026-10-01' }))).not.toContain('runway');
  });
  it('3 новые темы в неделю по умолчанию; можно передать другое число', () => {
    expect(runway(save(), { queue: q, lessonReady: () => true, topicsPerWeek: 2 }).weeks).toBe(10);
    expect(runway(save(), { queue: q, lessonReady: () => true }).weeks).toBe(6.6);
  });
});

describe('тревога 5: нет синхронизации больше 3 дней', () => {
  const active = () => save({ attempts: answers('2026-10-08', 3, 3) });
  const D = 864e5;
  it('облако неизвестно - молчит', () => { expect(ids(active(), '2026-10-10', ctx())).not.toContain('sync'); });
  it('занимается, а в облако не вошёл - тревога; не занимается - нет', () => {
    expect(ids(active(), '2026-10-10', ctx({ cloud: { loggedIn: false } }))).toContain('sync');
    expect(ids(save(), '2026-10-10', ctx({ cloud: { loggedIn: false } }))).not.toContain('sync');
    expect(ids(save({ attempts: answers('2026-09-01', 3, 3) }), '2026-10-10', ctx({ cloud: { loggedIn: false } }))).not.toContain('sync');   // занятия больше 14 дней назад
  });
  it('последняя запись 4 дня назад - тревога; ровно 3 дня - нет', () => {
    expect(ids(active(), '2026-10-10', ctx({ cloud: { loggedIn: true, lastSyncMs: NOW - 4 * D } }))).toContain('sync');
    expect(ids(active(), '2026-10-10', ctx({ cloud: { loggedIn: true, lastSyncMs: NOW - 3 * D } }))).not.toContain('sync');
    expect(ALERT.SYNC_MAX_DAYS).toBe(3);
  });
  it('свежая запись любого устройства аккаунта снимает тревогу; нет данных о записях - молчит', () => {
    expect(ids(active(), '2026-10-10', ctx({ cloud: { loggedIn: true, lastSyncMs: NOW - 9 * D, devices: [{ at: NOW - D }] } }))).not.toContain('sync');
    expect(ids(active(), '2026-10-10', ctx({ cloud: { loggedIn: true, lastSyncMs: 0, devices: [] } }))).not.toContain('sync');
  });
  it('болезнь и выходные синхронизацию не оправдывают: тревога остаётся', () => {
    const s = active(); s.exceptions = [ex('a', '2026-10-05', '2026-10-11')];
    expect(ids(s, '2026-10-10', ctx({ cloud: { loggedIn: true, lastSyncMs: NOW - 5 * D } }))).toContain('sync');
  });
});

describe('тревоги вместе', () => {
  const fire = () => {
    const s = save({ days: { '2026-10-05': done('2026-10-05'), '2026-10-06': done('2026-10-06') }, attempts: answers('2026-10-07', 30, 6) });
    const c = ctx({ nowMs: Date.parse('2026-10-09T12:00:00'), queue: ['a', 'b'], lessonReady: () => true, cracks: [{ since: '2026-09-01' }], cloud: { loggedIn: true, lastSyncMs: Date.parse('2026-10-01T12:00:00') } });
    return { s, c };
  };
  it('все пять срабатывают в своём порядке, у каждой есть текст и фраза для ребёнка без цифр и без длинного тире', () => {
    const { s, c } = fire();
    const a = alerts(s, '2026-10-09', c);
    expect(a.map(x => x.id)).toEqual(['no-plan', 'honesty', 'old-crack', 'runway', 'sync']);
    for (const x of a) {
      expect(x.title.length).toBeGreaterThan(3); expect(x.phrase.length).toBeGreaterThan(30);
      expect(x.phrase + x.text + x.title).not.toContain('—');
      if (x.id !== 'runway') expect(x.phrase).not.toMatch(/\d/);        // цифры тревог ребёнку не зачитываются
    }
  });
  it('текст для Telegram со всеми пятью тревогами не раздувается', () => {
    const { s, c } = fire();
    const t = weeklyText(card(s, '2026-10-09', c), alerts(s, '2026-10-09', c), 'Муртаза');
    expect(t).not.toContain('—');
    expect(t.length).toBeLessThan(1800);
  });
  it('пустое сохранение и полностью испорченное не дают тревог и не падают', () => {
    expect(alerts(save(), '2026-10-12', ctx())).toEqual([]);
    expect(() => alerts(save({ days: { a: null }, attempts: [null, 3], skills: null, exceptions: 7, usage: 'x' }), '2026-10-12', ctx({ cloud: { loggedIn: true, devices: null as any } }))).not.toThrow();
  });
  it('результат не зависит от повторного вызова и не меняет сохранение', () => {
    const { s, c } = fire();
    const before = JSON.stringify(s);
    expect(alerts(s, '2026-10-09', c)).toEqual(alerts(s, '2026-10-09', c));
    expect(JSON.stringify(s)).toBe(before);
  });
  it('тревоги по завершённым дням: полночь переводит день, а не добавляет сегодняшний пропуск', () => {
    const s = save({ days: { '2026-10-05': done('2026-10-05'), '2026-10-06': done('2026-10-06'), '2026-10-07': done('2026-10-07') } });
    expect(ids(s, '2026-10-08')).not.toContain('no-plan');                 // Чт в процессе, пропусков нет
    expect(ids(s, '2026-10-09')).not.toContain('no-plan');                 // Чт завершён и пропущен - это один день
    expect(ids(s, '2026-10-12')).toContain('no-plan');                     // Чт и Пт завершены и пропущены
  });
});

describe('red-team K5: молчащее устройство, запятая в неделях, склонение, ошибка облака', () => {
  const D = 864e5;
  const act = () => save({ attempts: answers('2026-10-09', 3, 3) });
  it('телефон ребёнка молчит 10 дней, телефон брата только что синхронизировался: тревога есть', () => {
    const c = ctx({ cloud: { loggedIn: true, status: 'ok', lastSyncMs: NOW - 1000, devices: [{ at: NOW - 10 * D }, { at: NOW - 1000 }] } });
    expect(silentWriteMs(c)).toBe(NOW - 10 * D);
    expect(ids(act(), '2026-10-10', c)).toContain('sync');
  });
  it('оба устройства писали недавно: тревоги нет; молчит больше 14 дней: тревоги «sync» нет (это уже «нет занятий»)', () => {
    expect(ids(act(), '2026-10-10', ctx({ cloud: { loggedIn: true, lastSyncMs: NOW, devices: [{ at: NOW - D }, { at: NOW - 2 * D }] } }))).not.toContain('sync');
    expect(silentWriteMs(ctx({ cloud: { loggedIn: true, devices: [{ at: NOW - 20 * D }, { at: NOW - 1000 }] } }))).toBeNull();
  });
  it('граница 3 дня у устройства: ровно 3 суток не молчит, 3 суток и 1 мс молчит', () => {
    expect(silentWriteMs(ctx({ cloud: { loggedIn: true, devices: [{ at: NOW - 3 * D }, { at: NOW }] } }))).toBeNull();
    expect(silentWriteMs(ctx({ cloud: { loggedIn: true, devices: [{ at: NOW - 3 * D - 1 }, { at: NOW }] } }))).toBe(NOW - 3 * D - 1);
  });
  it('одно устройство или нет данных о них: как раньше, по последней записи', () => {
    expect(silentWriteMs(ctx({ cloud: { loggedIn: true, lastSyncMs: NOW - 5 * D, devices: [] } }))).toBe(NOW - 5 * D);
    expect(silentWriteMs(ctx({ cloud: null }))).toBeNull();
  });
  it('дробные недели с запятой и верное склонение «тема»', () => {
    expect(ruNum(13.6)).toBe('13,6'); expect(ruNum(2)).toBe('2');
    for (const [n, w] of [[1, 'тема'], [2, 'темы'], [4, 'темы'], [5, 'тем'], [11, 'тем'], [21, 'тема'], [22, 'темы'], [41, 'тема'], [112, 'тем']] as const) expect(plural(n, 'тема', 'темы', 'тем'), String(n)).toBe(w);
  });
  it('в тексте для Telegram от ошибки облака остаётся только код, без английского текста Firebase', () => {
    const c = card(save(), '2026-10-10', ctx({ cloud: { loggedIn: true, status: 'error', error: 'permission-denied: Missing or insufficient permissions.' } }));
    const t = weeklyText(c, [], 'Муртаза');
    expect(t).toContain('permission-denied'); expect(t).not.toMatch(/Missing|insufficient/);
  });
});
