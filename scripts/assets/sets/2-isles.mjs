// Мир 2 «Парящие острова»: светлые деревья, облака, платформы, мосты. Kenney Nature Kit (CC0).
const N = 'nature-isles/'; // перекрашенный Nature Kit: scripts/assets/recolor-nature.mjs
const names = ['tree_oak', 'tree_oak_fall', 'tree_fat', 'tree_fat_fall', 'tree_default', 'tree_default_fall', 'tree_detailed', 'tree_detailed_fall', 'tree_tall', 'tree_tall_fall', 'tree_thin', 'tree_thin_fall',
  'tree_plateau', 'tree_plateau_fall', 'tree_simple', 'tree_simple_fall', 'tree_small', 'tree_small_fall', 'tree_blocks', 'tree_blocks_fall', 'tree_cone', 'tree_cone_fall', 'tree_palm', 'tree_palmShort',
  'plant_bush', 'plant_bushLarge', 'plant_bushDetailed', 'plant_flatTall', 'grass', 'grass_large', 'grass_leafs', 'flower_redA', 'flower_yellowA', 'flower_purpleA', 'flower_purpleB', 'flower_redB', 'flower_yellowB',
  'statue_block', 'statue_column', 'statue_columnDamaged', 'statue_obelisk', 'statue_ring', 'statue_head',
  'platform_grass', 'platform_stone', 'platform_beach', 'bridge_stone', 'bridge_wood', 'bridge_woodRound', 'fence_simple', 'fence_planks', 'fence_gate', 'sign', 'tent_detailedClosed', 'tent_smallOpen', 'campfire_logs', 'campfire_stones', 'canoe', 'pot_large', 'lily_large', 'lily_small', 'log_stack',
  'rock_largeA', 'rock_largeB', 'rock_smallA', 'rock_smallB', 'rock_smallFlatA', 'stone_largeA', 'stone_largeB', 'stone_smallA', 'stone_tallA', 'stone_tallB', 'rock_tallA', 'rock_tallB',
  'cliff_stone', 'cliff_rock', 'cliff_large_stone', 'cliff_block_stone', 'cliff_waterfall_stone', 'cliff_cave_rock'];
export const SETS = [{ id: 'isles', type: 'kit', out: 'kits/isles.glb', parts: names.map(n => `${N}${n}.glb`) }];
