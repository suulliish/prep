// Граф навыков v1. Категории A–J — как в docs/ARCHITECTURE.md раздел 1 (K — координаты).
// grade: 5 | 6 | 'olymp' (сверх программы, но встречается в пробниках).
// pre — что нужно освоить раньше. t — генераторы из content/templates. fig — нужен рисунок.
// Названия kz — черновик, проверяет носитель языка.

const W = { A: 3, B: 3, C: 3, D: 2, E: 2, F: 2, G: 2, H: 1, I: 2, J: 2, K: 1 };

const S = [];
const s = (id, cat, grade, kz, ru, pre = [], opt = {}) => S.push({ id, cat, grade, title: { kz, ru }, prereqs: pre, templates: opt.t || [], figure: !!opt.fig, weight: W[cat] });

// ---- Натуральные числа, действия ----
s('nat.place_value', 'C', 5, 'Натурал сандар, разрядтар', 'Натуральные числа, разряды', [], { t: ['nat.write_number'] });
s('nat.ops', 'C', 5, 'Натурал сандармен амалдар', 'Действия с натуральными числами', ['nat.place_value'], { t: ['nat.divide_remainder'] });
s('nat.order_ops', 'C', 5, 'Амалдар реті', 'Порядок действий', ['nat.ops'], { t: ['nat.order_of_ops'] });
s('nat.powers', 'C', 5, 'Дәреже: квадрат және куб', 'Степень: квадрат и куб', ['nat.ops'], { t: ['nat.powers_value'] });

// ---- Делимость, свойства чисел ----
s('div.rules', 'D', 5, 'Бөлінгіштік белгілері', 'Признаки делимости', ['nat.ops'], { t: ['div.which_divisible'] });
s('div.primes', 'D', 5, 'Жай және құрама сандар', 'Простые и составные числа', ['div.rules'], { t: ['div.which_prime'] });
s('div.factorization', 'D', 5, 'Жай көбейткіштерге жіктеу', 'Разложение на простые множители', ['div.primes'], { t: ['div.factorize'] });
s('div.gcd', 'D', 5, 'Ең үлкен ортақ бөлгіш (ЕҮОБ)', 'НОД', ['div.factorization'], { t: ['div.gcd_pair'] });
s('div.lcm', 'D', 5, 'Ең кіші ортақ еселік (ЕКОЕ)', 'НОК', ['div.factorization'], { t: ['div.lcm_pair'] });
s('div.gcd_lcm_word', 'D', 5, 'ЕҮОБ пен ЕКОЕ-ге мәтінді есептер', 'Задачи на НОД и НОК', ['div.gcd', 'div.lcm'], { t: ['div.gcd_lcm_story'] });
s('div.count_multiples', 'D', 5, 'Еселіктер санын табу', 'Сколько чисел кратны…', ['div.rules'], { t: ['logic.count_after_removal'] });
s('div.star_digit', 'D', 5, 'Жұлдызшаның орнына цифр қою', 'Цифра вместо звёздочки', ['div.rules'], { t: ['div.star_digit_9'] });
s('div.powers_count', 'D', 5, 'Квадраттар мен кубтар саны', 'Сколько квадратов/кубов', ['nat.powers'], { t: ['div.count_powers'] });
s('div.last_digit', 'D', 'olymp', 'Дәреженің соңғы цифры', 'Последняя цифра степени', ['nat.powers'], { t: ['div.last_digit_power', 'div.last_digit_sum'] });
s('div.trailing_zeros', 'D', 5, 'Көбейтіндінің соңындағы нөлдер', 'Нули в конце произведения', ['div.factorization'], { t: ['div.trailing_zeros_factorial', 'div.trailing_zeros_product'] });

// ---- Обыкновенные дроби ----
// Порядок по docs/PLAN.md (окт: делимость; ноя: дроби-база + весы/нули; дек: × ÷). Планировщик берёт тему с наибольшим весом (C=3 > D,I=2),
// поэтому без «замков» дроби обгоняли делимость, а × ÷ шли раньше сложения, весов и нулей. Замки (tests/progression.test.ts):
//  - frac.concept ждёт весь блок делимости (ЕҮОБ, ЕКОЕ, задачи);
//  - frac.mul (а за ним div/part_of_number/find_whole) ждёт конец базы дробей (frac.mixed) и ноябрьские весы, ребусы (шифры) и нули —
//    так × ÷ идут в декабре; сокращение остаётся на своём месте, сразу после основного свойства (PLAN: ноябрь).
//  - logic.permutations (комбинаторика — декабрь) ждёт весы, поэтому идёт после цепочки × ÷ (у неё вес выше).
s('frac.concept', 'C', 5, 'Жай бөлшек ұғымы', 'Понятие дроби', ['nat.ops', 'div.gcd_lcm_word'], { t: ['frac.concept_part', 'frac.concept_equal'] });
s('frac.magnitude', 'C', 5, 'Бөлшектің шамасы', 'Величина дроби (ориентиры 0, 1/2, 1)', ['frac.concept'], { t: ['frac.magnitude_half', 'frac.magnitude_near', 'frac.magnitude_estimate'] });
s('frac.basic_property', 'C', 5, 'Бөлшектің негізгі қасиеті', 'Основное свойство дроби', ['frac.concept'], { t: ['frac.equal_missing', 'frac.equal_which'] });
s('frac.reduce', 'C', 5, 'Бөлшекті қысқарту', 'Сокращение дробей', ['frac.basic_property', 'div.gcd'], { t: ['frac.reduce_lowest', 'frac.reduce_context'] });
s('frac.common_denominator', 'C', 5, 'Ортақ бөлімге келтіру', 'Общий знаменатель', ['frac.basic_property', 'div.lcm'], { t: ['frac.lcd_find', 'frac.lcd_numerators', 'frac.lcd_factor'] });
s('frac.compare', 'C', 5, 'Бөлшектерді салыстыру', 'Сравнение дробей', ['frac.common_denominator', 'frac.magnitude'], { t: ['frac.compare_extreme', 'frac.compare_order', 'frac.compare_true'] });
s('frac.add_sub', 'C', 5, 'Бөлшектерді қосу және азайту', 'Сложение и вычитание дробей', ['frac.common_denominator'], { t: ['frac.add_same', 'frac.add_diff', 'frac.to_whole', 'frac.rest_of_path'] });
s('frac.mixed', 'C', 5, 'Аралас сандар', 'Смешанные числа', ['frac.add_sub'], { t: ['frac.mixed_convert', 'frac.mixed_arith', 'frac.mixed_time'] });
s('frac.mul', 'C', 5, 'Бөлшектерді көбейту', 'Умножение дробей', ['frac.reduce', 'frac.mixed', 'div.trailing_zeros', 'logic.weighing', 'logic.cryptarithm'], { t: ['frac.mul_whole', 'frac.mul_frac', 'frac.mul_mixed', 'frac.mul_size'] });
s('frac.div', 'C', 5, 'Бөлшектерді бөлу', 'Деление дробей', ['frac.mul'], { t: ['frac.div_whole_by_frac', 'frac.div_frac_by_whole', 'frac.div_frac_frac', 'frac.div_size'] });
s('frac.part_of_number', 'C', 5, 'Санның бөлігін табу', 'Часть от числа', ['frac.mul'], { t: ['frac.part_of_number_direct', 'frac.part_of_number_more'] });
s('frac.find_whole', 'C', 5, 'Бөлігі бойынша санды табу', 'Число по его части', ['frac.div'], { t: ['frac.find_whole', 'frac.find_whole_story', 'frac.find_whole_rest'] });
s('frac.continued', 'C', 'olymp', 'Көп қабатты бөлшектер', 'Многоэтажные дроби', ['frac.div', 'frac.mixed'], { t: ['compute.continued_fraction'] });
s('frac.telescoping', 'C', 'olymp', 'Телескоптық қосындылар', 'Телескопические суммы', ['frac.add_sub']);
s('frac.alternating_sum', 'C', 'olymp', 'Кезектесетін қосынды (98 − 97 + …)', 'Знакочередующиеся суммы', ['nat.ops']);

// ---- Десятичные дроби ----
s('dec.concept', 'C', 5, 'Ондық бөлшек ұғымы', 'Понятие десятичной дроби', ['frac.concept'], { t: ['dec.place_digit', 'dec.from_fraction10', 'dec.units', 'dec.expanded'] });
s('dec.compare_round', 'C', 5, 'Ондық бөлшектерді салыстыру және дөңгелектеу', 'Сравнение и округление', ['dec.concept'], { t: ['dec.compare_true', 'dec.order_extreme', 'dec.round', 'dec.between'] });
s('dec.add_sub', 'C', 5, 'Ондық бөлшектерді қосу және азайту', 'Сложение и вычитание', ['dec.concept'], { t: ['dec.add_align', 'dec.sub_from_whole', 'dec.add_word'] });
s('dec.mul_div', 'C', 5, 'Ондық бөлшектерді көбейту және бөлу', 'Умножение и деление', ['dec.add_sub'], { t: ['dec.mul_pow10', 'dec.mul_dec', 'dec.div_nat'] });
s('dec.frac_convert', 'C', 5, 'Ондық және жай бөлшек', 'Десятичная ↔ обыкновенная', ['dec.concept', 'frac.reduce'], { t: ['dec.frac_to_dec', 'dec.dec_to_frac'] });
s('dec.from_digits', 'C', 5, 'Цифрлардан ондық бөлшек құрау', 'Дроби из заданных цифр', ['dec.compare_round'], { t: ['compute.decimal_from_digits'] });
s('dec.periodic', 'C', 6, 'Периодты ондық бөлшектер', 'Периодические дроби', ['dec.frac_convert']);
s('dec.mixed_expressions', 'C', 6, 'Жай және ондық бөлшектері бар өрнектер', 'Смешанные выражения', ['dec.mul_div', 'frac.div']);

// ---- Множества ----
s('sets.basics', 'I', 5, 'Жиындар: бірігуі мен қиылысуы', 'Множества: объединение и пересечение', ['nat.ops'], { t: ['sets.union_intersection'] });
s('sets.venn', 'I', 5, 'Эйлер–Венн диаграммалары', 'Диаграммы Эйлера–Венна', ['sets.basics'], { t: ['sets.venn3_none'] });

// ---- Проценты ----
s('pct.concept', 'G', 5, 'Пайыз ұғымы', 'Понятие процента', ['dec.frac_convert']);
s('pct.of_number', 'G', 5, 'Санның пайызын табу', 'Процент от числа', ['pct.concept']);
s('pct.find_whole', 'G', 5, 'Пайызы бойынша санды табу', 'Число по проценту', ['pct.of_number'], { t: ['pct.three_days_pages'] });
s('pct.ratio', 'G', 5, 'Екі санның пайыздық қатынасы', 'Сколько процентов одно от другого', ['pct.concept'], { t: ['pct.group_of_group', 'pct.part_of_unit_mass'] });
s('pct.change', 'G', 6, 'Пайызға өсу және кему', 'Увеличение и уменьшение на %', ['pct.of_number']);
s('pct.successive', 'G', 6, 'Бірінен соң бірі өзгеру', 'Последовательные изменения', ['pct.change', 'frac.part_of_number'], { t: ['pct.successive_parts'] });
s('pct.area_change', 'G', 'olymp', 'Ауданның пайыздық өзгеруі', 'Изменение площади в %', ['pct.change', 'geo.area_rect']);

// ---- Геометрия ----
s('geo.angles_basic', 'E', 5, 'Бұрыштар және оларды өлшеу', 'Углы и их измерение', ['nat.ops']);
s('geo.angles_adjacent', 'E', 5, 'Сыбайлас және вертикаль бұрыштар', 'Смежные и вертикальные углы', ['geo.angles_basic']);
s('geo.angles_figure', 'E', 5, 'Суреттегі бұрыштарды табу', 'Углы по рисунку', ['geo.angles_adjacent'], { fig: true });
s('geo.triangle_angles', 'E', 'olymp', 'Үшбұрыш бұрыштарының қосындысы', 'Сумма углов треугольника', ['geo.angles_basic']);
s('geo.perimeter', 'E', 5, 'Периметр', 'Периметр', ['nat.ops']);
s('geo.area_rect', 'E', 5, 'Тіктөртбұрыш пен квадраттың ауданы', 'Площадь прямоугольника и квадрата', ['geo.perimeter']);
s('geo.area_composite', 'E', 5, 'Құрама фигуралардың ауданы', 'Площадь составных фигур', ['geo.area_rect'], { fig: true });
s('geo.area_grid', 'E', 5, 'Тор көздер бойынша аудан', 'Площадь по клеткам', ['geo.area_rect'], { fig: true });
s('geo.volume', 'E', 5, 'Параллелепипед пен кубтың көлемі', 'Объём параллелепипеда и куба', ['geo.area_rect']);
s('geo.cube_painted', 'E', 'olymp', 'Боялған кубиктер', 'Окрашенный куб', ['geo.volume']);
s('geo.circle_length', 'E', 6, 'Шеңбердің ұзындығы', 'Длина окружности', ['dec.mul_div'], { t: ['geo.circumference_units', 'geo.inscribed_circle_length'] });
s('geo.circle_area', 'E', 6, 'Дөңгелектің ауданы', 'Площадь круга', ['geo.circle_length', 'nat.powers'], { t: ['geo.inscribed_corner_area'], fig: true });
s('geo.circle_estimate', 'E', 6, 'Шеңберге байланысты теңсіздіктер', 'Оценки для окружности', ['geo.circle_length', 'ineq.double'], { t: ['geo.circle_estimate_radius'] });
s('geo.arc_sector', 'E', 6, 'Доға және сектор', 'Дуга и сектор', ['geo.circle_length', 'geo.angles_basic']);

// ---- Отношения, пропорции, масштаб ----
s('ratio.units', 'F', 5, 'Өлшем бірліктерін ауыстыру', 'Перевод единиц', ['nat.ops']);
s('ratio.concept', 'F', 6, 'Қатынас', 'Отношение', ['frac.reduce']);
s('ratio.unit_ratio', 'F', 6, 'Әртүрлі бірліктегі шамалардың қатынасы', 'Отношение величин в разных единицах', ['ratio.concept', 'ratio.units'], { t: ['prop.unit_ratio'] });
s('ratio.divide_parts', 'F', 6, 'Санды берілген қатынаста бөлу', 'Деление в отношении', ['ratio.concept']);
s('prop.property', 'F', 6, 'Пропорцияның негізгі қасиеті', 'Основное свойство пропорции', ['ratio.concept'], { t: ['prop.product_of_extremes'] });
s('prop.solve', 'F', 6, 'Пропорцияның белгісіз мүшесі', 'Неизвестный член пропорции', ['prop.property', 'eq.linear_basic'], { t: ['eq.proportion_linear'] });
s('prop.direct_inverse', 'F', 6, 'Тура және кері пропорционалдық', 'Прямая и обратная пропорциональность', ['prop.solve'], { t: ['prop.workers_days'] });
s('scale.basic', 'F', 6, 'Масштаб', 'Масштаб', ['prop.property', 'ratio.units'], { t: ['prop.two_maps_scale'] });
s('scale.motion', 'F', 6, 'Масштаб және қозғалыс', 'Масштаб и движение', ['scale.basic', 'word.motion_basic'], { t: ['prop.map_then_speed'] });

// ---- Рациональные числа, координаты ----
s('rat.negatives', 'C', 6, 'Теріс сандар', 'Отрицательные числа', ['nat.ops']);
s('rat.abs', 'C', 6, 'Санның модулі', 'Модуль числа', ['rat.negatives']);
s('rat.add_sub', 'C', 6, 'Рационал сандарды қосу және азайту', 'Сложение и вычитание рациональных', ['rat.abs']);
s('rat.mul_div', 'C', 6, 'Рационал сандарды көбейту және бөлу', 'Умножение и деление рациональных', ['rat.add_sub', 'frac.mixed', 'dec.mul_div'], { t: ['compute.signed_mixed_product', 'compute.abs_product'] });
s('coord.line', 'K', 6, 'Координаталық түзу', 'Координатная прямая', ['rat.negatives']);
s('coord.intervals', 'K', 6, 'Сан аралықтары және қиылысуы', 'Числовые промежутки и пересечение', ['coord.line', 'ineq.basic'], { t: ['coord.interval_intersection'] });
s('coord.plane', 'K', 6, 'Координаталық жазықтық', 'Координатная плоскость', ['coord.line']);
s('coord.graph_point', 'K', 6, 'Нүкте графикте жата ма', 'Точка на графике', ['coord.plane', 'eq.linear_basic'], { t: ['eq.line_through_origin'] });
s('coord.symmetry', 'K', 6, 'Симметрия', 'Симметрия', ['coord.plane']);

// ---- Выражения, уравнения, неравенства, системы ----
s('expr.variables', 'A', 5, 'Әріпті өрнектер және олардың мәні', 'Буквенные выражения', ['nat.order_ops'], { t: ['expr.substitute', 'expr.compose_one', 'expr.substitute_two', 'expr.compose_two'] });
s('expr.brackets', 'A', 6, 'Жақшаны ашу', 'Раскрытие скобок', ['expr.variables', 'rat.mul_div']);
s('expr.like_terms', 'A', 6, 'Ұқсас мүшелерді біріктіру', 'Приведение подобных', ['expr.brackets'], { t: ['eq.collect_like_terms'] });
s('expr.factor_out', 'A', 6, 'Ортақ көбейткішті жақша сыртына шығару', 'Вынесение общего множителя', ['expr.like_terms'], { t: ['compute.factor_substitute'] });
s('expr.monomials', 'A', 6, 'Дәрежелері бар бөлшектерді қысқарту', 'Сокращение дробей со степенями', ['nat.powers', 'frac.reduce'], { t: ['compute.monomial_fraction'] });
s('eq.linear_basic', 'A', 5, 'Қарапайым теңдеулер', 'Простые уравнения', ['nat.ops', 'expr.variables'], { t: ['eq.add_sub_unknown', 'eq.mul_div_unknown', 'eq.reverse_order', 'eq.check_root', 'eq.story_one'] });
s('eq.two_step', 'A', 5, 'Екі қадамды теңдеулер', 'Уравнения в два шага', ['eq.linear_basic'], { t: ['eq.two_step_mul_add', 'eq.two_step_mul_sub', 'eq.two_step_div', 'eq.think_number', 'eq.two_step_story', 'eq.two_step_minus'] });
s('eq.linear_negative', 'A', 6, 'Теріс сандары бар теңдеулер', 'Уравнения с отрицательными числами', ['eq.linear_basic', 'rat.add_sub'], { t: ['eq.one_step_negative'] });
s('eq.linear', 'A', 6, 'Сызықтық теңдеулер', 'Линейные уравнения', ['eq.linear_negative', 'expr.like_terms']);
s('eq.compose', 'A', 6, 'Теңдеу құру арқылы есептер', 'Задачи на составление уравнений', ['eq.linear'], { t: ['eq.three_shelves'] });
s('eq.digits', 'A', 6, 'Цифрларға байланысты теңдеулер', 'Уравнения с цифрами числа', ['eq.compose', 'nat.place_value'], { t: ['eq.digit_move', 'eq.append_digit'] });
s('eq.abs', 'A', 6, 'Модулі бар теңдеулер', 'Уравнения с модулем', ['eq.linear', 'rat.abs'], { t: ['eq.abs_linear_sum_roots'] });
s('eq.no_roots', 'A', 6, 'Түбірі жоқ немесе шексіз көп теңдеулер', 'Уравнения без корней / с бесконечным числом корней', ['eq.linear']);
s('ineq.basic', 'A', 6, 'Теңсіздіктер', 'Неравенства', ['eq.linear']);
s('ineq.double', 'A', 6, 'Қос теңсіздіктер', 'Двойные неравенства', ['ineq.basic']);
s('ineq.abs', 'A', 6, 'Модулі бар теңсіздіктер', 'Неравенства с модулем', ['ineq.basic', 'rat.abs']);
s('ineq.systems', 'A', 6, 'Теңсіздіктер жүйесі', 'Системы неравенств', ['ineq.basic', 'coord.line']);
s('sys.sum_trick', 'A', 6, 'Қосындылар әдісі', 'Метод сложения сумм', ['eq.linear'], { t: ['eq.pair_sums'] });
s('sys.linear', 'A', 6, 'Екі айнымалысы бар теңдеулер жүйесі', 'Системы двух уравнений', ['eq.linear'], { t: ['eq.system_fractions'] });
s('sys.word', 'A', 6, 'Жүйе арқылы шығарылатын есептер (сатып алу)', 'Задачи на системы (покупки)', ['sys.linear']);
s('func.linear_kx', 'A', 6, 'y = kx тәуелділігі', 'Зависимость y = kx', ['coord.plane', 'prop.direct_inverse']);
s('stats.mean', 'A', 6, 'Арифметикалық орта', 'Среднее арифметическое', ['dec.mul_div']);
s('stats.mean_replace', 'A', 'olymp', 'Ауыстырудан кейінгі орта мән', 'Среднее после замены', ['stats.mean']);
s('stats.mode_median', 'A', 6, 'Мода, медиана, құлашы', 'Мода, медиана, размах', ['stats.mean']);

// ---- Текстовые задачи ----
s('word.motion_basic', 'B', 5, 'Жол, жылдамдық, уақыт', 'Путь, скорость, время', ['nat.ops']);
s('word.motion_meet', 'B', 5, 'Қарсы қозғалыс және алшақтау', 'Встречное движение и удаление', ['word.motion_basic'], { t: ['motion.opposite_directions'] });
s('word.motion_chase', 'B', 6, 'Қуып жету', 'Движение вдогонку', ['word.motion_meet']);
s('word.motion_river', 'B', 6, 'Өзендегі қозғалыс', 'Движение по реке', ['word.motion_basic'], { t: ['motion.river_ratio'] });
s('word.motion_average', 'B', 6, 'Орташа жылдамдық', 'Средняя скорость', ['word.motion_basic', 'stats.mean']);
s('word.work', 'B', 5, 'Бірлескен жұмыс', 'Совместная работа', ['frac.add_sub']);
s('word.distribution', 'B', 5, 'Бөлу: артық қалады / жетпейді', 'Раздача: лишнее / не хватает', ['eq.linear_basic'], { t: ['eq.surplus_shortage'] });
s('word.parts_successive', 'B', 5, 'Бөлігі, сосын қалғанның бөлігі', 'Часть, потом часть остатка', ['frac.part_of_number']);
s('word.age', 'B', 5, 'Жас туралы есептер', 'Задачи на возраст', ['eq.linear_basic'], { t: ['age.grandma_at_birth'] });
s('word.mixture_concentration', 'B', 6, 'Ерітінділерді араластыру', 'Смешивание растворов', ['pct.of_number'], { t: ['pct.mix_two'] });
s('word.mixture_dilution', 'B', 6, 'Ерітіндіні сұйылту', 'Разбавление раствора', ['pct.find_whole'], { t: ['pct.dilution'] });
s('word.drying', 'B', 6, 'Кептіру есептері', 'Задачи на высушивание', ['pct.find_whole'], { t: ['pct.drying'] });

// ---- Закономерности ----
s('pat.sequences', 'H', 5, 'Сандар тізбегі', 'Числовые последовательности', ['nat.ops'], { t: ['pat.seq_nth', 'pat.seq_position', 'pat.seq_growing_diff', 'pat.seq_interleaved'] });
s('pat.bracket', 'H', 5, 'Жақшадағы сан заңдылығы', 'Закономерность с числом в скобках', ['pat.sequences', 'nat.powers'], { t: ['logic.bracket_pattern', 'logic.bracket_middle', 'logic.bracket_square'] });
s('pat.function_machine', 'H', 5, 'Кесте бойынша формула', 'Формула по таблице', ['expr.variables']);
s('pat.arith_progression', 'H', 'olymp', 'Тұрақты айырмалы тізбек', 'Постоянная разность', ['pat.sequences']);

// ---- Логика словами ----
s('logic.new_operation', 'I', 5, 'Жаңа амал', 'Новая операция', ['nat.order_ops'], { t: ['logic.new_operation', 'logic.new_operation_nested', 'logic.new_operation_unknown'] });
s('logic.clock_angle', 'I', 6, 'Сағат тілдерінің арасындағы бұрыш', 'Угол между стрелками', ['frac.mul'], { t: ['logic.clock_angle', 'logic.clock_angle_hands'] });
s('logic.calendar', 'I', 5, 'Күнтізбе есептері', 'Календарь', ['div.rules'], { t: ['logic.every_k_days', 'logic.cal_weekday_shift', 'logic.cal_days_between', 'logic.cal_years_days', 'logic.cal_weekend_count', 'logic.cal_date_weekday'] });
s('logic.clock_lag', 'I', 'olymp', 'Қалып қоятын сағат', 'Отстающие часы', ['ratio.units']);
s('logic.deduction', 'I', 5, 'Кім қайда: кесте әдісі', 'Кто где: таблица', [], { t: ['logic.who_in_which_class', 'logic.deduction_table', 'logic.deduction_enough'] });
s('logic.permutations', 'I', 5, 'Қатарға тұру тәсілдері', 'Перестановки', ['nat.ops', 'logic.weighing'], { t: ['logic.line_up', 'logic.perm_digits', 'logic.perm_menu', 'logic.perm_fixed'] });
s('logic.pairs_tournament', 'I', 5, 'Жұптар және турнир', 'Пары и турнир', ['logic.permutations'], { t: ['logic.tour_pairs', 'logic.tour_double', 'logic.tour_one_more', 'logic.tour_find_n'] });
s('logic.probability', 'I', 6, 'Ықтималдық', 'Вероятность', ['frac.concept']);
s('logic.page_digits', 'I', 5, 'Беттерді нөмірлеу', 'Нумерация страниц', ['nat.place_value'], { t: ['logic.page_digits'] });
s('logic.seat_number', 'I', 5, 'Қатар мен орын нөмірі', 'Ряд и место (деление с остатком)', ['nat.ops']);
s('logic.cryptarithm', 'I', 5, 'Ребус: әріп = цифр', 'Ребусы (буква = цифра)', ['nat.place_value', 'nat.ops'], { t: ['logic.crypt_lead', 'logic.crypt_two_digit', 'logic.crypt_three_digit', 'logic.crypt_extreme'] });
s('logic.weighing', 'I', 5, 'Таразы және гірлер', 'Взвешивания и гири', ['nat.ops'], { t: ['logic.weighing_set', 'logic.weighing_range'] });
s('logic.pigeonhole', 'I', 'olymp', 'Ең нашар жағдай', 'Наихудший случай', ['nat.ops']);
s('logic.invariant', 'I', 'olymp', 'Өзгермейтін шама (инвариант)', 'Инвариант', ['nat.ops']);
s('logic.snail', 'I', 'olymp', 'Ұлу: күндіз көтеріледі, түнде түседі', 'Улитка на столбе', ['nat.ops']);

// ---- Визуальная логика ----
s('vis.count_segments', 'J', 5, 'Кесінділер санын табу', 'Подсчёт отрезков', [], { fig: true });
s('vis.count_squares', 'J', 5, 'Квадраттар санын табу', 'Подсчёт квадратов', [], { fig: true, t: ['vis.sq_grid', 'vis.sq_square_grid', 'vis.sq_shape'] });
s('vis.count_triangles', 'J', 5, 'Үшбұрыштар санын табу', 'Подсчёт треугольников', ['vis.count_segments'], { fig: true });
s('vis.cube_count', 'J', 5, 'Фигурадағы кубиктер саны', 'Кубики в фигуре', ['geo.volume'], { fig: true });
s('vis.cube_net', 'J', 5, 'Кубтың жазбасы', 'Развёртка куба', [], { fig: true });
s('vis.cube_views', 'J', 5, 'Фигураны үстінен және бүйірінен көру', 'Вид сверху и сбоку', ['vis.cube_count'], { fig: true });
s('vis.dice', 'J', 'olymp', 'Ойын сүйегі', 'Игральные кубики', ['vis.cube_net'], { fig: true });
s('vis.tiling', 'J', 5, 'Фигуралармен жабу', 'Замощение фигурами', ['geo.area_grid'], { fig: true });
s('vis.matchsticks', 'J', 5, 'Сіріңкелер', 'Спички', ['pat.sequences'], { fig: true });
s('vis.paths', 'J', 5, 'Жолдар санын табу', 'Число путей', ['logic.permutations'], { fig: true });
s('vis.odd_picture', 'J', 5, 'Артық суретті табу', 'Найди лишнюю картинку', [], { fig: true });
s('vis.cut_fold', 'J', 5, 'Қию және бүктеу', 'Разрезание и складывание', [], { fig: true });

export const skills = S;
export const skillById = Object.fromEntries(S.map(x => [x.id, x]));
