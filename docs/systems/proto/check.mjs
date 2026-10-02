import { skills } from '../../../content/skills.mjs';
import { LESSONS } from '../../../content/lessons.mjs';
import { QUEUE, NEW_SKILLS, PREREQ_FIX } from './queue_draft.mjs';
const pre = Object.fromEntries(skills.map(s=>[s.id, s.prereqs]));
for (const [id,,,,,p] of NEW_SKILLS) pre[id]=p; Object.assign(pre, PREREQ_FIX);
const all = new Set(Object.keys(pre));
const ids = QUEUE.map(q=>q.id); const seen=new Set(); let bad=0;
const dup = ids.filter((x,i)=>ids.indexOf(x)!==i); if(dup.length){console.log('dup',dup);bad++}
const unknown = ids.filter(x=>!all.has(x)); if(unknown.length){console.log('unknown',unknown);bad++}
const missing=[...all].filter(x=>!ids.includes(x)); if(missing.length){console.log('missing',missing);bad++}
ids.forEach((id,i)=>{ for(const p of pre[id]||[]) if(!seen.has(p)){console.log('prereq after',id,'<-',p);bad++} seen.add(id)});
// existing lessons order preserved?
const ex = ids.filter(x=>LESSONS[x]); console.log('existing in queue', ex.length);
const per={}; for(const q of QUEUE){per[q.ph]=(per[q.ph]||0)+1} console.log(per);
const newL = ids.filter(x=>!LESSONS[x]); console.log('new lessons', newL.length, 'total', ids.length);
// child dates: start index 5 at 2026-10-05, pace 3/wk and 2.5/wk (weekdays continuous)
const start=new Date('2026-10-05'); const at=(k,pace)=>{const w=(k-5)/pace; const d=new Date(start.getTime()+w*7*864e5); return d.toISOString().slice(0,10)};
for (const k of [5,17,29,41,53,65,77,89,101,113,125,137,143,ids.length-1]) console.log(k, ids[k], at(k,3), at(k,2.5));
console.log(bad?'BAD':'OK');
