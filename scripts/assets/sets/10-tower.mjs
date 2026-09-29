// Мир 10 «Башня Глитча»: Kenney Tower Defense Kit (CC0): фиолетовые башни, розовые кристаллы, серые камни, орудия.
const T = 'tower-defense-kit/Models/GLB format/';
const ls = names => names.map(n => `${T}${n}.glb`);
export const SETS = [
  { id: 'glitch', type: 'kit', out: 'kits/glitch.glb', parts: ls([
    'tower-square-build-a', 'tower-square-build-b', 'tower-square-build-c', 'tower-square-build-d', 'tower-square-build-e', 'tower-square-build-f', 'tower-square-bottom-b',
    'tower-round-crystals', 'detail-crystal', 'detail-rocks', 'weapon-turret', 'weapon-ballista', 'weapon-catapult']) },
];
