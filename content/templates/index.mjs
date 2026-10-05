// Все шаблоны задач. Каждый шаблон: { id, examType, skills, from, difficulty, title{kz,ru}, gen(rng) }.
import compute from './compute.mjs';
import equations from './equations.mjs';
import propPct from './proportion_percent.mjs';
import wordGeo from './word_geometry.mjs';
import logic from './logic.mjs';
import g5 from './grade5_basics.mjs';
import fractions5 from './fractions5.mjs';
import fractions6 from './fractions6.mjs';
import logic5 from './logic5.mjs';
import logic7 from './logic7.mjs';
import logic8 from './logic8.mjs';
import decimals from './decimals.mjs';
import logic9 from './logic9.mjs';

export const templates = [...g5, ...compute, ...equations, ...propPct, ...wordGeo, ...logic, ...fractions5, ...fractions6, ...logic5, ...logic7, ...logic8, ...decimals, ...logic9];
export const byId = Object.fromEntries(templates.map(t => [t.id, t]));
