// Мир 7 «Вулкан»: тёмные скалы и руины (Kenney Nature Kit, Graveyard Kit; CC0), обугленные деревья KayKit Forest (CC0). Лава, вулкан и искры ставятся кодом.
const N = 'ozh-nature-kit/Models/GLTF format/';
const G = 'ozh-graveyard-kit/Models/GLB format/';
const F = 'forest/';
const list = (dir, names, ext = '.glb') => names.map(n => `${dir}${n}${ext}`);
export const SETS = [
  { id: 'volcano', type: 'kit', out: 'kits/volcano.glb', parts: [
    ...list(N, ['rock_tallA', 'rock_tallB', 'rock_tallC', 'rock_tallD', 'rock_tallE', 'rock_tallG', 'rock_smallA', 'rock_smallB', 'rock_smallC', 'rock_smallD',
      'rock_smallFlatA', 'rock_smallFlatB', 'statue_obelisk']),
    ...list(G, ['crypt-large', 'crypt', 'crypt-small', 'pillar-large', 'pillar-obelisk', 'column-large', 'stone-wall-damaged', 'stone-wall-column',
      'fire-basket', 'rocks-tall', 'rocks', 'pine-crooked', 'debris', 'altar-stone', 'urn-round']),
    ...list(F, ['Tree_Bare_1_A', 'Tree_Bare_1_B', 'Tree_Bare_1_C', 'Tree_Bare_2_A', 'Tree_Bare_2_B', 'Tree_Bare_2_C'].map(n => `${n}_Color1`), '.gltf'),
  ] },
];
