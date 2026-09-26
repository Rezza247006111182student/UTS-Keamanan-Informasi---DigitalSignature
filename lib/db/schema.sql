-- =============================================================================
-- SKEMA DATABASE APLIKASI DIGITAL SIGNATURE
-- Dikelola oleh: Anggota B (Modul Keamanan Penyimpanan & Auth)
-- DDL SQL untuk Supabase Postgres
-- =============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABEL USERS (Profil Pengguna & Pasangan Kunci)
-- Terhubung dengan Supabase Auth (auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(100) DEFAULT 'Signer',
    institution VARCHAR(255) DEFAULT '',
    public_key TEXT,                          -- PEM string public key (dapat disebar bebas)
    encrypted_private_key TEXT,               -- Ciphertext base64 (terenkripsi AES via passphrase)
    key_salt TEXT,                            -- Salt untuk KDF (scrypt/PBKDF2/Argon2)
    key_iv TEXT,                              -- Initialization Vector untuk enkripsi AES
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABEL DOCUMENTS (Dokumen yang Diunggah)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,                  -- Path file di Supabase Storage
    document_hash VARCHAR(64) NOT NULL,       -- Hash SHA-256 dokumen asli
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',     -- 'pending', 'partially_signed', 'fully_signed', 'revoked'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABEL DOCUMENT_SIGNATURES (Relasi Multi-Signer)
-- Mendukung fitur pengayaan Multi-Signer (satu dokumen bisa memiliki banyak penandatangan)
CREATE TABLE IF NOT EXISTS public.document_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    signer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    signature TEXT NOT NULL,                  -- Digital signature dalam format base64
    signer_name VARCHAR(255) NOT NULL,        -- Snapshot nama saat tanda tangan
    signer_role VARCHAR(100) NOT NULL,        -- Snapshot jabatan/peran saat tanda tangan
    institution VARCHAR(255) NOT NULL,        -- Snapshot institusi saat tanda tangan
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    qr_payload TEXT,                          -- JSON string payload QR
    
    -- Mencegah penandatangan yang sama menandatangani dokumen yang sama lebih dari sekali
    UNIQUE (document_id, signer_id)
);

-- Row Level Security (RLS) Policies (Skeleton / Rekomendasi Awal)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

-- Catatan untuk Anggota B:
-- Tambahkan policy RLS sesuai kebutuhan otorisasi (SELECT public key diizinkan untuk verifikasi,
-- UPDATE/INSERT profile dibatasi hanya untuk user terkait).
