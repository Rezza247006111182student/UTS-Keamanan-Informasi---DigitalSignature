import { NextRequest, NextResponse } from "next/server";
import { createUserScopedServerClient } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createUserScopedServerClient(token);
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const { documentId, qrPayload } = await req.json();

    if (!documentId || !qrPayload) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Ambil user ID
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
       return NextResponse.json({ error: "Invalid user session" }, { status: 401 });
    }

    // Update payload
    const { error } = await supabase
      .from("document_signatures")
      .update({ qr_payload: qrPayload })
      .eq("document_id", documentId)
      .eq("signer_id", user.id);

    if (error) {
      console.error("Update payload error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
