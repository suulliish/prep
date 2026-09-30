// Мир 3 «Кристальные пещеры»: скалы, сталагмиты, грибы, арки. Kenney Nature Kit + Modular Cave Kit (CC0).
const N = 'nature-caves/'; // перекрашенный Nature Kit: scripts/assets/recolor-nature.mjs
const C = 'cave-purple/'; // Modular Cave Kit с фиолетовой палитрой: recolor-nature.mjs
const nat = ['rock_tallA', 'rock_tallB', 'rock_tallC', 'rock_tallD', 'rock_tallE', 'rock_tallF', 'rock_tallG', 'rock_tallH', 'rock_tallI', 'rock_tallJ',
  'stone_tallA', 'stone_tallB', 'stone_tallC', 'stone_tallD', 'stone_tallE', 'stone_tallF', 'stone_tallG',
  'rock_largeA', 'rock_largeB', 'rock_largeC', 'rock_largeD', 'rock_smallA', 'rock_smallB', 'rock_smallC', 'rock_smallD', 'stone_largeA', 'stone_largeB', 'stone_largeC', 'stone_smallA', 'stone_smallB', 'stone_smallC',
  'rock_smallFlatA', 'rock_smallFlatB', 'rock_smallTopA', 'stone_smallFlatA',
  'mushroom_red', 'mushroom_redGroup', 'mushroom_redTall', 'mushroom_tan', 'mushroom_tanGroup', 'mushroom_tanTall', 'hanging_moss', 'plant_flatShort', 'plant_flatTall', 'plant_bushSmall', 'grass_leafs',
  'statue_block', 'statue_column', 'statue_columnDamaged', 'statue_obelisk', 'statue_ring', 'statue_head',
  'cliff_stone', 'cliff_rock', 'cliff_large_rock', 'cliff_cave_stone', 'cliff_cave_rock', 'cliff_block_rock', 'cliff_half_rock', 'cliff_blockCave_rock', 'tree_pineTallA', 'stump_old', 'campfire_stones', 'bed_floor'];
const cave = ['template-detail', 'gate-rock', 'gate', 'gate-overhang', 'template-wall-half', 'template-wall', 'template-wall-top', 'template-corner'];
export const SETS = [{ id: 'caves', type: 'kit', out: 'kits/caves.glb', parts: [...nat.map(n => `${N}${n}.glb`), ...cave.map(n => `${C}${n}.glb`)] }];
