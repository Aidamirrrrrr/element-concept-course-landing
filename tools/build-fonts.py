#!/usr/bin/env python3
"""Собирает шрифты страницы: статичные начертания, подрезанные под её текст.

Зачем: Google отдаёт вариативные шрифты, разрезанные по unicode-range, —
это 10 файлов и 200 КБ. Первый экран при этом ждёт минимум два запроса
(кириллица для заголовка и латиница для логотипа и цифр), и Lighthouse
привязывает к ним FCP. Здесь на каждое используемое начертание собирается
один файл со всеми нужными символами — их можно встроить прямо в страницу.

Что делает:
  1. качает исходные TTF из репозитория google/fonts (кэш в fonts/src/);
  2. вырезает статичное начертание нужного веса из вариативного шрифта;
  3. подрезает под символы, реально встречающиеся в index.html, плюс
     страховочный набор (вся русская азбука, латиница, цифры, пунктуация);
  4. пишет woff2 в fonts/ и генерирует css/fonts.css.

Нужны fonttools и brotli:
    python3 -m venv .venv && .venv/bin/pip install fonttools brotli
    .venv/bin/python tools/build-fonts.py

Тексты поменялись — запустить заново.
"""
import html
import io
import pathlib
import re
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = ROOT / "fonts"
SRC = FONTS / "src"
BASE = "https://github.com/google/fonts/raw/main/"

# (файл, откуда качать, ось веса) — вес None означает статичный исходник.
SOURCES = {
    "manrope": ("ofl/manrope/Manrope%5Bwght%5D.ttf", "wght"),
    "literata": ("ofl/literata/Literata%5Bopsz,wght%5D.ttf", "wght"),
    "plex-mono": ("ofl/ibmplexmono/IBMPlexMono-Regular.ttf", None),
}

# Начертания, которые реально использует вёрстка.
FACES = [
    ("manrope", "Manrope", 400),
    ("manrope", "Manrope", 700),
    ("manrope", "Manrope", 800),
    ("literata", "Literata", 200),
    ("plex-mono", "IBM Plex Mono", 400),
]

# Страховка поверх символов страницы: правки текста не потребуют пересборки.
SAFETY = (
    "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"
    "абвгдеёжзийклмнопрстуфхцчшщъыьэюя"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    "0123456789"
    " !\"#%&'()*+,-./:;=?@[]«»‹›„“”‘’—–-…·№₽€$%°×÷©®™"
)


def page_chars() -> set[str]:
    """Символы из видимого текста страницы: теги, скрипты и стили не в счёт."""
    raw = (ROOT / "index.html").read_text(encoding="utf-8")
    raw = re.sub(r"<(script|style)\b.*?</\1>", " ", raw, flags=re.S | re.I)
    raw = re.sub(r"<[^>]+>", " ", raw)
    return set(html.unescape(raw)) | set(SAFETY)


def fetch(name: str, url_path: str) -> pathlib.Path:
    SRC.mkdir(parents=True, exist_ok=True)
    dst = SRC / f"{name}.ttf"
    if not dst.exists():
        print(f"качаю {name}…")
        with urllib.request.urlopen(BASE + url_path) as r:
            dst.write_bytes(r.read())
    return dst


def build_face(src_path: pathlib.Path, axis: str | None, weight: int,
               chars: set[str], out: pathlib.Path) -> int:
    font = TTFont(src_path)

    if axis:
        # Закрепляем ВСЕ оси, а не только вес: у Literata есть ещё opsz, и
        # частично вариативный шрифт потом ломает подрезку (KeyError в gvar).
        loc = {}
        for a in font["fvar"].axes:
            value = weight if a.axisTag == axis else a.defaultValue
            loc[a.axisTag] = max(a.minValue, min(a.maxValue, value))
        font = instancer.instantiateVariableFont(font, loc, updateFontNames=False)

    opts = subset.Options()
    opts.flavor = "woff2"
    opts.desubroutinize = True
    opts.layout_features = ["kern", "liga", "calt", "tnum", "locl"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.drop_tables += ["DSIG"]

    subsetter = subset.Subsetter(options=opts)
    subsetter.populate(text="".join(sorted(chars)))
    subsetter.subset(font)

    buf = io.BytesIO()
    font.flavor = "woff2"
    font.save(buf)
    out.write_bytes(buf.getvalue())
    return len(buf.getvalue())


def main() -> None:
    chars = page_chars()
    print(f"символов на странице: {len(chars)}")

    faces, total = [], 0
    for key, family, weight in FACES:
        url_path, axis = SOURCES[key]
        src = fetch(key, url_path)
        name = f"{key}-{weight}.woff2"
        size = build_face(src, axis, weight, chars, FONTS / name)
        total += size
        faces.append((family, weight, name))
        print(f"  {name:24} {size / 1024:5.1f} КБ")

    # Старые google-сабсеты больше не нужны.
    for old in FONTS.glob("*-cyrillic.woff2"):
        old.unlink()
    for old in FONTS.glob("*-latin.woff2"):
        old.unlink()

    css = ["/* Сгенерировано tools/build-fonts.py — руками не править. */"]
    for family, weight, name in faces:
        css.append(
            "@font-face{"
            f"font-family:'{family}';font-style:normal;font-weight:{weight};"
            f"font-display:swap;src:url('../fonts/{name}') format('woff2')"
            "}"
        )
    (ROOT / "css" / "fonts.css").write_text("\n".join(css) + "\n", encoding="utf-8")

    print(f"\nвсего {total / 1024:.0f} КБ в {len(faces)} файлах; css/fonts.css обновлён")


if __name__ == "__main__":
    main()
