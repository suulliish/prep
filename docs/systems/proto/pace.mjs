// Темп по решениям 02.10: без каникул (болезнь ~3% будней), новые темы Пн/Ср/Чт до 15.11.2027 (Чт — если две предыдущие үйренді),
// уроки: 36 + 3/нед; уровень 5 — мини-пробник по пятницам с 1.12.2026 и пробники арены с 1.09.2027. Монеты — по DESIGN §6.
export const START='2026-10-05', SWITCH='2026-11-30', EXAM='2028-05-15';
export const nextDay=d=>{const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+1);return t.toISOString().slice(0,10)};
export const dow=d=>new Date(d+'T12:00:00Z').getUTCDay();
export const WORLD_AT=[0,40,100,160,220,300,380,460,540,600,660];
export const MS=(()=>{const a=[];for(let v=10;v<=100;v+=10)a.push(v);for(let v=120;v<=620;v+=20)a.push(v);for(let v=630;v<=700;v+=10)a.push(v);for(let v=705;v<=725;v+=5)a.push(v);return a})();
const ARENA=(()=>{const a=[];// полные пробники: раз в месяц с сент. 2027, с янв. 2028 раз в 2 недели, последние 3 недели — без
  for(let d='2027-09-04';d<='2028-04-24';d=nextDay(d)){ if(dow(d)!==6)continue; const day=+d.slice(8);
    if(d<'2028-01-01'){ if(day<=7)a.push(d)} else { const k=Math.round((Date.parse(d)-Date.parse('2028-01-08'))/864e5/7); if(k>=0&&k%2===0)a.push(d)} } return new Set(a)})();
export function run(seed,{p=0.85,sick=0.03,bossWin=0.55}={}){
  let s=seed*7919+13;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
  const gaps=[0,0,2,5,15,42]; const RATE=[0,3,5,8,10,15];
  const T=[];let n=0,lessons=36,taught=0;const out=[];let coins=0, cleared=0, bossOpenN=-1, worldMax=0, honest=0;
  const ev={lvl:0,maint:0,crack:0,boss:0,mini:0,arena:0};
  for(let d=START;d<=EXAM;d=nextDay(d)){
    const w=dow(d); let day={d,earn:0};
    if(w===6&&ARENA.has(d)&&d>='2027-09-01'){ // пробник арены: часть тем 4→5, 20 монет
      coins+=20;ev.arena+=20;day.earn+=20; for(const t of T) if(t.lvl===4&&rnd()<0.25&&rnd()<p){t.lvl=5;coins+=RATE[5];ev.lvl+=15;day.earn+=15;t.due=n+40}
    }
    if(w===0||w===6){out.push({...day,level:T.reduce((a,t)=>a+t.lvl,0),coins,taught,cleared,honest});continue}
    if(w===1) lessons+=3;
    if(rnd()<sick){out.push({...day,level:T.reduce((a,t)=>a+t.lvl,0),coins,taught,cleared,honest});continue}
    n++; honest+= rnd()<0.92?1:0;
    const newOk = d<='2027-11-15' && taught<Math.min(145,lessons) && (w===1||w===3||(w===4&&rnd()<0.75));
    if(newOk){taught++;T.push({lvl:1,due:n+gaps[2]});coins+=RATE[1];ev.lvl+=3;day.earn+=3}
    for(const t of T){ if(t.due<0||t.due>n)continue;
      if(t.cr){ if(rnd()<p){t.cr=false; if(n-(t.rep??-99)>=20){coins+=3;ev.crack+=3;day.earn+=3;t.rep=n} t.due=n+Math.max(3,Math.round((gaps[t.lvl+1]||40)/2))} else t.due=n+1; continue}
      if(t.lvl===4){ if(d>='2026-12-01'&&w===5&&rnd()<0.35){ if(rnd()<0.8){t.lvl=5;coins+=15;ev.lvl+=15;day.earn+=15;t.due=n+40}else t.due=n+5} else t.due=n+1; continue}
      if(t.lvl>=5){ if(rnd()<0.9){coins+=4;ev.maint+=4;day.earn+=4} else {t.cr=true;t.due=n+1;continue} t.due=n+40;continue}
      const ok1=rnd()<p, ok2=rnd()<p;
      if(ok1&&ok2){t.lvl++;coins+=RATE[t.lvl];ev.lvl+=RATE[t.lvl];day.earn+=RATE[t.lvl];t.due=n+(gaps[t.lvl+1]??1)}
      else if(ok1||ok2){t.due=n+2} else if(rnd()<0.6){t.cr=true;t.due=n+1} else t.due=n+2;
    }
    if(w===5&&d>='2026-12-01'){coins+=5;ev.mini+=5;day.earn+=5}
    const level=T.reduce((a,t)=>a+t.lvl,0);
    while(worldMax<10&&level>=WORLD_AT[worldMax+1]){worldMax++; }
    // босс мира cleared+? : доступен после ~8 учебных дней в мире (≥4 родных темы), одна попытка в день после плана
    if(cleared<=worldMax && cleared<11){ const wOpenDay = (out.find(o=>o.worldMax>=cleared)?.n) ?? 0;
      if(n - wOpenDay >= 8 && rnd()<0.6 && rnd()<bossWin){cleared++;coins+=45;ev.boss+=45;day.earn+=45} }
    out.push({...day,n,level,coins,taught,cleared,worldMax,honest});
  }
  return {out,ev};
}
