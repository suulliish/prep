// Перекраска Kenney Nature Kit и Modular Cave Kit (CC0) под миры: в паке одна пастельная бирюзово-розовая гамма, а игре нужны джунгли, небо и пещеры.
// Nature Kit: ASSET_SRC/jw-nature/Models/GLTF format/*.glb → ASSET_SRC/nature-<мир>/*.glb, цвет материалов меняется по их именам.
// Modular Cave Kit: ASSET_SRC/jw-cave/Models/GLB format/*.glb → ASSET_SRC/cave-purple/*.glb, текстура-палитра (коричневая) сдвигается по оттенку в фиолетовый.
// Запуск: ASSET_SRC=... node scripts/assets/recolor-nature.mjs   (потом node scripts/assets/build.mjs jungle isles caves)
import { NodeIO } from '@gltf-transform/core';
import { KHRMaterialsUnlit } from '@gltf-transform/extensions';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC = process.env.ASSET_SRC;
if (!SRC) { console.error('Задайте ASSET_SRC'); process.exit(1); }
const IN = path.join(SRC, 'jw-nature/Models/GLTF format');

// имя материала → цвет (sRGB). Чего нет в списке, остаётся как в паке.
const SCHEMES = {
  jungle: { leafsGreen: 0x2f9e44, leafsDark: 0x1c7238, leafsFall: 0xd9a32e, grass: 0x4fae3e, dirt: 0x8a5a36, dirtDark: 0x6a4327, woodBark: 0xb07a45, woodBarkDark: 0x8a5c34,
    wood: 0xb07a45, woodDark: 0x8a5c34, stone: 0xb4b8a4, stoneDark: 0x83887a, water: 0x4fc3c8, colorRed: 0xe0503a, colorTan: 0xd9b25a },
  isles: { leafsGreen: 0x74dba0, leafsDark: 0x3fbf8c, leafsFall: 0xff9fcb, grass: 0xa6e89e, dirt: 0xd2b98f, dirtDark: 0xb0966c, woodBark: 0xc99a72, woodBarkDark: 0xa87d58,
    wood: 0xd9ab7e, woodDark: 0xb98a60, stone: 0xf3f7ff, stoneDark: 0xc4d2ee, water: 0x8fe3ff, colorRed: 0xff7fae, colorRedDark: 0xf0709f, colorTan: 0xffe08a },
  caves: { leafsGreen: 0x55e3b8, leafsDark: 0x2fae94, leafsFall: 0xff7ac8, grass: 0x6fdcd0, dirt: 0x6d4fa8, dirtDark: 0x4d3782, woodBark: 0x8e5f92, woodBarkDark: 0x6a4670,
    wood: 0x9e6fa0, woodDark: 0x7a5080, stone: 0x9a83e0, stoneDark: 0x6650b4, water: 0x7be8ff, colorRed: 0xff5fae, colorTan: 0x5fe8ff, colorPurple: 0xd39bff },
};
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const toLin = hex => [lin((hex >> 16) & 255), lin((hex >> 8) & 255), lin(hex & 255)];

const io = new NodeIO().registerExtensions([KHRMaterialsUnlit]);
for (const [world, map] of Object.entries(SCHEMES)) {
  const out = path.join(SRC, 'nature-' + world); fs.mkdirSync(out, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(IN).filter(x => x.endsWith('.glb'))) {
    const doc = await io.read(path.join(IN, f));
    for (const m of doc.getRoot().listMaterials()) if (map[m.getName()] != null) m.setBaseColorFactor([...toLin(map[m.getName()]), 1]);
    await io.write(path.join(out, f), doc); n++;
  }
  console.log(`nature-${world}: ${n} моделей`);
}

// пещерный кит: одна текстура-палитра на все модели; сдвигаем оттенок коричневого в фиолетовый
const CAVE_IN = path.join(SRC, 'jw-cave/Models/GLB format'), CAVE_OUT = path.join(SRC, 'cave-purple');
fs.mkdirSync(CAVE_OUT, { recursive: true });
let shifted = null, k = 0;
for (const f of fs.readdirSync(CAVE_IN).filter(x => x.endsWith('.glb'))) {
  const doc = await io.read(path.join(CAVE_IN, f));
  for (const t of doc.getRoot().listTextures()) {
    shifted ??= await sharp(Buffer.from(t.getImage())).modulate({ hue: 255, saturation: 1.15, brightness: 1.05 }).png().toBuffer();
    t.setImage(new Uint8Array(shifted)).setMimeType('image/png');
  }
  await io.write(path.join(CAVE_OUT, f), doc); k++;
}
console.log(`cave-purple: ${k} моделей`);
