"""Вырезает рисунки задач «Дарына» из исходных PDF (bank/sources) в public/figures/{id}.png.

Задача ищется по номеру «N.» в начале строки; область — до следующего номера. Внутри области берётся
объединение векторной графики и картинок (без текста); если графики нет — вся область задачи.
python3 scripts/bank/extract_figures.py [id ...]
"""
import json, re, sys, os
import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PDF = {'daryn2023': 'daryn_7_2023.pdf', 'daryn2024': 'daryn_7_2024.pdf', 'daryn2025': 'daryn_7_2025.pdf'}
OUT = os.path.join(ROOT, 'public', 'figures')
# ручная подрезка после визуальной проверки: доля высоты рамки, срезаемая сверху и снизу (обрывки текста)
TRIM = {'daryn2023-53': (0, 0.035), 'daryn2024-11': (0.1, 0.05), 'daryn2024-17': (0.1, 0.12), 'daryn2024-29': (0.14, 0.07)}
# в оригинале рисунка нет (только текст) — рисуем SVG вручную (content/figures_svg.mjs)
NO_FIGURE = {'daryn2023-22', 'daryn2023-50', 'daryn2024-36', 'daryn2024-44', 'daryn2025-27',
             'daryn2023-32', 'daryn2025-30'}  # последние два: в PDF мелко/с обрезанной рамкой — чётче в SVG

def starts(doc):
    """Позиции номеров задач: {n: (page, y)}."""
    pos = {}
    for pi, page in enumerate(doc):
        for b in page.get_text('dict')['blocks']:
            for l in b.get('lines', []):
                t = ''.join(s['text'] for s in l['spans']).strip()
                m = re.match(r'^(\d{1,2})\.(\s|$)', t)
                if m and l['bbox'][0] < 120:
                    n = int(m.group(1))
                    if n not in pos: pos[n] = (pi, l['bbox'][1])
    return pos

def crop(doc, pos, n, out, pad=6, trim=(0, 0)):
    p0, y0 = pos[n]
    p1, y1 = pos.get(n + 1, (p0, doc[p0].rect.y1))
    if p1 != p0: y1 = doc[p0].rect.y1 - 30   # задача до конца страницы
    page = doc[p0]
    region = pymupdf.Rect(page.rect.x0, y0, page.rect.x1, y1)
    boxes = [d['rect'] for d in page.get_drawings() if region.intersects(d['rect']) and d['rect'].width < page.rect.width * 0.95]
    boxes += [page.get_image_bbox(img) for img in page.get_images(full=True) if region.intersects(page.get_image_bbox(img))]
    boxes = [b for b in boxes if b.width > 2 or b.height > 2]
    if boxes:
        r = boxes[0]
        for b in boxes[1:]: r |= b
        # подписи внутри рисунка (цифры, буквы) — добавляем текст, лежащий внутри рамки
        r = (r + (-pad, -pad, pad, pad)) & page.rect
        kind = 'graphic'
    else:
        r, kind = region, 'region'
    h = r.height; r = pymupdf.Rect(r.x0, r.y0 + h * trim[0], r.x1, r.y1 - h * trim[1])
    pix = page.get_pixmap(clip=r, dpi=220)
    pix.save(out)
    return kind, (p0 + 1, round(r.x0), round(r.y0), round(r.width), round(r.height))

bank = json.load(open(os.path.join(ROOT, 'content', 'bank.json')))
items = bank['items'] if isinstance(bank, dict) else bank
want = set(sys.argv[1:])
docs = {}
for it in items:
    if not it.get('figure') or not it['source'] in PDF: continue
    if want and it['id'] not in want: continue
    if it['id'] in NO_FIGURE:
        p = os.path.join(OUT, it['id'] + '.png')
        if os.path.exists(p): os.remove(p)
        print(it['id'], 'нет рисунка в оригинале → SVG'); continue
    src = it['source']
    if src not in docs:
        d = pymupdf.open(os.path.join(ROOT, 'bank', 'sources', PDF[src])); docs[src] = (d, starts(d))
    d, pos = docs[src]
    if it['n'] not in pos: print('НЕ НАЙДЕНО', it['id']); continue
    kind, where = crop(d, pos, it['n'], os.path.join(OUT, it['id'] + '.png'), trim=TRIM.get(it['id'], (0, 0)))
    print(it['id'], kind, where)

# список готовых PNG — для сайта (content/figures_png.json)
json.dump(sorted(f[:-4] for f in os.listdir(OUT) if f.endswith('.png')), open(os.path.join(ROOT, 'content', 'figures_png.json'), 'w'), indent=1)
