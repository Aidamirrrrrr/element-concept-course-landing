#!/usr/bin/env python3
"""Генератор SVG-плейсхолдеров под фотосъёмку курса Element Concept."""
import html
import os

BONE = "#EDECE7"
SAND = "#E3E1DA"
LINE = "#C9C7BF"
INK = "#17191A"
MUTED = "#67695F"
RED = "#9E2B20"
OLIVE = "#5C6B4E"

# Веточка: рисуется по центру кадра, масштаб задаётся отдельно.
SPRIG = (
    '<g stroke="{olive}" stroke-width="1.4" fill="none" stroke-linecap="round">'
    '<path d="M0 34 L0 -30"/>'
    '<path d="M0 -6 C -16 -10 -22 -22 -20 -33 C -8 -30 -2 -19 0 -8"/>'
    '<path d="M0 -16 C 16 -20 22 -32 20 -43 C 8 -40 2 -29 0 -18"/>'
    '<path d="M0 12 C -14 8 -19 -2 -17 -12 C -6 -9 -1 0 0 10"/>'
    '</g>'
    '<circle cx="0" cy="-36" r="7" fill="none" stroke="{red}" stroke-width="1.4"/>'
)

SLOTS = [
    # (файл, ширина, высота, номер, заголовок слота, подпись — что снимать)
    ("cover-strip", 1800, 600, "01",
     "Обложка курса",
     "Горизонтальный кадр: интерьерная композиция в жилом пространстве, общий план"),
    ("week-01", 800, 1200, "02",
     "Урок 01 · выбор цветов",
     "Разбор букета на столе: срезанные цветы, секатор, вода"),
    ("week-02", 800, 1200, "03",
     "Урок 02 · вазы и монокомпозиция",
     "Парные интерьерные вазы, монокомпозиция на комоде"),
    ("week-03", 800, 1200, "04",
     "Урок 03 · текстура и фактура",
     "Руки в кадре: сборка арт-интерьерной композиции"),
    ("week-04", 800, 1200, "05",
     "Урок 04 · сет-дизайн",
     "Сервированный стол: посуда, текстиль, свечи, цветы"),
    ("kit-materials", 1000, 500, "06",
     "Раздаточный материал",
     "Рабочая тетрадь курса, ручки и чек-листы на столе"),
    ("teacher", 900, 1150, "07",
     "Преподаватель",
     "Портрет: за работой над композицией, вертикальный кадр"),
    ("work-01", 800, 800, "08",
     "Работа участницы",
     "Готовая монокомпозиция дома у ученицы"),
    ("work-02", 800, 800, "09",
     "Работа участницы",
     "Базовая интерьерная композиция, квадратный кадр"),
    ("work-03", 800, 800, "10",
     "Работа участницы",
     "Домашняя сервировка после четвёртого занятия"),
]


def wrap(text, width):
    """Простой перенос по словам — в SVG нет автопереноса."""
    words, lines, cur = text.split(), [], ""
    for w in words:
        probe = f"{cur} {w}".strip()
        if len(probe) <= width:
            cur = probe
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def build(name, w, h, num, title, hint):
    short = min(w, h)
    pad = round(short * 0.045)
    sprig_scale = short / 260
    cx, cy = w / 2, h / 2

    # Кегли считаем от короткой стороны, чтобы подписи читались в любом кадре.
    fs_num = max(11, round(short * 0.026))
    fs_title = max(13, round(short * 0.036))
    fs_hint = max(10.5, round(short * 0.022))
    fs_dim = max(10, round(short * 0.021))

    # Кадры показываются через object-fit:cover, то есть кропаются по центру.
    # Держим подписи в безопасной колонке, привязанной к короткой стороне.
    safe = min(w, h * 1.9) * 0.8
    hint_lines = wrap(hint, max(24, int(safe / (fs_hint * 0.62))))

    # Стопка подписей под веточкой: номер → название слота → что снимать.
    y_num = cy + sprig_scale * 40 + fs_num * 2.2
    y_title = y_num + fs_title * 1.6
    y_hint = y_title + fs_title * 0.5 + fs_hint * 1.6

    hint_svg = "".join(
        f'<text x="{cx}" y="{y_hint + i * fs_hint * 1.55:.1f}" '
        f'text-anchor="middle" font-family="ui-monospace,Menlo,Consolas,monospace" '
        f'font-size="{fs_hint}" fill="{MUTED}">{html.escape(line)}</text>'
        for i, line in enumerate(hint_lines)
    )

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{html.escape(title)} — место под фотографию">
<rect width="{w}" height="{h}" fill="{SAND}"/>
<rect x="{pad}.5" y="{pad}.5" width="{w - pad * 2 - 1}" height="{h - pad * 2 - 1}" fill="none" stroke="{LINE}" stroke-width="1" stroke-dasharray="7 7"/>
<g transform="translate({cx} {cy - short * 0.06}) scale({sprig_scale:.3f})">{SPRIG.format(olive=OLIVE, red=RED)}</g>
<text x="{cx}" y="{y_num:.1f}" text-anchor="middle" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="{fs_num}" letter-spacing="{fs_num * 0.16:.1f}" fill="{RED}">ФОТО {num}</text>
<text x="{cx}" y="{y_title:.1f}" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-weight="700" font-size="{fs_title}" fill="{INK}">{html.escape(title)}</text>
{hint_svg}
<text x="{pad + 10}" y="{h - pad - 12}" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="{fs_dim}" letter-spacing="{fs_dim * 0.12:.1f}" fill="{MUTED}">{w}×{h}</text>
<text x="{w - pad - 10}" y="{h - pad - 12}" text-anchor="end" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="{fs_dim}" letter-spacing="{fs_dim * 0.12:.1f}" fill="{MUTED}">ELEMENT CONCEPT</text>
</svg>
'''


out = os.path.join(os.getcwd(), "img", "ph")
os.makedirs(out, exist_ok=True)
for name, w, h, num, title, hint in SLOTS:
    path = os.path.join(out, f"{name}.svg")
    with open(path, "w", encoding="utf-8") as f:
        f.write(build(name, w, h, num, title, hint))
    print(f"{path}  {w}x{h}")
