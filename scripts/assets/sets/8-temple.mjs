// Мир 8 «Затонувший храм»: руины, колонны и статуи (Kenney Nature Kit, Graveyard Kit), рыбы (Survival Kit), обломки корабля (Pirate Kit) — всё CC0.
// Водоросли — из KayKit Hexagon (hexcore). Лучи света, пузыри и кораллы ставятся кодом.
const N = 'ozh-nature-kit/Models/GLTF format/';
const G = 'ozh-graveyard-kit/Models/GLB format/';
const S = 'ozh-survival-kit/Models/GLB format/';
const P = 'pirate/';
const list = (dir, names, ext = '.glb') => names.map(n => `${dir}${n}${ext}`);
export const SETS = [
  { id: 'temple', type: 'kit', out: 'kits/temple.glb', parts: [
    ...list(N, ['statue_block', 'statue_column', 'statue_columnDamaged', 'statue_head', 'statue_obelisk', 'statue_ring',
      'rock_tallE', 'rock_largeA', 'rock_smallA', 'rock_smallC', 'rock_smallFlatA', 'stone_largeA', 'stone_smallA', 'stone_smallC',
      'cliff_large_stone', 'plant_bushLargeTriangle', 'plant_bushTriangle', 'plant_flatTall', 'lily_large']),
    ...list(G, ['pillar-obelisk', 'pillar-square', 'column-large', 'altar-stone', 'urn-round', 'stone-wall-damaged', 'stone-wall-column', 'crypt-large']),
    ...list(S, ['fish', 'fish-large']),
    ...list(P, ['ship-wreck', 'chest', 'barrel', 'cannon', 'rocks-a', 'crate']),
  ] },
];
