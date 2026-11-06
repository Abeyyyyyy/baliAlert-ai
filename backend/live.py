"""Ambil data resmi BMKG (gempa dirasakan) dan ubah menjadi teks yang bisa dijelaskan.

Catatan: teks disusun otomatis dari kolom data BMKG; sumbernya tetap BMKG.
"""
import re
import time

URL = "https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json"
SOURCE_PAGE = "https://www.bmkg.go.id/gempabumi/gempabumi-dirasakan"
_cache = {"exp": 0.0, "value": None}


def _clean(s) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()


def build_items(payload, limit: int = 5) -> dict:
    rows = ((payload or {}).get("Infogempa") or {}).get("gempa") or []
    if isinstance(rows, dict):
        rows = [rows]
    rows = [r for r in rows if isinstance(r, dict)]

    def blob(r):
        return f"{r.get('Wilayah', '')} {r.get('Dirasakan', '')}".lower()

    bali = [r for r in rows if "bali" in blob(r)]
    chosen = bali[:limit]
    is_bali = bool(chosen)
    if not chosen:
        chosen = rows[:3]

    items = []
    for i, r in enumerate(chosen):
        text = _clean(
            f"Informasi Gempa Bumi Dirasakan. Tanggal {r.get('Tanggal', '')}, pukul {r.get('Jam', '')}. "
            f"Magnitudo {r.get('Magnitude', '')}, kedalaman {r.get('Kedalaman', '')}. "
            f"Wilayah: {r.get('Wilayah', '')}. Dirasakan (Skala MMI): {r.get('Dirasakan', '')}."
        )
        label = _clean(f"M{r.get('Magnitude', '?')} · {r.get('Wilayah', '')}")[:90]
        items.append({"id": f"gempa-{i}", "label": label, "text": text, "source_url": SOURCE_PAGE})
    return {"is_bali": is_bali, "items": items}


def fetch_live() -> dict:
    import httpx

    now = time.time()
    if _cache["value"] is not None and _cache["exp"] > now:
        return _cache["value"]
    r = httpx.get(URL, timeout=10, headers={"user-agent": "BaliAlertAI/1.1"})
    r.raise_for_status()
    value = build_items(r.json())
    _cache["value"], _cache["exp"] = value, now + 120
    return value
