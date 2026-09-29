// Костюмы героя (путь наград, content/worlds.mjs → OUTFITS): какой из шести героев KayKit, что в руках, что скрыть, оттенок.
// Костюм — только внешность: удары и анимации у всех одни (см. docs/GAME_LOOP.md 5).
import type { HeroKind } from './actor';

export interface HeroLook { kind: HeroKind; weapon: string; offhand?: string; hide?: string[]; tint?: number; glow?: number }
export const LOOKS: Record<string, HeroLook> = {
  cyan: { kind: 'Rogue', weapon: 'sword_1handed', offhand: 'shield_badge_color' },                                   // Кодер
  gold: { kind: 'Knight', weapon: 'sword_1handed', offhand: 'shield_round_color', tint: 0xffe08a },                  // Алтын: золотые латы
  pink: { kind: 'Rogue_Hooded', weapon: 'dagger', offhand: 'shield_square_color', tint: 0xff9bd8 },                  // Неон
  forest: { kind: 'Ranger', weapon: 'axe_1handed', offhand: 'shield_round_barbarian' },                              // Орман
  lava: { kind: 'Barbarian', weapon: 'axe_1handed', offhand: 'shield_spikes_color', tint: 0xff8a5c },                 // Жалын
  frost: { kind: 'Mage', weapon: 'wand', offhand: 'spellbook_closed', tint: 0xbfe9ff },                              // Аяз
  void: { kind: 'Knight', weapon: 'sword_1handed', offhand: 'shield_badge', hide: ['Knight_Helmet', 'Knight_HelmetVisor'], tint: 0x8a72c8, glow: 0xb58cff },  // Бос кеңістік
  crystal: { kind: 'Mage', weapon: 'wand', offhand: 'spellbook_open', hide: ['Mage_Hat'], tint: 0xd9b8ff, glow: 0xffffff },                             // Кристалл
};
export const DEFAULT_LOOK = LOOKS.cyan;
