// Миры «Разлома» (docs/GAME_DESIGN.md 2–4). Темы задач с мирами не связаны: портал заряжается энергией Кода —
// числом изученных и освоенных тем (какие — неважно). Босс мира — смешанный бой по всему пройденному (чередование).
// sky: [верх, середина, низ, сияние] в RGB 0..1; mob — вид глитч-моба.
export const WORLDS = [
  { id: 'village', kz: 'Пиксель ауылы', ru: 'Пиксельная деревня', need: 0, sky: [[.03, .04, .13], [.17, .08, .36], [.62, .22, .47], [.05, .35, .4]], fog: 0x17104a, mob: 0, isle: ['#5ce39c', '#2f8f5b'] },
  { id: 'jungle', kz: 'Джунгли қирандылары', ru: 'Джунгли с руинами', need: 5, sky: [[.02, .08, .06], [.07, .25, .16], [.45, .55, .25], [.3, .6, .2]], fog: 0x0f2a1c, mob: 2, isle: ['#7bd96b', '#3b6b2a'] },
  { id: 'isles', kz: 'Қалқыған аралдар', ru: 'Парящие острова', need: 12, sky: [[.1, .25, .5], [.35, .55, .85], [.85, .8, .9], [.9, .9, 1]], fog: 0x6d8fd0, mob: 1, isle: ['#9fd3ff', '#4a7bd0'] },
  { id: 'caves', kz: 'Кристалл үңгірлері', ru: 'Кристальные пещеры', need: 20, sky: [[.02, .01, .06], [.12, .05, .25], [.3, .15, .5], [.6, .3, .9]], fog: 0x120a26, mob: 1, isle: ['#b58cff', '#5a3bb0'] },
  { id: 'neon', kz: 'Неон қаласы', ru: 'Неоновый город', need: 30, sky: [[.01, .01, .05], [.2, .02, .25], [.9, .1, .5], [.1, .9, 1]], fog: 0x1a0626, mob: 0, isle: ['#ff4fb8', '#3ff0ff'] },
  { id: 'storm', kz: 'Найзағай трассасы', ru: 'Трасса молний', need: 42, sky: [[.04, .04, .1], [.15, .15, .3], [.4, .4, .55], [1, .9, .3]], fog: 0x1c1c33, mob: 2, isle: ['#ffc94a', '#6b5a2a'] },
  { id: 'ice', kz: 'Мұзды әлем', ru: 'Ледяная изнанка', need: 56, sky: [[.1, .2, .35], [.4, .6, .8], [.85, .95, 1], [.6, 1, 1]], fog: 0x7fa6c9, mob: 1, isle: ['#e6fbff', '#7fb8d9'] },
  { id: 'volcano', kz: 'Жанартау', ru: 'Вулкан', need: 72, sky: [[.08, .01, .01], [.35, .06, .02], [.95, .35, .05], [1, .5, .1]], fog: 0x3a0c04, mob: 2, isle: ['#ff6a3d', '#5a1a0a'] },
  { id: 'temple', kz: 'Су астындағы ғибадатхана', ru: 'Затонувший храм', need: 90, sky: [[0, .05, .12], [0, .2, .3], [.1, .5, .55], [.2, 1, .8]], fog: 0x032a33, mob: 0, isle: ['#3ff0c0', '#0d5f6c'] },
  { id: 'giants', kz: 'Алыптар әлемі', ru: 'Мир великанов', need: 110, sky: [[.15, .1, .05], [.5, .35, .2], [.95, .75, .45], [1, .8, .4]], fog: 0x5a4020, mob: 2, isle: ['#d9a25c', '#6b4a22'] },
  { id: 'tower', kz: 'Глитч мұнарасы', ru: 'Башня Глитча', need: 135, sky: [[.05, 0, .05], [.3, 0, .25], [.7, 0, .4], [1, .2, .8]], fog: 0x26001f, mob: 0, isle: ['#ff4fb8', '#26001f'] },
  { id: 'arena', kz: 'Разлом аренасы', ru: 'Арена Разлома', need: 160, arena: true, sky: [[.02, .02, .05], [.1, .1, .2], [.9, .75, .3], [1, .8, .3]], fog: 0x14142a, mob: 1, isle: ['#ffc94a', '#14142a'] },
];

/** Энергия Кода: изученная тема — 1, меңгерілген (кристалл) и автоматическая — 2. */
export function codeEnergy(skills) {
  let e = 0;
  for (const s of Object.values(skills)) e += s.status === 'learned' ? 1 : s.status === 'mastered' || s.status === 'automatic' ? 2 : 0;
  return e;
}

// Путь наград (как путь трофеев): вехи по числу кристаллов (меңгерілген тем). Костюм — только внешний вид.
export const OUTFITS = [
  { id: 'cyan', kz: 'Кодер', need: 0, jacket: 0x22b8cc, dark: 0x137e8f, visor: 0x3ff0ff },
  { id: 'gold', kz: 'Алтын', need: 3, jacket: 0xf2b632, dark: 0xa8741a, visor: 0xfff2a0 },
  { id: 'pink', kz: 'Неон', need: 6, jacket: 0xff4fb8, dark: 0xa0226f, visor: 0x3ff0ff },
  { id: 'forest', kz: 'Орман', need: 10, jacket: 0x3fae5c, dark: 0x1f6b33, visor: 0xc6ff7a },
  { id: 'lava', kz: 'Жалын', need: 15, jacket: 0xe8492a, dark: 0x8a2412, visor: 0xffc94a },
  { id: 'frost', kz: 'Аяз', need: 20, jacket: 0xdff4ff, dark: 0x7fb8d9, visor: 0x7ae8ff },
  { id: 'void', kz: 'Бос кеңістік', need: 30, jacket: 0x2a1f4d, dark: 0x120a26, visor: 0xb58cff },
  { id: 'crystal', kz: 'Кристалл', need: 45, jacket: 0xb58cff, dark: 0x5a3bb0, visor: 0xffffff },
];
