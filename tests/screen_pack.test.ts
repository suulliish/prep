// D3, экранный пакет (docs/systems/IMPLEMENTATION.md §3, 19.10): короткие события ответа, карточка «свернул», выход, копилка, «Ойын заңдары».
// Чистая логика: длительности и ускорение (src/engine/pacing.ts), тексты для ребёнка (screentext.ts), копилка (weekbank.ts), правило «свернул» (rules.ts).
import { describe, it, expect } from 'vitest';
import { EVENT, EVENT_PACE, BIG, PACE_WAVE, eventMs, eventPace, isWrongEvent } from '../src/engine/pacing';
import { EVENT_SAY, HALF_COINS_OVER, type EventKind } from '../src/engine/confidence';
import { AWAY_CARD, EXIT_ASK, RULES } from '../src/engine/screentext';
import { AWAY_CLOSE_MS, isClosed, isHonest, forModel } from '../src/engine/rules';
import { WINDOW_ACC, WINDOW_MIN, WINDOW_MAX } from '../src/engine/bkt';
import { EXAM_PENALTY, examShare } from '../src/engine/planner';
import { RUSH } from '../src/engine/rush';
import { weekendBank, mondayOf, WEEKEND_BANK_MAX } from '../src/engine/weekbank';
import type { DayRecord } from '../src/engine/types';

const KINDS = Object.keys(EVENT_SAY) as EventKind[];

describe('события ответа: по размеру праздника', () => {
  it('значения из решения: верный 0,8 с, неверный 1,3 с, «уменьшить движение» 0,6 с', () => {
    expect(EVENT).toEqual({ rightMs: 800, wrongMs: 1300, reducedMs: 600 });
  });
  it('верные события не длиннее 0,8 с, неверные (щит держит и разбит) не длиннее 1,3 с', () => {
    for (const k of KINDS) {
      const wrong = k === 'hold' || k === 'break';
      expect(isWrongEvent(k), k).toBe(wrong);
      expect(eventMs(k, false), k).toBe(wrong ? 1300 : 800);
    }
  });
  it('при «уменьшить движение» любое событие 0,6 с, короче обычного', () => {
    for (const k of KINDS) { expect(eventMs(k, true)).toBe(600); expect(eventMs(k, true)).toBeLessThan(eventMs(k, false)); }
  });
  it('3D-сцена только ускоряется (> 1), при «уменьшить движение» сильнее всего; смена волны медленнее ответа, но быстрее обычной', () => {
    for (const k of KINDS) { expect(eventPace(k, false)).toBeGreaterThan(1); expect(eventPace(k, true)).toBeGreaterThanOrEqual(eventPace(k, false)); }
    expect(PACE_WAVE).toBeGreaterThan(1);
    expect(PACE_WAVE).toBeLessThanOrEqual(EVENT_PACE.wrong);
  });
  it('пауза «ҮЙРЕНДІ!» после верного ответа: вместе с событием 2-3 с, при «уменьшить движение» короче', () => {
    expect(EVENT.rightMs + BIG.learnedMs).toBeGreaterThanOrEqual(2000);
    expect(EVENT.rightMs + BIG.learnedMs).toBeLessThanOrEqual(3000);
    expect(BIG.learnedReducedMs).toBeLessThan(BIG.learnedMs);
  });
});

describe('«свернул > 5 с» (решение семьи 02.10)', () => {
  it('граница: ровно 5 с ещё можно, больше — задача закрыта', () => {
    expect(AWAY_CLOSE_MS).toBe(5000);
    expect(isClosed(5000)).toBe(false);
    expect(isClosed(5001)).toBe(true);
    expect(isClosed(undefined)).toBe(false);
  });
  it('закрытая задача не честная и для модели знаний неверна, даже если ответ случайно верен', () => {
    expect(isHonest({ timeMs: 20000, hintLevel: 0, rushed: false, closed: true })).toBe(false);
    const a = { correct: true, honest: false, hintLevel: 0, mode: 'practice' as const, r: 2 as const, closed: true };
    expect(forModel(a)).toBe('wrong');
    expect(forModel({ ...a, closed: false, honest: true })).toBe('correct');
  });
  it('в минутах закрытая задача стоит как неверный ответ: −¼', () => {
    expect(examShare(3, 1, 4)).toBeCloseTo((3 - EXAM_PENALTY) / 4, 10);
    expect(EXAM_PENALTY).toBe(0.25);
  });
  it('карточка: правило из решения, число секунд из константы, объяснено что делать', () => {
    expect(AWAY_CARD.rule).toBe('Қосымшадан шығып кетсең, жауап саналмайды.');
    expect(AWAY_CARD.title).toContain(String(AWAY_CLOSE_MS / 1000));
    expect(AWAY_CARD.what).toContain('қате');
    expect(AWAY_CARD.todo).toContain('егіз');
    expect(AWAY_CARD.btn.length).toBeGreaterThan(0);
  });
});

describe('подтверждение выхода из боя', () => {
  it('открытая задача честно названа ошибкой, без неё предупреждения нет', () => {
    // выход с открытой задачей штрафа не даёт (решение семьи не принято): текст одинаков и не обещает «ошибки»
    expect(EXIT_ASK.text(true, false)).toBe(EXIT_ASK.text(false, false)); expect(EXIT_ASK.text(true, false)).not.toContain('қате');
  });
  it('в бою с боссом говорит, что вторая попытка сегодня не положена', () => {
    expect(EXIT_ASK.text(false, true)).toContain('Бас жау');
    expect(EXIT_ASK.text(false, false)).not.toContain('Бас жау');
  });
  it('кнопки: «Шығу» и «Қалу» (оставаться — главная)', () => {
    expect(EXIT_ASK.yes).toBe('Шығу'); expect(EXIT_ASK.no).toBe('Қалу');
  });
});

describe('копилка выходных на экране корабля', () => {
  const day = (date: string, w: number): DayRecord => ({ date, blocksDone: {}, planShare: 0, minutesToday: 0, minutesWeekend: w, extraMissions: 0, bonuses: [] });
  const days = (xs: [string, number][]) => Object.fromEntries(xs.map(([d, w]) => [d, day(d, w)]));
  it('неделя считается с понедельника, воскресенье относится к прошедшей неделе', () => {
    expect(mondayOf('2026-10-07')).toBe('2026-10-05');   // среда
    expect(mondayOf('2026-10-05')).toBe('2026-10-05');   // понедельник
    expect(mondayOf('2026-10-11')).toBe('2026-10-05');   // воскресенье
  });
  it('сумма минут для выходных за текущую неделю; прошлая неделя и будущие дни не входят', () => {
    const d = days([['2026-10-02', 40], ['2026-10-05', 20], ['2026-10-06', 18], ['2026-10-08', 30]]);
    expect(weekendBank(d, '2026-10-07')).toBe(38);        // пн + вт; пт прошлой недели и чт впереди не считаются
  });
  it('не больше 90 и не меньше 0', () => {
    expect(WEEKEND_BANK_MAX).toBe(90);
    expect(weekendBank(days([['2026-10-05', 48], ['2026-10-06', 48], ['2026-10-07', 48]]), '2026-10-07')).toBe(90);
    expect(weekendBank({}, '2026-10-07')).toBe(0);
    expect(weekendBank(days([['2026-10-05', -5]]), '2026-10-05')).toBe(0);
  });
  it('выходные видят копилку недели целиком', () => {
    const d = days([['2026-10-05', 18], ['2026-10-06', 18], ['2026-10-09', 18]]);
    expect(weekendBank(d, '2026-10-10')).toBe(54);        // суббота
  });
});

describe('«Ойын заңдары»: тексты для ребёнка', () => {
  const all = [AWAY_CARD.title, AWAY_CARD.rule, AWAY_CARD.what, AWAY_CARD.todo, AWAY_CARD.btn, AWAY_CARD.toast,
    EXIT_ASK.title, EXIT_ASK.yes, EXIT_ASK.no, EXIT_ASK.text(true, true), EXIT_ASK.text(false, false),
    ...RULES.flatMap(r => [r.title, ...r.lines])];
  it('без длинного (и среднего) тире: ни «—», ни «–»', () => {
    for (const t of all) { expect(t, t).not.toMatch(/[—–]/); expect(t.trim().length).toBeGreaterThan(0); }
  });
  it('правила: уникальные номера, у каждого заголовок и строки, не больше 8 (ребёнок читает до конца)', () => {
    expect(new Set(RULES.map(r => r.id)).size).toBe(RULES.length);
    expect(RULES.length).toBeLessThanOrEqual(8);
    for (const r of RULES) { expect(r.title.length).toBeGreaterThan(0); expect(r.lines.length).toBeGreaterThan(0); }
  });
  const text = (id: string) => RULES.find(r => r.id === id)!.lines.join(' ');
  it('минуты: +1, −¼ и 0 совпадают с тем, как считает examShare', () => {
    expect(text('minutes')).toContain('+1');
    expect(text('minutes')).toContain('−¼');
    expect(text('minutes')).toContain('«Білмеймін»: 0');
    expect(examShare(2, 0, 2)).toBe(1);
    expect(examShare(0, 0, 3)).toBe(0);
    expect(examShare(0, 4, 4)).toBe(0);   // минус не уводит ниже нуля
  });
  it('числа в правилах берутся из констант игры: 85%, окно 15-20, 5 секунд, порог спешки, больше 6 поломок', () => {
    expect(text('learned')).toContain(`${Math.round(WINDOW_ACC * 100)}%`);
    expect(text('learned')).toContain(`${WINDOW_MIN}-${WINDOW_MAX}`);
    expect(text('away')).toContain(`${AWAY_CLOSE_MS / 1000} секунд`);
    expect(text('slow')).toContain('2,5-8 секунд');
    expect(RUSH.minMs).toBe(2500); expect(RUSH.maxMs).toBe(8000);
    expect(text('repair')).toContain(`${HALF_COINS_OVER}-дан көп`);
  });
  it('правило «пропусков нет»: сказано прямо, и «Білмеймін» назван безопасным выходом', () => {
    expect(text('noskip')).toContain('өткізіп жіберуге болмайды');
    expect(text('noskip')).toContain('Білмеймін');
  });
});
