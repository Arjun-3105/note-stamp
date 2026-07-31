import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type GHRepo = { name: string; full_name: string; html_url: string; private: boolean };

// When the user is signed in via GitHub OAuth, we fetch their own repos
// (including private ones) using the token from the httpOnly cookie.
// Fallback: if a `username` is supplied in the body, fetch public repos only.
export async function POST(req: Request) {
  try {
    const jar   = await cookies();
    const token = jar.get("gh_token")?.value;

    let apiUrl: string;
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };

    if (token) {
      // Authenticated — /user/repos returns all repos the user has access to
      apiUrl = "https://api.github.com/user/repos?sort=updated&per_page=100&type=owner";
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      const body = await req.json().catch(() => ({})) as { username?: string };
      const { username } = body;
      if (!username) {
        return NextResponse.json({ error: "Sign in with GitHub or supply a username" }, { status: 400 });
      }
      apiUrl = `https://api.github.com/users/${username}/repos?sort=updated&per_page=50`;
    }

    const res = await fetch(apiUrl, { headers });
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch repositories from GitHub" }, { status: 400 });
    }

    const data = (await res.json()) as GHRepo[];
    const repos = data.map((r) => ({
      name:     r.name,
      fullName: r.full_name,
      url:      r.html_url,
      private:  r.private,
    }));

    return NextResponse.json({ repos });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}

