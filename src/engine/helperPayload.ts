// Тело запроса к ИИ-помощнику (helper/): чистая функция, чтобы проверять тестами.
import type { Item } from './items';
import { maskText, type StepGaps } from '../lesson/gap';

export interface Turn { role: 'kid' | 'bit'; text: string }
export interface TaskContext { item: Item; picked: number | null; mistake?: string; rule?: string }

/** Тело запроса: всё, что Бит должен знать о задаче (правильный ответ посчитан кодом). */
export function payload(c: TaskContext, history: Turn[], question?: string) {
  const { item, picked } = c;
  return {
    task: {
      text: item.kz,
      choices: item.choices.map(x => x.text),
      correct: item.choices[item.answer].text,
      picked: picked == null ? null : item.choices[picked].text,
      pickedCorrect: picked === item.answer,
      mistake: c.mistake,
      solution: item.sol.kz,
      rule: c.rule,
    },
    history: history.map(t => ({ role: t.role, text: t.text })),
    question: question?.trim() || undefined,
  };
}


export type LessonStepType = 'example' | 'why' | 'rule' | 'predict' | 'faded' | 'blitz' | 'final';
/** Шаг урока и состояние экрана: всё, что нужно, чтобы собрать запрос «как видит ребёнок». */
export interface LessonContext {
  skill: string;
  title: string;                 // название темы для Бита
  step: any;                     // шаг из content/lessons_*.mjs (не маскированный)
  frame?: number;                // example: номер текущего кадра
  gaps?: StepGaps | null;        // planGaps(skill, i, step): пропуск ▢ этого шага
  solved?: boolean;              // ребёнок уже вписал закрытое число — его можно не прятать
  answered?: boolean;            // predict/faded/blitz/final: ребёнок ответил и видит верный ответ (иначе сервер вернёт 400)
  picked?: number | null;        // predict/why/final: индекс выбранного варианта
  rule?: string;                 // правило темы, если ребёнок его уже читал
}

const plain = (s: string) => s.replace(/[[\]]/g, '');   // [..] — подсветка в кадре, ребёнок скобок не видит

/** Тело запроса режима «урок»: закрытое число уходит как «▢», верный ответ — только после ответа ребёнка. */
export function lessonPayload(c: LessonContext, history: Turn[], question?: string) {
  const { step } = c;
  const type: LessonStepType = step.type;
  const at = c.frame ?? 0;
  const gap = type === 'example' ? c.gaps?.frames?.[at] ?? null : type === 'rule' ? c.gaps?.rule?.gap ?? null : null;
  const hide = gap && !c.solved ? gap.answer : null;
  // спрятанное число маскируется во всём, что уходит на сервер, а не только в строке с пропуском
  const m = (s: string) => plain(hide ? maskText(s, hide) : s);
  const answered = c.answered === true;
  let text: string = step.kz ?? '';
  let lines: string[] | undefined;
  if (type === 'example') {
    lines = (step.frames as any[]).slice(0, at + 1).map((f, k) => {
      const math = k === at && gap && !c.solved ? gap.text : f.math;
      return [math ? m(math) : '', m(f.kz)].filter(Boolean).join(' — ');
    });
  } else if (type === 'rule') {
    lines = (step.lines as string[]).map((l, k) => m(gap && !c.solved && c.gaps?.rule?.line === k ? gap.text : l));
  } else if (type === 'faded' && answered) {
    lines = (step.steps as any[]).map(s => plain(s.blank ? s.math.replace('▢', s.blank.choices[s.blank.answer]) : s.math));
  } else if (type === 'blitz') {
    text = `${step.title}. ${text}`;
  }
  const hasChoices = ['predict', 'why', 'final'].includes(type);
  return {
    mode: 'lesson' as const,
    topic: { skill: c.skill, title: c.title },
    step: {
      type,
      text: m(text),
      lines,
      choices: hasChoices ? (step.choices as string[]) : undefined,
      answered,
      picked: hasChoices && answered && c.picked != null ? step.choices[c.picked] : undefined,
      correct: hasChoices && answered ? step.choices[step.answer] : undefined,
      reveal: answered ? step.reveal ?? step.why : undefined,
    },
    rule: c.rule ? m(c.rule) : undefined,
    history: history.map(t => ({ role: t.role, text: t.text })),
    question: question?.trim() || undefined,
  };
}


/** Правило темы, как его видит ребёнок (шаг «Есте сақта»), и вопрос Бита для режима «Биткә түсіндір». */
export interface TeachContext {
  skill: string;
  title: string;
  rule: { kz: string; lines: string[] };   // строки правила целиком: ребёнок их уже прочитал, пропуск ▢ решён
  question: string;                        // первый вопрос Бита («Бөлшекті қалай қысқартамыз? Не үшін?»)
  examples?: string[];                     // краткий контекст из урока, необязательно
}
export type Verdict = 'got' | 'partial' | 'mis';
export interface TeachReply { verdict: Verdict; reply: string; followup: string | null }
export const MAX_TEACH_ROUNDS = 2;   // столько ответов ребёнка принимает сервер; второй — последний

/** Тело запроса режима «Биткә түсіндір». Раунд сервер считает по числу ответов ребёнка в history (kid), последний ответ идёт в answer. */
export function teachPayload(c: TeachContext, history: Turn[], answer: string) {
  const ex = (c.examples ?? []).map(x => x.trim()).filter(Boolean).slice(0, 3);
  return {
    mode: 'teachback' as const,
    topic: { skill: c.skill, title: c.title },
    rule: [c.rule.kz, ...c.rule.lines].filter(Boolean).join(' '),
    question: c.question,
    examples: ex.length ? ex : undefined,
    history: history.map(t => ({ role: t.role, text: t.text })),
    answer: answer.trim().slice(0, 400),
  };
}

// ---------- «Дәптер»: проверка фото карточки (helper/notebook.mjs) ----------
export type NbField = 'rule' | 'example' | 'trap' | 'scheme';
export type NbMark = 'ok' | 'partial' | 'wrong' | 'missing';
export const NB_FIELDS: NbField[] = ['rule', 'example', 'trap', 'scheme'];
export interface NotebookContext {
  skill: string; title: string;
  /** строки «Есте сақта» — эталон */
  ruleLines: string[];
  /** ловушка Глитча из урока: что написано с ошибкой и верный разбор */
  trap: { bad: string; fix: string } | null;
  /** пример, который ребёнок ввёл в игру, и итог проверки вычислением (null — тема без проверки) */
  example?: string; exampleOk?: boolean | null;
  /** образец из поля ввода: если в тетради ровно он — пример списан */
  sample?: string;
}
export interface NotebookCheck { readable: boolean; fields: Record<NbField, { mark: NbMark; note: string }>; praise: string; fix: string }

export function notebookPayload(c: NotebookContext, image: string, mime: string) {
  const ex = c.example?.trim();
  return {
    topic: { skill: c.skill, title: c.title },
    rule: c.ruleLines.filter(l => l.trim()).slice(0, 8),
    trap: c.trap ? { bad: c.trap.bad, fix: c.trap.fix } : undefined,
    example: ex || undefined,
    exampleOk: ex ? c.exampleOk ?? null : undefined,
    sample: c.sample || undefined,
    image, mime,
  };
}

/** Ответ сервера → проверка или null (не тот формат). Пустой fix при «не прочитал» — тоже null: ребёнку нечего показать. */
export function readNotebookCheck(r: any): NotebookCheck | null {
  if (!r || typeof r !== 'object' || typeof r.readable !== 'boolean' || !r.fields) return null;
  const fields = {} as NotebookCheck['fields'];
  for (const k of NB_FIELDS) {
    const f = r.fields[k];
    if (!f || !['ok', 'partial', 'wrong', 'missing'].includes(f.mark)) return null;
    fields[k] = { mark: f.mark, note: typeof f.note === 'string' ? f.note.trim() : '' };
  }
  const fix = typeof r.fix === 'string' ? r.fix.trim() : '';
  if (!r.readable && !fix) return null;
  return { readable: r.readable, fields, praise: typeof r.praise === 'string' ? r.praise.trim() : '', fix };
}
