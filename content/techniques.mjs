// Приёмы (GAME_LOOP 19): урок темы = тренировка приёма; в бою на задаче этой темы герой бьёт этим приёмом — название над ударом и свой цвет.
// Только красота и называние: урон всегда 1 («пусть всё решает ответ»). Карточки приёмов — в Альбоме.
// Поля: skill — id темы (content/skills.mjs); kz, ru — название (ребёнку только kz; проверить носителем языка);
//   color — цвет следа удара и надписи; fx — вид удара: 'arc' (дуга), 'pierce' (выпад), 'split' (рассекает на части), 'multi' (серия), 'spin' (вихрь).
// Каждая тема с уроком обязана иметь приём (проверка: tests/techniques.test.ts).
export const TECHNIQUES = [
  // ---- натурал сандар ----
  { skill: 'nat.place_value', kz: 'Разряд соққысы', ru: 'Удар разрядов', color: 0x35e6ff, fx: 'pierce' },
  { skill: 'nat.ops', kz: 'Бағана соққысы', ru: 'Удар столбиком', color: 0x5ea0ff, fx: 'arc' },
  { skill: 'nat.order_ops', kz: 'Кезек тәсілі', ru: 'Приём очереди', color: 0x7dffd4, fx: 'multi' },
  { skill: 'nat.powers', kz: 'Дәреже құйыны', ru: 'Вихрь степени', color: 0xa77bff, fx: 'spin' },
  // ---- бөлінгіштік ----
  { skill: 'div.rules', kz: 'Белгі соққысы', ru: 'Удар признака', color: 0x3ddc6e, fx: 'pierce' },
  { skill: 'div.primes', kz: 'Жай сан найзасы', ru: 'Копьё простого числа', color: 0xffcb2e, fx: 'pierce' },
  { skill: 'div.factorization', kz: 'Жіктеу соққысы', ru: 'Удар разложения', color: 0xff9a3d, fx: 'split' },
  { skill: 'div.gcd', kz: 'Ортақ бөлгіш тәсілі', ru: 'Приём общего делителя', color: 0x3ddc6e, fx: 'split' },
  { skill: 'div.lcm', kz: 'Ортақ еселік тәсілі', ru: 'Приём общего кратного', color: 0x35e6ff, fx: 'multi' },
  { skill: 'div.gcd_lcm_word', kz: 'Екі жақты тәсіл', ru: 'Двусторонний приём', color: 0x7dffd4, fx: 'arc' },
  { skill: 'div.count_multiples', kz: 'Еселік қадамы', ru: 'Шаг кратных', color: 0x5ea0ff, fx: 'multi' },
  { skill: 'div.star_digit', kz: 'Жұлдыз соққысы', ru: 'Звёздный удар', color: 0xffcb2e, fx: 'spin' },
  { skill: 'div.powers_count', kz: 'Шаршы мен куб тәсілі', ru: 'Приём квадратов и кубов', color: 0xa77bff, fx: 'multi' },
  { skill: 'div.trailing_zeros', kz: 'Нөл аулау', ru: 'Охота за нулями', color: 0xff4fb8, fx: 'pierce' },
  // ---- бөлшектер ----
  { skill: 'frac.concept', kz: 'Бөлшек кесуі', ru: 'Разрез дроби', color: 0x35e6ff, fx: 'split' },
  { skill: 'frac.magnitude', kz: 'Бағдар тәсілі', ru: 'Приём ориентира', color: 0x7dffd4, fx: 'pierce' },
  { skill: 'frac.basic_property', kz: 'Тең бөлшек тәсілі', ru: 'Приём равных дробей', color: 0xffcb2e, fx: 'arc' },
  { skill: 'frac.reduce', kz: 'Қысқарту соққысы', ru: 'Удар сокращения', color: 0x3ddc6e, fx: 'split' },
  { skill: 'frac.common_denominator', kz: 'Ортақ бөлім тәсілі', ru: 'Приём общего знаменателя', color: 0x5ea0ff, fx: 'multi' },
  { skill: 'frac.compare', kz: 'Салыстыру көзі', ru: 'Глаз сравнения', color: 0xa77bff, fx: 'pierce' },
  { skill: 'frac.add_sub', kz: 'Бөлшек қосу соққысы', ru: 'Удар сложения дробей', color: 0x35e6ff, fx: 'arc' },
  { skill: 'frac.mixed', kz: 'Аралас соққы', ru: 'Смешанный удар', color: 0xff9a3d, fx: 'multi' },
  { skill: 'frac.mul', kz: 'Көбейту соққысы', ru: 'Удар умножения', color: 0xffcb2e, fx: 'spin' },
  { skill: 'frac.div', kz: 'Аударма соққысы', ru: 'Удар переворота', color: 0xff4fb8, fx: 'spin' },
  { skill: 'frac.part_of_number', kz: 'Бөлік соққысы', ru: 'Удар части', color: 0x3ddc6e, fx: 'split' },
  // ---- ондық бөлшектер (C3, 02.10) ----
  { skill: 'dec.concept', kz: 'Үтір соққысы', ru: 'Удар запятой', color: 0x35e6ff, fx: 'pierce' },
  { skill: 'dec.compare_round', kz: 'Дөңгелек тәсілі', ru: 'Приём округления', color: 0x7dffd4, fx: 'spin' },
  { skill: 'dec.add_sub', kz: 'Үтір бағанасы', ru: 'Столбик запятых', color: 0x5ea0ff, fx: 'arc' },
  { skill: 'dec.mul_div', kz: 'Үтір секірісі', ru: 'Прыжок запятой', color: 0xffcb2e, fx: 'multi' },
  { skill: 'dec.frac_convert', kz: 'Екі жүз соққысы', ru: 'Удар двух лиц', color: 0xa77bff, fx: 'split' },
  { skill: 'frac.find_whole', kz: 'Бүтінді табу тәсілі', ru: 'Приём целого', color: 0x7dffd4, fx: 'arc' },
  // ---- жиындар, тізбектер, логика ----
  { skill: 'sets.basics', kz: 'Жиын торы', ru: 'Сеть множеств', color: 0x5ea0ff, fx: 'multi' },
  { skill: 'sets.venn', kz: 'Венн шеңбері', ru: 'Круг Венна', color: 0xa77bff, fx: 'spin' },
  { skill: 'pat.sequences', kz: 'Тізбек соққысы', ru: 'Удар последовательности', color: 0xd6f24a, fx: 'multi' },
  { skill: 'logic.calendar', kz: 'Күнтізбе тәсілі', ru: 'Приём календаря', color: 0xffcb2e, fx: 'arc' },
  { skill: 'logic.permutations', kz: 'Ағаш тәсілі', ru: 'Приём дерева', color: 0x3ddc6e, fx: 'split' },
  { skill: 'logic.pairs_tournament', kz: 'Турнир тәсілі', ru: 'Приём турнира', color: 0xff9a3d, fx: 'multi' },
  { skill: 'logic.page_digits', kz: 'Бет санау тәсілі', ru: 'Приём страниц', color: 0x35e6ff, fx: 'pierce' },
  { skill: 'logic.cryptarithm', kz: 'Шифр кілті', ru: 'Ключ шифра', color: 0xff4fb8, fx: 'pierce' },
  { skill: 'logic.weighing', kz: 'Таразы тәсілі', ru: 'Приём весов', color: 0xc0c8ff, fx: 'arc' },
  { skill: 'vis.count_squares', kz: 'Шаршы көзі', ru: 'Глаз квадратов', color: 0x7dffd4, fx: 'spin' },
];

export const techniqueOf = skill => TECHNIQUES.find(t => t.skill === skill) ?? null;
