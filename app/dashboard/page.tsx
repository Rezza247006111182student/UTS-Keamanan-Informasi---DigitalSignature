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
  const map: Record<string, { label: string; cls: string }> = {
    pending: {
      label: "Menunggu tanda tangan",
      cls: "bg-[#FEF3C7] text-[#92400E]",
    },
    partially_signed: {
      label: "Sebagian ditandatangani",
      cls: "bg-[#DBEAFE] text-[#1E40AF]",
    },
    fully_signed: {
      label: "Sudah ditandatangani",
      cls: "bg-valid-bg text-valid",
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
          <svg
            className="w-6 h-6 text-seal/60"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z"
            />
          </svg>
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
            <th className="px-4 py-3" />
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
                <Link
                  href={`/verify?doc=${doc.id}`}
                  className="text-xs text-seal hover:underline mr-3"
                >
                  Verifikasi
                </Link>
                <Link
                  href={`/sign?doc=${doc.id}`}
                  className="text-xs text-ink-muted hover:text-ink hover:underline"
                >
                  Tambah tanda tangan
                </Link>
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
    <div className="max-w-4xl py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink mb-1">
            Dashboard Dokumen
          </h1>
          <p className="text-sm text-ink-muted">
            Pantau status tanda tangan digital dokumen Anda.
          </p>
        </div>
        <Link
          href="/sign"
          className="shrink-0 px-4 py-2 bg-seal hover:bg-seal-dark text-white text-sm font-medium rounded transition-colors"
        >
          Tanda tangani dokumen
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
