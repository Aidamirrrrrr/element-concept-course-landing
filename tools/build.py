#!/usr/bin/env python3
"""Сборка боевой версии в docs/ (оттуда её отдаёт GitHub Pages).

Что делает:
  • склеивает и минифицирует css/fonts.css + css/style.css и вставляет
    их в <style> — два блокирующих отрисовку запроса превращаются в ноль;
  • вставляет js/app.js в <script> — минус ещё один запрос;
  • копирует шрифты и картинки;
  • кладёт robots.txt, sitemap.xml и .nojekyll.

Исходники остаются раздельными: правим css/ и js/, потом запускаем сборку.
Запуск: python3 tools/build.py
"""
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "docs"
SITE = "https://aidamirrrrrr.github.io/element-concept-course-landing/"


def minify_css(css: str) -> str:
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)          # комментарии
    css = re.sub(r"\s+", " ", css)                            # переносы и отступы
    css = re.sub(r"\s*([{}:;,>~])\s*", r"\1", css)            # пробелы вокруг знаков
    css = re.sub(r";}", "}", css)                             # висячая точка с запятой
    # ' + ' в селекторах трогать нельзя: это может быть calc(). Оставляем как есть.
    return css.strip()


def minify_js(js: str) -> str:
    """Осторожная чистка: только строки, целиком состоящие из комментария.

    Полноценный минификатор здесь не нужен — файл отдаётся сжатым, а на
    метрики Lighthouse его размер уже не влияет. Зато нет риска сломать
    регулярку или шаблонную строку.
    """
    out, in_block = [], False
    for line in js.splitlines():
        s = line.strip()
        if in_block:
            if "*/" in s:
                in_block = False
            continue
        if s.startswith("/*"):
            if "*/" not in s:
                in_block = True
            continue
        if s.startswith("//") or not s:
            continue
        out.append(line)
    return "\n".join(out)


def build() -> None:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()

    css = "\n".join(
        (ROOT / "css" / name).read_text(encoding="utf-8") for name in ("fonts.css", "style.css")
    )
    js = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
    html = (ROOT / "index.html").read_text(encoding="utf-8")

    html = html.replace(
        '<link rel="stylesheet" href="css/fonts.css">\n<link rel="stylesheet" href="css/style.css">',
        f"<style>{minify_css(css)}</style>",
    )
    html = html.replace(
        '<script src="js/app.js"></script>',
        f"<script>{minify_js(js)}</script>",
    )

    assert "<style>" in html and "css/style.css" not in html, "стили не встроились"
    assert "js/app.js" not in html, "скрипт не встроился"

    (DIST / "index.html").write_text(html, encoding="utf-8")
    (DIST / ".nojekyll").write_text("", encoding="utf-8")
    (DIST / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\nSitemap: {SITE}sitemap.xml\n", encoding="utf-8"
    )
    (DIST / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"  <url><loc>{SITE}</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>\n"
        "</urlset>\n",
        encoding="utf-8",
    )

    # fonts/src — исходные TTF для пересборки, в боевую версию не идут.
    shutil.copytree(ROOT / "fonts", DIST / "fonts",
                    ignore=shutil.ignore_patterns("src"))
    shutil.copytree(ROOT / "img", DIST / "img")

    size = len((DIST / "index.html").read_bytes())
    print(f"docs/index.html — {size / 1024:.1f} КБ (стили и скрипт внутри)")
    print(f"docs/ — {sum(f.stat().st_size for f in DIST.rglob('*') if f.is_file()) / 1024:.0f} КБ всего")


if __name__ == "__main__":
    build()
