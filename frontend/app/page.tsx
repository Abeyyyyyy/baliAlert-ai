"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Sample = { id: string; label: string; text: string; source_url: string | null };
type LiveItem = { id: string; label: string; text: string; source_url: string };
type Live = { is_bali: boolean; items: LiveItem[] };
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
  model?: string | null;
  disclaimer: string;
};
type Failure = { message: string; baseline?: Baseline };
type Sev = "red" | "orange" | "yellow" | "gray";

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
const SEV_LABEL: Record<Sev, string> = {
  red: "Level sangat tinggi",
  orange: "Level tinggi",
  yellow: "Level waspada/sedang",
  gray: "Level tidak diketahui",
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const has = (hay: string, needle: string) => norm(hay).includes(norm(needle));

function severity(level: string | null): Sev {
  const l = (level || "").toLowerCase();
  if (/awas|sangat tinggi|extreme|very high/.test(l)) return "red";
  if (/siaga|tinggi|high|alert/.test(l)) return "orange";
  if (/waspada|sedang|moderate|watch/.test(l)) return "yellow";
  return "gray";
}

type Row = { field: string; ai: string; base: string; status: "ok" | "diff" | "na" };

function compareRows(r: Result, b: Baseline): Row[] {
  const aiAreas = r.areas.map((a) => a.name);
  const rows: Row[] = [];
  rows.push({ field: "Jenis bahaya", ai: r.hazard_type ?? "—", base: b.hazard_type ?? "—", status: "na" });
  const lv = r.level && b.level ? (has(r.level, b.level) || has(b.level, r.level) ? "ok" : "diff") : "na";
  rows.push({ field: "Level", ai: r.level ?? "—", base: b.level ?? "—", status: lv });
  const vq = r.validity_quote && b.validity ? (has(r.validity_quote, b.validity) || has(b.validity, r.validity_quote) ? "ok" : "diff") : "na";
  rows.push({ field: "Masa berlaku", ai: r.validity_quote ?? "—", base: b.validity ?? "—", status: vq });
  const ar = b.areas.length === 0 ? "na" : b.areas.every((x) => aiAreas.some((a) => has(a, x))) ? "ok" : "diff";
  rows.push({
    field: "Wilayah",
    ai: aiAreas.length ? aiAreas.join(", ") : "—",
    base: b.areas.length ? b.areas.join(", ") : "—",
    status: ar,
  });
  return rows;
}

export default function Home() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [text, setText] = useState("");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [lang, setLang] = useState("en");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Response | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [shownText, setShownText] = useState("");
  const [live, setLive] = useState<Live | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("ba_lang");
      if (saved && LANGS[saved]) setLang(saved);
    } catch {
      /* penyimpanan browser tidak tersedia: abaikan */
    }
    fetch(`${API}/api/samples`)
      .then((r) => r.json())
      .then(setSamples)
      .catch(() => setSamples([]));
  }, []);

  function changeLang(v: string) {
    setLang(v);
    try {
      window.localStorage.setItem("ba_lang", v);
    } catch {
      /* abaikan */
    }
  }

  function pick(t: string, url: string | null, sample: boolean) {
    setText(t);
    setSourceUrl(url);
    setIsSample(sample);
  }

  async function loadLive() {
    setLiveLoading(true);
    setLiveError(null);
    try {
      const r = await fetch(`${API}/api/live/gempa`);
      const j = await r.json();
      if (r.ok) setLive(j as Live);
      else setLiveError(j?.detail?.message || "Data BMKG tidak dapat diambil saat ini.");
    } catch {
      setLiveError("Tidak bisa terhubung ke server.");
    } finally {
      setLiveLoading(false);
    }
  }

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
      else if (r.status === 503 && j.detail) setFailure({ message: j.detail.message, baseline: j.detail.baseline });
      else if (r.status === 422) setFailure({ message: "Teks terlalu pendek atau terlalu panjang (20–5000 karakter)." });
      else setFailure({ message: "Terjadi kesalahan. Coba lagi." });
    } catch {
      setFailure({ message: "Tidak bisa terhubung ke server. Periksa koneksi, lalu coba lagi." });
    } finally {
      setLoading(false);
    }
  }

  async function copyResult() {
    if (!data?.result) return;
    const r = data.result;
    const lines = [
      `${r.hazard_type ?? ""} ${r.level ? "(" + r.level + ")" : ""}`.trim(),
      r.validity_quote ?? "",
      r.simple_explanation,
      ...r.official_instructions.map((i) => `- ${i.translation} ("${i.original}")`),
      "",
      data.disclaimer,
    ];
    try {
      await navigator.clipboard.writeText(lines.filter((l) => l !== undefined).join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const tooShort = text.trim().length < 20;
  const res = data && data.is_official_warning ? data.result : undefined;
  const sev: Sev = res ? severity(res.level) : "gray";
  const verifiedAreas = res ? res.areas.filter((a) => a.verified).length : 0;

  return (
    <main className="wrap">
      <header className="hero">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            ⚠
          </span>
          <div>
            <h1>BaliAlert AI</h1>
            <p className="sub">Pahami peringatan resmi BMKG/BPBD di Bali dalam bahasamu, tanpa kehilangan teks aslinya.</p>
          </div>
        </div>
        <ol className="steps">
          <li>
            <b>1</b> Tempel atau ambil peringatan
          </li>
          <li>
            <b>2</b> Pilih bahasa
          </li>
          <li>
            <b>3</b> Baca penjelasan + teks asli
          </li>
        </ol>
      </header>

      <div className="banner" role="note">
        <strong>Bukan sumber peringatan resmi.</strong> Penjelasan dibuat AI dan bisa keliru. Ikuti teks asli dan arahan BMKG,
        BPBD, serta petugas di lokasi.
      </div>

      <section className="card">
        <label htmlFor="src">Teks peringatan resmi</label>
        <textarea
          id="src"
          rows={6}
          value={text}
          maxLength={5000}
          onChange={(e) => {
            setText(e.target.value);
            setSourceUrl(null);
            setIsSample(false);
          }}
          placeholder="Salin teks peringatan dari bmkg.go.id lalu tempel di sini…"
        />
        {isSample && <p className="sample-note">Teks contoh untuk demo, bukan peringatan resmi.</p>}

        <div className="sources">
          <div className="group">
            <span className="group-title">Contoh format (demo)</span>
            <div className="chips">
              {samples.map((s) => (
                <button key={s.id} className="chip" onClick={() => pick(s.text, s.source_url, true)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="group">
            <span className="group-title">Data resmi BMKG (beta)</span>
            <div className="chips">
              <button className="chip live" onClick={loadLive} disabled={liveLoading}>
                {liveLoading ? "Mengambil…" : "Ambil gempa dirasakan terbaru"}
              </button>
            </div>
          </div>
        </div>

        {liveError && <p className="small err">{liveError}</p>}
        {live && (
          <div className="livebox">
            <p className="small">
              {live.is_bali
                ? "Gempa dirasakan terbaru yang menyebut Bali (data BMKG, disusun otomatis):"
                : "Tidak ada gempa dirasakan terbaru yang menyebut Bali. Menampilkan yang terbaru secara nasional:"}
            </p>
            <div className="chips">
              {live.items.map((i) => (
                <button key={i.id} className="chip" onClick={() => pick(i.text, i.source_url, false)}>
                  {i.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="row">
          <div>
            <label htmlFor="lang">Bahasa penjelasan</label>
            <select id="lang" value={lang} onChange={(e) => changeLang(e.target.value)}>
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
        {loading && <div className="bar" aria-hidden="true" />}
      </section>

      <div aria-live="polite">
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

        {data && res && (
          <>
            <section className={`summary sev-${sev}`}>
              <div>
                <span className="sev-tag">{SEV_LABEL[sev]}</span>
                <h2>{res.hazard_type ?? "Jenis bahaya tidak tersedia"}</h2>
                <p>
                  {res.level ? <b>{res.level}</b> : <em>Level tidak tersedia</em>}
                  {res.validity_quote ? <> · {res.validity_quote}</> : <> · <em>Masa berlaku tidak tersedia</em></>}
                </p>
              </div>
              <div className="verify" title="Setiap kutipan AI diperiksa harus ada persis di teks asli">
                <span>✓</span> {verifiedAreas}/{res.areas.length} wilayah terverifikasi
                <br />
                <span>✓</span> {res.official_instructions.length} kutipan instruksi terverifikasi
                {data.checks && data.checks.instructions_dropped > 0 && (
                  <>
                    <br />
                    <span className="bad">✕</span> {data.checks.instructions_dropped} dibuang (tidak ada di teks asli)
                  </>
                )}
              </div>
            </section>

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
                <div className="card-head">
                  <h2>Penjelasan AI</h2>
                  <button className="ghost" onClick={copyResult}>
                    {copied ? "Tersalin ✓" : "Salin"}
                  </button>
                </div>
                <p className="explain">{res.simple_explanation}</p>
                <dl>
                  <dt>Wilayah</dt>
                  <dd>
                    {res.areas.length === 0 && <em>Tidak tersedia</em>}
                    {res.areas.map((a) => (
                      <span key={a.name} className={a.verified ? "tag ok" : "tag bad"}>
                        {a.name}
                        {a.verified ? " ✓" : " ?"}
                      </span>
                    ))}
                  </dd>
                </dl>

                <h3>Instruksi resmi</h3>
                {res.official_instructions.length === 0 ? (
                  <p>
                    <em>Teks sumber tidak memuat instruksi. BaliAlert AI tidak menambahkan saran sendiri.</em>
                  </p>
                ) : (
                  <ul>
                    {res.official_instructions.map((i, idx) => (
                      <li key={idx}>
                        <span className="quote">“{i.original}”</span>
                        <br />
                        {i.translation}
                      </li>
                    ))}
                  </ul>
                )}

                {res.missing_fields.length > 0 && (
                  <p className="missing">
                    Informasi tidak ada di teks sumber: {res.missing_fields.map((f) => FIELD_LABEL[f] ?? f).join(", ")}.
                  </p>
                )}
                {data.model && <p className="small">Model: {data.model}</p>}
              </div>
            </section>

            <section className="card">
              <h2>AI vs. tanpa AI</h2>
              <p className="small">
                Hasil AI dibandingkan dengan ekstraksi berbasis aturan (kata kunci/regex) dari teks yang sama. “Selaras” berarti
                keduanya sepakat; “Beda” berarti periksa teks asli.
              </p>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Elemen</th>
                      <th>AI</th>
                      <th>Tanpa AI</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows(res, data.baseline).map((row) => (
                      <tr key={row.field}>
                        <td>{row.field}</td>
                        <td>{row.ai}</td>
                        <td>{row.base}</td>
                        <td>
                          <span className={`pill ${row.status}`}>
                            {row.status === "ok" ? "Selaras" : row.status === "diff" ? "Beda" : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>

      <details className="card how">
        <summary>Bagaimana BaliAlert AI menjaga keakuratan?</summary>
        <ul>
          <li>AI hanya menjelaskan; ia tidak menerbitkan atau mengubah peringatan.</li>
          <li>Setiap kutipan (instruksi, wilayah, level, masa berlaku) diperiksa harus ada persis di teks asli; yang tidak ada dibuang atau ditandai.</li>
          <li>Informasi yang tidak ada ditulis “Tidak tersedia”, bukan ditebak.</li>
          <li>Jika AI gagal atau kuota habis, tetap tampil ekstraksi non-AI dan teks asli.</li>
          <li>Teks yang ditempel tidak disimpan oleh aplikasi ini.</li>
        </ul>
      </details>

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
