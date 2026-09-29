// Сборка моделей игры: берёт исходные паки (CC0: KayKit, Kenney, Quaternius), оставляет нужное, сжимает и кладёт в public/models.
// Запуск: ASSET_SRC=/путь/к/исходникам node scripts/assets/build.mjs [имя-набора ...]
// Исходники в репозиторий не входят (тяжёлые). В игру идут только готовые .glb из public/models.
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization, KHRTextureTransform } from '@gltf-transform/extensions';
import { dedup, prune, quantize, meshopt, reorder, resample, flatten, join, mergeDocuments } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';
import { SETS } from './manifest.mjs';

const SRC = process.env.ASSET_SRC;
if (!SRC) { console.error('Задайте ASSET_SRC — папку с исходниками (см. manifest.mjs).'); process.exit(1); }
const OUT = path.resolve('public/models');

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization, KHRTextureTransform])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const rootOf = p => path.join(SRC, p);
const base = f => path.basename(f).replace(/\.(gltf|glb)$/i, '');

/** Клипы: оставить только перечисленные (остальные и их данные выбрасываем). */
function keepClips(doc, names) {
  const keep = new Set(names);
  for (const a of doc.getRoot().listAnimations()) if (!keep.has(a.getName())) a.dispose();
}

/** Слить несколько моделей в один файл-набор: у каждой корневой узел с именем файла. */
async function buildKit(set) {
  let main = null, mainScene = null;
  const seen = new Set();
  for (const part of set.parts) {
    const files = expand(part);
    for (const f of files) {
      const name = base(f);
      if (seen.has(name)) continue; seen.add(name);
      const d = await io.read(f);
      if (!main) {
        main = d; mainScene = d.getRoot().listScenes()[0];
        const holder = d.createNode('K_' + name); for (const c of [...mainScene.listChildren()]) { mainScene.removeChild(c); holder.addChild(c); }
        mainScene.addChild(holder);
      } else {
        const map = mergeDocuments(main, d);
        const s = map.get(d.getRoot().listScenes()[0]);
        const holder = main.createNode('K_' + name);
        for (const c of [...s.listChildren()]) { s.removeChild(c); holder.addChild(c); }
        mainScene.addChild(holder); s.dispose();
      }
    }
  }
  return main;
}

/** Файлы по шаблону: строка-путь или 'папка/*' (все .gltf/.glb в папке). */
function expand(part) {
  const p = typeof part === 'string' ? part : part.src;
  if (p.endsWith('/*')) { const dir = rootOf(p.slice(0, -2)); return fs.readdirSync(dir).filter(x => /\.(gltf|glb)$/i.test(x)).sort().map(x => path.join(dir, x)); }
  return [rootOf(p)];
}

async function finish(doc, outFile, opts = {}) {
  // после слияния буферов несколько: GLB допускает один
  const root = doc.getRoot(), bufs = root.listBuffers();
  if (bufs.length > 1) { const main = bufs[0]; for (const a of root.listAccessors()) a.setBuffer(main); for (const b of bufs.slice(1)) b.dispose(); }
  if (opts.skinned) {
    // персонажи: позиции не квантуем — контур строится по нормалям в единицах модели, масштаб узлов его бы сломал
    await doc.transform(dedup(), prune(), resample(), reorder({ encoder: MeshoptEncoder }),
      quantize({ quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8, pattern: /^(NORMAL|TEXCOORD_0|COLOR_0|WEIGHTS_0)$/ }), prune());
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  } else {
    // иерархию не выпрямляем: корневые узлы набора должны сохранить имена файлов
    await doc.transform(dedup(), prune(), resample(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await io.write(outFile, doc);
  return fs.statSync(outFile).size;
}

const only = process.argv.slice(2);
let total = 0;
for (const set of SETS) {
  if (only.length && !only.includes(set.id)) continue;
  let bytes = 0;
  if (set.type === 'kit') {
    const doc = await buildKit(set);
    bytes = await finish(doc, path.join(OUT, set.out));
  } else if (set.type === 'anims') {
    // наборы клипов скелета: каждый исходный файл → один файл с отобранными клипами
    for (const f of set.files) {
      const doc = await io.read(rootOf(f.src));
      keepClips(doc, f.keep);
      for (const n of doc.getRoot().listNodes()) { n.setMesh(null); n.setSkin(null); }
      // мешей в файлах анимаций нет, но скелет-нули оставляем: клипы привязываются к костям по именам
      bytes += await finish(doc, path.join(OUT, set.out, f.out), { skinned: true });
    }
  } else if (set.type === 'single') {
    for (const f of set.files) {
      const doc = await io.read(rootOf(f.src));
      if (f.keep) keepClips(doc, f.keep);
      bytes += await finish(doc, path.join(OUT, set.out, f.out ?? (base(f.src) + '.glb')), { skinned: !!set.skinned });
    }
  }
  total += bytes; console.log(`${set.id.padEnd(14)} ${(bytes / 1024).toFixed(0).padStart(6)} КБ`);
}
console.log(`ИТОГО ${(total / 1024).toFixed(0)} КБ`);
