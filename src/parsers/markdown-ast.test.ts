// src/parsers/markdown-ast.test.ts
import { test, describe, expect } from "vitest";
import { parseReadme } from "./markdown-ast.js";

describe("parseReadme", () => {
  test("extracts categories from headings", () => {
    const md = `# Awesome OSINT\n\n## General Search\n\n- [Google](https://google.com) - The most popular search engine\n- [Bing](https://bing.com) - Microsoft search\n\n## Social Media\n\n### Twitter\n\n- [TweetDeck](https://tweetdeck.twitter.com) - Twitter dashboard\n`;

    const result = parseReadme(md, "test/repo");

    expect(result.taxonomy.length).toBe(2);
    expect(result.taxonomy[0].category).toBe("General Search");
    expect(result.taxonomy[0].tools.length).toBe(2);
    expect(result.taxonomy[0].tools[0].name).toBe("Google");
    expect(result.taxonomy[0].tools[0].url).toBe("https://google.com");
    expect(result.taxonomy[0].tools[0].description).toBe("The most popular search engine");
    expect(result.taxonomy[1].category).toBe("Social Media");
    expect(result.taxonomy[1].subcategories.length).toBe(1);
    expect(result.taxonomy[1].subcategories[0].category).toBe("Twitter");
    expect(result.taxonomy[1].subcategories[0].tools.length).toBe(1);
  });

  test("detects GitHub link types", () => {
    const md = `## Tools\n\n- [Repo](https://github.com/user/repo) - A GitHub repo\n- [Site](https://example.com) - A website\n`;
    const result = parseReadme(md, "test/repo");
    expect(result.taxonomy[0].tools[0].link_type).toBe("github");
    expect(result.taxonomy[0].tools[1].link_type).toBe("website");
  });

  test("counts stats correctly", () => {
    const md = `## Cat1\n\n- [A](https://a.com) - desc\n\n## Cat2\n\n- [B](https://b.com) - desc\n- [C](https://c.com) - desc\n`;
    const result = parseReadme(md, "test/repo");
    expect(result.stats.categories).toBe(2);
    expect(result.stats.links).toBe(3);
  });
});
