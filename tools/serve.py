#!/usr/bin/env python3
"""Локальный статик-сервер для лендинга.

Отдаёт файлы проекта без кэширования: правки в css/js видно с первой
перезагрузки, без ?v=… и хардресета. Запуск: python3 tools/serve.py [порт]
"""
import functools
import http.server
import os
import socketserver
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4321


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

    def log_message(self, fmt, *args):
        # Пропускаем шум от успешных запросов, оставляем только ошибки.
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    handler = functools.partial(Handler, directory=ROOT)
    with Server(("127.0.0.1", PORT), handler) as httpd:
        print(f"Element Concept — http://localhost:{PORT}  (Ctrl+C — стоп)", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
