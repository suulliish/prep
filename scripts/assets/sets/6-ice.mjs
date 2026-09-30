// Мир 6 «Ледяная изнанка»: Kenney Hexagon Kit в снежной раскраске (variation-a; копия GLB с подменённой текстурой в kenney-hexagon-snow/) + Kenney Holiday Kit. Оба CC0.
const H = 'kenney-hexagon-snow/';
const W = 'kenney-holiday-kit/Models/GLB format/';
export const SETS = [
  { id: 'ice', type: 'kit', out: 'kits/ice.glb', parts: [
    ...['unit-house', 'unit-mill', 'unit-tower', 'unit-mansion', 'unit-wall-tower', 'unit-tree', 'stone-mountain', 'stone-hill', 'grass-forest', 'grass-hill', 'stone-rocks', 'water-rocks', 'building-wizard-tower', 'building-castle', 'building-walls'].map(n => `${H}${n}.glb`),
    ...['tree-snow-a', 'tree-snow-b', 'tree-snow-c', 'tree', 'rocks-small', 'rocks-medium', 'rocks-large', 'snow-pile', 'snow-flat', 'snow-flat-large', 'snowman', 'snowman-hat',
      'snow-bunker', 'lantern', 'lantern-hanging', 'sled', 'sled-long', 'reindeer', 'bench', 'candy-cane-red', 'candy-cane-green', 'lights-colored', 'nutcracker', 'wreath', 'snowflake-a', 'snowflake-b', 'snowflake-c', 'cabin-roof-snow', 'cabin-roof-snow-chimney', 'cabin-wall', 'cabin-doorway'].map(n => `${W}${n}.glb`),
  ] },
];
