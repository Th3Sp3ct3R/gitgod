import { readFileSync } from "node:fs";

interface Tool {
  name: string;
  url: string;
  description: string;
  status: string;
  synthesis?: {
    summary: string;
    tags: string[];
    relevance_score: number;
    cross_categories: string[];
    duplicates: string[];
  };
  scraped?: {
    github_meta?: { stars?: number; language?: string };
  };
}

interface Cat {
  category: string;
  tools: Tool[];
  subcategories: Cat[];
}

const kg = JSON.parse(readFileSync("./data/z4nzu-hackingtool/knowledge-graph.json", "utf8"));

function collectTools(cats: Cat[], prefix: string): Array<Tool & { catPath: string }> {
  const all: Array<Tool & { catPath: string }> = [];
  for (const cat of cats) {
    const p = prefix ? `${prefix} > ${cat.category}` : cat.category;
    for (const t of cat.tools) {
      if (t.status === "alive" && t.synthesis) {
        all.push({ ...t, catPath: p });
      }
    }
    if (cat.subcategories) all.push(...collectTools(cat.subcategories, p));
  }
  return all;
}

const tools = collectTools(kg.taxonomy, "");
console.log(`Alive + synthesized tools: ${tools.length}\n`);

// Group by top-level category
const byCat: Record<string, Array<Tool & { catPath: string }>> = {};
for (const t of tools) {
  const c = t.catPath.split(" > ")[0];
  if (!(c in byCat)) byCat[c] = [];
  byCat[c].push(t);
}

for (const [cat, ts] of Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${cat} (${ts.length} tools):`);
  for (const t of ts.sort((a, b) => (b.synthesis!.relevance_score || 0) - (a.synthesis!.relevance_score || 0)).slice(0, 3)) {
    const stars = t.scraped?.github_meta?.stars || 0;
    console.log(`  [${t.synthesis!.relevance_score}/5] ${t.name} | stars: ${stars.toLocaleString()}`);
    console.log(`    tags: ${t.synthesis!.tags.join(", ")}`);
    console.log(`    ${(t.synthesis!.summary || "").slice(0, 140)}`);
  }
  console.log();
}
