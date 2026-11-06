"""BaliAlert AI - backend (FastAPI)."""
import os

from pathlib import Path


def _load_env():
    """Baca backend/.env (KEY=VALUE) tanpa library tambahan."""
    p = Path(__file__).parent / ".env"
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env()

# pyrefly: ignore[missing-import]
from fastapi import FastAPI, HTTPException
# pyrefly: ignore[missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore[missing-import]
from pydantic import BaseModel, Field

import ai
import baseline
from samples import SAMPLES
from guardrails import validate

DISCLAIMER = (
    "BaliAlert AI bukan sumber peringatan resmi. Penjelasan ini dibuat oleh AI dan bisa keliru. "
    "Selalu ikuti teks asli dan arahan BMKG, BPBD, serta petugas di lokasi."
)

app = FastAPI(title="BaliAlert AI API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])



class ExplainRequest(BaseModel):
    text: str = Field(min_length=20, max_length=5000)
    language: str = Field(default="id", pattern="^(" + "|".join(ai.LANGUAGES) + ")$")
    source_url: str | None = Field(default=None, max_length=300)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/meta")
def meta():
    return {"languages": ai.LANGUAGES, "disclaimer": DISCLAIMER}


@app.get("/api/samples")
def samples():
    return SAMPLES


@app.post("/api/explain")
def explain(req: ExplainRequest):
    base = baseline.extract(req.text)
    try:
        raw = ai.call_model(req.text, req.language)
    except ai.AIError as e:
        # Cadangan: tetap kembalikan ekstraksi non-AI + teks asli.
        raise HTTPException(
            status_code=503,
            detail={"code": e.code, "message": str(e), "baseline": base, "disclaimer": DISCLAIMER},
        )
    if not raw.get("is_official_warning", False):
        return {
            "ok": True,
            "is_official_warning": False,
            "message": "Teks ini tidak terdeteksi sebagai peringatan resmi. Tempel teks peringatan dari BMKG/BPBD.",
            "baseline": base,
            "disclaimer": DISCLAIMER,
        }
    result, checks = validate(raw, req.text)
    return {
        "ok": True,
        "is_official_warning": True,
        "result": result,
        "checks": checks,
        "baseline": base,
        "source_url": req.source_url,
        "disclaimer": DISCLAIMER,
    }
