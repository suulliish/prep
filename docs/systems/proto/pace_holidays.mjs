// Реалистичный темп: новые темы 2,5/нед (лето 1,5/нед), уроки растут 2,5/нед до 145; отдых в каникулы.
const START='2026-09-28', EXAM='2028-05-15';
const nextDay=d=>{const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+1);return t.toISOString().slice(0,10)};
const isWd=d=>{const w=new Date(d+'T12:00:00Z').getUTCDay();return w>=1&&w<=5};
const REST=[['2026-10-26','2026-11-01'],['2026-12-29','2027-01-08'],['2027-03-20','2027-03-28'],['2027-06-01','2027-06-14'],['2027-08-09','2027-08-22'],['2027-10-25','2027-10-31'],['2027-12-29','2028-01-08'],['2028-03-20','2028-03-28']];
const rest=d=>REST.some(([a,b])=>d>=a&&d<=b);
const summer=d=>d>='2027-06-01'&&d<='2027-08-31';
function run(seed,p=0.85){
  let s=seed*7919+13;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
  const gaps=[0,0,2,5,15,42], crack=0.12;
  const T=[];let n=0,credit=0,lessonsF=36,taught=0,coins=0;const out=[];
  const RATE=[0,3,5,8,10,15];
  for(let d=START;d<=EXAM;d=nextDay(d)){
    if(!isWd(d))continue;
    if(rest(d)){out.push({d,level:T.reduce((a,t)=>a+t.lvl,0),coins});continue}
    n++;
    lessonsF=Math.min(145,lessonsF+(d<'2028-02-01'?2.5/5:0));
    const pace=d>='2028-02-01'?0:summer(d)?1.5:2.5;
    credit+=pace/5;
    if(credit>=1&&taught<Math.floor(lessonsF)){credit-=1;taught++;T.push({lvl:1,due:n+gaps[2]});coins+=RATE[1]}
    for(const t of T){ if(t.due<0||t.due>n)continue;
      if(t.cr){ if(rnd()<p){t.cr=false;coins+=3;t.due=n+Math.max(3,Math.round((gaps[t.lvl+1]||40)/2))} else t.due=n+1; continue}
      if(t.lvl===4){ // уровень 5 — только на пробнике: мини-пробник по пятницам с декабря 2026, берём ~2 темы/нед
        if(d>='2026-12-01'&&new Date(d+'T12:00:00Z').getUTCDay()===5&&rnd()<0.35){ if(rnd()<0.8){t.lvl=5;coins+=RATE[5];t.due=n+40}else t.due=n+5}
        else t.due=n+1; continue }
      if(t.lvl>=5){coins+=4;t.due=n+40;continue}
      const ok1=rnd()<p, ok2=rnd()<p;
      if(ok1&&ok2){t.lvl++;coins+=RATE[t.lvl];t.due=n+(gaps[t.lvl+1]??1)}
      else if(ok1||ok2){t.due=n+2}
      else if(rnd()<0.6){t.cr=true;t.due=n+1} else t.due=n+2;
    }
    out.push({d,level:T.reduce((a,t)=>a+t.lvl,0),coins,taught});
  }
  return out;
}
const R=40, runs=Array.from({length:R},(_,i)=>run(i+1));
const L=runs[0].map((x,k)=>({d:x.d,level:runs.reduce((a,r)=>a+r[k].level,0)/R,coins:runs.reduce((a,r)=>a+r[k].coins,0)/R,taught:runs[0][k].taught}));
const months={};for(const x of L)months[x.d.slice(0,7)]=x;
for(const [m,x] of Object.entries(months))console.log(m,Math.round(x.level),Math.round(x.coins),x.taught);
const MS=[];for(let v=10;v<=100;v+=10)MS.push(v);for(let v=120;v<=620;v+=20)MS.push(v);for(let v=630;v<=700;v+=10)MS.push(v);for(let v=705;v<=725;v+=5)MS.push(v);
const when=v=>{const x=L.find(y=>y.level>=v);return x?x.d:'—'};
console.log('worlds candidates');for(const v of [40,100,160,220,300,380,460,540,600,660])console.log(v,when(v));
let last=null,gapsW=[];for(const v of MS){const w=when(v);if(w!=='—'&&last){gapsW.push((new Date(w)-new Date(last))/864e5)}if(w!=='—')last=w}
gapsW.sort((a,b)=>a-b);console.log('milestones reached',MS.filter(v=>when(v)!=='—').length,'median gap days',gapsW[Math.floor(gapsW.length/2)],'max',gapsW.at(-1));
