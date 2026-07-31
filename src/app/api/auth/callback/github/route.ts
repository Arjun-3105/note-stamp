import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// GitHub registered callback: /api/auth/callback/github
export async function GET(req: NextRequest) {
  const base = process.env.APP_URL || "http://localhost:3000";
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${base}/assess?gh_error=${error ?? "no_code"}`);
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id:     process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenRes.json() as { access_token?: string; error?: string };

  if (!tokenData.access_token) {
    return NextResponse.redirect(`${base}/assess?gh_error=token_exchange_failed`);
  }

  const jar = await cookies();
  jar.set("gh_token", tokenData.access_token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   60 * 60 * 24,
    path:     "/",
  });

  return NextResponse.redirect(`${base}/assess`);
}

