// Мастерская корабля (GAME_LOOP 5): украшения палубы и питомцы. Всё CC0 (KayKit, Kenney): docs/CREDITS.md.
// Исходники в ASSET_SRC: kaykit-resource-bits, kaykit-rpg-tools-bits, kaykit-furniture-bits (папка пака с Assets/gltf), kenney-platformer-kit, kenney-cube-pets (Models/GLB format).
// Ещё в каталоге (content/ship_items.mjs) есть модели из уже собранных наборов: ship (сундук, пушка), arena (кубок, статуя).
const KK = (pack, names) => names.map(n => `${pack}/Assets/gltf/${n}.gltf`);
const KN = (pack, names) => names.map(n => `${pack}/Models/GLB format/${n}.glb`);
export const PETS = ['fox', 'cat', 'dog', 'panda', 'parrot', 'penguin'];
export const SETS = [
  { id: 'shipdecor', type: 'kit', out: 'kits/shipdecor.glb', parts: [
    ...KK('kaykit-resource-bits', ['Fuel_A_Barrels', 'Gold_Bars_Stack_Medium']),
    ...KK('kaykit-rpg-tools-bits', ['lantern', 'map', 'rope_bundle_A']),
    ...KK('kaykit-furniture-bits', ['cactus_medium_B', 'table_small', 'armchair']),
    ...KN('kenney-platformer-kit', ['crate-item-strong']),
  ] },
  // питомцы: по файлу на зверя (у каждого свои клипы idle/walk/run/dance/gesture-positive); части тела двигаются узлами, поэтому позиции не квантуем (skinned: true)
  { id: 'pets', type: 'single', skinned: true, out: 'pets', files: PETS.map(n => ({ src: `kenney-cube-pets/Models/GLB format/animal-${n}.glb`, keep: ['idle', 'walk', 'run', 'dance', 'gesture-positive'] })) },
];
