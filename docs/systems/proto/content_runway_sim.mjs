import { LESSONS } from '../../../content/lessons.mjs';
import { QUEUE } from './queue_draft.mjs';
export const READY = { // готово = смержено + озвучено (пятница недели PR)
 'dec.concept':'2026-10-09','dec.compare_round':'2026-10-09','dec.add_sub':'2026-10-09','dec.mul_div':'2026-10-09','dec.frac_convert':'2026-10-09',
 'div.last_digit':'2026-10-16','logic.deduction':'2026-10-16','logic.new_operation':'2026-10-16','pat.bracket':'2026-10-16','logic.clock_angle':'2026-10-16',
 'expr.variables':'2026-10-23','eq.linear_basic':'2026-10-23','eq.two_step':'2026-10-23','eq.both_sides_nat':'2026-10-30','eq.brackets_nat':'2026-10-30',
 'word.part_whole':'2026-11-06','word.compare':'2026-11-13','word.sum_diff':'2026-11-13','word.distribution':'2026-11-20','word.age':'2026-11-20','geo.perimeter':'2026-11-20',
 'word.parts_successive':'2026-11-27','geo.area_rect':'2026-11-27','geo.area_grid':'2026-11-27',
};
const ids = QUEUE.map(q=>q.id);
const start=new Date('2026-10-05');
for (let w=0; w<=12; w++){ const d=new Date(start.getTime()+w*7*864e5); const ds=d.toISOString().slice(0,10); const pace=+(process.argv[2]||3); const child=Math.min(5+pace*Math.min(w,8)+3*Math.max(0,w-8), 150);
  let k=child; while(k<ids.length && (LESSONS[ids[k]] || (READY[ids[k]] && READY[ids[k]]<=ds))) k++;
  console.log(ds,'child#',child,ids[child],'| first missing #',k,ids[k],'runway wk',((k-child)/3).toFixed(1)); }
console.log(ids.slice(0,60).map((x,i)=>i+':'+x+(LESSONS[x]?'':'*')).join(' '));
