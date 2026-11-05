"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Sample = { id: string; label: string; text: string; source_url: string | null };
type Baseline = { hazard_type: string | null; level: string | null; validity: string | null; areas: string[] };
type Result = {
  hazard_type: string | null;
  level: string | null;
  level_quote: string | null;
  areas: { name: string; verified: boolean }[];
  validity_quote: string | null;
  official_instructions: { original: string; translation: string }[];
  simple_explanation: string;
  missing_fields: string[];
};
type Checks = { instructions_dropped: number; areas_unverified: string[] };
type Response = {
  is_official_warning: boolean;
  message?: string;
  result?: Result;
  checks?: Checks;
  baseline: Baseline;
  source_url?: string | null;
  disclaimer: string;
};
type Failure = { message: string; baseline?: Baseline; disclaimer?: string };

const LANGS: Record<string, string> = {
  id: "Bahasa Indonesia sederhana",
  en: "English",
  zh: "简体中文",
  ja: "日本語",
  ru: "Русский",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
};
const FIELD_LABEL: Record<string, string> = {
  hazard: "Jenis bahaya",
  area: "Wilayah",
  validity: "Masa berlaku",
  level: "Level",
  instruction: "Instruksi resmi",
};

export default function Home() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [text, setText] = useState("");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [lang, setLang] = useState("en");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Response | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [shownText, setShownText] = useState("");

  useEffect(() => {
    fetch(`${API}/api/samples`)
      .then((r) => r.json())
      .then(setSamples)
      .catch(() => setSamples([]));
  }, []);

  async function run() {
    setLoading(true);
    setData(null);
    setFailure(null);
    setShownText(text);
    try {
      const r = await fetch(`${API}/api/explain`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, language: lang, source_url: sourceUrl }),
      });
      const j = await r.json();
      if (r.ok) setData(j as Response);
      else if (r.status === 503 && j.detail)
        setFailure({ message: j.detail.message, baseline: j.detail.baseline, disclaimer: j.detail.disclaimer });
      else if (r.status === 422) setFailure({ message: "Teks terlalu pendek atau terlalu panjang (20–5000 karakter)." });
      else setFailure({ message: "Terjadi kesalahan. Coba lagi." });
    } catch {
      setFailure({ message: "Tidak bisa terhubung ke server. Periksa koneksi, lalu coba lagi." });
    } finally {
      setLoading(false);
    }
  }

  const tooShort = text.trim().length < 20;

  return (
    <main className="wrap">
      <header>
        <h1>BaliAlert AI</h1>
        <p className="sub">
          Tempel peringatan resmi BMKG/BPBD, dapatkan penjelasan dalam bahasamu. Teks asli selalu ditampilkan.
        </p>
      </header>

      <div className="banner" role="note">
        <strong>Bukan sumber peringatan resmi.</strong> Penjelasan dibuat AI dan bisa keliru. Ikuti teks asli dan arahan
        BMKG, BPBD, serta petugas di lokasi.
      </div>

      <section className="card">
        <label htmlFor="src">Teks peringatan resmi</label>
        <textarea
          id="src"
          rows={7}
          value={text}
          maxLength={5000}
          onChange={(e) => {
            setText(e.target.value);
            setSourceUrl(null);
          }}
          placeholder="Salin teks peringatan dari bmkg.go.id lalu tempel di sini…"
        />
        {samples.length > 0 && (
          <div className="samples">
            <span>Atau coba contoh format (demo, bukan peringatan resmi):</span>
            {samples.map((s) => (
              <button
                key={s.id}
                className="chip"
                onClick={() => {
                  setText(s.text);
                  setSourceUrl(s.source_url);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        <div className="row">
          <div>
            <label htmlFor="lang">Bahasa penjelasan</label>
            <select id="lang" value={lang} onChange={(e) => setLang(e.target.value)}>
              {Object.entries(LANGS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <button className="primary" onClick={run} disabled={loading || tooShort}>
            {loading ? "Memproses…" : "Jelaskan"}
          </button>
        </div>
      </section>

      {failure && (
        <section className="card warn" role="alert">
          <h2>AI tidak tersedia saat ini</h2>
          <p>{failure.message}</p>
          {failure.baseline && (
            <>
              <p>Ekstraksi berbasis aturan (tanpa AI) dari teks yang kamu tempel:</p>
              <BaselineView b={failure.baseline} />
            </>
          )}
          <p className="small">Teks asli tetap berlaku. Rujuk langsung ke bmkg.go.id atau petugas setempat.</p>
        </section>
      )}

      {data && !data.is_official_warning && (
        <section className="card warn">
          <p>{data.message}</p>
        </section>
      )}

      {data && data.is_official_warning && data.result && (
        <section className="grid">
          <div className="card">
            <h2>Teks asli (resmi)</h2>
            <pre className="orig">{shownText}</pre>
            {data.source_url ? (
              <a href={data.source_url} target="_blank" rel="noreferrer">
                Buka sumber resmi ↗
              </a>
            ) : (
              <p className="small">Tautan sumber tidak diberikan. Rujuk bmkg.go.id.</p>
            )}
          </div>

          <div className="card">
            <h2>Penjelasan AI</h2>
            <dl>
              <dt>Jenis bahaya</dt>
              <dd>{data.result.hazard_type ?? <em>Tidak tersedia</em>}</dd>
              <dt>Level</dt>
              <dd>
                {data.result.level ?? <em>Tidak tersedia</em>}
                {data.result.level_quote && <span className="quote"> “{data.result.level_quote}”</span>}
              </dd>
              <dt>Masa berlaku</dt>
              <dd>{data.result.validity_quote ?? <em>Tidak tersedia</em>}</dd>
              <dt>Wilayah</dt>
              <dd>
                {data.result.areas.length === 0 && <em>Tidak tersedia</em>}
                {data.result.areas.map((a) => (
                  <span key={a.name} className={a.verified ? "tag ok" : "tag bad"}>
                    {a.name}
                    {a.verified ? " ✓" : " ?"}
                  </span>
                ))}
              </dd>
            </dl>
            <p className="explain">{data.result.simple_explanation}</p>

            <h3>Instruksi resmi</h3>
            {data.result.official_instructions.length === 0 ? (
              <p>
                <em>Teks sumber tidak memuat instruksi. BaliAlert AI tidak menambahkan saran sendiri.</em>
              </p>
            ) : (
              <ul>
                {data.result.official_instructions.map((i, idx) => (
                  <li key={idx}>
                    <span className="quote">“{i.original}”</span>
                    <br />
                    {i.translation}
                  </li>
                ))}
              </ul>
            )}

            {data.result.missing_fields.length > 0 && (
              <p className="missing">
                Informasi tidak ada di teks sumber: {data.result.missing_fields.map((f) => FIELD_LABEL[f] ?? f).join(", ")}.
              </p>
            )}
            {data.checks && (data.checks.instructions_dropped > 0 || data.checks.areas_unverified.length > 0) && (
              <p className="small">
                Pemeriksaan otomatis: {data.checks.instructions_dropped} kutipan instruksi dibuang karena tidak ditemukan di
                teks asli
                {data.checks.areas_unverified.length > 0 && `; wilayah bertanda “?” tidak ditemukan di teks asli`}.
              </p>
            )}
          </div>

          <div className="card full">
            <h2>Pembanding tanpa AI</h2>
            <p className="small">Ekstraksi berbasis aturan (regex/kata kunci) dari teks yang sama.</p>
            <BaselineView b={data.baseline} />
          </div>
        </section>
      )}

      <footer>
        <p className="small">
          Proyek lomba AI Web Innovation Challenge, Bali DigiFest 2026. Sumber peringatan: BMKG dan BPBD.
        </p>
      </footer>
    </main>
  );
}

function BaselineView({ b }: { b: Baseline }) {
  return (
    <dl>
      <dt>Jenis bahaya</dt>
      <dd>{b.hazard_type ?? <em>Tidak terdeteksi</em>}</dd>
      <dt>Level</dt>
      <dd>{b.level ?? <em>Tidak terdeteksi</em>}</dd>
      <dt>Masa berlaku</dt>
      <dd>{b.validity ?? <em>Tidak terdeteksi</em>}</dd>
      <dt>Wilayah</dt>
      <dd>{b.areas.length ? b.areas.join(", ") : <em>Tidak terdeteksi</em>}</dd>
    </dl>
  );
}
