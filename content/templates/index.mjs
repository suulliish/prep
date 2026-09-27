// Все шаблоны задач. Каждый шаблон: { id, examType, skills, from, difficulty, title{kz,ru}, gen(rng) }.
import compute from './compute.mjs';
import equations from './equations.mjs';
import propPct from './proportion_percent.mjs';
import wordGeo from './word_geometry.mjs';
import logic from './logic.mjs';

export const templates = [...compute, ...equations, ...propPct, ...wordGeo, ...logic];
export const byId = Object.fromEntries(templates.map(t => [t.id, t]));
