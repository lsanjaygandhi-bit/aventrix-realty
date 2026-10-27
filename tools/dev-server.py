#!/usr/bin/env python3
"""Local preview server for Aventrix Realty multilingual routes.

Run from the extracted project:
    python3 tools/dev-server.py
Then open http://127.0.0.1:4173/ or /ta/, /hi/, /te/, /kn/, /ml/.
This mimics the locale-prefix rewrite and script injection performed by worker.js.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os, re

ROOT = Path(__file__).resolve().parents[1]
PORT = int(os.environ.get("PORT", "4173"))

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def translate_path(self, path):
        path = path.split("?", 1)[0].split("#", 1)[0]
        path = re.sub(r"^/(ta|hi|te|kn|ml)(?=/|$)", "", path) or "/"
        return super().translate_path(path)

    def end_headers(self):
        super().end_headers()

    def do_GET(self):
        original_path = self.path
        locale_match = re.match(r"^/(ta|hi|te|kn|ml)(?=/|\?|$)", original_path)
        locale = locale_match.group(1) if locale_match else "en"
        translated_path = re.sub(r"^/(ta|hi|te|kn|ml)(?=/|\?|$)", "", original_path)
        self.path = translated_path or "/"
        if "?" in original_path and "?" not in self.path:
            self.path += "?" + original_path.split("?", 1)[1]
        # Serve normally first; HTML injection is handled by send_head below.
        self._avx_locale = locale
        return super().do_GET()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            index = os.path.join(path, "index.html")
            if os.path.exists(index):
                path = index
        if path.lower().endswith((".html", ".htm")) and os.path.isfile(path):
            try:
                with open(path, "rb") as f:
                    body = f.read()
                text = body.decode("utf-8")
                injection = '<script src="/js/language-switcher.js?v=20261027-desktop-selector-restore" defer></script>'
                if "language-switcher.js" not in text:
                    text = re.sub(r"</head>", injection + "\n</head>", text, count=1, flags=re.I)
                text = re.sub(r'<html([^>]*?)\slang=["\'][^"\']*["\']', r'<html\1 lang="' + getattr(self, "_avx_locale", "en") + '"', text, count=1, flags=re.I)
                encoded = text.encode("utf-8")
                from io import BytesIO
                self.send_response(200)
                self.send_header("Content-type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(encoded)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                return BytesIO(encoded)
            except (OSError, UnicodeDecodeError):
                pass
        return super().send_head()

if __name__ == "__main__":
    print(f"Aventrix Realty preview: http://127.0.0.1:{PORT}/")
    print("Locales: /ta/ /hi/ /te/ /kn/ /ml/")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
