"""Достаёт из PDF «Дарына» условия задач 1–55: казахскую часть, русскую часть и строки-формулы.
Результат: bank/sources/<name>.split.json  {номер: {kz, ru, math}}.
Разделение строк эвристическое: казахские буквы (әғқңөұүһі) → kz; русские маркеры → ru; без букв → формула.
"""
import json, re, sys, pymupdf

KZ = re.compile(r'[әғқңөұүһіӘҒҚҢӨҰҮҺІ]')
CYR = re.compile(r'[А-Яа-яЁё]')
RU_START = re.compile(r'^(Найд|Вычисл|Реш|Упрост|Скольк|Сколь|Если|Как|Чему|При как|Определ|Сократ|Извест|Дан[аоы]? |Из |В |На |Тр[её]хзнач|Сумма|Длина|Расстоя|Морск|Лодк|После|Новое|Четыре|Два|Площад|Свеж|Фигур|Асан|Наборщ|У |Одинаков|Прямые|Периметр|Отношение|Запиш|Выбер|Числ|Скорост|Масса|Цена|Сторон|Для |За |Найти|Какое|Какой|Какая|Каков|Есть|Имеется|Ученик|Автомоб|Поезд|Велосип|Пешеход|Мама|Отец|Брат|Сестра|Бабушка|Дедушка|Школ|Класс|Товар|Банк|Бассейн|Трубы|Рабоч|Мастер|Туристы|Лист|Куб|Прямоуг|Треуг|Квадрат|Окружн|Круг|Угол|Точк|Отрезк|Диаграм|Табли|График|Функц|Выраж|Уравн|Неравен|Систем|Пропорц|Процент|Дроб|Сравн|Округл|Вычеркн|Последоват|Закономер|Новое|Кодир|Шифр|Сколько)')
CHOICE = re.compile(r'^\s*[A-EАВСЕ]\)')
QSTART = re.compile(r'^\s*(\d{1,2})\.\s*(.*)$')

def split_questions(text):
    qs, cur, num = {}, [], None
    for line in text.split('\n'):
        if line.startswith('=== PAGE'):
            continue
        m = QSTART.match(line)
        if m and 1 <= int(m.group(1)) <= 75 and (num is None or int(m.group(1)) == num + 1 or (num + 1 < int(m.group(1)) <= num + 3 and KZ.search(m.group(2) or ''))):
            if num is not None: qs[num] = cur
            num, cur = int(m.group(1)), [m.group(2) or '']
        elif num is not None:
            cur.append(line)
    if num is not None: qs[num] = cur
    return qs

def classify(lines):
    kz, ru, math = [], [], []
    mode = 'kz'
    for raw in lines:
        l = raw.strip()
        if not l: continue
        if '\\' in l and KZ.search(l.split('\\')[0]):   # «каз\\рус» в одной строке (2024)
            a, b = l.split('\\', 1); kz.append(a.strip()); ru.append(b.strip()); continue
        if CHOICE.match(l): break
        letters = CYR.findall(l)
        if KZ.search(l):
            mode = 'kz'; kz.append(l); continue
        if len(letters) < 3:
            math.append(l); continue
        if RU_START.match(l) or mode == 'ru':
            mode = 'ru'; ru.append(l); continue
        (kz if mode == 'kz' else ru).append(l)
    j = lambda xs: re.sub(r'\s+', ' ', ' '.join(xs)).strip()
    return {'kz': j(kz), 'ru': j(ru), 'math': j(math)}

if __name__ == '__main__':
    for pdf, out in [('bank/sources/daryn_7_2023.pdf', 'daryn2023'), ('bank/sources/daryn_7_2024.pdf', 'daryn2024'), ('bank/sources/daryn_7_2025.pdf', 'daryn2025')]:
        text = '\n'.join('=== PAGE\n' + p.get_text() for p in pymupdf.open(pdf))
        qs = split_questions(text)
        res = {n: classify(ls) for n, ls in qs.items() if n <= 55}
        json.dump(res, open(f'bank/sources/{out}.split.json', 'w'), ensure_ascii=False, indent=1)
        print(out, len(res), 'questions; empty kz:', [n for n, v in res.items() if not v['kz']])
