// прототип движка минут (решение 4) — проверка рабочих примеров
const V={right:1,dunno:0,rush:0,wrong:-0.25,away:-0.25};
const NEED={wrong:2,away:2,dunno:1,rush:1};
function bar(slots,debts,N){let s=0;for(const x of slots)s+=V[x.kind];for(const d of debts)s+=(1-V[d.kind])*Math.min(d.got,d.need)/d.need;return 60*Math.max(0,Math.min(1,s/Math.max(N,slots.length)));}
function day({N,errs=0,dunno=0,rushWrong=0,repairOk=Infinity,repairWrong=0,tS=50,twinS=45,lessonMin=10}){
  const slots=[];for(let i=0;i<N;i++)slots.push({kind:i<errs?'wrong':i<errs+dunno?'dunno':i<errs+dunno+rushWrong?'wrong':'right',rush:i>=errs+dunno&&i<errs+dunno+rushWrong});
  const debts=slots.filter(s=>NEED[s.kind]).map(s=>({kind:s.kind,need:NEED[s.kind],got:0}));
  let honest=lessonMin*60+slots.filter(s=>!s.rush).length*tS; const b0=bar(slots,debts,N);
  let tw=0,wr=0,capHit=false;
  for(const d of debts){while(d.got<d.need){ if(honest>=50*60){capHit=true;break;} if(wr<repairWrong){wr++;honest+=twinS;continue;} if(tw>=repairOk)break; d.got++;tw++;honest+=twinS;} if(capHit)break;}
  const left=debts.reduce((a,d)=>a+d.need-d.got,0);
  const b=bar(slots,debts,N);
  return {bar0:+b0.toFixed(1),bar:+b.toFixed(1),credited:capHit?60:Math.round(b),twins:tw,left,honestMin:+(honest/60).toFixed(1),capHit};
}
console.log('1 err',day({N:24,errs:1}));
console.log('8 err',day({N:24,errs:8}));
console.log('8 err, 3 wrong twins',day({N:24,errs:8,repairWrong:3}));
console.log('15 deliberate rushed',day({N:24,rushWrong:15}));
console.log('15 deliberate slow',day({N:24,errs:15}));
console.log('15 deliberate rushed, quits repair',day({N:24,rushWrong:15,repairOk:0}));
console.log('honest 0 errs',day({N:24}));
console.log('3 dunno',day({N:24,dunno:3}));
