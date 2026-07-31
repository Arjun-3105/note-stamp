import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type GHUser = {
  login:            string;
  name:             string | null;
  avatar_url:       string;
  bio:              string | null;
  location:         string | null;
  company:          string | null;
  blog:             string | null;
  twitter_username: string | null;
  public_repos:     number;
  followers:        number;
  following:        number;
  html_url:         string;
};

export async function GET() {
  const jar   = await cookies();
  const token = jar.get("gh_token")?.value;

  if (!token) return NextResponse.json({ user: null }, { status: 401 });

  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    cache: "no-store",
  });

  if (!res.ok) return NextResponse.json({ user: null }, { status: 401 });

  const u = (await res.json()) as GHUser;
  return NextResponse.json({
    user: {
      login:            u.login,
      name:             u.name ?? u.login,
      avatar_url:       u.avatar_url,
      bio:              u.bio,
      location:         u.location,
      company:          u.company,
      blog:             u.blog,
      twitter_username: u.twitter_username,
      public_repos:     u.public_repos,
      followers:        u.followers,
      following:        u.following,
      html_url:         u.html_url,
    },
  });
}

