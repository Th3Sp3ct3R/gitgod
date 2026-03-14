// src/parsers/markdown-ast.ts
import { unified } from "unified";
import remarkParse from "remark-parse";
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

export function parseReadme(markdown: string, repoName: string): Skeleton {
  const tree = unified().use(remarkParse).parse(markdown);

  const taxonomy: Category[] = [];
  const headingStack: { depth: number; category: Category }[] = [];
  let currentCategory: Category | null = null;
  let totalLinks = 0;
  let totalCategories = 0;
  let skipFirstH1 = true;

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

        currentCategory!.tools.push(tool);
        totalLinks++;
      });
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
