"""Guardrail deterministik (non-AI) untuk memeriksa keluaran model.

Prinsip: apa pun yang dikutip AI sebagai "teks resmi" harus benar-benar ada
di teks sumber. Yang tidak ada di sumber dibuang dan ditandai.
"""
import re
import unicodedata


def norm(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    return re.sub(r"\s+", " ", text).strip().lower()


def is_verbatim(quote: str, source: str) -> bool:
    q = norm(quote)
    return bool(q) and q in norm(source)


def validate(result: dict, source: str) -> tuple[dict, dict]:
    """Kembalikan (hasil_bersih, laporan_pemeriksaan)."""
    clean = dict(result)
    report = {
        "instructions_dropped": 0,
        "areas_unverified": [],
        "validity_verified": None,
        "level_verified": None,
    }

    kept = []
    for item in result.get("official_instructions") or []:
        original = (item or {}).get("original", "")
        if is_verbatim(original, source):
            kept.append({"original": original, "translation": item.get("translation", "")})
        else:
            report["instructions_dropped"] += 1
    clean["official_instructions"] = kept

    areas = []
    for name in result.get("areas") or []:
        ok = is_verbatim(name, source)
        areas.append({"name": name, "verified": ok})
        if not ok:
            report["areas_unverified"].append(name)
    clean["areas"] = areas

    vq = result.get("validity_quote")
    if vq:
        report["validity_verified"] = is_verbatim(vq, source)
        if not report["validity_verified"]:
            clean["validity_quote"] = None
    lq = result.get("level_quote")
    if lq:
        report["level_verified"] = is_verbatim(lq, source)
        if not report["level_verified"]:
            clean["level_quote"] = None

    # Bidang yang kosong setelah validasi dicatat sebagai "tidak tersedia".
    missing = set(result.get("missing_fields") or [])
    if not clean.get("hazard_type"):
        missing.add("hazard")
    if not clean["areas"]:
        missing.add("area")
    if not clean.get("validity_quote"):
        missing.add("validity")
    if not clean["official_instructions"]:
        missing.add("instruction")
    clean["missing_fields"] = sorted(missing)
    return clean, report
