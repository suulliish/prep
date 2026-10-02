import {run} from './pace.mjs';
import {RESERVE,ALL as ALL0,OLD,UPG,FURN,ACC,SEASON,ARENA,LIGHT,sum,PET_STAGE_DAYS} from './catalog.mjs';
const SW='2026-11-30'; let ALL=ALL0;
console.log('catalog: old',sum(OLD),'upg',sum(UPG),'furn',sum(FURN),'acc',sum(ACC),'season',sum(SEASON),'arena',sum(ARENA),'light',sum(LIGHT),'TOTAL',sum(ALL),'new only',sum(ALL)-sum(OLD),'items',ALL.length);
function sim(seed,{p=0.85,B=0,ownOld=true,policy='greedy',slow=false,oldCleared=2}={}){
  const {out}=run(seed,{p,sick:slow?0.08:0.03,bossWin:slow?0.4:0.55});
  if(slow) for(const o of out){} // (медленный сценарий — ниже масштабом дохода)
  ALL=[...ALL0,...RESERVE.slice(0,Math.max(0,Math.ceil((B-1000)/350)))];
  const owned=new Set(ownOld?OLD.map(x=>x.id):[]); let bal=B, prevCoins=null, arenaN=0, weeks=[], inc=[];
  const roomsLvl={}; let wk=0;
  for(let i=0;i<out.length;i++){const o=out[i]; if(o.d<SW){prevCoins=o.coins;continue}
    let add=o.coins-prevCoins; prevCoins=o.coins; if(slow) add*=0.72; bal+=add; inc.push(add);
    if(o.d>='2027-09-01'&&new Date(o.d+'T12:00:00Z').getUTCDay()===6&&o.earn>=20) arenaN++;
    if(new Date(o.d+'T12:00:00Z').getUTCDay()!==6) continue; wk++;
    const stage=PET_STAGE_DAYS.filter(x=>(o.honest-0)>=x).length-1; const hasPet=true;
    const avail=x=>!owned.has(x.id)&&(()=>{const n=x.need;
      if(n.boss!==undefined) return Math.max(o.cleared,oldCleared)>n.boss; if(n.lvl) return owned.has(n.lvl[1]===2?UPG[n.lvl[0]*2].id:UPG[n.lvl[0]*2+1].id);
      if(n.date) return o.d>=n.date; if(n.petStage!==undefined) return hasPet&&stage>=n.petStage; if(n.arena) return arenaN>=n.arena; return true})();
    let A=ALL.filter(avail);
    const rate=inc.slice(-28).reduce((a,b)=>a+b,0)/4||1;
    const nearF=()=>{const B2=ALL.filter(avail);return B2.length?Math.min(...B2.map(x=>Math.max(0,x.price-bal)/rate)):Infinity};
    
    // покупка
    if(policy==='greedy'){A.sort((a,b)=>a.price-b.price);for(const x of A)if(x.price<=bal){bal-=x.price;owned.add(x.id)}}
    else { // копит на самое дорогое из доступного, если оно не дальше 3 недель, иначе берёт дешёвое
      A.sort((a,b)=>b.price-a.price); const t=A.find(x=>(x.price-bal)/rate<=3)??A.at(-1); if(t&&t.price<=bal){bal-=t.price;owned.add(t.id)} }
    { const B2=ALL.filter(avail); weeks.push({d:o.d,bal:Math.round(bal),avail:B2.length,near:B2.length?Math.min(...B2.map(x=>Math.max(0,x.price-bal)/rate)):Infinity,rate}); }
  }
  void 0;
  const left=sum(ALL.filter(x=>!owned.has(x.id)));
  return {weeks,left,bal:Math.round(bal),ownedN:owned.size};
}
for(const sc of [{},{B:500},{B:1500},{B:2000},{B:3000},{B:4000},{ownOld:false,oldCleared:0},{policy:'saver'},{slow:true},{slow:true,B:1500},{p:0.7,slow:true,oldCleared:0}]){
  const R=30;let dead=0,far=0,inst=0,W=0,left=0,bal=0,firstEmpty=[];
  for(let s=1;s<=R;s++){const r=sim(s,sc);for(const w of r.weeks){W++;if(!w.avail)dead++;else if(w.near>3)far++;else if(w.near<1)inst++}left+=r.left/R;bal+=r.bal/R;
    const fe=r.weeks.find(w=>!w.avail);if(fe)firstEmpty.push(fe.d)}
  console.log(JSON.stringify(sc).padEnd(28),'weeks',W/R,'| no goal',(100*dead/W).toFixed(1)+'%','| goal >3wk',(100*far/W).toFixed(1)+'%','| goal <1wk',(100*inst/W).toFixed(0)+'%','| unbought at exam',Math.round(left),'| coins at exam',Math.round(bal),'| first empty',firstEmpty.sort()[0]??'—');
}
// поквартальная картина для одного прогона
const r=sim(1,{B:500});for(const w of r.weeks.filter((_,i)=>i%6===0))console.log(w.d,'bal',w.bal,'avail',w.avail,'nearest wk',w.near.toFixed(1),'rate/wk',Math.round(w.rate));
