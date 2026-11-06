# AI & Technology Disclosure — BaliAlert AI

> Isi bagian bertanda `[ISI]` sebelum submit. Pernyataan di akhir harus benar.

| Komponen | Isi |
|---|---|
| Nama Produk | BaliAlert AI |
| Framework / Frontend | Next.js 14 (React 18, TypeScript) |
| Backend / Runtime | Python 3 + FastAPI |
| Database / Storage | Tidak ada. Teks pengguna diproses per permintaan dan tidak disimpan |
| Hosting / Deployment | Vercel (frontend dan backend sebagai dua proyek) `[ISI: konfirmasi]` |
| AI Model / API / Method | Gemini API (Google AI Studio), model utama `gemini-3.5-flash-lite` dengan cadangan otomatis `gemini-3.8-flash` (dapat diatur lewat `GEMINI_MODEL` / `GEMINI_FALLBACK_MODELS`) `[ISI: sesuaikan dengan yang dipakai]`; keluaran JSON terstruktur, temperature 0 |
| Peran AI dalam Produk | Mengekstrak jenis bahaya, level, wilayah, masa berlaku, dan instruksi dari teks peringatan resmi, lalu menjelaskan dan menerjemahkannya. AI tidak menerbitkan atau mengubah peringatan |
| Pengaman non-AI | Validasi deterministik: kutipan instruksi, wilayah, level, dan masa berlaku harus ada persis di teks sumber, jika tidak dibuang/ditandai. Ekstraksi berbasis aturan sebagai pembanding dan cadangan |
| Dataset / Data Source | Teks peringatan publik BMKG (bmkg.go.id) yang ditempel pengguna, dan open data gempa dirasakan BMKG (data.bmkg.go.id) untuk fitur beta. Contoh bawaan berlabel DEMO dan bukan peringatan resmi |
| Data yang dikirim ke model | Hanya teks peringatan yang ditempel/diambil dan bahasa target. Pada tier gratis Gemini, Google dapat memakai isi permintaan untuk meningkatkan produknya; teks yang dikirim hanya informasi peringatan publik. Tidak ada data pribadi yang diminta |
| Open-source Libraries | Next.js, React, FastAPI, httpx, Pydantic |
| Template / Boilerplate | Tidak ada |
| AI Coding Assistant | Claude (Anthropic) membantu menulis kode awal; seluruh kode ditinjau, diuji, dan dipahami oleh pembuat |
| Pre-existing Components | Tidak ada. Proyek dimulai untuk kompetisi ini |
| Third-party Assets / Credits | Data dan nama lembaga: BMKG, BPBD, Pemprov Bali (rujukan sumber) |

**Pernyataan:** Kami menyatakan bahwa informasi di atas benar dan lengkap. Kami bertanggung jawab atas penggunaan teknologi, source code, data, library, API, model AI, dan aset yang digunakan pada produk.
