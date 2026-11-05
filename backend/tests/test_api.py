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
