// Список разрешённых аккаунтов помощника (переменная ALLOW: почты и/или uid через запятую). Пустой список — пускаем всех вошедших.
/** who: {uid, email}; list — уже в нижнем регистре. */
export const isAllowed = (who, list) =>
  !list.length || list.includes(String(who.uid).toLowerCase()) || (!!who.email && list.includes(String(who.email).toLowerCase()));
