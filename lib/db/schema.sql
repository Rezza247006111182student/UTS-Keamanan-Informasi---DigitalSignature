-- =============================================================================
-- SKEMA DATABASE APLIKASI DIGITAL SIGNATURE
-- Dikelola oleh: Anggota B (Modul Keamanan Penyimpanan & Auth)
-- DDL SQL untuk Supabase Postgres
-- =============================================================================
--
-- CARA MENJALANKAN ULANG (idempotent):
--   Skrip ini aman dijalankan berulang kali. Setiap objek yang sudah ada
--   akan di-DROP lebih dulu (DROP ... IF EXISTS) sebelum dibuat ulang, dan
--   perubahan skema yang breaking memakai ALTER TABLE ... IF EXISTS.
--
--   1. Buka Supabase Dashboard -> SQL Editor -> New query
--   2. Tempel SELURUH isi file ini, lalu Run
--   3. Cek Output tidak ada error
--
-- CATATAN KEAMANAN PENTING:
--   Private key TIDAK PERNAH disimpan sebagai plaintext. Kolom
--   encrypted_private_key menyimpan paket terenkripsi (base64) hasil
--   AES-256-GCM, diturunkan dari passphrase user lewat scrypt.
--   Kolom ini tidak boleh pernah diekspos ke client/anon — hanya boleh
--   diakses oleh service_role (server) atau user itu sendiri lewat RLS.
--   Karena itu public key tidak lagi dibaca langsung dari tabel public.users,
--   melainkan dari view public_signers (lihat bagian 7).
-- =============================================================================


-- =============================================================================
-- 0. EKSTENSI
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================================
-- 1. TABEL USERS (Profil Pengguna & Pasangan Kunci)
--    Terhubung dengan Supabase Auth (auth.users)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(100) DEFAULT 'Signer',
    institution VARCHAR(255) DEFAULT '',
    public_key TEXT,                          -- PEM string public key (boleh disebar bebas)
    encrypted_private_key TEXT,               -- Ciphertext base64 (AES-256-GCM via scrypt, sudah termasuk salt+iv+tag di dalamnya)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Kolom key_salt & key_iv sudah dihapus: sejak paket terenkripsi dibuat oleh
-- encryptPrivateKey() sudah memuat salt, iv, tag, dan data dalam satu string
-- base64, kolom terpisah tidak lagi diperlukan (dan rawan tidak sinkron).
ALTER TABLE public.users DROP COLUMN IF EXISTS key_salt;
ALTER TABLE public.users DROP COLUMN IF EXISTS key_iv;


-- =============================================================================
-- 2. TABEL DOCUMENTS (Dokumen yang Diunggah)
-- =============================================================================
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


-- =============================================================================
-- 3. TABEL DOCUMENT_SIGNATURES (Relasi Multi-Signer)
--    Mendukung fitur pengayaan Multi-Signer (satu dokumen bisa memiliki banyak penandatangan)
-- =============================================================================
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


-- =============================================================================
-- 4. INDEX
-- =============================================================================
-- Verifikasi sering mencari dokumen berdasarkan hash-nya.
CREATE INDEX IF NOT EXISTS idx_documents_document_hash ON public.documents (document_hash);
CREATE INDEX IF NOT EXISTS idx_documents_created_by   ON public.documents (created_by);
CREATE INDEX IF NOT EXISTS idx_documents_status        ON public.documents (status);
-- Query multi-signer: ambil semua tanda tangan dari satu dokumen.
CREATE INDEX IF NOT EXISTS idx_document_signatures_document_id ON public.document_signatures (document_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_signer_id   ON public.document_signatures (signer_id);


-- =============================================================================
-- 5. TRIGGER updated_at
--    updated_at tidak diperbarui otomatis oleh Postgres, harus ada trigger.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON public.users;
CREATE TRIGGER trg_users_set_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_documents_set_updated_at ON public.documents;
CREATE TRIGGER trg_documents_set_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- 5b. TRIGGER auto-profil pengguna
--     Setiap kali ada baris baru di auth.users, profil public.users dibuat
--     otomatis dari metadata yang dikirim saat signUp (full_name, role, institution).
--
--     Kenapa perlu: bila profil dibuat manual dari browser, RLS mensyaratkan
--     auth.uid() = id. Saat signUp.email confirmation aktif, sesi belum ada
--     sehingga insert dari client pasti GAGAL diam-diam dan user ended up
--     tanpa profil. Trigger ini berjalan di luar RLS (milik postgres),
--     sehingga profil selalu terbentuk.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, role, institution)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Pengguna NaturalSign'),
        COALESCE(NEW.raw_user_meta_data ->> 'role', 'Signer'),
        COALESCE(NEW.raw_user_meta_data ->> 'institution', '')
    )
    ON CONFLICT (id) DO UPDATE
        SET email       = EXCLUDED.email,
            full_name   = EXCLUDED.full_name,
            role        = EXCLUDED.role,
            institution = EXCLUDED.institution;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_user_create_profile ON auth.users;
CREATE TRIGGER trg_auth_user_create_profile
    AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;


-- ---------- public.users ----------
-- Setiap user hanya boleh membaca & mengubah profilnya sendiri.
-- encrypted_private_key TIDAK PERNAH bisa dibaca oleh user lain.
DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS users_insert_own ON public.users;
CREATE POLICY users_insert_own ON public.users
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Catatan: tidak ada policy DELETE untuk pengguna — biayanya cascade dari
-- auth.users yang menghapus profil (dan private key terenkripsi-nya).


-- ---------- public.documents ----------
-- Dokumen & hash-nya dapat dibaca semua user yang sudah login, karena proses
-- verifikasi (Modul C) harus bisa mencocokkan hash dan public key penandatangan.
DROP POLICY IF EXISTS documents_select_all ON public.documents;
CREATE POLICY documents_select_all ON public.documents
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS documents_insert_own ON public.documents;
CREATE POLICY documents_insert_own ON public.documents
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS documents_update_own ON public.documents;
CREATE POLICY documents_update_own ON public.documents
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);


-- ---------- public.document_signatures ----------
-- Semua tanda tangan pada suatu dokumen harus bisa dibaca untuk memverifikasi
-- dokumen multi-signer. Tanda tangan bersifat publik — yang rahasia adalah
-- private key-nya, yang tidak pernah ada di tabel ini.
DROP POLICY IF EXISTS signatures_select_all ON public.document_signatures;
CREATE POLICY signatures_select_all ON public.document_signatures
    FOR SELECT
    TO authenticated
    USING (true);

-- Setiap orang hanya boleh menandatangani atas namanya sendiri.
DROP POLICY IF EXISTS signatures_insert_own ON public.document_signatures;
CREATE POLICY signatures_insert_own ON public.document_signatures
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = signer_id);

DROP POLICY IF EXISTS signatures_update_own ON public.document_signatures;
CREATE POLICY signatures_update_own ON public.document_signatures
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = signer_id)
    WITH CHECK (auth.uid() = signer_id);


-- =============================================================================
-- 7. VIEW PUBLIC_SIGNERS
--    Menyediakan public key penandatangan untuk keperluan VERIFIKASI tanpa
--    membuka kolom encrypted_private_key.
--
--    Kenapa perlu view: public key memang boleh disebar bebas (dibutuhkan
--    Anggota C saat verify), tapi private key terenkripsi tidak boleh keluar.
--    RLS bersifat per-BARIS, bukan per-KOLOM, jadi policy SELECT yang longgar
--    di tabel users akan ikut membocorkan encrypted_private_key. View ini
--    hanya mengekspos kolom yang aman, dan karena view memakai hak pemilik
--    (postgres) RLS tabel users tidak berlaku padanya.
-- =============================================================================
CREATE OR REPLACE VIEW public.public_signers
WITH (security_invoker = false) AS
    SELECT
        u.id,
        u.full_name,
        u.role,
        u.institution,
        u.public_key
    FROM public.users u
    WHERE u.public_key IS NOT NULL
      AND u.public_key <> '';

-- View tidak punya RLS policy (hanya tabel yang punya). Akses view diatur
-- lewat GRANT di bawah — RLS tetap berlaku di tabel public.users yang
-- menjadi sumber datanya.
GRANT SELECT ON public.public_signers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users        TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.documents    TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.document_signatures TO authenticated;
-- Sequence & default UUID
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- =============================================================================
-- 8. ROW LEVEL SECURITY UNTUK STORAGE (bucket: documents)
--    Bucket 'documents' bersifat PRIVATE. Tanpa policy di bawah, upload dari
--    client (anon/authenticated) DITOLAK karena storage.objects tidak punya
--    policy sama sekali (0 policies) — akibatnya file PDF tidak pernah
--    tersimpan dan download gagal.
--
--    Aturan: setiap user hanya boleh INSERT/SELECT/DELETE objek di dalam
--    foldernya sendiri, yaitu prefix pertama path = auth.uid()
--    (sign page menyimpan ke "<user.id>/<documentId>.pdf").
--
--    Download tetap dilayani lewat signed URL service-role di
--    /api/documents/download (service role menembus RLS), jadi tidak perlu
--    policy SELECT publik.
-- =============================================================================
DROP POLICY IF EXISTS storage_documents_owner_insert ON storage.objects;
CREATE POLICY storage_documents_owner_insert ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS storage_documents_owner_select ON storage.objects;
CREATE POLICY storage_documents_owner_select ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS storage_documents_owner_delete ON storage.objects;
CREATE POLICY storage_documents_owner_delete ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );


-- =============================================================================
-- CATATAN UNTUK ANGGOTA A & C (BUKAN BAGIAN TUGAS ANGGOTA B)
-- =============================================================================
-- Query public key penandatangan (verifikasi):
--   SELECT full_name, role, institution, public_key
--   FROM public.public_signers
--   WHERE id = '<signer_uuid>';
--
-- Contoh multi-signer (semua tanda tangan pada satu dokumen):
--   SELECT signer_id, signer_name, signer_role, institution, signature, signed_at
--   FROM public.document_signatures
--   WHERE document_id = '<document_uuid>';
--
-- Jumlah penandatangan sebuah dokumen:
--   SELECT count(*) FROM public.document_signatures WHERE document_id = '<uuid>';
--
-- Kedua helper di atas juga sudah dibungkus TypeScript di lib/db/signatures.ts
-- (fungsi addSignature, getSignaturesForDocument, getSignerIdsForDocument).
-- =============================================================================
