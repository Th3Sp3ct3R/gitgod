// src/parsers/markdown-ast.test.ts
import { test, describe } from "node:test";
import assert from "node:assert";
import { parseReadme } from "./markdown-ast.js";

describe("parseReadme", () => {
  test("extracts categories from headings", () => {
    const md = `# Awesome OSINT\n\n## General Search\n\n- [Google](https://google.com) - The most popular search engine\n- [Bing](https://bing.com) - Microsoft search\n\n## Social Media\n\n### Twitter\n\n- [TweetDeck](https://tweetdeck.twitter.com) - Twitter dashboard\n`;

    const result = parseReadme(md, "test/repo");

    assert.equal(result.taxonomy.length, 2);
    assert.equal(result.taxonomy[0].category, "General Search");
    assert.equal(result.taxonomy[0].tools.length, 2);
    assert.equal(result.taxonomy[0].tools[0].name, "Google");
    assert.equal(result.taxonomy[0].tools[0].url, "https://google.com");
    assert.equal(result.taxonomy[0].tools[0].description, "The most popular search engine");
    assert.equal(result.taxonomy[1].category, "Social Media");
    assert.equal(result.taxonomy[1].subcategories.length, 1);
    assert.equal(result.taxonomy[1].subcategories[0].category, "Twitter");
    assert.equal(result.taxonomy[1].subcategories[0].tools.length, 1);
  });

  test("detects GitHub link types", () => {
    const md = `## Tools\n\n- [Repo](https://github.com/user/repo) - A GitHub repo\n- [Site](https://example.com) - A website\n`;
    const result = parseReadme(md, "test/repo");
    assert.equal(result.taxonomy[0].tools[0].link_type, "github");
    assert.equal(result.taxonomy[0].tools[1].link_type, "website");
  });

  test("counts stats correctly", () => {
    const md = `## Cat1\n\n- [A](https://a.com) - desc\n\n## Cat2\n\n- [B](https://b.com) - desc\n- [C](https://c.com) - desc\n`;
    const result = parseReadme(md, "test/repo");
    assert.equal(result.stats.categories, 2);
    assert.equal(result.stats.links, 3);
  });
});
