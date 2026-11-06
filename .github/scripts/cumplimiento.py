#!/usr/bin/env python3
"""Falla la publicación si una página no cumple lo mínimo (ver CUMPLIMIENTO.md)."""
import pathlib, re, sys
raiz = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OBLIG = ["politica-de-datos", "terminos", "reembolsos", "politica-de-cookies", "eliminar-mis-datos", "aviso-legal"]
errores = []
for p in OBLIG:
    if not (raiz / p / "index.html").exists(): errores.append(f"falta la página /{p}/")
for f in sorted(raiz.rglob("*.html")):
    if any(x.startswith(".") for x in f.relative_to(raiz).parts) or "docs" in f.parts: continue
    t = f.read_text(encoding="utf-8", errors="ignore"); r = f.relative_to(raiz)
    if 'src="/legal.js"' not in t: errores.append(f"{r}: no carga /legal.js (banner de cookies + franja legal)")
    if not re.search(r'<html[^>]*\blang="', t): errores.append(f"{r}: <html> sin lang")
    for img in re.findall(r"<img\b[^>]*>", t):
        if "alt=" not in img and "${" not in img and "'" not in img: errores.append(f"{r}: imagen sin alt: {img[:80]}")
    if re.search(r"googletagmanager|google-analytics|connect\.facebook\.net|hotjar|clarity\.ms", t) and "PascaliaConsent" not in t:
        errores.append(f"{r}: script de seguimiento sin pasar por PascaliaConsent")
if errores:
    print("Cumplimiento: hay problemas\n- " + "\n- ".join(errores)); sys.exit(1)
print("Cumplimiento: OK")
