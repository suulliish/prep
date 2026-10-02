// Очередь новых тем для ребёнка (C1, docs/systems/IMPLEMENTATION.md; черновик — docs/systems/proto/queue_draft.mjs).
// Только математика и логика (решение Султана 02.10). Планировщик даёт новую тему в порядке очереди: первая тема,
// у которой есть полный урок и генераторы и пройдены предпосылки (src/engine/planner.ts nextSkill). Темы без урока
// пропускаются — планировщик не ждёт, а урок пишет еженедельная сессия ИИ. Комментарий над строкой — целевой месяц;
// 'opt' — олимпиадный хвост, если успеваем. С 15.11.2027 новых тем нет — только практика.
// Новые темы — только по понедельникам, средам и четвергам (≤ 3 в неделю): запас уроков и закрепление.
export const NEW_TOPIC_WEEKDAYS = [1, 3, 4];
export const NEW_TOPICS_END = '2027-11-15';
export const QUEUE = [
  // done
  'nat.place_value', 'nat.ops', 'nat.order_ops', 'nat.powers', 'div.rules',
  // 2026-10
  'div.primes', 'div.factorization', 'div.gcd', 'div.lcm', 'div.gcd_lcm_word', 'div.count_multiples', 'div.star_digit', 'div.powers_count', 'sets.basics', 'sets.venn', 'frac.concept', 'frac.magnitude',
  // 2026-11
  'frac.basic_property', 'frac.reduce', 'frac.common_denominator', 'div.last_digit', 'frac.compare', 'logic.new_operation', 'frac.add_sub', 'dec.concept', 'frac.mixed', 'dec.compare_round', 'logic.deduction', 'dec.add_sub',
  // 2026-12
  'logic.weighing', 'dec.mul_div', 'dec.frac_convert', 'div.trailing_zeros', 'expr.variables', 'eq.linear_basic', 'logic.cryptarithm', 'eq.two_step', 'eq.both_sides_nat', 'frac.mul', 'frac.div', 'eq.brackets_nat',
  // 2027-01
  'frac.part_of_number', 'frac.find_whole', 'word.part_whole', 'word.compare', 'logic.page_digits', 'word.sum_diff', 'logic.permutations', 'word.distribution', 'logic.pairs_tournament', 'pat.sequences', 'word.age', 'logic.calendar',
  // 2027-02
  'vis.count_squares', 'word.parts_successive', 'pat.bracket', 'word.motion_basic', 'word.motion_meet', 'logic.clock_angle', 'word.work', 'geo.perimeter', 'geo.area_rect', 'dec.from_digits', 'geo.area_grid', 'ratio.units',
  // 2027-03
  'pct.concept', 'pct.of_number', 'pct.find_whole', 'pct.ratio', 'geo.angles_basic', 'geo.angles_adjacent', 'geo.angles_figure', 'geo.area_composite', 'geo.volume', 'vis.count_segments', 'vis.count_triangles', 'vis.cube_count',
  // 2027-04
  'vis.cube_net', 'vis.cube_views', 'vis.tiling', 'pat.function_machine', 'logic.seat_number', 'logic.snail', 'geo.triangle_angles', 'frac.alternating_sum', 'vis.matchsticks', 'vis.paths', 'ratio.concept', 'ratio.divide_parts',
  // 2027-05
  'prop.property', 'prop.solve', 'prop.direct_inverse', 'ratio.unit_ratio', 'scale.basic', 'scale.motion', 'logic.pigeonhole', 'pat.arith_progression', 'vis.odd_picture', 'vis.cut_fold', 'stats.mean', 'word.motion_average',
  // 2027-06
  'rat.negatives', 'rat.abs', 'coord.line', 'rat.add_sub', 'coord.plane', 'coord.symmetry', 'rat.mul_div', 'word.motion_chase', 'word.motion_river', 'geo.circle_length', 'geo.circle_area', 'stats.mode_median',
  // 2027-07
  'pct.change', 'pct.successive', 'dec.periodic', 'expr.brackets', 'expr.like_terms', 'eq.linear_negative', 'eq.linear', 'expr.factor_out', 'eq.compose', 'logic.probability', 'word.mixture_concentration', 'eq.no_roots',
  // 2027-08
  'ineq.basic', 'ineq.double', 'eq.digits', 'word.mixture_dilution', 'word.drying', 'sys.sum_trick', 'sys.linear', 'coord.intervals', 'coord.graph_point', 'dec.mixed_expressions', 'expr.monomials', 'geo.circle_estimate',
  // 2027-09
  'eq.abs', 'ineq.abs', 'ineq.systems', 'sys.word', 'func.linear_kx', 'geo.arc_sector',
  // opt
  'frac.continued', 'frac.telescoping', 'logic.clock_lag', 'logic.invariant', 'geo.cube_painted', 'pct.area_change', 'stats.mean_replace', 'vis.dice',
];
