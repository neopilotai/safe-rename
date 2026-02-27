import fg from "fast-glob";
import fs from "fs-extra";

export async function analyzeRepo(root: string) {
  const files = await fg(["**/*.{ts,tsx,js,json,yml,yaml,env}"], {
    cwd: root,
    ignore: ["node_modules", "dist", ".git"],
  });

  const freq: Record<string, number> = {};

  function add(word: string) {
    freq[word] = (freq[word] || 0) + 1;
  }

  for (const f of files) {
    const content = await fs.readFile(`${root}/${f}`, "utf8");

    const scopeMatches = content.match(/@([a-zA-Z0-9-_]+)\//g) || [];
    scopeMatches.forEach((m) => add(m.replace("@", "").replace("/", "")));

    const envMatches = content.match(/[A-Z0-9_]{5,}_/g) || [];
    envMatches.forEach(add);

    const dockerMatches = content.match(/image:\s*([^\s]+)/g) || [];
    dockerMatches.forEach((m) => add(m.split(":")[1]));

    const importMatches = content.match(/from ["']([^"']+)["']/g) || [];
    importMatches.forEach((m) => add(m));
  }

  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);

  return {
    topTokens: sorted.slice(0, 20),
  };
}
