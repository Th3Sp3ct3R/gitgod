import { describe, it, expect } from "vitest";
import { classifyContent, parseLlmsIndex, detectSdkRepo } from "./content-classifier.js";

describe("classifyContent", () => {
  it("returns markdown for prose-heavy docs", () => {
    const html = `<h1>Guide</h1><p>Intro text.</p><h2>Setup</h2><p>More text here.</p><pre><code>npm install</code></pre><h2>Usage</h2><p>Even more.</p>`;
    const r = classifyContent({ source: "https://x.com/docs", html, downstream: "llm_context" });
    expect(r.format).toBe("markdown");
  });

  it("returns json for table-heavy API ref", () => {
    const rows = Array.from({ length: 15 }, (_, i) => `<tr><td>p${i}</td><td>string</td></tr>`).join("");
    const html = `<h1>API</h1><table><tr><th>Param</th><th>Type</th></tr>${rows}</table><table><tr><th>Endpoint</th></tr>${rows}</table>`;
    const r = classifyContent({ source: "https://x.com/api", html, downstream: "knowledge_graph" });
    expect(r.format).toBe("json");
  });

  it("uses extension fast path", () => {
    expect(classifyContent({ source: "README.md", fileExtension: ".md", downstream: "llm_context" }).format).toBe(
      "markdown"
    );
    expect(classifyContent({ source: "c.json", fileExtension: ".json", downstream: "knowledge_graph" }).format).toBe(
      "json"
    );
  });

  it("respects forceFormat", () => {
    expect(classifyContent({ source: "x", forceFormat: "json_with_md", downstream: "llm_context" }).format).toBe(
      "json_with_md"
    );
  });

  it("detects SDK content and routes to json_with_md", () => {
    const html = `
      <h1>uiautomator2</h1>
      <h2>Installation</h2>
      <pre><code>pip install uiautomator2</code></pre>
      <h2>Quick Start</h2>
      <p>Getting started with the SDK client library.</p>
      <pre><code>import uiautomator2 as u2
d = u2.connect()
d.app_start("com.instagram.android")</code></pre>
      <h2>API Reference</h2>
      <p>The SDK provides the following methods:</p>
      <pre><code>d.click(x, y)
d.swipe(sx, sy, ex, ey)
d.app_install("path/to/apk")</code></pre>
    `;
    const r = classifyContent({
      source: "https://github.com/openatx/uiautomator2",
      html,
      downstream: "knowledge_graph",
    });
    expect(r.category).toBe("sdk");
    expect(r.format).toBe("json_with_md");
  });

  it("boosts SDK confidence with content_hint from agent", () => {
    // Weak SDK signals (~0.45) — below 0.5 without hint; hint boosts past threshold. No pip/npm (avoids readme branch).
    const html = `<h1>x</h1><pre><code>go get example.com/sdk</code></pre><p>Official SDK.</p>`;
    const withHint = classifyContent({
      source: "https://github.com/example/some-repo",
      html,
      downstream: "knowledge_graph",
      contentHint: "sdk",
    });
    const withoutHint = classifyContent({
      source: "https://github.com/example/some-repo",
      html,
      downstream: "knowledge_graph",
    });
    expect(withHint.category).toBe("sdk");
    expect(withHint.confidence).toBeGreaterThanOrEqual(withoutHint.confidence);
  });

  it("overrides agent hint when content doesn't match", () => {
    const html = `<h1>My Blog</h1><p>Today I want to talk about my feelings.</p><p>It was a beautiful day.</p><p>The end.</p>`;
    const r = classifyContent({
      source: "https://blog.example.com/feelings",
      html,
      downstream: "llm_context",
      contentHint: "sdk",
    });
    expect(r.category).not.toBe("sdk");
  });
});

describe("detectSdkRepo", () => {
  it("detects GitHub SDK repos", () => {
    expect(detectSdkRepo("https://github.com/stripe/stripe-node")).toBe(true);
    expect(detectSdkRepo("https://github.com/openai/openai-python")).toBe(true);
    expect(detectSdkRepo("https://github.com/aws/aws-sdk-js")).toBe(true);
  });

  it("detects npm registry pages", () => {
    expect(detectSdkRepo("https://www.npmjs.com/package/firecrawl-js")).toBe(true);
  });

  it("detects pypi pages", () => {
    expect(detectSdkRepo("https://pypi.org/project/uiautomator2/")).toBe(true);
  });

  it("returns false for non-SDK URLs", () => {
    expect(detectSdkRepo("https://example.com/about")).toBe(false);
    expect(detectSdkRepo("https://blog.example.com/post-1")).toBe(false);
  });
});

describe("parseLlmsIndex", () => {
  it("parses llms.txt entries", () => {
    const entries = parseLlmsIndex("- [Start](https://x.com/start): Quick start\n- [API](https://x.com/api)");
    expect(entries.length).toBe(2);
    expect(entries[0].title).toBe("Start");
  });
});
