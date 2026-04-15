// src/parsers/markdown-ast.ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import type { Skeleton, Category, Tool } from "../types.js";

function detectLinkType(url: string): Tool["link_type"] {
  if (url.includes("github.com") && url.split("/").length >= 5) return "github";
  if (url.includes("api.") || url.includes("/api/") || url.includes("/api")) return "api";
  return "website";
}

function extractTextFromNode(node: any): string {
  if (node.type === "text") return node.value;
  if (node.children) return node.children.map(extractTextFromNode).join("");
  return "";
}

export function extractHttpLinksFromMarkdown(markdown: string): string[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const seen = new Set<string>();
  const links: string[] = [];

  visit(tree, "link", (linkNode: any) => {
    const url = String(linkNode?.url ?? "").trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) return;
    if (seen.has(url)) return;
    seen.add(url);
    links.push(url);
  });

  return links;
}

export function parseReadme(markdown: string, repoName: string): Skeleton {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);

  const taxonomy: Category[] = [];
  const headingStack: { depth: number; category: Category }[] = [];
  let currentCategory: Category | null = null;
  let totalLinks = 0;
  let totalCategories = 0;
  let skipFirstH1 = true;
  const seenPerCategory = new WeakMap<Category, Set<string>>();

  function addToolToCurrentCategory(tool: Tool): void {
    if (!currentCategory) return;
    if (!seenPerCategory.has(currentCategory)) {
      seenPerCategory.set(currentCategory, new Set<string>());
    }
    const seen = seenPerCategory.get(currentCategory)!;
    if (seen.has(tool.url)) return;
    seen.add(tool.url);
    currentCategory.tools.push(tool);
    totalLinks++;
  }

  for (const node of tree.children as any[]) {
    if (node.type === "heading") {
      // Skip the first H1 (repo title)
      if (node.depth === 1 && skipFirstH1) {
        skipFirstH1 = false;
        continue;
      }

      const name = extractTextFromNode(node).trim();
      if (!name) continue;

      // Skip Table of Contents and similar meta sections
      const lower = name.toLowerCase();
      if (lower === "table of contents" || lower === "contents" || lower === "toc") continue;

      const cat: Category = {
        category: name,
        depth: node.depth,
        tools: [],
        subcategories: [],
      };
      totalCategories++;

      // Find parent based on heading depth
      while (
        headingStack.length > 0 &&
        headingStack[headingStack.length - 1].depth >= node.depth
      ) {
        headingStack.pop();
      }

      if (headingStack.length > 0) {
        headingStack[headingStack.length - 1].category.subcategories.push(cat);
      } else {
        taxonomy.push(cat);
      }

      headingStack.push({ depth: node.depth, category: cat });
      currentCategory = cat;
    }

    if (node.type === "list" && currentCategory) {
      visit(node, "listItem", (listItem: any) => {
        let linkNode: any = null;
        let descriptionParts: string[] = [];

        visit(listItem, (child: any) => {
          if (child.type === "link" && !linkNode) {
            linkNode = child;
          }
        });

        if (!linkNode) return;

        const paragraph = listItem.children?.[0];
        if (paragraph?.type === "paragraph") {
          let afterLink = false;
          for (const child of paragraph.children) {
            if (child === linkNode) {
              afterLink = true;
              continue;
            }
            if (afterLink && child.type === "text") {
              descriptionParts.push(child.value);
            }
          }
        }

        const description = descriptionParts
          .join("")
          .replace(/^\s*[-–—:]\s*/, "")
          .trim();

        const tool: Tool = {
          name: extractTextFromNode(linkNode),
          url: linkNode.url,
          description,
          link_type: detectLinkType(linkNode.url),
          status: "pending_scrape",
        };

        addToolToCurrentCategory(tool);
      });
    }

    if (node.type === "table" && currentCategory) {
      for (const row of node.children ?? []) {
        if (row.type !== "tableRow") continue;

        const rowLinks: any[] = [];
        visit(row, "link", (linkNode: any) => {
          rowLinks.push(linkNode);
        });
        if (rowLinks.length === 0) continue;

        // Prefer GitHub repo links in table rows (awesome-list style).
        const preferred =
          rowLinks.find((link) => (link.url || "").includes("github.com")) ?? rowLinks[0];

        const descriptionCell = row.children?.[1];
        const description = descriptionCell ? extractTextFromNode(descriptionCell).trim() : "";

        const tool: Tool = {
          name: extractTextFromNode(preferred).trim() || preferred.url,
          url: preferred.url,
          description,
          link_type: detectLinkType(preferred.url),
          status: "pending_scrape",
        };

        addToolToCurrentCategory(tool);
      }
    }
  }

  return {
    repo: repoName,
    url: `https://github.com/${repoName}`,
    scraped_at: new Date().toISOString(),
    stats: { categories: totalCategories, links: totalLinks },
    taxonomy,
  };
}
