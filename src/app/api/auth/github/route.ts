import { NextResponse } from "next/server";

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    scope: "read:user repo",
    // Do NOT send redirect_uri — GitHub uses whatever URL is registered
    // in the OAuth app settings, which avoids any mismatch error.
  });

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`
  );
}

