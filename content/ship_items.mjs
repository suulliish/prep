// Мастерская корабля (GAME_LOOP 5, L5): украшения и отсеки за монеты — только красота, на учёбу не влияют.
// Каталог — договор между экраном мастерской (src/screens/Workshop.svelte, покупка, монеты) и 3D-кораблём
// (src/three/hub3d.ts + decor3d.ts: предмет ставится в своё место на палубе, питомец ходит за героем).
//
// Поля предмета:
//   id     — уникальный ключ (хранится в сохранении, не менять);
//   kz, ru — название (на экране ребёнка только kz);
//   price  — цена в монетах;
//   slot   — место на корабле: 'deck' (палуба), 'bow' (нос), 'stern' (корма), 'mast' (мачты: флаги, огни), 'pet' (питомец — один активный);
//   model  — { kit, name, h }: набор из public/models/kits (kit: 'ship' | 'arena' | 'shipdecor'), имя модели в нём, высота в метрах.
//            Особые kit: 'pets' — файл питомца public/models/pets/<name>.glb (с клипами idle/walk/run/dance/gesture-positive);
//            'code' — предмет собран кодом (src/three/decor_models.ts, имя = ключ CODE_MODELS), файлов нет;
//   icon   — картинка для экрана мастерской (public/ui/ship/<id>.png, 256×256, прозрачный фон; делает scripts/assets/ship-icons.mjs);
//   r      — радиус основания предмета, м (для мест на палубе: не наезжать друг на друга);
//   glow   — (необязательно) цвет свечения у фонаря;  flat — (необязательно) плоский предмет, по нему можно ходить.
// Место предмета на корабле зависит от номера среди предметов его слота: порядок не менять, новые дописывать в конец слота.
// Заполняет и проверяет 3D-сторона (tests/ship_items.test.ts); экран только читает.
const I = id => `ui/ship/${id}.png`;
export const SHIP_ITEMS = [
  // ---- палуба ----
  { id: 'rope_coil', kz: 'Арқан орамы', ru: 'Бухта каната', price: 20, slot: 'deck', model: { kit: 'shipdecor', name: 'rope_bundle_A', h: 0.28 }, icon: I('rope_coil'), r: 0.5, flat: true },
  { id: 'barrel_pair', kz: 'Бөшкелер', ru: 'Бочки', price: 30, slot: 'deck', model: { kit: 'shipdecor', name: 'Fuel_A_Barrels', h: 0.9 }, icon: I('barrel_pair'), r: 0.7 },
  { id: 'flower_pot', kz: 'Кактус', ru: 'Кактус в горшке', price: 35, slot: 'deck', model: { kit: 'shipdecor', name: 'cactus_medium_B', h: 0.85 }, icon: I('flower_pot'), r: 0.5 },
  { id: 'lantern_floor', kz: 'Шам-шырақ', ru: 'Фонарь', price: 45, slot: 'deck', model: { kit: 'shipdecor', name: 'lantern', h: 0.95 }, icon: I('lantern_floor'), r: 0.4, glow: 0xffc56b },
  { id: 'gem_crate', kz: 'Асыл тас жәшігі', ru: 'Ящик с самоцветами', price: 60, slot: 'deck', model: { kit: 'shipdecor', name: 'crate-item-strong', h: 0.9 }, icon: I('gem_crate'), r: 0.5 },
  { id: 'cannon', kz: 'Зеңбірек', ru: 'Пушка', price: 90, slot: 'deck', model: { kit: 'ship', name: 'cannon', h: 1.0 }, icon: I('cannon'), r: 0.9 },
  { id: 'map_table', kz: 'Карта үстелі', ru: 'Стол с картой', price: 100, slot: 'deck', model: { kit: 'code', name: 'map_table', h: 1.05 }, icon: I('map_table'), r: 0.55 },
  { id: 'gold_bars', kz: 'Алтын кірпіштер', ru: 'Золотые слитки', price: 110, slot: 'deck', model: { kit: 'shipdecor', name: 'Gold_Bars_Stack_Medium', h: 1.15 }, icon: I('gold_bars'), r: 0.4 },
  { id: 'lantern_big', kz: 'Үлкен шам', ru: 'Большой фонарь', price: 60, slot: 'deck', model: { kit: 'shipdecor', name: 'lantern', h: 1.6 }, icon: I('lantern_big'), r: 0.5, glow: 0xffc56b },
  // ---- нос ----
  { id: 'statue_hero', kz: 'Батыр мүсіні', ru: 'Статуя героя', price: 140, slot: 'bow', model: { kit: 'arena', name: 'statue', h: 2.1 }, icon: I('statue_hero'), r: 0.6 },
  // ---- корма ----
  { id: 'chest_gold', kz: 'Алтын сандық', ru: 'Золотой сундук', price: 80, slot: 'stern', model: { kit: 'ship', name: 'chest', h: 0.85 }, icon: I('chest_gold'), r: 0.55 },
  { id: 'captain_chair', kz: 'Капитан орындығы', ru: 'Кресло капитана', price: 70, slot: 'stern', model: { kit: 'shipdecor', name: 'armchair', h: 1.15 }, icon: I('captain_chair'), r: 0.85 },
  { id: 'trophy', kz: 'Жеңімпаз кубогы', ru: 'Кубок победителя', price: 170, slot: 'stern', model: { kit: 'arena', name: 'trophy', h: 1.4 }, icon: I('trophy'), r: 0.8 },
  // ---- мачты ----
  { id: 'bunting', kz: 'Түрлі-түсті жалаулар', ru: 'Гирлянда флажков', price: 55, slot: 'mast', model: { kit: 'code', name: 'bunting', h: 1 }, icon: I('bunting') },
  { id: 'banner_star', kz: 'Жұлдызды ту', ru: 'Знамя со звездой', price: 65, slot: 'mast', model: { kit: 'code', name: 'banner_star', h: 2 }, icon: I('banner_star') },
  { id: 'string_lights', kz: 'Жарық шамдары', ru: 'Огоньки-гирлянда', price: 75, slot: 'mast', model: { kit: 'code', name: 'string_lights', h: 1 }, icon: I('string_lights') },
  // ---- питомцы (один активный) ----
  { id: 'pet_cat', kz: 'Мысық', ru: 'Кот', price: 120, slot: 'pet', model: { kit: 'pets', name: 'animal-cat', h: 0.9 }, icon: I('pet_cat') },
  { id: 'pet_dog', kz: 'Күшік', ru: 'Щенок', price: 130, slot: 'pet', model: { kit: 'pets', name: 'animal-dog', h: 0.9 }, icon: I('pet_dog') },
  { id: 'pet_fox', kz: 'Түлкі', ru: 'Лиса', price: 150, slot: 'pet', model: { kit: 'pets', name: 'animal-fox', h: 0.9 }, icon: I('pet_fox') },
  { id: 'pet_parrot', kz: 'Тотықұс', ru: 'Попугай', price: 180, slot: 'pet', model: { kit: 'pets', name: 'animal-parrot', h: 0.9 }, icon: I('pet_parrot') },
  { id: 'pet_penguin', kz: 'Пингвин', ru: 'Пингвин', price: 200, slot: 'pet', model: { kit: 'pets', name: 'animal-penguin', h: 0.9 }, icon: I('pet_penguin') },
  { id: 'pet_panda', kz: 'Панда', ru: 'Панда', price: 250, slot: 'pet', model: { kit: 'pets', name: 'animal-panda', h: 1.0 }, icon: I('pet_panda') },
];

/** Сколько монет за что (экономика только для красоты; меняется здесь). */
export const COINS = { correct: 2, enemy: 5, boss: 25, stars3: 10 };
