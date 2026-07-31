export type RepoFile = { path: string; content: string };

export async function fetchRepoFiles(
  owner: string,
  repo: string,
  accessToken?: string
): Promise<RepoFile[]> {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
    { headers }
  );
  if (!treeRes.ok) {
    throw new Error(`Unable to fetch repository tree (${treeRes.status})`);
  }

  const tree = await treeRes.json();

  const codeFiles = (tree.tree || [])
    .filter(
      (f: { type: string; path: string }) =>
        f.type === "blob" &&
        !f.path.includes("node_modules") &&
        !f.path.includes("vendor/") &&
        !f.path.includes("dist/") &&
        !f.path.includes(".min.") &&
        [
          // Web
          ".html", ".css", ".js", ".ts", ".jsx", ".tsx",
          // C / C++
          ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx",
          // Systems / compiled
          ".rs", ".go", ".java", ".kt", ".swift", ".cs",
          // Scripting
          ".py", ".rb", ".php", ".lua", ".sh", ".bash",
          // Data / config
          ".json", ".yaml", ".yml", ".toml", ".env.example",
          // Docs / markup
          ".md",
          // SQL
          ".sql",
        ].some((ext) => f.path.endsWith(ext))
    )
    .slice(0, 20);

  const files = await Promise.all(
    codeFiles.map(async (f: { path: string }) => {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${f.path}`, { headers });
      if (!res.ok) {
        return null;
      }
      const data = await res.json();
      if (!data?.content) {
        return null;
      }

      return {
        path: f.path,
        content: Buffer.from(data.content, "base64").toString("utf-8"),
      };
    })
  );

  return files.filter((file): file is RepoFile => file !== null);
}

