#!/usr/bin/env python3
"""Локальный статик-сервер для лендинга.

Отдаёт файлы проекта без кэширования: правки в css/js видно с первой
перезагрузки, без ?v=… и хардресета. Запуск: python3 tools/serve.py [порт]
"""
import functools
import gzip
import http.server
import io
import os
import socketserver
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
# Каталог можно переопределить вторым аргументом: tools/serve.py 4321 docs
SUBDIR = sys.argv[2] if len(sys.argv) > 2 else ""

GZIP_TYPES = ("text/", "application/javascript", "application/json", "image/svg+xml")


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".woff2": "font/woff2",
        ".json": "application/json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def send_head(self):
        """Отдаём текст сжатым — как это делает GitHub Pages.

        Без этого локальные замеры Lighthouse занижают результат: боевой
        хостинг гзипует, а простой http.server — нет.
        """
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            # Запрос каталога — отдаём его index.html, иначе сжатие пройдёт мимо
            # самой тяжёлой страницы.
            path = os.path.join(path, "index.html")
        ctype = self.guess_type(path)
        accepts = "gzip" in self.headers.get("Accept-Encoding", "")

        if not (accepts and os.path.isfile(path) and ctype.startswith(GZIP_TYPES)):
            return super().send_head()

        with open(path, "rb") as f:
            body = gzip.compress(f.read(), 6)

        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        return io.BytesIO(body)

    def log_message(self, fmt, *args):
        # Пропускаем шум от успешных запросов, оставляем только ошибки.
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    handler = functools.partial(Handler, directory=os.path.join(ROOT, SUBDIR))
    with Server(("127.0.0.1", PORT), handler) as httpd:
        print(f"Element Concept — http://localhost:{PORT}  (Ctrl+C — стоп)", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
