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

from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

import ai  # noqa: E402
import baseline  # noqa: E402
import live  # noqa: E402
from guardrails import validate  # noqa: E402
from samples import SAMPLES  # noqa: E402

DISCLAIMER = (
    "BaliAlert AI bukan sumber peringatan resmi. Penjelasan ini dibuat oleh AI dan bisa keliru. "
    "Selalu ikuti teks asli dan arahan BMKG, BPBD, serta petugas di lokasi."
)

app = FastAPI(title="BaliAlert AI API", version="1.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class ExplainRequest(BaseModel):
    text: str = Field(min_length=20, max_length=5000)
    language: str = Field(default="id", pattern="^(" + "|".join(ai.LANGUAGES) + ")$")
    source_url: str | None = Field(default=None, max_length=300)


@app.get("/")
def root():
    return {"name": "BaliAlert AI API", "version": "1.1", "health": "/api/health", "docs": "/docs"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/meta")
def meta():
    return {"languages": ai.LANGUAGES, "disclaimer": DISCLAIMER}


@app.get("/api/samples")
def samples():
    return SAMPLES


@app.get("/api/live/gempa")
def live_gempa():
    try:
        return {"ok": True, **live.fetch_live()}
    except Exception:  # sumber luar bisa gagal; pengguna tetap bisa tempel teks manual
        raise HTTPException(
            status_code=502,
            detail={"code": "live_unavailable",
                    "message": "Data BMKG tidak dapat diambil saat ini. Tempel teks peringatan secara manual."},
        )


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
    model = raw.pop("_model", None)
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
        "model": model,
        "disclaimer": DISCLAIMER,
    }
