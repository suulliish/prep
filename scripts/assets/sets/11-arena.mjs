// Мир 11 «Арена Жарық»: Kenney Mini Arena (CC0) + флаги и осадные машины из Kenney Castle Kit (CC0).
const A = 'mini-arena/Models/GLB format/', C = 'castle-kit/Models/GLB format/';
const ls = (d, names) => names.map(n => `${d}${n}.glb`);
export const SETS = [
  { id: 'arena', type: 'kit', out: 'kits/arena.glb', parts: [
    ...ls(A, ['banner', 'block', 'border-corner', 'border-straight', 'bricks', 'column-damaged', 'column', 'floor-detail', 'stairs-corner-inner', 'stairs-corner', 'stairs', 'statue', 'trophy',
      'wall-corner', 'wall-gate', 'wall', 'weapon-rack', 'weapon-spear', 'weapon-sword', 'character-soldier']),
    ...ls(C, ['siege-ballista', 'siege-catapult', 'rocks-large', 'rocks-small']),
  ] },
];
