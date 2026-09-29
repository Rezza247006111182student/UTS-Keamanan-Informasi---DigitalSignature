"use client";

/**
 * Halaman Dashboard & Riwayat Dokumen
 * Tanggung Jawab: Anggota C
 *
 * Menampilkan semua dokumen yang telah diunggah & ditandatangani oleh user
 * yang sedang login, beserta status multi-signer dan jumlah tanda tangan.
 *
 * Guard RequireAuth (Modul B) memastikan halaman ini hanya bisa diakses
 * setelah login — tanpa mengubah logika auth sama sekali.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import RequireAuth from "@/lib/auth/RequireAuth";
import { getAccessToken } from "@/lib/auth/session";
import { FaFileSignature } from "react-icons/fa6";

// ─── Tipe ─────────────────────────────────────────────────────────────────────

interface DocumentItem {
  id: string;
  title: string;
  file_path: string;
  document_hash: string;
  status: "pending" | "partially_signed" | "fully_signed" | "revoked" | string;
  created_at: string;
  signature_count: number;
}

// ─── Helper: label & warna status ────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  // Karena tanda tangan sekarang selalu dilakukan secara sinkron saat pembuatan,
  // semua dokumen yang ada di dashboard pada dasarnya sudah ditandatangani.
  const map: Record<string, { label: string; cls: string }> = {
    pending: {
      label: "Ditandatangani",
      cls: "bg-valid-bg text-valid",
    },
    fully_signed: {
      label: "Ditandatangani",
      cls: "bg-valid-bg text-valid",
    },
    partially_signed: {
      label: "Sebagian ditandatangani",
      cls: "bg-[#DBEAFE] text-[#1E40AF]",
    },
    revoked: {
      label: "Dicabut",
      cls: "bg-invalid-bg text-invalid",
    },
  };

  const entry = map[status] ?? { label: status, cls: "bg-border text-ink-muted" };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${entry.cls}`}
    >
      {entry.label}
    </span>
  );
}

// ─── Komponen isi dashboard (ditampilkan setelah login) ───────────────────────

function DashboardContent() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDocuments() {
      setLoading(true);
      setError(null);

      try {
        const token = await getAccessToken();
        const res = await fetch("/api/documents", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Gagal memuat dokumen (${res.status})`);
        }

        const body = await res.json();
        setDocuments(body.documents ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      } finally {
        setLoading(false);
      }
    }

    fetchDocuments();
  }, []);

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="border border-border rounded bg-paper divide-y divide-border">
        {[1, 2, 3].map((i) => (
          <div key={i} className="px-6 py-4 flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 animate-pulse bg-border/70 rounded" />
              <div className="h-3 w-32 animate-pulse bg-border/50 rounded" />
            </div>
            <div className="h-5 w-28 animate-pulse bg-border/50 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="border border-invalid/30 rounded bg-invalid-bg p-6">
        <p className="text-sm font-medium text-invalid mb-1">Gagal memuat dokumen</p>
        <p className="text-sm text-invalid/80">{error}</p>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (documents.length === 0) {
    return (
      <div className="border border-border rounded bg-paper px-8 py-12 text-center">
        {/* Ikon dokumen sederhana */}
        <div className="mx-auto mb-4 w-12 h-12 rounded border-2 border-seal/40 flex items-center justify-center">
          <FaFileSignature className="w-6 h-6 text-seal/80" aria-hidden="true" />
        </div>
        <h2 className="font-serif text-lg font-semibold text-ink mb-2">
          Belum ada dokumen ditandatangani
        </h2>
        <p className="text-sm text-ink-muted mb-6 max-w-sm mx-auto leading-relaxed">
          Unggah dokumen PDF pertamamu untuk mulai membubuhkan tanda tangan digital.
        </p>
        <Link
          href="/sign"
          className="inline-flex items-center px-5 py-2.5 bg-seal hover:bg-seal-dark text-white text-sm font-medium rounded transition-colors"
        >
          Tanda tangani dokumen
        </Link>
      </div>
    );
  }

  // ── Tabel dokumen ────────────────────────────────────────────────────────
  return (
    <div className="border border-border rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-paper border-b border-border">
            <th className="text-left px-6 py-3 font-medium text-ink">Dokumen</th>
            <th className="text-left px-4 py-3 font-medium text-ink hidden sm:table-cell">
              Tanggal
            </th>
            <th className="text-left px-4 py-3 font-medium text-ink hidden md:table-cell">
              Tanda tangan
            </th>
            <th className="text-left px-4 py-3 font-medium text-ink">Status</th>
            <th className="px-4 py-3 text-right font-medium text-ink">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-paper/60 transition-colors">
              {/* Judul + hash */}
              <td className="px-6 py-4">
                <p className="font-medium text-ink truncate max-w-[220px]">{doc.title}</p>
                <p className="font-mono text-xs text-ink-muted truncate max-w-[220px] mt-0.5">
                  {doc.document_hash.slice(0, 16)}…
                </p>
              </td>

              {/* Tanggal */}
              <td className="px-4 py-4 text-ink-muted whitespace-nowrap hidden sm:table-cell">
                {new Date(doc.created_at).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </td>

              {/* Jumlah tanda tangan */}
              <td className="px-4 py-4 text-ink-muted hidden md:table-cell">
                {doc.signature_count} penandatangan
              </td>

              {/* Badge status */}
              <td className="px-4 py-4">
                <StatusBadge status={doc.status} />
              </td>

              {/* Aksi */}
              <td className="px-4 py-4 text-right whitespace-nowrap">
                {doc.file_path && !doc.file_path.endsWith(".pdf") ? (
                  // Sementara (bisa diupdate jika file_path valid URL atau storage route)
                  <span className="text-xs text-ink-muted">Belum tersedia</span>
                ) : (
                  <a
                    href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${doc.file_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-seal hover:underline font-medium"
                    download={`${doc.title}-signed.pdf`}
                  >
                    Unduh PDF
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <div className="max-w-5xl mx-auto py-10 relative">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-40"
        style={{ background: "radial-gradient(circle, rgba(176,141,47,0.2) 0%, transparent 70%)" }}
      />
      {/* Header */}
      <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-seal mb-1">Riwayat</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-ink mb-2">
            Dashboard Dokumen
          </h1>
          <p className="text-sm sm:text-base text-ink-muted">
            Pantau status tanda tangan digital dokumen Anda secara real-time.
          </p>
        </div>
        <Link
          href="/sign"
          className="shrink-0 inline-flex items-center justify-center px-6 py-3 bg-seal hover:bg-seal-dark text-white text-sm font-semibold rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-seal/20 active:scale-95"
          style={{ background: "linear-gradient(135deg, #B08D2F, #8A6E22)" }}
        >
          Tanda tangani dokumen baru
        </Link>
      </div>

      {/* Konten dijaga RequireAuth dari Modul B */}
      <RequireAuth
        title="Masuk untuk melihat dashboard"
        description="Dashboard menampilkan dokumen dan status tanda tangan milik Anda. Masuk terlebih dahulu — kunci digital Anda disimpan terenkripsi dan hanya bisa dibuka setelah autentikasi."
      >
        <DashboardContent />
      </RequireAuth>
    </div>
  );
}
