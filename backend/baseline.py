"""Ekstraksi berbasis aturan (tanpa AI).

Dipakai sebagai pembanding terhadap AI dan sebagai cadangan jika AI gagal.
"""
import re

HAZARDS = [
    ("tsunami", "Tsunami"),
    ("gempa", "Gempa bumi"),
    ("gelombang tinggi", "Gelombang tinggi"),
    ("banjir pesisir", "Banjir pesisir (rob)"),
    ("rob", "Banjir pesisir (rob)"),
    ("cuaca ekstrem", "Cuaca ekstrem"),
    ("hujan lebat", "Hujan lebat"),
]
LEVELS = ["AWAS", "SIAGA", "WASPADA", "Sangat Tinggi", "Tinggi", "Sedang", "Rendah"]
MONTHS = (
    "Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|"
    "Jan|Feb|Mar|Apr|Jun|Jul|Agu|Agt|Sep|Okt|Nov|Des"
)
PERIOD = re.compile(
    rf"\d{{1,2}}\s*(?:{MONTHS})?\s*(?:\d{{4}})?\s*[-–]\s*\d{{1,2}}\s+(?:{MONTHS})\s+\d{{4}}", re.I
)
SINGLE_DATE = re.compile(rf"\b\d{{1,2}}\s+(?:{MONTHS})\s+\d{{4}}\b", re.I)
AREAS = [
    "Gianyar", "Badung", "Denpasar", "Tabanan", "Klungkung", "Jembrana",
    "Buleleng", "Karangasem", "Bangli", "Nusa Penida", "Selat Badung", "Selat Lombok",
    "Samudra Hindia", "Laut Bali", "Bali", "Lombok",
]


def extract(source: str) -> dict:
    low = source.lower()
    hazard = next((label for key, label in HAZARDS if re.search(rf"\b{re.escape(key)}\b", low)), None)
    level = next((l for l in LEVELS if re.search(rf"\b{re.escape(l)}\b", source, re.I)), None)
    m = PERIOD.search(source) or SINGLE_DATE.search(source)
    areas = [a for a in AREAS if re.search(rf"\b{re.escape(a)}\b", source, re.I)]
    return {
        "hazard_type": hazard,
        "level": level,
        "validity": m.group(0) if m else None,
        "areas": areas,
    }
