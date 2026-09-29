// Мир 5 «Трасса молний»: Kenney Racing Kit, CC0. Молнии рисуются кодом (src/three/worlds/5-storm.ts).
const K = 'kenney-racing-kit/Models/GLTF format/';
const names = ['roadStraight', 'roadStraightLong', 'roadStraightArrow', 'roadCrossing', 'roadSide', 'roadCornerLarge', 'roadStart', 'roadStraightBridge', 'roadRampLong',
  'barrierRed', 'barrierWhite', 'barrierWall', 'fenceStraight', 'fenceCurved', 'rail', 'railDouble', 'pylon',
  'grandStand', 'grandStandCovered', 'grandStandRound', 'grandStandAwning', 'pitsGarage', 'pitsGarageClosed', 'pitsOffice', 'pitsOfficeRoof',
  'tent', 'tentLong', 'tentRoofDouble', 'flagRed', 'flagGreen', 'flagCheckers', 'flagTankco', 'bannerTowerRed', 'bannerTowerGreen',
  'lightPostLarge', 'lightPostModern', 'lightRed', 'lightColored', 'lightRedDouble', 'overhead', 'overheadLights', 'overheadRoundColored',
  'billboard', 'billboardLow', 'tentClosed', 'grandStandCoveredRound', 'billboardLower', 'radarEquipment', 'treeLarge', 'treeSmall', 'raceCarRed', 'raceCarOrange', 'ramp'];
export const SETS = [
  { id: 'storm', type: 'kit', out: 'kits/storm.glb', parts: names.map(n => `${K}${n}.glb`) },
];
