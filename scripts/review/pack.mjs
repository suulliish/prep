// Пакет проверки казахского: один офлайн-HTML для человека, знающего казахский (docs/KZ_REVIEW.md).
//   node scripts/review/pack.mjs --id kz-pack-01 --out на-вычитку/kz-pack-01.html --queue 6-17 --skills dec.concept,dec.add_sub
//   node scripts/review/pack.mjs --id kz-pack-02 --next 12        # следующие 12 тем очереди, у которых статус не 'ok'
//   node scripts/review/pack.mjs --id kz-pack-03 --changed        # только то, что изменилось или ждёт поправок
// Работает без сети: данные внутри файла, ответы хранятся в браузере (localStorage), результат — кнопка «Нәтижені көшіру» (JSON).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { LESSONS } from '../../content/lessons.mjs';
import { QUEUE } from '../../content/queue.mjs';
import { skillById } from '../../content/skills.mjs';
import { templates } from '../../content/templates/index.mjs';
import { lessonHash, glossaryHits, templateSamples, STEP_KZ, isMain } from './lib.mjs';
import { chunksOf } from './current.mjs';

const ROOT = new URL('../../', import.meta.url);
const GLOSSARY = JSON.parse(readFileSync(new URL('content/glossary.json', ROOT), 'utf8')).terms;
const byTpl = Object.fromEntries(templates.map(t => [t.id, t]));
const statusPath = new URL('content/kz_review.json', ROOT);

/** Данные пакета: для каждого урока куски, хэш, термины, образцы генераторов. */
export function buildData({ id, skills, now = new Date().toISOString() }) {
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(id)) throw new Error('--id: только латиница, цифры, точка, дефис, подчёркивание (до 40 знаков)');
  const lessons = skills.map(skill => {
    const chunks = chunksOf(skill);
    const g = glossaryHits(chunks.map(c => c.text), GLOSSARY);
    const gens = (skillById[skill]?.templates ?? []).filter(t => byTpl[t]).map(t => templateSamples(byTpl[t]));
    return { skill, title: skillById[skill]?.title ?? { kz: skill, ru: skill }, steps: LESSONS[skill].map(s => s.type), h: lessonHash(chunks), chunks, terms: g.used, badWords: g.bad, generators: gens };
  });
  return { id, built: now, stepKz: { ...STEP_KZ, skill: 'Название темы', tech: 'Название приёма' }, lessons };
}

/** Какие темы брать: --skills (явно), --queue a-b (позиции очереди, 1-based, только с уроком), --next N, --changed. */
export function pickSkills(args, status = {}) {
  const has = s => !!LESSONS[s];
  const list = [];
  const add = s => { if (has(s) && !list.includes(s)) list.push(s); };
  if (args.queue) {
    const m = String(args.queue).match(/^(\d+)(?:-(\d+))?$/); if (!m) throw new Error('--queue: нужно число или диапазон, например 6 или 6-17');
    const a = +m[1], b = m[2] === undefined ? a : +m[2];
    if (a < 1 || b < a) throw new Error('--queue: начало не меньше 1, конец не меньше начала');
    QUEUE.slice(a - 1, b).forEach(add);
  }
  if (args.skills) args.skills.split(',').forEach(s => { if (!has(s)) throw new Error(`нет урока: ${s}`); add(s); });
  if (args.next) QUEUE.filter(s => has(s) && status[s]?.st !== 'ok').slice(0, +args.next).forEach(add);
  if (args.changed) Object.keys(LESSONS).filter(s => status[s]?.st !== 'ok').forEach(add);
  return list;
}

const CSS = `
:root{--bg:#f6f7fb;--card:#fff;--ink:#1c2233;--mut:#6b7390;--line:#dfe3ef;--ok:#1f9d63;--okbg:#e6f6ee;--fix:#d9534f;--fixbg:#fdecea;--acc:#3b5bdb;--hl:#fff7d6}
@media(prefers-color-scheme:dark){:root{--bg:#12151f;--card:#1b2030;--ink:#e8ebf5;--mut:#9aa3c0;--line:#2c3350;--ok:#4cd08b;--okbg:#17332a;--fix:#ff7b72;--fixbg:#3a1f22;--acc:#7c9bff;--hl:#3a3418}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header{position:sticky;top:0;z-index:5;background:var(--card);border-bottom:1px solid var(--line);padding:10px 16px}
header h1{margin:0 0 6px;font-size:18px}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.bar{flex:1;min-width:140px;height:10px;background:var(--line);border-radius:6px;overflow:hidden}.bar i{display:block;height:100%;background:var(--ok);width:0}
button{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:6px 12px;cursor:pointer}
button.primary{background:var(--acc);border-color:var(--acc);color:#fff}button.ok.on{background:var(--ok);border-color:var(--ok);color:#fff}button.fix.on{background:var(--fix);border-color:var(--fix);color:#fff}
main{max-width:860px;margin:0 auto;padding:12px 16px 80px}
.how{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin:12px 0}.how li{margin:4px 0}
nav{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}nav a{padding:4px 10px;border:1px solid var(--line);border-radius:999px;color:var(--ink);text-decoration:none;font-size:14px;background:var(--card)}nav a.done{border-color:var(--ok);color:var(--ok)}
section.lesson{margin:22px 0}section.lesson>h2{margin:0 0 4px;font-size:20px}.sub{color:var(--mut);font-size:14px}
.step{background:var(--card);border:1px solid var(--line);border-radius:12px;margin:10px 0;overflow:hidden}.step>h3{margin:0;padding:6px 12px;font-size:13px;background:var(--bg);color:var(--mut);border-bottom:1px solid var(--line)}
.ch{display:flex;gap:10px;align-items:flex-start;padding:8px 12px;border-left:4px solid transparent;border-bottom:1px solid var(--line)}.ch:last-child{border-bottom:0}
.ch.ok{border-left-color:var(--ok);background:var(--okbg)}.ch.fix{border-left-color:var(--fix);background:var(--fixbg)}
.ch .t{flex:1;white-space:pre-wrap;word-break:break-word}.ch .sp{display:none;color:var(--mut);font-size:13px;margin-top:2px}body.sp .ch .sp{display:block}
.ch .b{display:flex;gap:4px;flex-shrink:0}.ch .b button{padding:3px 10px}
.ed{margin-top:6px;display:grid;gap:6px}.ed textarea,.ed input,input.name,textarea.note{width:100%;font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:6px 8px}.ed textarea{min-height:64px}
.terms input{width:100%;font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:4px 8px}.terms table{width:100%;border-collapse:collapse;font-size:15px}.terms td,.terms th{padding:4px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.bad{color:var(--fix);font-weight:600}.gen{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:10px 0}.gen .it{padding:6px 0;border-top:1px dashed var(--line);white-space:pre-wrap}.gen .it:first-of-type{border-top:0}
.gen .a{color:var(--ok);font-weight:600}.gen .sol{color:var(--mut);font-size:14px}.foot{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
.toast{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:8px 16px;border-radius:999px;display:none}.toast.on{display:block}
@media(max-width:600px){header{position:static}.ch{flex-direction:column;gap:6px}.ch .b{width:100%}.ch .b button{flex:1;padding:9px 8px}main{padding:8px 10px 80px}}
`;

const JS = `
const D=JSON.parse(document.getElementById('data').textContent),KEY='kzpack:'+D.id;
let S;try{S=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){S=null}
S=S||{by:'',chunks:{},gens:{},terms:{}};
const $=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}paint()};
const ck=(L,id)=>L.skill+'@'+L.h+'|'+id;   // отметка привязана к хэшу текста урока: текст изменился — старые отметки не действуют
function stat(){let n=0,d=0;for(const L of D.lessons)for(const c of L.chunks){n++;if(S.chunks[ck(L,c.id)])d++}return[n,d]}
function paint(){const[n,d]=stat();document.getElementById('pct').textContent=d+' / '+n;document.querySelector('.bar i').style.width=(n?100*d/n:0)+'%';
 for(const L of D.lessons){const a=document.querySelector('nav a[href="#'+L.skill+'"]');const dd=L.chunks.filter(c=>S.chunks[ck(L,c.id)]).length;a.className=dd===L.chunks.length?'done':'';a.textContent=L.title.kz+' '+dd+'/'+L.chunks.length}}
function chunk(L,c){const k=ck(L,c.id),r=S.chunks[k];const row=$('div','ch'+(r?' '+r.st:''));
 const t=$('div','t');t.append($('div',null,c.text));if(c.speak){t.append($('div','sp','🔊 '+c.speak))}
 if(r&&r.st==='fix'){const ed=$('div','ed');const ta=$('textarea');ta.value=r.now!=null?r.now:c.text;ta.oninput=()=>{r.now=ta.value;save2()};const nt=$('input');nt.placeholder='Комментарий (необязательно)';nt.value=r.note||'';nt.oninput=()=>{r.note=nt.value;save2()};ed.append(ta,nt);t.append(ed)}
 const b=$('div','b');const ok=$('button','ok'+(r&&r.st==='ok'?' on':''),'✓ Дұрыс');const fx=$('button','fix'+(r&&r.st==='fix'?' on':''),'✎ Түзету');
 ok.onclick=()=>{if(r&&r.st==='ok')delete S.chunks[k];else S.chunks[k]={st:'ok'};save();render()};
 fx.onclick=()=>{if(r&&r.st==='fix')delete S.chunks[k];else S.chunks[k]={st:'fix',now:c.text,note:''};save();render()};
 b.append(ok,fx);row.append(t,b);return row}
const save2=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}paint()};
function lesson(L){const sec=$('section','lesson');sec.id=L.skill;sec.append($('h2',null,L.title.kz),$('div','sub',L.title.ru+' · '+L.skill));
 const byStep={};L.chunks.forEach(c=>(byStep[c.step]=byStep[c.step]||[]).push(c));
 for(const i of Object.keys(byStep)){const st=$('div','step');st.append($('h3',null,i==='-1'?'Название темы и приёма (ребёнок видит в уроке)':(i*1+1)+'. '+(D.stepKz[L.steps[i]]||L.steps[i])));for(const c of byStep[i])st.append(chunk(L,c));sec.append(st)}
 const f=$('div','foot');const all=$('button','primary','Все остальные тексты урока верны');all.onclick=()=>{for(const c of L.chunks){const k=ck(L,c.id);if(!S.chunks[k])S.chunks[k]={st:'ok'}}save();render()};f.append(all);sec.append(f);
 if(L.badWords.length){const w=$('div','bad','Русские слова из словаря «avoid» в тексте: '+L.badWords.map(x=>x.word+' (надо: '+x.use+')').join(', '));sec.append(w)}
 for(const g of L.generators){const box=$('div','gen');box.append($('b',null,'Генератор задач: '+g.title),$('span','sub',' · '+g.id));
  g.items.forEach((it,n)=>{const d=$('div','it');d.append($('div',null,(n+1)+') '+it.kz));d.append($('div',null,it.choices.map((x,j)=>'ABCDE'[j]+') '+x+(j===it.answer?' ✓':'')).join('   ')));d.append($('div','sol','Шешуі: '+it.sol));box.append(d)});
  const gs=S.gens[g.id];const row=$('div','foot');const ok=$('button','ok'+(gs&&gs.st==='ok'?' on':''),'✓ Дұрыс');const fx=$('button','fix'+(gs&&gs.st==='fix'?' on':''),'✎ Түзету');
  ok.onclick=()=>{S.gens[g.id]={st:'ok',h:g.h};save();render()};fx.onclick=()=>{S.gens[g.id]={st:'fix',h:g.h,note:(gs&&gs.note)||''};save();render()};row.append(ok,fx);
  if(gs&&gs.st==='fix'){const nt=$('input');nt.placeholder='Что не так (какой вариант, как правильно)';nt.value=gs.note||'';nt.oninput=()=>{gs.note=nt.value;save2()};box.append(row,nt)}else box.append(row);sec.append(box)}
 return sec}
function terms(){const m=new Map();for(const L of D.lessons)for(const t of L.terms){const x=m.get(t.kz)||{kz:t.kz,ru:t.ru,n:0};x.n+=t.n;m.set(t.kz,x)}
 const sec=$('section','lesson terms');sec.id='terms';sec.append($('h2',null,'Термины'),$('div','sub','Как в школьном учебнике Муртазы? Если иначе, впишите слово из учебника.'));
 const tb=$('table');tb.append((()=>{const tr=$('tr');['Термин','По-русски','Как в учебнике'].forEach(h=>tr.append($('th',null,h)));return tr})());
 for(const t of [...m.values()].sort((a,b)=>a.kz.localeCompare(b.kz))){const tr=$('tr');const inp=$('input');inp.placeholder='как в учебнике (если иначе)';inp.value=(S.terms[t.kz]&&S.terms[t.kz].textbook)||'';inp.oninput=()=>{if(inp.value.trim())S.terms[t.kz]={textbook:inp.value.trim()};else delete S.terms[t.kz];save2()};
  const td=$('td');td.append(inp);tr.append($('td',null,t.kz),$('td',null,t.ru),td);tb.append(tr)}
 sec.append(tb);return sec}
function render(){const m=document.getElementById('out');m.replaceChildren(terms(),...D.lessons.map(lesson));paint()}
function result(){const o={pack:D.id,built:D.built,by:S.by,exported:new Date().toISOString(),lessons:{},generators:{},terms:S.terms};
 for(const L of D.lessons){const ch={};for(const c of L.chunks){const r=S.chunks[ck(L,c.id)];if(r)ch[c.id]=r.st==='fix'?{st:'fix',now:r.now,note:r.note||''}:{st:'ok'}}o.lessons[L.skill]={h:L.h,chunks:ch};for(const g of L.generators)if(S.gens[g.id])o.generators[g.id]=S.gens[g.id]}return JSON.stringify(o,null,1)}
const toast=m=>{const t=document.querySelector('.toast');t.textContent=m;t.className='toast on';setTimeout(()=>t.className='toast',2500)};
document.getElementById('copy').onclick=async()=>{const s=result();try{await navigator.clipboard.writeText(s);toast('Скопировано. Отправьте Султану.')}catch(e){const ta=$('textarea');ta.value=s;document.body.append(ta);ta.select();let ok=false;try{ok=document.execCommand('copy')}catch(e){}ta.remove();toast(ok?'Скопировано. Отправьте Султану.':'Не удалось скопировать: нажмите «Скачать файл»')}};
document.getElementById('dl').onclick=()=>{const a=$('a');a.href=URL.createObjectURL(new Blob([result()],{type:'application/json'}));a.download=D.id+'-результат.json';a.click()};
document.getElementById('sp').onchange=e=>document.body.classList.toggle('sp',e.target.checked);
try{localStorage.setItem('__t','1');localStorage.removeItem('__t')}catch(e){document.getElementById('warn').hidden=false}
const nm=document.getElementById('by');nm.value=S.by||'';nm.oninput=()=>{S.by=nm.value;save2()};
const nav=document.querySelector('nav');nav.append(Object.assign($('a'),{href:'#terms',textContent:'Термины'}));for(const L of D.lessons)nav.append(Object.assign($('a'),{href:'#'+L.skill}));
render();
`;

export function buildHtml(data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `<!doctype html><html lang="kk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Проверка казахского · ${data.id}</title><style>${CSS}</style></head><body>
<header><h1>Проверка казахского текста · ${data.id}</h1><div class="row"><input class="name" id="by" placeholder="Кто проверяет (имя)" style="max-width:220px"><div class="bar"><i></i></div><b id="pct"></b>
<button class="primary" id="copy">Нәтижені көшіру</button><button id="dl">Скачать файл</button><label><input type="checkbox" id="sp"> Показать, как прочтёт Бит</label></div></header>
<main><div class="how" id="warn" hidden style="border-color:var(--fix)"><b>Браузер не сохраняет отметки.</b> Не закрывайте страницу, пока не нажмёте «Нәтижені көшіру» или «Скачать файл».</div><div class="how"><b>Как проверять</b><ol><li>Читайте текст так, как его прочтёт 11-летний школьник. Тексты идут в порядке урока.</li><li>Всё верно: «✓ Дұрыс». Что-то не так (грамматика, термин, неестественная фраза, ошибка в смысле): «✎ Түзету», исправьте текст прямо в поле и при желании напишите, почему.</li><li>Если в уроке верно почти всё, отметьте только ошибки и нажмите «Все остальные тексты урока верны».</li><li>Термины: сверьте с учебником. Если в учебнике слово иное, впишите его.</li><li>Ответы сохраняются в этом браузере сами, можно закрыть и вернуться. В конце «Нәтижені көшіру» и отправьте текст Султану.</li></ol></div>
<nav></nav><div id="out"></div></main><div class="toast"></div>
<script type="application/json" id="data">${json}</script><script>${JS}</script></body></html>`;
}

// CLI
if (isMain(import.meta.url)) {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const nx = process.argv[i + 1]; if (!nx || nx.startsWith('--')) args[k] = true; else { args[k] = nx; i++; } } }
  const status = existsSync(statusPath) ? JSON.parse(readFileSync(statusPath, 'utf8')) : {};
  let skills; try { skills = pickSkills(args, status); } catch (e) { console.error('Ошибка: ' + e.message); process.exit(1); }
  if (!skills.length) { console.error('Нечего собирать: укажите --skills, --queue 6-17, --next N или --changed'); process.exit(1); }
  const id = args.id || 'kz-pack', out = args.out || `${id}.html`;
  let data; try { data = buildData({ id, skills }); } catch (e) { console.error('Ошибка: ' + e.message); process.exit(1); }
  writeFileSync(out, buildHtml(data));
  const words = data.lessons.reduce((a, l) => a + l.chunks.reduce((s, c) => s + c.text.split(/\s+/).length, 0), 0);
  console.log(`${out}: ${skills.length} уроков, ${data.lessons.reduce((a, l) => a + l.chunks.length, 0)} кусков текста, ≈ ${words} слов, ${data.lessons.reduce((a, l) => a + l.generators.length, 0)} генераторов`);
}
