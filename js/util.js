// Общие утилиты: случайные числа, дроби (рациональные числа), разбор и проверка ответов.
window.KTL = window.KTL || {};
(function () {
  const U = {};

  U.rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  U.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  U.shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  U.rndNot = (a, b, bad) => { let x; do { x = U.rnd(a, b); } while (bad.includes(x)); return x; };

  U.gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
  U.lcm = (a, b) => a / U.gcd(a, b) * b;
  U.isPrime = n => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
  U.factor = n => { const f = []; for (let p = 2; p * p <= n; p++) while (n % p === 0) { f.push(p); n /= p; } if (n > 1) f.push(n); return f; };

  // Рациональные числа {n, d}, d > 0, несократимые
  U.Q = (n, d = 1) => {
    if (d < 0) { n = -n; d = -d; }
    const g = U.gcd(n, d) || 1;
    return { n: n / g, d: d / g };
  };
  U.qadd = (x, y) => U.Q(x.n * y.d + y.n * x.d, x.d * y.d);
  U.qsub = (x, y) => U.Q(x.n * y.d - y.n * x.d, x.d * y.d);
  U.qmul = (x, y) => U.Q(x.n * y.n, x.d * y.d);
  U.qdiv = (x, y) => U.Q(x.n * y.d, x.d * y.n);
  U.qeq = (x, y) => x.n === y.n && x.d === y.d;
  U.qstr = q => (q.d === 1 ? String(q.n) : q.n + '/' + q.d);
  // Десятичная запись числа, заданного в сотых/тысячных, без ошибок float
  U.qdec = (int, places) => U.Q(int, Math.pow(10, places));

  const MINUS = '−';
  // Красивое число: минус, десятичная запятая
  U.n = x => {
    if (typeof x === 'object') return U.qhtml(x);
    let s = String(+(+x).toFixed(10));
    return s.replace('-', MINUS).replace('.', ',');
  };
  // Дробь в HTML
  U.F = (n, d) => `<span class="fr"><span>${n}</span><span>${d}</span></span>`;
  U.qhtml = q => {
    if (q.d === 1) return U.n(q.n);
    return (q.n < 0 ? MINUS : '') + U.F(Math.abs(q.n), q.d);
  };
  // Смешанное число в HTML
  U.mixed = q => {
    const s = q.n < 0 ? MINUS : '';
    const a = Math.abs(q.n);
    const whole = Math.floor(a / q.d), r = a % q.d;
    if (r === 0) return s + whole;
    if (whole === 0) return s + U.F(r, q.d);
    return s + whole + U.F(r, q.d);
  };
  // Десятичная запись рационального числа (если конечна)
  U.qToDec = q => {
    let d = q.d, k = 0;
    while (d % 2 === 0) { d /= 2; k++; }
    while (d % 5 === 0) { d /= 5; k++; }
    if (d !== 1) return null;
    return U.n(q.n / q.d);
  };
  // Ответ для показа: дробь, смешанное или десятичное
  U.ansHtml = (str) => {
    const r = U.parse(str);
    if (!r) return str;
    if (r.form === 'dec') return U.n(r.q.n / r.q.d);
    if (r.form === 'mixed') return U.mixed(r.q);
    return U.qhtml(r.q);
  };

  // Разбор ответа ученика: "12", "-3", "2,5", "3/4", "1 2/3"
  U.parse = raw => {
    if (raw == null) return null;
    let s = String(raw).trim().replace(/[−–—]/g, '-').replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/');
    let m;
    if ((m = s.match(/^(-?)(\d+) (\d+)\/(\d+)$/))) {
      const sign = m[1] ? -1 : 1, w = +m[2], a = +m[3], d = +m[4];
      if (d === 0) return null;
      return { q: U.Q(sign * (w * d + a), d), form: 'mixed', reduced: U.gcd(a, d) === 1 && a < d };
    }
    if ((m = s.match(/^(-?\d+)\/(-?\d+)$/))) {
      const a = +m[1], d = +m[2];
      if (d === 0) return null;
      return { q: U.Q(a, d), form: 'frac', reduced: U.gcd(a, d) === 1 };
    }
    if ((m = s.match(/^(-?)(\d+)(?:[.,](\d+))?$/))) {
      const sign = m[1] ? -1 : 1, frac = m[3] || '';
      const n = +(m[2] + frac), d = Math.pow(10, frac.length);
      return { q: U.Q(sign * n, d), form: frac ? 'dec' : 'int', reduced: true };
    }
    return null;
  };

  // Проверка ответа. Возвращает {ok, note}; ok === null — ответ записан в неверном формате.
  U.check = (p, input) => {
    if (p.type === 'choice') return { ok: input === p.correct };
    const r = U.parse(input);
    if (!r) return { ok: null, note: 'Не понимаю запись. Пиши число: 12, −3, 2,5, 3/4 или 1 2/3.' };
    const target = U.parse(p.a).q;
    if (!U.qeq(r.q, target)) return { ok: false };
    if (p.form && r.form !== p.form && !(p.form === 'frac' && r.form === 'int')) {
      const names = { frac: 'обыкновенной дроби (например 7/3)', mixed: 'смешанного числа (например 2 1/3)', dec: 'десятичной дроби' };
      return { ok: null, note: 'Значение верное, но запиши ответ в виде ' + names[p.form] + '.' };
    }
    if (r.form === 'frac' && !r.reduced) {
      if (p.reduced === 'strict') return { ok: false, note: 'Дробь нужно сократить до конца.' };
      return { ok: true, note: 'Верно! Но дробь можно сократить — привыкай всегда сокращать.' };
    }
    return { ok: true };
  };

  // Даты — считаем в «днях» по местному времени
  U.today = () => { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); };
  U.dayStr = day => new Date(day * 86400000).toISOString().slice(0, 10);

  U.esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  KTL.U = U;
  KTL.topics = [];
  KTL.addTopics = list => list.forEach(t => KTL.topics.push(t));
})();
