// Атаки на движок минут (решение 4) — модель по day.md
const V={right:1,dunno:0,rush:0,wrong:-0.25,away:-0.25};
const NEED={wrong:2,away:2,dunno:1,rush:1};
const CAP=50*60, TASK=180, STEP=120;
function bar(slots,debts,N){let s=0;for(const x of slots)s+=V[x];for(const d of debts)s+=(1-V[d.k])*Math.min(d.got,d.need)/d.need;return 60*Math.max(0,Math.min(1,s/Math.max(N,slots.length)));}
// сценарий: шаги не-задачи (урок и т.п.) секундами, потом слоты [{k, t}], потом ремонт [{ok, t}]
function run(name,{steps=[],slots=[],twins=[],N=24,wallExtra=0}){
  let h=0, wall=wallExtra, capAt=null; const S=[],D=[];
  const add=(t,lim)=>{h+=Math.min(t,lim);wall+=t; if(capAt===null&&h>=CAP)capAt=wall;};
  for(const st of steps)add(st.t,STEP);
  for(const s of slots){ if(capAt!==null)break; S.push(s.k); if(s.k!=='rush'&&s.k!=='away')add(s.t,TASK); else wall+=s.t; if(NEED[s.k])D.push({k:s.k,need:NEED[s.k],got:0,expl:s.k==='dunno'}); }
  let ti=0; for(const d of D){ if(capAt!==null)break; if(d.expl){add(40,STEP);} while(d.got<d.need&&ti<twins.length&&capAt===null){const tw=twins[ti++]; add(tw.t,TASK); if(tw.ok)d.got++;} }
  const b=bar(S,D,N); const credit=capAt!==null?60:Math.round(b);
  const right=S.filter(k=>k==='right').length;
  console.log(name.padEnd(46),`кредит ${String(credit).padStart(2)}  ${capAt!==null?'CAP':'   '}  честн ${(h/60).toFixed(1)}  стена ${(wall/60).toFixed(1)} мин  верных ${right}/${S.length}`);
}
const rep=(n,o)=>Array.from({length:n},()=>({...o}));
const lesson=rep(12,{t:30}), lessonStall=rep(12,{t:120});
run('честный 50с, 3 ошибки',{steps:lesson,slots:[...rep(3,{k:'wrong',t:50}),...rep(21,{k:'right',t:50})],twins:rep(6,{ok:true,t:45})});
run('СТОЙКА: урок по 120с + все задачи неверно 179с',{steps:[...lessonStall,...rep(4,{t:120})],slots:rep(24,{k:'wrong',t:179})});
run('СТОЙКА без урока (Вт): 24×неверно 179с',{steps:rep(4,{t:120}),slots:rep(24,{k:'wrong',t:179}),twins:rep(40,{ok:false,t:179})});
run('ВСЁ «Білмеймін» 1,5с + близнец после разбора',{steps:lesson,slots:rep(24,{k:'dunno',t:1.5}),twins:rep(24,{ok:true,t:40})});
run('ПОДСКАЗКА-1 + угадывание 4 вар. (6с)',{steps:lesson,slots:Array.from({length:24},(_,i)=>({k:i%4===0?'right':'wrong',t:6})),twins:Array.from({length:60},(_,i)=>({ok:i%4===0,t:6}))});
// честный медленный читатель: задача 95с, близнец 85с, урок 12 шагов по 70с, 8 ошибок; ворота/анимации/переходы ~+12с на задачу вне честного
run('МЕДЛЕННЫЙ честный: 95с, 8 ошибок',{steps:rep(12,{t:70}),slots:[...rep(8,{k:'wrong',t:95}),...rep(16,{k:'right',t:95})],twins:rep(16,{ok:true,t:85}),wallExtra:24*12+16*10+300});
run('МЕДЛЕННЫЙ+беглый: 8 верных «наспех»',{steps:rep(12,{t:70}),slots:[...rep(4,{k:'wrong',t:95}),...rep(8,{k:'rush',t:4}),...rep(12,{k:'right',t:95})],twins:rep(16,{ok:true,t:85}),wallExtra:24*12+16*10+300});
run('СРЕДНИЙ честный 60с, 6 ошиб., звонок=away',{steps:lesson,slots:[...rep(6,{k:'wrong',t:60}),{k:'away',t:60},...rep(17,{k:'right',t:60})],twins:rep(14,{ok:true,t:50})});
