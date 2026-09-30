// Проверка виджетов без входа (только для разработки): widgets.html?w=FractionCircle&props={"target":{"n":3,"d":4}}
// Кроме виджетов из src/widgets можно открыть Frac, MathLine (props {"text":"2 3/4 + [1/2] = ▢"}) и Tiles ({"math":"..."}).
// Когда виджет вызвал ondone, в углу появится «DONE», а window.__done станет числом вызовов.
import { mount } from 'svelte';
import '../app.css';
import Frac from '../ui/Frac.svelte';
import MathLine from '../lesson/MathLine.svelte';
import Tiles from '../lesson/scenes/Tiles.svelte';

const mods = import.meta.glob('../widgets/*.svelte', { eager: true }) as Record<string, { default: any }>;
const comps: Record<string, any> = { Frac, MathLine, Tiles };
for (const [p, m] of Object.entries(mods)) comps[p.split('/').pop()!.replace('.svelte', '')] = m.default;

const q = new URLSearchParams(location.search);
const name = q.get('w') || 'FractionCircle';
let props: Record<string, any> = {};
try { props = JSON.parse(q.get('props') || '{}'); } catch (e) { document.getElementById('done')!.textContent = 'bad props json'; }
const w = window as any; w.__done = 0;
const ondone = (...a: any[]) => { w.__done++; w.__doneArgs = a; document.getElementById('done')!.textContent = 'DONE'; };

const box = document.getElementById('root')!;
if (name in comps && !['Frac', 'MathLine', 'Tiles'].includes(name)) {
  // так же оформлено в уроке (Lesson.svelte .widget)
  box.style.cssText = 'background:var(--deep);border:3px solid var(--outline);padding:14px 8px;border-radius:16px;max-width:520px;margin:0 auto';
  mount(comps[name], { target: box, props: { ...props, ondone } });
} else if (name in comps) {
  box.style.cssText = 'background:var(--paper);color:var(--paper-ink);padding:14px;border-radius:14px;max-width:520px;margin:0 auto';
  mount(comps[name], { target: box, props });
} else box.textContent = `нет виджета ${name}; есть: ${Object.keys(comps).join(', ')}`;
