import { describe, expect, it } from "vitest";
import { formatResearchMarkdown } from "./research-merge.js";

describe("formatResearchMarkdown", () => {
  it("renders both sections and notes", () => {
    const md = formatResearchMarkdown(
      "test query",
      [{ url: "https://a.com", title: "A", description: "desc" }],
      [
        {
          fullName: "o/r",
          description: "repo",
          stargazersCount: 42,
          url: "https://github.com/o/r",
        },
      ],
      {}
    );
    expect(md).toContain("# Research: \"test query\"");
    expect(md).toContain("## Firecrawl (web search)");
    expect(md).toContain("[A](https://a.com)");
    expect(md).toContain("## GitHub (`gh search repos`)");
    expect(md).toContain("**o/r** (42★)");
    expect(md).toContain("## Notes");
  });

  it("shows skipped messages", () => {
    const md = formatResearchMarkdown("q", [], [], {
      firecrawlSkipped: "no key",
      ghSkipped: "no gh",
    });
    expect(md).toContain("_no key_");
    expect(md).toContain("_no gh_");
  });
});
