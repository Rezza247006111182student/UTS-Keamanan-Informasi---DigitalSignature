import { NextRequest, NextResponse } from "next/server";
import { createUserScopedServerClient } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createUserScopedServerClient(token);
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const { documentId, signature, signerName, signerRole, signerInstitution } = await req.json();
    if (!documentId || !signature) {
      return NextResponse.json({ error: "Missing documentId or signature" }, { status: 400 });
    }

    const { error } = await supabase
      .from("document_signatures")
      .upsert(
        {
          document_id: documentId,
          signer_id: user.id,
          signature,
          signer_name: signerName ?? "Penandatangan",
          signer_role: signerRole ?? "Signer",
          institution: signerInstitution ?? "",
        },
        { onConflict: "document_id,signer_id" }
      );

    if (error) {
      console.error("[record-signature] error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
