# BaliAlert AI

Penjelas peringatan resmi (BMKG/BPBD) untuk wisatawan di Bali. Pengguna menempel teks peringatan, lalu BaliAlert AI mengekstrak bahaya, wilayah, masa berlaku, level, dan instruksi resmi, dan menjelaskannya dalam bahasa pilihan. **Teks asli dan tautan sumber selalu ditampilkan.** BaliAlert AI bukan sumber peringatan resmi.

## Problem & Target User
- Peringatan resmi Bali tersedia di banyak kanal (BMKG, BMKG Maritim, BNPB, BPBD, Pemprov Bali) dan umumnya berbahasa Indonesia dengan istilah teknis.
- Target: wisatawan mancanegara dan domestik di Bali (fokus awal aktivitas pesisir/laut), serta pelaku usaha pariwisata yang menjelaskan peringatan ke tamu.
- Catatan jujur: kesulitan wisatawan belum dibuktikan lewat riset primer. Lihat `docs/` dan Hypothesis Register. MVP ini dibuat sebagai alat untuk **menguji** hipotesis tersebut.

## Key Features (berfungsi saat submission)
- Tempel teks peringatan atau pilih contoh format demo.
- Ekstraksi AI: jenis bahaya, level, wilayah, masa berlaku, instruksi resmi, ke dalam 8 bahasa.
- Teks asli berdampingan dengan penjelasan, plus tautan sumber.
- Pengaman: kutipan AI diverifikasi harus ada persis di teks sumber; yang tidak ditemukan dibuang/ditandai. Bidang yang tidak ada ditulis "Tidak tersedia", tidak ditebak.
- Pembanding non-AI (aturan/regex) yang ditampilkan berdampingan dengan hasil AI (selaras/beda), dan cadangan saat AI gagal atau kuota habis.
- Badge level berwarna, ringkasan verifikasi, tombol salin, dan pilihan bahasa yang diingat.
- (Beta) Ambil data gempa dirasakan terbaru dari open data BMKG (data.bmkg.go.id); teks disusun otomatis dari kolom data resmi.
- Model cadangan otomatis dan cache sementara untuk menghemat kuota API.

## Tech Stack
Frontend: Next.js 14 + TypeScript. Backend: Python + FastAPI. AI: Gemini API (`GEMINI_MODEL`, cadangan `GEMINI_FALLBACK_MODELS`). Hosting: Vercel. Tanpa database.

## AI Implementation
Lihat `docs/AI_TECHNOLOGY_DISCLOSURE.md`. Kode pemanggilan AI: `backend/ai.py`. Pengaman: `backend/guardrails.py`. Baseline non-AI: `backend/baseline.py`.

## Architecture / Data Flow
```
Pengguna -> Frontend (Next.js) -> POST /api/explain (FastAPI)
   -> baseline.py (aturan)  +  ai.py (Gemini, JSON)
   -> guardrails.py (verifikasi kutipan harus ada di teks sumber)
   -> hasil + pemeriksaan -> Frontend (teks asli | penjelasan | pembanding)
```

## Installation / Run Instructions
Backend:
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # isi GEMINI_API_KEY
export $(grep -v '^#' .env | xargs)   # Windows: set variabel secara manual
uvicorn main:app --reload --port 8000
pytest                      # menjalankan tes
```
Frontend:
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

## Deployment URL
`https://bali-alert-ai-web.vercel.app`

## Demo Account
Tidak perlu login.

## Known Limitations
- Input utama lewat tempel teks. Pengambilan otomatis baru tersedia untuk gempa dirasakan (beta); peringatan gelombang tinggi dan rob belum punya feed yang terverifikasi.
- AI bisa melewatkan informasi (mis. satu wilayah); pemeriksa otomatis menangkap karangan, bukan yang terlewat, sehingga pembanding non-AI ditampilkan.
- Kuota gratis Gemini terbatas; saat habis, aplikasi menampilkan ekstraksi non-AI.
- Terjemahan belum divalidasi penutur asli; kutipan resmi tetap dalam teks asli.
- Fokus awal: gelombang tinggi dan banjir pesisir (rob) Bali.
- Contoh bawaan berlabel DEMO, bukan peringatan resmi.

## Third-party Resources / Credits
Next.js, React, FastAPI, httpx, Pydantic, Gemini API. Rujukan sumber peringatan: BMKG, BPBD, Pemprov Bali.

## Team Members
`Abiyya Hamdan Nurwandha` — pembuat tunggal (kategori SMA/SMK).
