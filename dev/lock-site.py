#!/usr/bin/env python3
"""Encrypt index.source.html into index.html (the copy the site serves).

index.html becomes a password screen (dev/gate.html) carrying the page as
AES-256-GCM ciphertext; the visitor's browser decrypts it once they type the
password. The chip scripts and logos are folded into the page first, so
nothing readable ships beside it. Re-run after any edit to
index.source.html, js/ or assets/logos/.

    python3 dev/lock-site.py              lock; prompts for the password
    python3 dev/lock-site.py --unlock     print the decrypted page

SITE_PASSWORD in the environment skips the prompt.
"""
import base64
import getpass
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ITERATIONS = 600_000  # PBKDF2-SHA256; the blob is public, so guessing is offline

root = Path(__file__).resolve().parent.parent
src, out = root / "index.source.html", root / "index.html"
gate = root / "dev" / "gate.html"
VAULT = re.compile(r'(<script type="application/json" id="vault">)(.*?)(</script>)', re.S)
SCRIPT = re.compile(r'<script src="(js/[^"]+)"></script>')


def derive(password: str, salt: bytes, iterations: int) -> bytes:
    pw = unicodedata.normalize("NFC", password).encode()  # gate.html normalizes the same way
    return PBKDF2HMAC(hashes.SHA256(), 32, salt, iterations).derive(pw)


def bundle(page: str) -> str:
    def script(m: re.Match) -> str:
        code = (root / m[1]).read_text(encoding="utf-8")
        if "</script" in code or "<!--" in code:
            sys.exit(f"{m[1]}: contains </script or <!--, can't be inlined")
        return f"<script>\n{code}</script>"

    def image(m: re.Match) -> str:
        svg = base64.b64encode((root / m[1]).read_bytes()).decode()
        return f'src="data:image/svg+xml;base64,{svg}"'

    page = re.sub(r'src="(assets/[^"]+\.svg)"', image, page)

    # anything still loaded by relative path would be missing on the deployed site
    inlined = SCRIPT.findall(page)
    left = [s for s in re.findall(r'\ssrc="([^"]+)"', page)
            if not s.startswith(("data:", "https://")) and s not in inlined]
    if left:
        sys.exit(f"not inlined: {', '.join(left)}")
    return SCRIPT.sub(script, page)


def ask(confirm: bool) -> str:
    pw = os.environ.get("SITE_PASSWORD")
    if pw:
        return pw
    pw = getpass.getpass("Site password: ")
    if not pw or (confirm and pw != getpass.getpass("Again: ")):
        sys.exit("passwords empty or didn't match")
    return pw


def lock() -> None:
    if not src.exists():
        sys.exit(f"missing {src.name}")
    page = bundle(src.read_text(encoding="utf-8"))
    pw = ask(confirm=True)
    if len(pw) < 10:
        print("warning: short password; the encrypted page is public and can be guessed offline", file=sys.stderr)

    salt, iv = os.urandom(16), os.urandom(12)
    data = AESGCM(derive(pw, salt, ITERATIONS)).encrypt(iv, page.encode(), None)
    b64 = lambda b: base64.b64encode(b).decode()
    vault = json.dumps({"iter": ITERATIONS, "salt": b64(salt), "iv": b64(iv), "data": b64(data)})

    html, n = VAULT.subn(lambda m: m[1] + vault + m[3], gate.read_text(encoding="utf-8"))
    if n != 1:
        sys.exit(f"{gate.name}: vault placeholder not found")
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out.name} (AES-256-GCM, {len(html) // 1024} KB)")


def unlock() -> None:
    m = VAULT.search(out.read_text(encoding="utf-8"))
    if not m:
        sys.exit(f"{out.name} isn't a locked page")
    v = json.loads(m[2])
    salt, iv, data = (base64.b64decode(v[k]) for k in ("salt", "iv", "data"))
    try:
        page = AESGCM(derive(ask(confirm=False), salt, v["iter"])).decrypt(iv, data, None)
    except InvalidTag:
        sys.exit("wrong password")
    sys.stdout.write(page.decode())


if __name__ == "__main__":
    unlock() if "--unlock" in sys.argv[1:] else lock()
