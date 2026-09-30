// Мир 9 «Мир великанов»: гигантские вещи (Kenney Food Kit, Furniture Kit, Survival Kit) среди песка и кактусов (Kenney Nature Kit) — всё CC0.
const N = 'ozh-nature-kit/Models/GLTF format/';
const FD = 'ozh-food-kit/Models/GLB format/';
const FU = 'ozh-furniture-kit/Models/GLTF format/';
const S = 'ozh-survival-kit/Models/GLB format/';
const list = (dir, names, ext = '.glb') => names.map(n => `${dir}${n}${ext}`);
export const SETS = [
  { id: 'giants', type: 'kit', out: 'kits/giants.glb', parts: [
    ...list(N, ['cactus_short', 'cactus_tall', 'rock_tallB', 'rock_smallA', 'rock_smallB', 'rock_smallC', 'rock_smallD', 
      'grass', 'grass_large', 'cliff_large_rock']),
    ...list(FD, ['cup', 'pot-stew', 'cake-birthday', 'loaf-round', 'donut-sprinkles', 'burger-double', 'watermelon', 'pumpkin', 'soda-can', 'cheese', 'ice-cream-cne', 'lollypop', 'pepper-mill', 
      'cookie-chocolate', 'apple', 'egg', 'tajine']),
    ...list(FU, ['chair', 'bookcaseClosedWide', 'bookcaseOpen', 'lampSquareFloor', 'lampRoundFloor', 'loungeSofaLong', 'kitchenFridgeLarge', 'kitchenStove', 'toaster', 'coatRackStanding', 'stoolBar', 'sideTable', 'washer', 'televisionVintage']),
    ...list(S, ['barrel', 'chest', 'box-large']),
  ] },
];
