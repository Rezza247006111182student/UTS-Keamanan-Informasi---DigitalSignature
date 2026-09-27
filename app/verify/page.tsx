"use client";

/**
 * Halaman Verifikasi Keaslian Dokumen
 * Tanggung Jawab: Anggota C
 *
 * Halaman ini terbuka untuk siapa saja — tanpa harus login (sesuai
 * PROJECT_CONTEXT.md: "Siapa pun bisa memverifikasi keaslian dokumen").
 *
 * Dua mode verifikasi:
 *  A. Upload PDF → ekstrak QR dari halaman terakhir → parse payload → verify
 *  B. Upload gambar QR langsung → parse payload → verify
 *
 * Alur teknis:
 *  1. User pilih file (PDF atau PNG/JPG QR)
 *  2. Jika PDF: kirim ke /api/verify dengan file + mode "pdf"
 *     Jika QR image: kirim ke /api/verify dengan file + mode "qr"
 *  3. Server (Modul A) melakukan:
 *       - ekstrak QR dari PDF (memanggil parseQrPayload Modul C via import)
 *       - atau langsung parse QR image
 *       - hash ulang dokumen, verifySignature
 *  4. Response: { valid: boolean, reason?: string, signers?: [...] }
 *  5. Tampilkan badge valid/invalid sesuai DESIGN_GUIDE Bagian 4
 *
 * Catatan: logic verifySignature sepenuhnya di Modul A (/api/verify).
 * Halaman ini hanya UI & orkestrasi, tidak reimplementasi kriptografi.
 */

import { useState, useRef, useCallback } from "react";

// ─── Helper: hash file dengan Web Crypto API (untuk mode PDF) ─────────────────
async function hashFileSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Tipe ─────────────────────────────────────────────────────────────────────

type VerifyMode = "pdf" | "qr";
type VerifyStatus = "idle" | "verifying" | "valid" | "invalid" | "error";

interface SignerInfo {
  signerName: string;
  role: string;
  institution: string;
  date: string;
  signedAt?: string;
}

interface VerifyResult {
  valid: boolean;
  reason?: string;      // alasan spesifik jika tidak valid
  signers?: SignerInfo[]; // info penandatangan (jika valid & multi-signer)
}

// ─── Komponen badge status verifikasi ─────────────────────────────────────────
// Elemen paling penting sesuai DESIGN_GUIDE Bagian 4 — warna & teks harus tegas

function VerificationBadge({ result }: { result: VerifyResult }) {
  if (result.valid) {
    return (
      <div
        className="border border-valid/30 rounded bg-valid-bg px-5 py-4"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          {/* Ikon centang */}
          <svg
            className="w-6 h-6 text-valid shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="font-serif text-base font-semibold text-valid">
              Dokumen asli dan belum diubah
            </p>
            <p className="text-sm text-valid/80 mt-0.5">
              Tanda tangan digital valid. Keutuhan dan keaslian dokumen telah terkonfirmasi.
            </p>
          </div>
        </div>

        {/* Detail penandatangan (multi-signer) */}
        {result.signers && result.signers.length > 0 && (
          <div className="mt-4 border-t border-valid/20 pt-4 space-y-3">
            <p className="text-xs font-medium text-valid/70 uppercase tracking-wide">
              Penandatangan ({result.signers.length})
            </p>
            {result.signers.map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full border border-valid/30 bg-valid/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-valid">{i + 1}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">{s.signerName}</p>
                  <p className="text-xs text-ink-muted">
                    {s.role}{s.institution ? ` — ${s.institution}` : ""}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Ditandatangani pada {s.signedAt
                      ? new Date(s.signedAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : s.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Status tidak valid ─────────────────────────────────────────────────────
  // Teks alasan harus spesifik — DESIGN_GUIDE Bagian 4: "bukan cuma 'Gagal'"

  const reasonLabel = mapInvalidReason(result.reason);

  return (
    <div
      className="border border-invalid/30 rounded bg-invalid-bg px-5 py-4"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        {/* Ikon silang */}
        <svg
          className="w-6 h-6 text-invalid shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <p className="font-serif text-base font-semibold text-invalid">
            {reasonLabel.title}
          </p>
          <p className="text-sm text-invalid/80 mt-0.5">{reasonLabel.detail}</p>
        </div>
      </div>
    </div>
  );
}

/** Terjemahkan kode reason dari API ke pesan yang jelas bagi user */
function mapInvalidReason(reason?: string): { title: string; detail: string } {
  if (!reason) {
    return {
      title: "Verifikasi gagal",
      detail: "Tanda tangan tidak dapat diverifikasi. Dokumen mungkin telah diubah atau QR tidak valid.",
    };
  }
  const r = reason.toLowerCase();
  if (r.includes("modified") || r.includes("diubah") || r.includes("tamper")) {
    return {
      title: "Dokumen telah diubah sejak ditandatangani",
      detail: "Hash dokumen saat ini tidak cocok dengan hash yang tersimpan di QR. Dokumen tidak dapat dipercaya.",
    };
  }
  if (r.includes("public key") || r.includes("kunci") || r.includes("key mismatch")) {
    return {
      title: "Kunci publik tidak cocok",
      detail: "Signature tidak bisa diverifikasi dengan kunci publik penandatangan. Identitas penandatangan tidak valid.",
    };
  }
  if (r.includes("qr") || r.includes("parse") || r.includes("payload")) {
    return {
      title: "QR-Code tidak valid atau dipalsukan",
      detail: "Data di dalam QR tidak lengkap atau tidak sesuai format yang diharapkan. QR mungkin dipalsukan.",
    };
  }
  if (r.includes("signature") || r.includes("invalid sig")) {
    return {
      title: "Tanda tangan digital tidak valid",
      detail: "Nilai signature di QR tidak cocok dengan isi dokumen. Dokumen atau tanda tangan telah dimanipulasi.",
    };
  }
  // fallback: tampilkan pesan asli dari server
  return {
    title: "Verifikasi tidak berhasil",
    detail: reason,
  };
}

// ─── Form verifikasi ──────────────────────────────────────────────────────────

export default function VerifyPage() {
  const [mode, setMode] = useState<VerifyMode>("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptAttr = mode === "pdf" ? "application/pdf" : "image/png,image/jpeg,image/webp";
  const modeLabel  = mode === "pdf" ? "PDF" : "gambar QR-Code";

  // ── File selection ─────────────────────────────────────────────────────

  function selectFile(f: File) {
    setFile(f);
    setStatus("idle");
    setResult(null);
  }

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) selectFile(dropped);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode]
  );

  // ── Verifikasi ─────────────────────────────────────────────────────────

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus("verifying");
    setResult(null);

    try {
      // Hash file PDF dihitung di client dan dikirim ke server
      // supaya server bisa cross-check dengan hash yang di-sign Modul A
      let documentHash: string | undefined;
      if (mode === "pdf") {
        documentHash = await hashFileSHA256(file);
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      if (documentHash) formData.append("documentHash", documentHash);

      // Arahkan ke /api/documents/verify (Modul C) yang menghandle
      // ekstraksi QR dari file sebelum memanggil verifySignature Modul A
      const res = await fetch("/api/documents/verify", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.reason ?? body.error ?? `Verifikasi gagal (${res.status})`);
      }

      const body: VerifyResult = await res.json();
      setResult(body);
      setStatus(body.valid ? "valid" : "invalid");
    } catch (err) {
      setStatus("error");
      setResult({
        valid: false,
        reason: err instanceof Error ? err.message : "Terjadi kesalahan tidak terduga.",
      });
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  function reset() {
    setFile(null);
    setStatus("idle");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl py-6">
      <h1 className="font-serif text-3xl font-semibold text-ink mb-1">
        Verifikasi Keaslian Dokumen
      </h1>
      <p className="text-sm text-ink-muted mb-8">
        Unggah dokumen PDF atau gambar QR-Code untuk memverifikasi keutuhan dan keaslian tanda tangan digital.
      </p>

      <form onSubmit={handleVerify} className="space-y-6">

        {/* ── Pilih mode ──────────────────────────────────────────────── */}
        <div>
          <p className="text-sm font-medium text-ink mb-2">Metode verifikasi</p>
          <div className="flex gap-2">
            {(["pdf", "qr"] as VerifyMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); reset(); }}
                className={`px-4 py-2 text-sm rounded border transition-colors ${
                  mode === m
                    ? "bg-seal text-white border-seal"
                    : "bg-paper text-ink border-border hover:border-seal/40"
                }`}
              >
                {m === "pdf" ? "Unggah PDF" : "Scan gambar QR"}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-muted mt-2">
            {mode === "pdf"
              ? "PDF bertanda tangan akan diekstrak QR-nya secara otomatis."
              : "Unggah foto/screenshot QR-Code dari dokumen bertanda tangan."}
          </p>
        </div>

        {/* ── Drop zone file ──────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            {mode === "pdf" ? "Dokumen PDF" : "Gambar QR-Code"}
          </label>
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded px-6 py-8 text-center cursor-pointer
              transition-colors select-none
              ${isDragging
                ? "border-seal bg-seal/5"
                : file
                  ? "border-valid/50 bg-valid-bg/30"
                  : "border-border hover:border-seal/40 bg-paper"
              }
            `}
          >
            {file ? (
              <div>
                <svg className="mx-auto mb-2 w-8 h-8 text-valid" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-ink">{file.name}</p>
                <p className="text-xs text-ink-muted mt-1">
                  {(file.size / 1024).toFixed(1)} KB — klik untuk ganti
                </p>
              </div>
            ) : (
              <div>
                <svg className="mx-auto mb-2 w-8 h-8 text-ink-muted/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-ink-muted">
                  Seret {modeLabel} ke sini atau{" "}
                  <span className="text-seal">pilih file</span>
                </p>
                <p className="text-xs text-ink-muted/70 mt-1">
                  {mode === "pdf" ? "Hanya file .pdf" : "PNG, JPG, atau WEBP"}
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptAttr}
              className="sr-only"
              aria-label={`Pilih file ${modeLabel}`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) selectFile(f);
              }}
            />
          </div>
        </div>

        {/* ── Tombol verifikasi ────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!file || status === "verifying"}
            className="px-6 py-2.5 bg-seal hover:bg-seal-dark disabled:opacity-50
                       disabled:cursor-not-allowed text-white text-sm font-medium
                       rounded transition-colors"
          >
            {status === "verifying" ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Memverifikasi…
              </span>
            ) : (
              "Verifikasi sekarang"
            )}
          </button>

          {(status === "valid" || status === "invalid" || status === "error") && (
            <button
              type="button"
              onClick={reset}
              className="px-5 py-2.5 border border-border text-ink text-sm font-medium rounded hover:bg-black/5 transition-colors"
            >
              Verifikasi dokumen lain
            </button>
          )}
        </div>
      </form>

      {/* ── Badge hasil verifikasi ─────────────────────────────────────── */}
      {/* Elemen paling penting — badge valid/invalid sesuai DESIGN_GUIDE Bagian 4 */}
      {result && (
        <div className="mt-8">
          <VerificationBadge result={result} />
        </div>
      )}

      {/* ── Catatan informasi ─────────────────────────────────────────── */}
      <div className="mt-8 border border-border rounded bg-paper px-5 py-4">
        <p className="text-xs font-medium text-ink mb-2">Cara kerja verifikasi</p>
        <ul className="text-xs text-ink-muted space-y-1 list-disc list-inside leading-relaxed">
          <li>QR-Code di dalam PDF mengandung tanda tangan digital dan metadata penandatangan.</li>
          <li>Sistem menghitung ulang hash dokumen dan membandingkan dengan signature di QR.</li>
          <li>Jika dokumen diubah walau 1 byte, hash akan berbeda dan verifikasi akan gagal.</li>
          <li>Verifikasi tidak membutuhkan akun — siapa pun bisa memeriksa keaslian dokumen.</li>
        </ul>
      </div>
    </div>
  );
}
