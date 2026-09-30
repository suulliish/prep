// Урок = тренировка (docs/GAME_LOOP.md 19): в Lesson.svelte нет врага, здоровья и его атак; каждый тип шага зовёт своё действие площадки; мир и арена их предоставляют.
// Проверка по тексту исходников: экран нельзя собрать без браузера, а поведение самой арены проверяет tests/arena_training.test.ts.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
// @ts-ignore
import { TECHNIQUES } from '../content/techniques.mjs';

const read = (f: string) => fs.readFileSync(path.resolve(f), 'utf8');
const lesson = read('src/screens/Lesson.svelte'), world = read('src/three/world.ts'), arena = read('src/three/arena.ts'), session = read('src/screens/Session.svelte');

describe('Lesson.svelte: тренировка вместо боя', () => {
  it('нет врага, полоски вируса, атак врага и сундука', () => {
    for (const bad of ['spawnMob', 'heroAttack', 'enemyAttack', 'killMob', 'openChest', 'Вирус']) expect(lesson.includes(bad), bad).toBe(false);
  });
  it('вход ставит площадку, музыка «тренировка», доска пишет приём', () => {
    expect(lesson).toContain('setTraining(true)'); expect(lesson).toContain("audio.setMood('training')"); expect(lesson).toContain('Бүгінгі тәсіл: ');
  });
  it('каждый тип шага зовёт своё действие', () => {
    for (const call of ["trainStrike('strong', 1, false, strikeN++)", "trainStrike('light')", 'trainBlock()', 'trainBonk()', "trainStrike('combo', k", 'trainVictory()', 'trainMastered(tech.color)', 'trainStep(s.type)', 'trainBreakGlitch()', 'trainGlitch(', 'trainTargets(', 'trainTargetHit()', 'trainBoard('])
      expect(lesson.includes(call), call).toBe(true);
  });
  it('карточка приёма после «Есте сақта», подпись полоски по-казахски, кнопки без «Соққы беру»', () => {
    expect(lesson).toContain('<TechCard'); expect(lesson).toContain('aria-label="Тәсіл"'); expect(lesson).not.toContain('Соққы беру');
    expect(lesson).toContain('Тәсіл меңгерілді');
  });
  it('новые фразы (на проверку носителем) на месте и без длинного тире', () => {
    const src = [lesson, read('src/lesson/TechCard.svelte')].join('\n');
    for (const ph of ['Бүгінгі тәсіл: ', 'бүгін жаттығу алаңындамыз! Соңында', 'тәсілін меңгересің.', 'Жаңа тәсіл!', 'Түртіп жалғастыр', 'Жаттығуды бастау', 'Соңғы сынақ', 'Соңғы сынақ! Үйренгеніңді көрсет: дұрыс жауапты таңда.', 'Жаттығу әлі аяқталған жоқ! Сабақта не үйрендік? Тағы тексер.', 'Тәсіл меңгерілді', 'МЕҢГЕРІЛДІ!']) {
      expect(src, ph).toContain(ph); expect(ph.includes('—'), ph).toBe(false);
    }
  });
  it('ИИ-помощник подключён под карточкой шага', () => { expect(lesson).toContain('<LessonHelper ctx={lessonCtx} />'); });
});

describe('мир и арена', () => {
  it('методы тренировки есть в интерфейсе мира, реализации и арене', () => {
    for (const m of ['setTraining', 'trainStrike', 'trainBonk', 'trainGlitch', 'trainBreakGlitch', 'trainTargets', 'trainTargetHit', 'trainTargetMiss', 'trainBoard', 'trainCheer', 'trainStep', 'trainBlock', 'trainMastered', 'trainVictory']) {
      expect(world.match(new RegExp(`\\b${m}\\(`, 'g'))!.length, `world ${m}`).toBeGreaterThanOrEqual(2);
      expect(arena, `arena ${m}`).toContain(m);
    }
  });
  it('Session передаёт приём только для пройденной темы', () => {
    expect(session).toContain('heroAttack(crit, sup, techFor(item?.skill))'); expect(session).toContain('st?.lessonDone || isDone(st)');
  });
  it('у каждого приёма цвет и вид удара из известных', () => {
    for (const t of TECHNIQUES) { expect(['arc', 'pierce', 'split', 'multi', 'spin']).toContain(t.fx); expect(arena).toContain(t.fx === 'arc' ? "'arc'" : `'${t.fx}'`); }
  });
});
