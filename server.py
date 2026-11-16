"""Servidor local del Entrenador de Ajedrez.
Ejecuta:  python server.py   y se abre el navegador en http://127.0.0.1:8765
(Hace falta un servidor porque el motor Stockfish corre en un Web Worker.)
"""
import http.server
import os
import socketserver
import sys
import threading
import webbrowser

PORT = 8765
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".webmanifest": "application/manifest+json",
    }

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *args):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    url = f"http://127.0.0.1:{PORT}/"
    try:
        httpd = Server(("127.0.0.1", PORT), Handler)
    except OSError:
        print(f"El puerto {PORT} ya está en uso: probablemente la app ya está abierta.")
        webbrowser.open(url)
        return
    print(f"Entrenador de Ajedrez en {url}  (cierra esta ventana para apagarlo)")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
