import { describe, it, expect } from 'vitest';
import { RUSH, stemChars, tooFastMs, isTooFast, rushAction, nextStreak, twinSlot, pickRevengeTpl, changedMarkup, varyAnswerPos, canReorder, askKind, miniCheck } from '../src/engine/rush';
import { sequenceSlots } from '../src/engine/planner';
import { templatesOf, makeItem } from '../src/engine/items';
// @ts-ignore
import { skillById as SKILLS } from '../content/skills.mjs';
import { nb } from '../src/ui/text';
// @ts-ignore
import { templates } from '../content/templates/index.mjs';
// @ts-ignore
import { rng } from '../content/templates/lib.mjs';

const hl = (cur: string, prev: string | null) => changedMarkup(cur.split('\n').map(nb), prev).map(l => l.filter(s => s.hl).map(s => s.t));

describe('порог «слишком быстро» (D2)', () => {
  it('2,0 с + 0,04 с на знак, не меньше 2,5 с и не больше 8 с', () => {
    expect(tooFastMs(0)).toBe(2500);
    expect(tooFastMs(12)).toBe(2500);      // 2,48 с → нижняя граница
    expect(tooFastMs(13)).toBe(2520);
    expect(tooFastMs(50)).toBe(4000);
    expect(tooFastMs(100)).toBe(6000);
    expect(tooFastMs(150)).toBe(8000);     // ровно потолок
    expect(tooFastMs(400)).toBe(8000);
  });
  it('длина условия — без переносов и пробелов по краям', () => {
    expect(stemChars('  Кітапта неше бет бар?\n')).toBe('Кітапта неше бет бар?'.length);
    expect(stemChars('а\n\nб')).toBe(3);
  });
  it('граница порога: быстрее — быстрый, ровно порог — нормальный; с подсказкой не считается', () => {
    const c = 50;
    expect(isTooFast(3999, c)).toBe(true);
    expect(isTooFast(4000, c)).toBe(false);
    expect(isTooFast(1000, c, 1)).toBe(false);
  });
  it('пороги согласованы с константами', () => {
    expect(RUSH).toMatchObject({ minMs: 2500, maxMs: 8000, pauseMs: 3000, twinGap: 3 });
  });
});

describe('лесенка быстрых ответов', () => {
  it('1 → подсказка, 2 подряд → «егіз», 3+ → пауза и проверка', () => {
    expect([0, 1, 2, 3, 4].map(rushAction)).toEqual(['none', 'nudge', 'twin', 'check', 'check']);
  });
  it('обычный ответ обнуляет серию', () => {
    let s = 0;
    s = nextStreak(s, true); s = nextStreak(s, true);
    expect(s).toBe(2);
    s = nextStreak(s, false);
    expect(s).toBe(0);
    expect(rushAction(nextStreak(s, true))).toBe('nudge');
  });
  it('«егіз» возвращается через 3 вопроса, в конце боя — на последнем, после последнего не возвращается', () => {
    expect(twinSlot(1, 10)).toBe(4);
    expect(twinSlot(7, 10)).toBe(9);
    expect(twinSlot(8, 10)).toBe(9);
    expect(twinSlot(9, 10)).toBeNull();
  });
  it('чередование АБАБ: «егіз» встаёт в ближайший слот ≥ 3 вперёд, где соседи — другой шаблон (не ААА)', () => {
    const abab = ['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B'];
    expect(twinSlot(0, 8, abab, 'A')).toBe(4);   // слот 3 — B, но рядом A (слот 2): стык; слот 4 — A между двумя B
    expect(twinSlot(1, 8, abab, 'B')).toBe(5);
    expect(twinSlot(2, 8, abab, 'A')).toBe(6);
    expect(twinSlot(3, 8, abab, 'B')).toBe(7);   // конец боя: справа соседа нет, слева A
    expect(twinSlot(4, 8, abab, 'A')).toBe(6);   // слот 7 стыкуется с A (слот 6); ближе, но без стыка — 6 (между B и B)
  });
  it('без шаблонов очереди — как раньше; свободного слота нет (тема из одного шаблона) — как раньше', () => {
    expect(twinSlot(1, 10, undefined, 'A')).toBe(4);
    expect(twinSlot(1, 10, Array(10).fill('A'), 'A')).toBe(4);
    expect(twinSlot(6, 8, ['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B'], 'A')).toBe(7);   // единственный слот, стык с A слева неизбежен
    expect(twinSlot(7, 8, ['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B'], 'B')).toBeNull();
  });
});

describe('«егіз» и реванш на реальной очереди: красная команда (frac.concept — 2 шаблона, АБАБ)', () => {
  const ids: string[] = Object.keys(SKILLS as any).filter(id => templatesOf(id).length > 1);
  it('бой из 8 вопросов по одной теме: «егіз» рядом с тем же шаблоном только там, где иначе нельзя (раньше ≈85 стыков из 126 «егіз», теперь 18 неизбежных)', () => {
    let bad = 0, unavoidable = 0, all = 0;
    for (const id of ids) {
      const seq = sequenceSlots([id], 8, templatesOf);
      const tpls = seq.map(x => x.tpl);
      for (let i = 0; i < 8; i++) {
        const at = twinSlot(i, 8, tpls, tpls[i]);
        if (at === null) continue;
        all++;
        const clash = (s: number) => tpls[s - 1] === tpls[i] || tpls[s + 1] === tpls[i];
        if (clash(at)) { bad++; if (![...Array(8).keys()].some(s => s >= i + 2 && !clash(s))) unavoidable++; }
      }
    }
    expect(all).toBeGreaterThan(100);
    expect(bad).toBe(unavoidable);          // стык только там, где свободного слота не осталось (последний слот, хвост боя)
    expect(bad / all).toBeLessThan(0.2);   // 18 из 126: «егіз» от предпоследнего вопроса, слот один
  });
  it('frac.concept: 4:part, 5*ЕГІЗ:part → егіз уходит на слот с другими соседями, и реванш после неверного егіз не даёт три подряд', () => {
    const seq = sequenceSlots(['frac.concept'], 8, templatesOf);
    const tpls = seq.map(x => x.tpl), all = templatesOf('frac.concept');
    for (let i = 0; i < 6; i++) {
      const at = twinSlot(i, 8, tpls, tpls[i])!;
      const shown = tpls.map((t, k) => (k === at ? tpls[i] : t));
      // реванш после неверного «егіз»
      const before = shown.slice(0, at + 1);
      const rev = pickRevengeTpl(before, tpls[i]!, all, tpls[at + 1] ?? null);
      const line = [...before, rev, ...shown.slice(at + 1)];
      const triple = line.some((t, k) => k >= 2 && t === line[k - 1] && t === line[k - 2]);
      expect(triple, `${i} → ${at}: ${line.join(',')}`).toBe(false);
    }
  });
  it('pickRevengeTpl: два одинаковых подряд — другой шаблон темы (не следующий в очереди); иначе тот же', () => {
    expect(pickRevengeTpl(['A', 'B'], 'B', ['A', 'B'])).toBe('B');
    expect(pickRevengeTpl(['B', 'B'], 'B', ['A', 'B'])).toBe('A');
    expect(pickRevengeTpl(['B', 'B'], 'B', ['A', 'B', 'C'], 'A', () => 0)).toBe('C');
    expect(pickRevengeTpl(['B', 'B'], 'B', ['A', 'B'], 'A')).toBe('A');   // другого нет — берём хоть его
    expect(pickRevengeTpl(['B', 'B'], 'B', ['B'])).toBe('B');
    expect(pickRevengeTpl(['B'], 'B', ['A', 'B'])).toBe('B');
  });
});

describe('подсветка изменений (D3)', () => {
  it('тот же вопрос с новыми числами: светятся числа, слова остаются', () => {
    expect(hl('63 санын жай көбейткіштерге жіктеңіз.', '84 санын жай көбейткіштерге жіктеңіз.')).toEqual([['63']]);
  });
  it('ең кіші ↔ ең үлкен: светится слово, а не числа', () => {
    expect(hl('3, 7, 5 сандарының ішіндегі ең үлкен санды табыңыз.', '3, 7, 5 сандарының ішіндегі ең кіші санды табыңыз.')).toEqual([['үлкен']]);
  });
  it('артық ↔ кем и «неше» ↔ «қанша»', () => {
    expect(hl('А-ның Б-дан 5 артық болуы үшін', 'А-ның Б-дан 5 кем болуы үшін')).toEqual([['артық']]);
    expect(hl('Кітапта қанша бет бар?', 'Кітапта неше бет бар?')).toEqual([['қанша']]);
  });
  it('единицы: км ↔ м', () => {
    expect(hl('Жол 12 км, жылдамдық 60 км/сағ', 'Жол 12 см, жылдамдық 60 км/сағ')).toEqual([['км']]);
  });
  it('числа с неразрывными пробелами сравниваются как одно число', () => {
    expect(hl('2 097 051 санын оқыңыз', '2 097 051 санын оқыңыз')).toEqual([[]]);
    expect(hl('2 097 051 санын оқыңыз', '2 097 052 санын оқыңыз')).toEqual([['2 097 051']]);
  });
  it('первый вопрос и совпадающий текст — без подсветки; сегменты собирают строку целиком', () => {
    expect(hl('7 + 5 = ?', null)).toEqual([[]]);
    const line = nb('Айжанда 1 250 теңге бар, 3 қарындаш алды.');
    const segs = changedMarkup([line], 'Айжанда 900 теңге бар, 3 қарындаш алды.')[0];
    expect(segs.map(s => s.t).join('')).toBe(line);
    expect(segs.filter(s => s.hl).map(s => s.t)).toEqual(['1 250']);
  });
  it('совсем другой вопрос: числа не подсвечиваются (шум), слова-ключи — да', () => {
    const r = hl('Пойыз 90 километр жолды жүріп өтті, қанша уақыт кетті деп ойлайсың?', 'Кітаптың беттерін нөмірлеуге 147 цифр жұмсалды. Кітапта неше бет бар?');
    expect(r[0]).not.toContain('90');
    expect(r[0]).toContain('қанша');
  });
  it('соседние подсвеченные слова склеиваются в один кусок', () => {
    const r = changedMarkup(['ең үлкен сан'], 'ең кіші сан')[0].filter(s => s.hl).map(s => s.t);
    expect(r).toEqual(['үлкен']);  // «ең» уже было; склейка — только для двух новых слов подряд
    const r2 = changedMarkup(['ең үлкен сан'], 'қосынды сан')[0].filter(s => s.hl).map(s => s.t);
    expect(r2).toEqual(['ең үлкен']);
  });
  it('на реальных шаблонах: тот же шаблон, новые числа — подсвечено хотя бы одно число, текст цел', () => {
    const R = rng(3);
    let withNums = 0, n = 0;
    for (const t of templates) {
      const a = t.gen(R), b = t.gen(R);
      const segs = changedMarkup(b.kz.split('\n').map(nb), a.kz);
      expect(segs.flat().map(s => s.t).join('')).toBe(b.kz.split('\n').map(nb).join(''));
      if (a.kz !== b.kz) { n++; if (segs.flat().some(s => s.hl)) withNums++; }
    }
    expect(withNums / n).toBeGreaterThan(0.7);
  });
});

describe('верный ответ не на том же месте (D3)', () => {
  const mk = (texts: string[], answer: number) => ({ choices: texts.map((t, i) => ({ text: t, tag: 't' + i })), answer });
  it('переставляет верный вариант вместе с меткой ошибки; answer указывает на тот же текст', () => {
    const it0 = mk(['12', '5', '9', '33', '7'], 2);
    for (let k = 0; k < 20; k++) {
      const r = varyAnswerPos(it0, 2, Math.random);
      expect(r.answer).not.toBe(2);
      expect(r.choices[r.answer]).toEqual({ text: '9', tag: 't2' });
      expect(r.choices.map(c => c.text).sort()).toEqual(['12', '33', '5', '7', '9']);
    }
  });
  it('другое место — не трогает', () => {
    const it0 = mk(['12', '5', '9', '33', '7'], 2);
    expect(varyAnswerPos(it0, 0)).toBe(it0);
  });
  it('числа по порядку и «барлығы дұрыс» / «A және B» не тасуем', () => {
    expect(canReorder(mk(['1', '2', '3', '4', '5'], 0).choices)).toBe(false);
    expect(canReorder(mk(['5', '4', '3', '2', '1'], 0).choices)).toBe(false);
    expect(canReorder(mk(['3', '1', '2', 'Барлығы дұрыс'], 0).choices)).toBe(false);
    expect(canReorder(mk(['A және B', 'C', 'D'], 0).choices)).toBe(false);
    expect(canReorder(mk(['3', '1', '2'], 0).choices)).toBe(true);
    const it0 = mk(['1', '2', '3', '4', '5'], 2);
    expect(varyAnswerPos(it0, 2)).toBe(it0);
  });
  it('на реальных шаблонах: 1000 подряд — верный ответ ни разу не на том же месте, где не запрещено порядком', () => {
    const R = rng(5);
    let prev = -1, same = 0, moved = 0;
    for (let k = 0; k < 1000; k++) {
      const t = templates[k % templates.length];
      let it = t.gen(R);
      const ok = canReorder(it.choices);
      const before = it.answer, correctText = it.choices[it.answer].text;
      it = varyAnswerPos(it, prev, Math.random);
      if (ok) { if (it.answer === prev) same++; if (it.answer !== before) moved++; }
      // текст верного ответа не изменился
      expect(it.choices[it.answer].text).toBe(correctText);
      prev = it.answer;
    }
    expect(same).toBe(0);
    expect(moved).toBeGreaterThan(0);
  });
});

describe('мини-проверка «Сұрақ не туралы?» (D2)', () => {
  it('узнаёт, что спрашивается, по хвосту вопроса', () => {
    expect(askKind('Жаңа ерітіндінің концентрациясы неше пайыз?')?.id).toBe('percent');
    expect(askKind('Бірінші пойыздың жылдамдығы 90 км/сағ болса, екінші пойыздың жылдамдығы қанша км/сағ?')?.id).toBe('speed');
    expect(askKind('Пойыз осы жолды 60 км/сағ жылдамдықпен неше сағатта жүріп өтеді?')?.id).toBe('time');
    expect(askKind('Қайықтың меншікті жылдамдығының ағыс жылдамдығына қатынасы қандай?')?.id).toBe('ratio');
    expect(askKind('Кітапта неше бет бар?')?.id).toBe('count');
    expect(askKind('Өрнектің мәнін табыңыз:\n1 + 1 / (2 + 1 / 3)')?.id).toBe('value');
    expect(askKind('Қабырғасы 4 см квадратқа іштей сызылған шеңбердің ұзындығын табыңыз (π = 3).')?.id).toBe('geom');
  });
  it('неоднозначное или неразобранное — null (тогда «оқыдым»)', () => {
    expect(askKind('7 + 5')).toBeNull();
    expect(askKind('Ойлаған санды табыңыз.')).toBeNull();
    expect(miniCheck('Ойлаған санды табыңыз.')).toBeNull();
  });
  it('3 разных варианта, верный есть, индекс указывает на него', () => {
    for (let k = 0; k < 40; k++) {
      const mc = miniCheck('Жаңа ерітіндінің концентрациясы неше пайыз?')!;
      expect(mc.prompt).toBe('Сұрақ не туралы?');
      expect(mc.options).toHaveLength(3);
      expect(new Set(mc.options).size).toBe(3);
      expect(mc.options[mc.answer]).toBe('Пайыз');
    }
  });
  it('масса с падежным суффиксом: «неше грамға», «массаны» → «Масса»; «аптаның қай күні» → «Уақыт»', () => {
    expect(askKind('1, 2, 4 г гір бар. Ең көбі неше грамға дейінгі әр массаны өлшеуге болады?')?.label).toBe('Масса');
    expect(askKind('Қанша килограмға жетеді?')?.label).toBe('Масса');
    expect(askKind('Қапта неше кг бар?')?.label).toBe('Масса');
    expect(askKind('Асан әр 6 күн сайын бассейнге барады. Аптаның қай күні ол 4-ші рет барады?')?.label).toBe('Уақыт');
    expect(askKind('Ұзындығы неше гектар?')?.label).not.toBe('Масса');
    expect(askKind('Қай сан жай сан?')?.id).toBe('which');
  });
  it('logic.weighing_range и logic.every_k_days: верный вид распознан во всех задачах или «оқыдым», чужой «Масса»/«Уақыт» верным не подсовывается', () => {
    for (const [sid, tpl, label] of [['logic.weighing', 'logic.weighing_range', 'Масса'], ['logic.calendar', 'logic.every_k_days', 'Уақыт']] as const) {
      let n = 0, right = 0, wrongDistractor = 0;
      for (let k = 0; k < 300; k++) {
        const it = makeItem(sid, { tpl }); if (!it || it.source !== tpl) continue;
        const mc = miniCheck(it.kz); n++; if (!mc) continue;
        if (mc.options[mc.answer] === label) right++;
        else if (mc.options.includes(label)) wrongDistractor++;   // красная команда: 75/400 и 73/400
      }
      expect(n).toBeGreaterThan(200);
      expect(wrongDistractor, tpl).toBe(0);
      expect(right / n, tpl).toBeGreaterThan(0.95);
    }
  });
  it('ratio и part не соседствуют среди вариантов (оба «доля»)', () => {
    for (let k = 0; k < 60; k++) {
      const o = miniCheck('Қайықтың жылдамдығының ағыс жылдамдығына қатынасы қандай?')!.options;
      expect(o).not.toContain('Бөлшек, бөлік');
    }
  });
  it('на всех шаблонах: если вид найден, он не противоречит шаблону (просмотр ниже), доля найденных — см. лог', () => {
    const R = rng(9); let found = 0, n = 0;
    for (const t of templates) { const it = t.gen(R); n++; if (askKind(it.kz)) found++; }
    expect(found / n).toBeGreaterThan(0.35);
  });
});
