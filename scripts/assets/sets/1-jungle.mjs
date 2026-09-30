// Мир 1 «Джунгли с руинами»: пальмы, бамбук, лианы, каменные руины и статуи. Kenney Nature Kit (CC0).
const N = 'nature-jungle/'; // перекрашенный Nature Kit: scripts/assets/recolor-nature.mjs
const names = ['tree_palm', 'tree_palmBend', 'tree_palmShort', 'tree_palmTall', 'tree_palmDetailedShort', 'tree_palmDetailedTall',
  'tree_oak', 'tree_fat', 'tree_default', 'tree_detailed', 'tree_tall', 'tree_thin', 'tree_plateau', 'tree_simple',
  'plant_bush', 'plant_bushLarge', 'plant_bushDetailed', 'plant_bushLargeTriangle', 'plant_flatTall', 'plant_flatShort',
  'grass', 'grass_large', 'grass_leafs', 'grass_leafsLarge', 'flower_redA', 'flower_yellowA', 'flower_purpleA', 'mushroom_red', 'mushroom_redGroup', 'mushroom_tanGroup',
  'crops_bambooStageA', 'crops_bambooStageB', 'hanging_moss',
  'statue_block', 'statue_column', 'statue_columnDamaged', 'statue_head', 'statue_obelisk', 'statue_ring',
  'cliff_block_stone', 'cliff_stone', 'cliff_half_stone', 'cliff_large_stone', 'cliff_corner_stone', 'cliff_top_stone', 'cliff_cave_stone', 'cliff_steps_stone',
  'rock_largeA', 'rock_largeB', 'rock_largeC', 'rock_smallA', 'rock_smallB', 'rock_smallC', 'stone_largeA', 'stone_largeB', 'stone_smallA', 'stone_smallB', 'stone_smallC', 'stone_smallD', 'stone_smallE', 'stone_tallA', 'stone_tallB', 'stone_tallC',
  'stump_old', 'stump_round', 'log', 'log_large', 'lily_large', 'lily_small', 'campfire_stones', 'path_stone', 'bridge_stone', 'fence_simple', 'sign'];
export const SETS = [{ id: 'jungle', type: 'kit', out: 'kits/jungle.glb', parts: names.map(n => `${N}${n}.glb`) }];
