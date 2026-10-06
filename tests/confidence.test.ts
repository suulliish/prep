import { describe, it, expect } from 'vitest';
import { eventOf, breaksCombo, critCoins, CRIT_COINS, nextSureFirst, calibOf, calibLine, kzFrom, eventMs, rushLine, EVENT_SAY } from '../src/engine/confidence';

describe('цена уверенности (GAME_LOOP 20)', () => {
  it('верно+уверен — крит, верно+шамамен — обычный удар', () => {
    expect(eventOf(true, 'sure')).toBe('crit');
    expect(eventOf(true, 'maybe')).toBe('hit');
  });
  it('неверно+шамамен — щит держит, неверно+уверен — щит разбит', () => {
    expect(eventOf(false, 'maybe')).toBe('hold');
    expect(eventOf(false, 'sure')).toBe('break');
  });
  it('«білмеймін» события не имеет: сразу разбор', () => {
    expect(eventOf(false, 'unsure')).toBeNull();
    expect(eventOf(true, 'unsure')).toBeNull();
  });
  it('серию рвёт только ошибка при уверенности', () => {
    expect(breaksCombo(false, 'sure')).toBe(true);
    expect(breaksCombo(false, 'maybe')).toBe(false);
    expect(breaksCombo(false, 'unsure')).toBe(false);
    expect(breaksCombo(true, 'sure')).toBe(false);
  });
  it('бонусная монета — только за верный уверенный ответ без подсказок и не слишком быстрый', () => {
    expect(critCoins(true, 'sure', 0, false)).toBe(CRIT_COINS);
    expect(critCoins(true, 'maybe', 0, false)).toBe(0);
    expect(critCoins(false, 'sure', 0, false)).toBe(0);
    expect(critCoins(true, 'sure', 1, false)).toBe(0);
    expect(critCoins(true, 'sure', 0, true)).toBe(0);
  });
  it('у каждого события есть подпись; длительность — по размеру праздника (pacing.EVENT), при «уменьшить движение» короче', () => {
    for (const k of Object.keys(EVENT_SAY) as (keyof typeof EVENT_SAY)[]) {
      expect(EVENT_SAY[k].big.length).toBeGreaterThan(0);
      expect(eventMs(k, false)).toBeLessThanOrEqual(1300);
      expect(eventMs(k, true)).toBeLessThan(eventMs(k, false));
    }
  });
});

describe('порядок кнопок уверенности', () => {
  it('случайный, но не больше двух раз подряд в одну сторону', () => {
    const h: boolean[] = [];
    for (let i = 0; i < 400; i++) h.push(nextSureFirst(h));
    for (let i = 2; i < h.length; i++) expect(h[i] === h[i - 1] && h[i - 1] === h[i - 2]).toBe(false);
    expect(h.filter(Boolean).length).toBeGreaterThan(120); expect(h.filter(Boolean).length).toBeLessThan(280);
  });
});

describe('итог боя: калибровка', () => {
  it('нет уверенных ответов — нет строки', () => { expect(calibOf({ sure: 0, sureRight: 0 })).toBeNull(); expect(calibLine({ sure: 0, sureRight: 0 })).toBeNull(); });
  it('5 и больше уверенных — «10-нан N»', () => {
    expect(calibLine({ sure: 10, sureRight: 7 })).toBe('10-нан 7 дұрыс');
    expect(calibLine({ sure: 8, sureRight: 6 })).toBe('10-нан 8 дұрыс');   // 0,75 → 8 из 10
    expect(calibOf({ sure: 10, sureRight: 7 })!.scaled).toBe(true);
  });
  it('меньше 5 — в штуках, без растягивания на 10', () => {
    expect(calibLine({ sure: 3, sureRight: 2 })).toBe('3-тен 2 дұрыс');
    expect(calibOf({ sure: 3, sureRight: 2 })!.scaled).toBe(false);
  });
  it('окончания чисел', () => { expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(kzFrom)).toEqual(['1-ден', '2-ден', '3-тен', '4-тен', '5-тен', '6-дан', '7-ден', '8-ден', '9-дан', '10-нан']); });
});

describe('быстрый ответ', () => { it('называет секунды', () => { expect(rushLine(2100)).toContain('2 секундта'); expect(rushLine(200)).toContain('1 секундта'); }); });
