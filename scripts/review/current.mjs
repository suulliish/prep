// Актуальное состояние уроков и генераторов для проверки казахского: хэши, куски, тексты. Читает content/, ничего не пишет.
import { LESSONS } from '../../content/lessons.mjs';
import { skillById } from '../../content/skills.mjs';
import { techniqueOf } from '../../content/techniques.mjs';
import { templates } from '../../content/templates/index.mjs';
import { lessonChunks, lessonHash, templateSamples } from './lib.mjs';

/** Тексты вне шагов урока, которые ребёнок видит в уроке: название темы и название приёма (доска, реплика Бита, карточка приёма). */
export function extrasFor(skill) {
  const out = [], title = skillById[skill]?.title?.kz, tech = techniqueOf(skill)?.kz;
  if (title) out.push({ id: 'skill:title', step: -1, type: 'skill', text: title });
  if (tech) out.push({ id: 'tech:kz', step: -1, type: 'tech', text: tech });
  return out;
}
export const chunksOf = skill => lessonChunks(skill, LESSONS[skill], extrasFor(skill));

/** { lessons: { id: { h, chunks: [id], text: { id: текст } } }, generators: { id: h }, hashes: { id: h } (всё вместе для kz_review.json) }. */
export function current() {
  const lessons = {}, generators = {}, hashes = {};
  const byTpl = Object.fromEntries(templates.map(t => [t.id, t]));
  for (const skill of Object.keys(LESSONS)) {
    const chunks = chunksOf(skill), h = lessonHash(chunks);
    lessons[skill] = { h, chunks: chunks.map(c => c.id), text: Object.fromEntries(chunks.map(c => [c.id, c.text])) };
    hashes[skill] = h;
    for (const t of skillById[skill]?.templates ?? []) if (byTpl[t] && generators[t] === undefined) { generators[t] = templateSamples(byTpl[t]).h; hashes[t] = generators[t]; }
  }
  return { lessons, generators, hashes };
}
