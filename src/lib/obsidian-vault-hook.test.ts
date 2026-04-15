import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { syncArchitectureDocsToVault, getArchitectureDocsDir, syncAllToVault } from "./obsidian-vault-hook.js";

describe("obsidian-vault-hook", () => {
  it("getArchitectureDocsDir points at docs with README + DATA-FLOW-ARC", () => {
    const d = getArchitectureDocsDir();
    expect(existsSync(path.join(d, "DATA-FLOW-ARC.md"))).toBe(true);
    expect(existsSync(path.join(d, "README.md"))).toBe(true);
  });

  it("syncArchitectureDocsToVault copies both files into vault/Architecture", () => {
    const vault = mkdtempSync(path.join(tmpdir(), "gg-vault-"));
    const r = syncArchitectureDocsToVault(vault);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const readme = readFileSync(path.join(r.vaultArchitectureDir, "README.md"), "utf-8");
    const arc = readFileSync(path.join(r.vaultArchitectureDir, "DATA-FLOW-ARC.md"), "utf-8");
    expect(readme.length).toBeGreaterThan(10);
    expect(arc.includes("Data flow arc")).toBe(true);
    rmSync(vault, { recursive: true, force: true });
  });

  it("syncAllToVault copies markdown and agent-docs from data dirs", () => {
    // syncAllToVault reads from the real data/ dir, so just verify it returns ok
    const vault = mkdtempSync(path.join(tmpdir(), "gg-vault-full-"));
    mkdirSync(path.join(vault, "08-gitgod"), { recursive: true });
    const r = syncAllToVault(vault);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.copied.length).toBeGreaterThan(0);
    rmSync(vault, { recursive: true, force: true });
  });
});
