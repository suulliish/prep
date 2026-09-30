// Мир 4 «Неоновый город»: Kenney City Kit (Commercial + Roads), CC0. Неон рисуется кодом (src/three/worlds/4-neon.ts).
const C = 'kenney-city-kit-commercial/Models/GLB format/';
const R = 'kenney-city-kit-roads/Models/GLB format/';
const pick = (dir, names) => names.map(n => `${dir}${n}.glb`);

export const SETS = [
  { id: 'neon', type: 'kit', out: 'kits/neon.glb', parts: [
    ...pick(C, ['building-a', 'building-c', 'building-e', 'building-h', 'building-i', 'building-m', 
      'building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c', 'building-skyscraper-d', 'building-skyscraper-e',
      'low-detail-building-wide-a', 'low-detail-building-wide-b']),
    ...pick(R, ['light-square', 'light-square-double', 'light-curved', 'light-curved-double', 'light-curved-cross', 'traffic-light', 'sign-highway-wide', 'sign-highway-detailed',
      'road-sign-empty-hanging', 'road-sign-street', 'electricity-pole', 'electricity-pole-wide', 'bridge-pillar-wide', 'construction-barrier', 'construction-cone', 'construction-fence',
      'construction-light', 'dumpster']),
  ] },
];
