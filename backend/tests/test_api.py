import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402

import ai  # noqa: E402
import baseline  # noqa: E402
from guardrails import validate  # noqa: E402

SRC = ("Peringatan Dini Gelombang Tinggi. Berlaku 4 - 7 November 2026. "
       "Perairan Bali: Selat Badung kategori Tinggi. "
       "Masyarakat dihimbau tidak melakukan aktivitas di laut.")

try:
    from fastapi.testclient import TestClient  # noqa: E402
    import main  # noqa: E402
    client = TestClient(main.app)
except ImportError:  # fastapi belum terpasang: tes API dilewati
    client = None
api = pytest.mark.skipif(client is None, reason="fastapi belum terpasang")


def fake_ok(source, language):
    return {
        "is_official_warning": True,
        "hazard_type": "Gelombang tinggi",
        "level": "Tinggi",
        "level_quote": "kategori Tinggi",
        "areas": ["Selat Badung", "Pulau Fiktif"],  # yang kedua tidak ada di sumber
        "validity_quote": "Berlaku 4 - 7 November 2026",
        "official_instructions": [
            {"original": "tidak melakukan aktivitas di laut", "translation": "Do not go to sea."},
            {"original": "segera evakuasi ke bukit", "translation": "Evacuate."},  # karangan AI
        ],
        "simple_explanation": "High waves expected.",
        "missing_fields": [],
    }


def test_guardrail_drops_invented_instruction_and_flags_area():
    clean, report = validate(fake_ok(SRC, "en"), SRC)
    assert len(clean["official_instructions"]) == 1
    assert report["instructions_dropped"] == 1
    assert report["areas_unverified"] == ["Pulau Fiktif"]
    assert report["validity_verified"] is True


def test_guardrail_marks_missing_when_nothing_verified():
    raw = fake_ok(SRC, "en")
    raw["official_instructions"] = [{"original": "evakuasi", "translation": "x"}]
    raw["validity_quote"] = "Berlaku 1 Januari 2030"
    clean, _ = validate(raw, SRC)
    assert "instruction" in clean["missing_fields"]
    assert "validity" in clean["missing_fields"]


@api
def test_explain_ok(monkeypatch):
    monkeypatch.setattr(ai, "call_model", fake_ok)
    r = client.post("/api/explain", json={"text": SRC, "language": "en"})
    assert r.status_code == 200
    body = r.json()
    assert body["checks"]["instructions_dropped"] == 1
    assert body["baseline"]["hazard_type"] == "Gelombang tinggi"
    assert "bukan sumber peringatan resmi" in body["disclaimer"]


@api
def test_explain_ai_failure_returns_baseline(monkeypatch):
    def boom(source, language):
        raise ai.AIError("quota", "Kuota AI sedang habis.")
    monkeypatch.setattr(ai, "call_model", boom)
    r = client.post("/api/explain", json={"text": SRC, "language": "id"})
    assert r.status_code == 503
    d = r.json()["detail"]
    assert d["code"] == "quota" and d["baseline"]["validity"]


@api
def test_not_a_warning(monkeypatch):
    monkeypatch.setattr(ai, "call_model", lambda s, l: {"is_official_warning": False})
    r = client.post("/api/explain", json={"text": "Resep nasi goreng enak sekali untuk sarapan pagi", "language": "id"})
    assert r.json()["is_official_warning"] is False


@api
def test_validation_of_input():
    assert client.post("/api/explain", json={"text": "pendek", "language": "id"}).status_code == 422
    assert client.post("/api/explain", json={"text": SRC, "language": "xx"}).status_code == 422


@api
def test_no_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    r = client.post("/api/explain", json={"text": SRC, "language": "id"})
    assert r.status_code == 503 and r.json()["detail"]["code"] == "no_key"


def test_baseline_extracts_without_ai():
    b = baseline.extract(SRC)
    assert b["hazard_type"] == "Gelombang tinggi"
    assert b["level"] == "Tinggi"
    assert "Selat Badung" in b["areas"]
    assert b["validity"].endswith("November 2026")


def test_ai_without_key_raises(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(ai.AIError) as e:
        ai.call_model(SRC, "id")
    assert e.value.code == "no_key"


def test_models_fallback_order(monkeypatch):
    monkeypatch.setenv("GEMINI_MODEL", "m-utama")
    monkeypatch.setenv("GEMINI_FALLBACK_MODELS", "m-b, m-utama, m-c")
    assert ai.models() == ["m-utama", "m-b", "m-c"]


def test_fallback_to_second_model_and_cache(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "x")
    monkeypatch.setenv("GEMINI_MODEL", "m1")
    monkeypatch.setenv("GEMINI_FALLBACK_MODELS", "m2")
    ai._CACHE.clear()
    calls = []

    def fake_one(model, key, source, language):
        calls.append(model)
        if model == "m1":
            raise ai.AIError("quota", "habis")
        return {"is_official_warning": True}

    monkeypatch.setattr(ai, "_call_one", fake_one)
    r = ai.call_model(SRC, "id")
    assert r["_model"] == "m2" and calls == ["m1", "m2"]
    ai.call_model(SRC, "id")  # kedua kali: dari cache, tanpa panggilan baru
    assert calls == ["m1", "m2"]


def test_all_models_fail_raises(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "x")
    ai._CACHE.clear()
    monkeypatch.setattr(ai, "_call_one", lambda *a: (_ for _ in ()).throw(ai.AIError("quota", "habis")))
    with pytest.raises(ai.AIError):
        ai.call_model(SRC, "id")


def test_parse_json_handles_code_fence():
    assert ai._parse_json('```json\n{"a": 1}\n```') == {"a": 1}


def test_live_build_items_prefers_bali():
    import live
    payload = {"Infogempa": {"gempa": [
        {"Tanggal": "05 Nov 2026", "Jam": "10:00:00 WIB", "Magnitude": "3.1", "Kedalaman": "10 km",
         "Wilayah": "Pusat gempa di darat 5 km Timur Laut Karangasem-Bali", "Dirasakan": "II Karangasem"},
        {"Tanggal": "05 Nov 2026", "Jam": "09:00:00 WIB", "Magnitude": "4.0", "Kedalaman": "20 km",
         "Wilayah": "Laut Banda", "Dirasakan": "III Ambon"},
    ]}}
    out = live.build_items(payload)
    assert out["is_bali"] is True and len(out["items"]) == 1
    assert "Karangasem" in out["items"][0]["text"]
    b = baseline.extract(out["items"][0]["text"])
    assert b["hazard_type"] == "Gempa bumi" and b["validity"] == "05 Nov 2026"


def test_live_build_items_falls_back_when_no_bali():
    import live
    payload = {"Infogempa": {"gempa": [{"Wilayah": "Laut Banda", "Magnitude": "4"}] * 5}}
    out = live.build_items(payload)
    assert out["is_bali"] is False and len(out["items"]) == 3
