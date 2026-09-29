#!/usr/bin/env python3
"""Tiny local server for the D&D character sheet + session notes app.

No dependencies beyond the Python standard library.

  python3 server.py                 # http://127.0.0.1:8765
  python3 server.py --port 9000
  DND_NOTES_DIR=~/vault/DnD python3 server.py   # write notes into an Obsidian vault

Layout:
  data/characters/<id>.json   one file per character
  <notes dir>/<id>/*.md       session notes, one folder per character
"""
import argparse
import json
import os
import re
import shutil
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
DATA_DIR = Path(os.path.expanduser(os.environ.get("DND_DATA_DIR", ROOT / "data"))).resolve()
NOTES_DIR = Path(os.path.expanduser(os.environ.get("DND_NOTES_DIR", DATA_DIR / "notes"))).resolve()
CHAR_DIR = DATA_DIR / "characters"
LEGACY_CHARACTER_FILE = DATA_DIR / "character.json"  # single-character layout, migrated on start

# Note filenames: no path separators, must end in .md
SAFE_NAME = re.compile(r"^[^/\\\x00]+\.md$")
# Character ids: lowercase slug
SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")


def atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:48]
    return slug or "character"


def unique_id(name: str) -> str:
    base = slugify(name)
    cid, n = base, 2
    while (CHAR_DIR / f"{cid}.json").exists():
        cid, n = f"{base}-{n}", n + 1
    return cid


def parse_frontmatter(text: str) -> dict:
    """Minimal YAML frontmatter reader: flat `key: value` pairs only."""
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    meta = {}
    for line in text[3:end].splitlines():
        if ":" in line and not line.startswith((" ", "\t", "-")):
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip().strip("'\"")
    return meta


def char_path(cid: str | None) -> Path | None:
    cid = unquote(cid or "")
    return CHAR_DIR / f"{cid}.json" if SAFE_ID.match(cid) else None


def notes_dir(cid: str | None) -> Path | None:
    cid = unquote(cid or "")
    return NOTES_DIR / cid if SAFE_ID.match(cid) else None


def note_path(cid: str | None, name: str) -> Path | None:
    folder = notes_dir(cid)
    name = unquote(name)
    if not folder or not SAFE_NAME.match(name) or name.startswith("."):
        return None
    path = (folder / name).resolve()
    return path if path.parent == folder.resolve() else None


def migrate_legacy() -> None:
    """Move the old single data/character.json (and loose notes) into the per-character layout."""
    if not LEGACY_CHARACTER_FILE.exists():
        return
    data = json.loads(LEGACY_CHARACTER_FILE.read_text(encoding="utf-8"))
    cid = unique_id(data.get("name") or "character")
    CHAR_DIR.mkdir(parents=True, exist_ok=True)
    shutil.move(str(LEGACY_CHARACTER_FILE), CHAR_DIR / f"{cid}.json")
    moved = 0
    for note in NOTES_DIR.glob("*.md"):
        (NOTES_DIR / cid).mkdir(parents=True, exist_ok=True)
        shutil.move(str(note), NOTES_DIR / cid / note.name)
        moved += 1
    print(f"Migrated data/character.json -> characters/{cid}.json ({moved} session notes moved to notes/{cid}/)")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    # --- helpers -----------------------------------------------------------
    def send_json(self, obj, status=HTTPStatus.OK):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(length) or b"null")

    def error_json(self, status, msg):
        self.send_json({"error": msg}, status)

    def end_headers(self):
        # Don't let the browser cache stale app code between edits.
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    # --- routing -----------------------------------------------------------
    # /api/characters[/<id>]          list / create, get / save / delete
    # /api/notes/<id>[/<file>]        list / create, get / save / delete
    def route(self, method):
        path = urlparse(self.path).path
        if not path.startswith("/api/"):
            return False
        parts = path.strip("/").split("/")[1:]  # [resource, *args]
        resource, args = (parts[0] if parts else ""), parts[1:]
        try:
            handler = getattr(self, f"{resource}_{method}", None)
            if resource not in ("characters", "notes") or handler is None:
                self.error_json(HTTPStatus.NOT_FOUND, "unknown endpoint")
            else:
                handler(*args)
        except TypeError:
            self.error_json(HTTPStatus.NOT_FOUND, "unknown endpoint")
        except (ValueError, json.JSONDecodeError) as e:
            self.error_json(HTTPStatus.BAD_REQUEST, str(e))
        return True

    def do_GET(self):
        if not self.route("get"):
            super().do_GET()

    def do_PUT(self):
        if not self.route("put"):
            self.error_json(HTTPStatus.METHOD_NOT_ALLOWED, "method not allowed")

    def do_POST(self):
        if not self.route("post"):
            self.error_json(HTTPStatus.METHOD_NOT_ALLOWED, "method not allowed")

    def do_DELETE(self):
        if not self.route("delete"):
            self.error_json(HTTPStatus.METHOD_NOT_ALLOWED, "method not allowed")

    # --- characters --------------------------------------------------------
    def characters_get(self, cid=None):
        if cid is None:
            out = []
            for p in sorted(CHAR_DIR.glob("*.json")):
                try:
                    d = json.loads(p.read_text(encoding="utf-8"))
                except json.JSONDecodeError:
                    continue
                out.append({"id": p.stem, "name": d.get("name", ""), "class": d.get("class", ""),
                            "level": d.get("level", ""), "race": d.get("race", ""),
                            "mtime": p.stat().st_mtime})
            return self.send_json(out)
        path = char_path(cid)
        if not path or not path.exists():
            return self.error_json(HTTPStatus.NOT_FOUND, "character not found")
        self.send_json(json.loads(path.read_text(encoding="utf-8")))

    def characters_post(self):
        """Create a character. Body: the character object (at least {name})."""
        data = self.read_json() or {}
        if not isinstance(data, dict):
            raise ValueError("character must be a JSON object")
        cid = unique_id(str(data.get("name") or "character"))
        atomic_write(CHAR_DIR / f"{cid}.json", json.dumps(data, indent=2))
        self.send_json({"ok": True, "id": cid}, HTTPStatus.CREATED)

    def characters_put(self, cid):
        path = char_path(cid)
        if not path or not path.exists():
            return self.error_json(HTTPStatus.NOT_FOUND, "character not found")
        data = self.read_json()
        if not isinstance(data, dict):
            raise ValueError("character must be a JSON object")
        atomic_write(path, json.dumps(data, indent=2))
        self.send_json({"ok": True})

    def characters_delete(self, cid):
        """Deleting a character moves its sheet and notes into data/trash/ rather than erasing them."""
        path = char_path(cid)
        if not path or not path.exists():
            return self.error_json(HTTPStatus.NOT_FOUND, "character not found")
        trash = DATA_DIR / "trash"
        trash.mkdir(parents=True, exist_ok=True)
        shutil.move(str(path), trash / path.name)
        nd = notes_dir(cid)
        if nd and nd.exists():
            shutil.move(str(nd), trash / f"{path.stem}-notes")
        self.send_json({"ok": True})

    # --- notes -------------------------------------------------------------
    def notes_get(self, cid, name=None):
        folder = notes_dir(cid)
        if not folder:
            return self.error_json(HTTPStatus.BAD_REQUEST, "invalid character id")
        if name is None:
            notes = []
            for p in folder.glob("*.md") if folder.exists() else []:
                if p.name.startswith("."):
                    continue
                meta = parse_frontmatter(p.read_text(encoding="utf-8"))
                notes.append({
                    "file": p.name,
                    "title": meta.get("title") or p.stem,
                    "date": meta.get("date", ""),
                    "session": meta.get("session", ""),
                    "mtime": p.stat().st_mtime,
                })
            return self.send_json(notes)
        path = note_path(cid, name)
        if not path or not path.exists():
            return self.error_json(HTTPStatus.NOT_FOUND, "note not found")
        self.send_json({"file": path.name, "content": path.read_text(encoding="utf-8")})

    def notes_put(self, cid, name):
        path = note_path(cid, name)
        if not path:
            return self.error_json(HTTPStatus.BAD_REQUEST, "invalid note name")
        data = self.read_json() or {}
        atomic_write(path, str(data.get("content", "")))
        self.send_json({"ok": True, "file": path.name})

    def notes_post(self, cid):
        """Create a new note; refuses to overwrite an existing file."""
        data = self.read_json() or {}
        path = note_path(cid, str(data.get("file", "")))
        if not path:
            return self.error_json(HTTPStatus.BAD_REQUEST, "invalid note name")
        if path.exists():
            return self.error_json(HTTPStatus.CONFLICT, "a note with that name already exists")
        atomic_write(path, str(data.get("content", "")))
        self.send_json({"ok": True, "file": path.name}, HTTPStatus.CREATED)

    def notes_delete(self, cid, name):
        path = note_path(cid, name)
        if not path or not path.exists():
            return self.error_json(HTTPStatus.NOT_FOUND, "note not found")
        path.unlink()
        self.send_json({"ok": True})

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            return  # keep the console quiet during autosave
        super().log_message(fmt, *args)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8765)
    args = ap.parse_args()
    CHAR_DIR.mkdir(parents=True, exist_ok=True)
    NOTES_DIR.mkdir(parents=True, exist_ok=True)
    migrate_legacy()
    print(f"Characters: {CHAR_DIR}")
    print(f"Notes:      {NOTES_DIR}/<character>/")
    print(f"Open        http://{args.host}:{args.port}")
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
