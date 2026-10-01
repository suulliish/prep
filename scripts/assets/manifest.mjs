// Что попадает в игру из готовых паков. Все паки CC0 (KayKit, Kenney, Quaternius): docs/CREDITS.md.
// Исходники лежат вне репозитория (ASSET_SRC): chars/ items/ hex/ forest/ monsters/ pirate/ anims/ (см. scripts/assets/README.md).

const HEX = 'hex/';
const F = 'forest/';
const list = (dir, names, ext = '.gltf') => names.map(n => `${dir}${n}${ext}`);

// клипы героя: только нужные игре (остальные тяжёлые и не используются)
export const HERO_CLIPS = {
  General: ['Idle_A', 'Idle_B', 'Hit_A', 'Hit_B', 'Death_A', 'Spawn_Air', 'Spawn_Ground', 'Interact', 'PickUp', 'Use_Item', 'Throw'],
  MovementBasic: ['Walking_A', 'Walking_B', 'Running_A', 'Running_B', 'Jump_Full_Short', 'Jump_Full_Long', 'Jump_Start', 'Jump_Idle', 'Jump_Land'],
  MovementAdvanced: ['Dodge_Backward', 'Dodge_Forward', 'Dodge_Left', 'Dodge_Right', 'Walking_Backwards', 'Crouching'],
  CombatMelee: ['Melee_1H_Attack_Chop', 'Melee_1H_Attack_Slice_Diagonal', 'Melee_1H_Attack_Slice_Horizontal', 'Melee_1H_Attack_Stab', 'Melee_1H_Attack_Jump_Chop',
    'Melee_2H_Attack_Spin', 'Melee_2H_Attack_Spinning', 'Melee_2H_Attack_Chop', 'Melee_2H_Idle', 'Melee_Block', 'Melee_Blocking', 'Melee_Block_Hit', 'Melee_Block_Attack',
    'Melee_Unarmed_Attack_Kick', 'Melee_Unarmed_Attack_Punch_A', 'Melee_Unarmed_Idle'],   // бой с тенью на тренировке (урок)
  CombatRanged: ['Ranged_Magic_Shoot', 'Ranged_Magic_Spellcasting', 'Ranged_Magic_Raise', 'Ranged_Magic_Summon', 'Ranged_Bow_Draw', 'Ranged_Bow_Release', 'Ranged_Bow_Aiming_Idle', 'Ranged_Bow_Idle', 'Ranged_1H_Shoot'],
  Simulation: ['Cheering', 'Waving', 'Sit_Floor_Down', 'Sit_Floor_Idle', 'Sit_Floor_StandUp', 'Push_Ups', 'Sit_Ups', 'Lie_Down', 'Lie_Idle', 'Lie_StandUp'],   // палуба и тренировка: сидит, качается, машет, отдыхает лёжа
  Tools: ['Hammer', 'Hammering'],   // корабль: чинит поломку молотком
};

// клипы монстров: имена у Quaternius одинаковы внутри папки
const MON_KEEP = ['Idle', 'Flying_Idle', 'Walk', 'Run', 'Fast_Flying', 'Punch', 'Weapon', 'Headbutt', 'Bite_Front', 'HitReact', 'HitRecieve', 'Death', 'Jump', 'Yes', 'No', 'Dance', 'Wave'];
const MON = {
  Big: ['Alien', 'Birb', 'BlueDemon', 'Bunny', 'Cactoro', 'Demon', 'Dino', 'Fish', 'Frog', 'Monkroose', 'MushroomKing', 'Ninja', 'Orc', 'Orc_Skull', 'Tribal', 'Yeti'],
  Blob: ['Alien', 'Birb', 'Cactoro', 'Cat', 'Chicken', 'Dog', 'Fish', 'GreenBlob', 'GreenSpikyBlob', 'Mushnub', 'Mushnub_Evolved', 'Ninja', 'Orc', 'Pigeon', 'PinkBlob', 'Wizard', 'Yeti'],
  Flying: ['Alpaking', 'Alpaking_Evolved', 'Armabee', 'Armabee_Evolved', 'Dragon', 'Dragon_Evolved', 'Ghost', 'Ghost_Skull', 'Glub', 'Glub_Evolved', 'Goleling', 'Goleling_Evolved', 'Hywirl', 'Pigeon', 'Squidle', 'Tribal'],
};

export const SETS = [
  { id: 'heroes', type: 'single', skinned: true, out: 'heroes', files: ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded', 'Ranger'].map(n => ({ src: `chars/${n}.glb` })) },
  { id: 'anims', type: 'anims', out: 'anims', files: Object.entries(HERO_CLIPS).map(([set, keep]) => ({ src: `anims/Rig_Medium_${set}.glb`, out: `${set}.glb`, keep })) },
  { id: 'items', type: 'kit', out: 'kits/items.glb', parts: ['items/*'] },
  { id: 'monsters', type: 'single', skinned: true, out: 'monsters',
    files: Object.entries(MON).flatMap(([kind, names]) => names.map(n => ({ src: `monsters/${kind}/${n}.gltf`, out: `${kind}_${n}.glb`, keep: MON_KEEP }))) },
  // остров из шестигранных плиток: земля, вода, берег, дороги, холмы, горы, деревья, камни, облака, реквизит
  { id: 'hexcore', type: 'kit', out: 'kits/hexcore.glb', parts: [
    ...list(HEX + 'tiles/base/', ['hex_grass', 'hex_grass_bottom', 'hex_grass_sloped_high', 'hex_grass_sloped_low', 'hex_water']),
    ...list(HEX + 'tiles/coast/', ['hex_coast_A', 'hex_coast_B', 'hex_coast_C', 'hex_coast_D', 'hex_coast_E']),
    ...list(HEX + 'tiles/roads/', ['hex_road_A', 'hex_road_B', 'hex_road_C', 'hex_road_D']),
    HEX + 'decoration/nature/*', HEX + 'decoration/props/*',
  ] },
  { id: 'forest', type: 'kit', out: 'kits/forest.glb', parts: [
    ...list(F, ['Tree_1_A', 'Tree_1_B', 'Tree_1_C', 'Tree_2_A', 'Tree_2_B', 'Tree_2_C', 'Tree_2_D', 'Tree_3_A', 'Tree_3_B', 'Tree_3_C', 'Tree_4_A', 'Tree_4_B', 'Tree_4_C',
      'Tree_Bare_1_A', 'Tree_Bare_1_B', 'Tree_Bare_1_C', 'Tree_Bare_2_A', 'Tree_Bare_2_B', 'Tree_Bare_2_C',
      'Bush_1_A', 'Bush_1_B', 'Bush_1_C', 'Bush_2_A', 'Bush_2_B', 'Bush_3_A', 'Bush_4_A', 'Bush_4_B', 'Bush_4_C',
      'Rock_1_A', 'Rock_1_B', 'Rock_1_C', 'Rock_2_A', 'Rock_2_B', 'Rock_2_C', 'Rock_3_A', 'Rock_3_B', 'Rock_3_C',
      'Grass_1_A', 'Grass_1_B', 'Grass_1_C', 'Grass_2_A', 'Grass_2_B', 'Grass_2_C'].map(n => `${n}_Color1`)),
  ] },
  { id: 'village', type: 'kit', out: 'kits/village.glb', parts: [HEX + 'buildings/blue/*'] },
  { id: 'ship', type: 'kit', out: 'kits/ship.glb', parts: list('pirate/', ['ship-large', 'ship-medium', 'ship-small', 'ship-pirate-large', 'ship-wreck', 'chest', 'barrel', 'crate', 'crate-bottles', 'cannon',
    'mast', 'flag', 'flag-pirate', 'palm-straight', 'palm-bend', 'palm-detailed-straight', 'rocks-a', 'rocks-b', 'rocks-c', 'rocks-sand-a', 'rocks-sand-b', 'patch-sand', 'grass', 'platform',
    'structure-platform-dock', 'tool-paddle', 'tool-shovel', 'tower-complete-small', 'tower-complete-large', 'castle-gate', 'castle-wall'], '.glb') },
];
