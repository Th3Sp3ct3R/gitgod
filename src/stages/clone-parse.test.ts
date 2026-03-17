import { describe, it, expect } from "vitest";
import { cloneAndParse } from "./clone-parse.js";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("cloneAndParse", () => {
  it("rejects invalid GitHub URLs", async () => {
    await expect(cloneAndParse("https://notgithub.com/foo")).rejects.toThrow("Invalid GitHub URL");
  });

  it("uses execFileSync instead of execSync (no command injection)", async () => {
    // Verify the import is execFileSync, not execSync
    const source = readFileSync(path.join(import.meta.dirname, "clone-parse.ts"), "utf-8");
    expect(source).toContain("execFileSync");
    expect(source).not.toContain("execSync");
  });
});
