// Черновик content/queue.mjs (конвейер контента). Порядок новых тем для ребёнка до 13.11.2027.
// new: true — урока ещё нет. ph — фаза (месяц у ребёнка). opt — олимп. хвост (отсекается 13.11.2027).
export const NEW_SKILLS = [ // добавить в content/skills.mjs
  ['eq.two_step','A',5,'Екі амалды теңдеулер','Уравнения в два действия',['eq.linear_basic']],
  ['eq.both_sides_nat','A',5,'Айнымалы екі жақта','x с двух сторон',['eq.two_step']],
  ['eq.brackets_nat','A',5,'Жақшасы бар теңдеулер','Уравнения со скобками',['eq.two_step']],
  ['word.part_whole','B',5,'Бөлік пен бүтін','Часть и целое',['nat.ops']],
  ['word.compare','B',5,'Салыстыру: артық/кем, есе','Сравнение: больше/меньше, во сколько раз',['word.part_whole']],
  ['word.sum_diff','B',5,'Қосынды мен айырма бойынша','По сумме и разности',['word.compare']],
];
export const PREREQ_FIX = { 'logic.new_operation': ['nat.order_ops'], 'logic.clock_angle': ['frac.mul'] };
const P = (ph, ...ids) => ids.map(id => ({ id, ph }));
export const QUEUE = [
  ...P('done', 'nat.place_value','nat.ops','nat.order_ops','nat.powers','div.rules'),
  ...P('2026-10', 'div.primes','div.factorization','div.gcd','div.lcm','div.gcd_lcm_word','div.count_multiples','div.star_digit','div.powers_count','sets.basics','sets.venn','frac.concept','frac.magnitude'),
  ...P('2026-11', 'frac.basic_property','frac.reduce','frac.common_denominator','div.last_digit','frac.compare','logic.new_operation','frac.add_sub','dec.concept','frac.mixed','dec.compare_round','logic.deduction','dec.add_sub'),
  ...P('2026-12', 'logic.weighing','dec.mul_div','dec.frac_convert','div.trailing_zeros','expr.variables','eq.linear_basic','logic.cryptarithm','eq.two_step','eq.both_sides_nat','frac.mul','frac.div','eq.brackets_nat'),
  ...P('2027-01', 'frac.part_of_number','frac.find_whole','word.part_whole','word.compare','logic.page_digits','word.sum_diff','logic.permutations','word.distribution','logic.pairs_tournament','pat.sequences','word.age','logic.calendar'),
  ...P('2027-02', 'vis.count_squares','word.parts_successive','pat.bracket','word.motion_basic','word.motion_meet','logic.clock_angle','word.work','geo.perimeter','geo.area_rect','dec.from_digits','geo.area_grid','ratio.units'),
  ...P('2027-03', 'pct.concept','pct.of_number','pct.find_whole','pct.ratio','geo.angles_basic','geo.angles_adjacent','geo.angles_figure','geo.area_composite','geo.volume','vis.count_segments','vis.count_triangles','vis.cube_count'),
  ...P('2027-04', 'vis.cube_net','vis.cube_views','vis.tiling','pat.function_machine','logic.seat_number','logic.snail','geo.triangle_angles','frac.alternating_sum','vis.matchsticks','vis.paths','ratio.concept','ratio.divide_parts'),
  ...P('2027-05', 'prop.property','prop.solve','prop.direct_inverse','ratio.unit_ratio','scale.basic','scale.motion','logic.pigeonhole','pat.arith_progression','vis.odd_picture','vis.cut_fold','stats.mean','word.motion_average'),
  ...P('2027-06', 'rat.negatives','rat.abs','coord.line','rat.add_sub','coord.plane','coord.symmetry','rat.mul_div','word.motion_chase','word.motion_river','geo.circle_length','geo.circle_area','stats.mode_median'),
  ...P('2027-07', 'pct.change','pct.successive','dec.periodic','expr.brackets','expr.like_terms','eq.linear_negative','eq.linear','expr.factor_out','eq.compose','logic.probability','word.mixture_concentration','eq.no_roots'),
  ...P('2027-08', 'ineq.basic','ineq.double','eq.digits','word.mixture_dilution','word.drying','sys.sum_trick','sys.linear','coord.intervals','coord.graph_point','dec.mixed_expressions','expr.monomials','geo.circle_estimate'),
  ...P('2027-09', 'eq.abs','ineq.abs','ineq.systems','sys.word','func.linear_kx','geo.arc_sector'),
  // олимп. хвост: даётся, если успеваем; 13.11.2027 всё, что не дошло, уходит в практику по банку
  ...P('opt', 'frac.continued','frac.telescoping','logic.clock_lag','logic.invariant','geo.cube_painted','pct.area_change','stats.mean_replace','vis.dice'),
];

// Позиция ребёнка: обновляет еженедельная сессия ИИ по карточке недели. Тест запаса проецирует 3 темы/нед (Пн, Ср, Чт).
export const POSITION = { date: '2026-10-05', index: 5 };

// План генераторов (id → [навык, қиындық]); неделя — когда в PR.
export const GEN_PLAN = {
  W1_decimals: { 'dec.read_write':['dec.concept',1], 'dec.digit_place':['dec.concept',2], 'dec.on_line':['dec.concept',2],
    'dec.compare_pair':['dec.compare_round',1], 'dec.order_set':['dec.compare_round',2], 'dec.round_to':['dec.compare_round',2], 'dec.count_between':['dec.compare_round',3],
    'dec.add_align':['dec.add_sub',1], 'dec.sub_borrow':['dec.add_sub',2], 'dec.change_word':['dec.add_sub',3],
    'dec.shift_10':['dec.mul_div',1], 'dec.mul_dec':['dec.mul_div',2], 'dec.div_dec':['dec.mul_div',3],
    'dec.to_frac':['dec.frac_convert',1], 'frac.to_dec':['dec.frac_convert',2], 'dec.frac_order':['dec.frac_convert',3] },
  W2_emergency: { 'logic.new_op_nested':['logic.new_operation',2], 'logic.new_op_solve':['logic.new_operation',3], 'logic.clock_hours':['logic.clock_angle',1], 'logic.clock_half':['logic.clock_angle',2],
    'logic.deduction_3x3':['logic.deduction',1], 'div.last_digit_product':['div.last_digit',1], 'div.last_digit_big':['div.last_digit',3], 'pat.bracket_simple':['pat.bracket',1] },
  W3_entry_eq: { 'expr.value_at':['expr.variables',1], 'expr.from_words':['expr.variables',2], 'expr.compare_values':['expr.variables',3],
    'eq.one_step_nat':['eq.linear_basic',1], 'eq.which_root':['eq.linear_basic',1], 'eq.unknown_component':['eq.linear_basic',2],
    'eq.two_step_nat':['eq.two_step',1], 'eq.two_step_div':['eq.two_step',2], 'eq.two_step_story':['eq.two_step',3],
    'eq.both_simple':['eq.both_sides_nat',1], 'eq.both_sides':['eq.both_sides_nat',2], 'eq.both_story':['eq.both_sides_nat',3],
    'eq.brackets_divide':['eq.brackets_nat',1], 'eq.brackets_expand':['eq.brackets_nat',2], 'eq.brackets_both':['eq.brackets_nat',3] },
  W5_schemas: { 'pw.total':['word.part_whole',1], 'pw.two_step':['word.part_whole',2], 'pw.multi':['word.part_whole',3],
    'cmp.more_less':['word.compare',1], 'cmp.times':['word.compare',2], 'cmp.indirect':['word.compare',3],
    'sd.two_numbers':['word.sum_diff',2], 'sd.units':['word.sum_diff',3], 'sd.simple':['word.sum_diff',1] },
  W6_motion_work: { 'motion.svt':['word.motion_basic',1], 'motion.units':['word.motion_basic',2], 'motion.two_legs':['word.motion_basic',3],
    'motion.meet_time':['word.motion_meet',1], 'motion.meet_left':['word.motion_meet',3], 'motion.chase_time':['word.motion_chase',2], 'motion.chase_head':['word.motion_chase',3],
    'motion.river_speeds':['word.motion_river',1], 'motion.river_time':['word.motion_river',2], 'motion.avg_trap':['word.motion_average',2], 'motion.avg_equal':['word.motion_average',3],
    'work.rate':['word.work',1], 'work.together':['word.work',2], 'work.pipes':['word.work',3] },
  W7_geo_words: { 'per.rect':['geo.perimeter',1], 'per.missing_side':['geo.perimeter',2], 'per.composite':['geo.perimeter',3],
    'area.rect':['geo.area_rect',1], 'area.from_perimeter':['geo.area_rect',2], 'area.change':['geo.area_rect',3], 'grid.count':['geo.area_grid',1], 'grid.half_cells':['geo.area_grid',2],
    'dist.simple':['word.distribution',1], 'age.diff_const':['word.age',1], 'age.times_later':['word.age',3], 'ps.rest':['word.parts_successive',2], 'ps.backward':['word.parts_successive',3] },
  W4_W8_debt: { 'nat.class_digits':['nat.place_value',2], 'nat.compare_build':['nat.place_value',3], 'nat.remainder_story':['nat.ops',2], 'nat.missing_digit':['nat.ops',3],
    'nat.brackets_place':['nat.order_ops',2], 'nat.order_long':['nat.order_ops',3], 'nat.powers_compare':['nat.powers',2], 'nat.powers_sum':['nat.powers',3],
    'div.rules_combo':['div.rules',2], 'div.rules_star':['div.rules',3], 'div.prime_pick':['div.primes',1], 'div.prime_story':['div.primes',3], 'div.factor_count':['div.factorization',3],
    'div.gcd_three':['div.gcd',3], 'div.lcm_three':['div.lcm',3], 'div.gcd_lcm_bus':['div.gcd_lcm_word',3], 'div.count_range':['div.count_multiples',1],
    'div.star_two':['div.star_digit',3], 'div.squares_range':['div.powers_count',1], 'sets.count_list':['sets.basics',2], 'sets.two_story':['sets.basics',3], 'sets.venn2_fill':['sets.venn',2],
    'logic.page_count_digits':['logic.page_digits',2], 'frac.concept_story':['frac.concept',3], 'frac.equal_chain':['frac.basic_property',3], 'frac.reduce_big':['frac.reduce',3],
    'frac.lcd_three':['frac.common_denominator',3], 'frac.compare_close':['frac.compare',3] },
};
