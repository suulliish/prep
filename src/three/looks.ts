// Костюмы героя (путь наград, content/worlds.mjs → OUTFITS): какой из шести героев KayKit, что в руках, что скрыть, оттенок.
// Костюм — только внешность: удары и анимации у всех одни (см. docs/GAME_LOOP.md 5).
import type { HeroKind } from './actor';

export interface HeroLook { kind: HeroKind; weapon: string; offhand?: string; hide?: string[]; tint?: [number, number, number]; glow?: number }
export const LOOKS: Record<string, HeroLook> = {
  cyan: { kind: 'Rogue', weapon: 'sword_1handed', offhand: 'shield_badge_color' },                                   // Кодер
  gold: { kind: 'Knight', weapon: 'sword_1handed', offhand: 'shield_round_color', tint: [1.9, 1.45, 0.5] },                  // Алтын: золотые латы
  pink: { kind: 'Rogue_Hooded', weapon: 'dagger', offhand: 'shield_square_color', tint: [1.6, 0.85, 1.5] },                  // Неон
  forest: { kind: 'Ranger', weapon: 'axe_1handed', offhand: 'shield_round_barbarian' },                              // Орман
  lava: { kind: 'Barbarian', weapon: 'axe_1handed', offhand: 'shield_spikes_color', tint: [1.6, 0.85, 0.7] },                 // Жалын
  frost: { kind: 'Mage', weapon: 'wand', offhand: 'spellbook_closed', tint: [0.75, 1.25, 1.7] },                              // Аяз
  void: { kind: 'Knight', weapon: 'sword_1handed', offhand: 'shield_badge', hide: ['Knight_Helmet', 'Knight_HelmetVisor'], tint: [1.0, 0.65, 1.7], glow: 0x8a5cff },  // Бос кеңістік
  crystal: { kind: 'Mage', weapon: 'wand', offhand: 'spellbook_open', hide: ['Mage_Hat'], tint: [1.5, 1.05, 1.8], glow: 0xd9b8ff },                             // Кристалл
};
export const DEFAULT_LOOK = LOOKS.cyan;
