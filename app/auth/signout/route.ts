import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function signOut(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const reason = new URL(request.url).searchParams.get("reason");
  return NextResponse.redirect(new URL(reason === "domain" ? "/login?error=domain" : "/login", request.url), { status: 303 });
}

export const POST = signOut;
export const GET = signOut;
