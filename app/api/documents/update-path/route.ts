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

    const { documentId, filePath } = await req.json();

    if (!documentId || !filePath) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Ambil user ID
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
       return NextResponse.json({ error: "Invalid user session" }, { status: 401 });
    }

    // Update path di documents
    const { error } = await supabase
      .from("documents")
      .update({ file_path: filePath })
      .eq("id", documentId)
      .eq("created_by", user.id);

    if (error) {
      console.error("Update path error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
