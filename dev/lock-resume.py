#!/usr/bin/env python3
"""Encrypt resume.source.pdf into resume.pdf (the copy the site serves).

Browsers prompt for the password when the PDF opens. Re-run this whenever
the résumé changes: drop the new PDF in as resume.source.pdf first.
"""
import getpass
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter

root = Path(__file__).resolve().parent.parent
src, out = root / "resume.source.pdf", root / "resume.pdf"

if not src.exists():
    sys.exit(f"missing {src.name}")

pw = getpass.getpass("Résumé password: ")
if not pw or pw != getpass.getpass("Again: "):
    sys.exit("passwords empty or didn't match")

writer = PdfWriter(clone_from=PdfReader(src))
writer.encrypt(user_password=pw, algorithm="AES-256")
writer.write(out)
print(f"wrote {out.name} (AES-256)")
