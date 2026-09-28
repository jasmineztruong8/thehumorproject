import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Last hop of the flow: app -> Google -> Supabase -> here.
// Supabase sends back a one-time code; we swap it for a session cookie.
// Redirects only go to fixed paths on our own origin, never to a URL
// taken from the request, so this can't be used as an open redirect.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", data.user.id)
        .single();

      const needsName = !profile?.first_name || !profile?.last_name;
      return NextResponse.redirect(`${origin}${needsName ? "/onboarding" : "/"}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
