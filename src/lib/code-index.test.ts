import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildCodeIndex, retrieveChunks } from "./code-index.js";

describe("buildCodeIndex + retrieveChunks", () => {
  it("indexes text files and retrieves cli-related chunks", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "gitgod-code-index-"));
    mkdirSync(path.join(dir, "src"), { recursive: true });
    writeFileSync(
      path.join(dir, "README.md"),
      "This project exposes a command-line interface for repository ingestion."
    );
    writeFileSync(
      path.join(dir, "src", "cli.ts"),
      "export function main() { console.log('cli'); }\n".repeat(30)
    );

    const chunks = buildCodeIndex(dir);
    expect(chunks.length).toBeGreaterThan(0);

    const top = retrieveChunks("cli command entry main", chunks, 5);
    expect(top.some((c) => c.path.includes("cli") || c.text.includes("cli"))).toBe(true);
  });
});
