// Кто сражается в каком мире: обычные мобы (Blob), мини-босс конца обычного боя, босс мира.
// Индекс = номер мира в content/worlds.mjs. Названия — файлы public/models/monsters (Quaternius Ultimate Monsters, CC0).
// Финальный Глитч (мир «Башня Глитча») — призрак-череп в глитч-палитре.
export interface Roster { mobs: string[]; mini: string; boss: string; scale?: { mini?: number; boss?: number } }
export const ROSTER: Roster[] = [
  /* 0 деревня */ { mobs: ['Blob_GreenBlob', 'Blob_PinkBlob', 'Blob_Chicken', 'Blob_Dog'], mini: 'Blob_Mushnub_Evolved', boss: 'Big_Bunny' },
  /* 1 джунгли */ { mobs: ['Blob_Mushnub', 'Blob_GreenSpikyBlob', 'Flying_Armabee'], mini: 'Big_Monkroose', boss: 'Big_Tribal' },
  /* 2 острова */ { mobs: ['Flying_Pigeon', 'Flying_Glub', 'Blob_Pigeon'], mini: 'Flying_Alpaking_Evolved', boss: 'Flying_Dragon_Evolved' },
  /* 3 пещеры */ { mobs: ['Blob_Alien', 'Blob_Wizard', 'Flying_Glub'], mini: 'Flying_Goleling_Evolved', boss: 'Big_Alien' },
  /* 4 неон */ { mobs: ['Blob_Ninja', 'Blob_Cactoro', 'Flying_Hywirl'], mini: 'Big_Ninja', boss: 'Big_Demon' },
  /* 5 молнии */ { mobs: ['Flying_Hywirl', 'Blob_Birb', 'Blob_Pigeon'], mini: 'Flying_Squidle', boss: 'Big_Birb' },
  /* 6 лёд */ { mobs: ['Blob_Yeti', 'Flying_Ghost', 'Blob_Fish'], mini: 'Flying_Ghost_Skull', boss: 'Big_Yeti' },
  /* 7 вулкан */ { mobs: ['Blob_GreenSpikyBlob', 'Blob_Orc', 'Flying_Dragon'], mini: 'Big_Demon', boss: 'Big_Dino' },
  /* 8 храм */ { mobs: ['Blob_Fish', 'Flying_Squidle', 'Blob_GreenBlob'], mini: 'Big_Fish', boss: 'Big_Frog' },
  /* 9 великаны */ { mobs: ['Blob_Orc', 'Blob_Cactoro', 'Blob_Yeti'], mini: 'Big_Orc', boss: 'Big_Orc_Skull', scale: { boss: 1.5 } },
  /* 10 башня */ { mobs: ['Blob_Ninja', 'Flying_Ghost', 'Blob_Wizard'], mini: 'Big_BlueDemon', boss: 'Flying_Ghost_Skull', scale: { boss: 1.7 } },
  /* 11 арена */ { mobs: ['Blob_PinkBlob', 'Flying_Armabee', 'Blob_Orc'], mini: 'Big_MushroomKing', boss: 'Big_Orc_Skull' },
];
/** Кто выйдет: kind — вид моба из мира (0..2), mini — мини-босс, boss — босс мира. Возвращает файл и множитель роста. */
export function pickEnemy(world: number, kind: number, mini: boolean, boss: boolean, wave = 0): { id: string; scale: number } {
  const r = ROSTER[Math.max(0, Math.min(ROSTER.length - 1, world))];
  if (boss) return { id: r.boss, scale: r.scale?.boss ?? 1.25 };
  if (mini) return { id: r.mini, scale: r.scale?.mini ?? 1.15 };
  return { id: r.mobs[(kind + wave) % r.mobs.length], scale: 1 };
}
