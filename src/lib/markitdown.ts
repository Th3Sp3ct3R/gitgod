// src/lib/markitdown.ts
// Wrapper around Microsoft MarkItDown CLI for free local HTML/PDF/DOCX → markdown conversion.
// Falls back gracefully if markitdown is not installed.

import { execFile, execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const MARKITDOWN_BIN =
  process.env.MARKITDOWN_BIN ||
  "/Users/growthgod/Library/Python/3.14/bin/markitdown";

const TIMEOUT_MS = 30_000;

export interface MarkItDownResult {
  ok: true;
  markdown: string;
  source: string;
  method: "markitdown_file" | "markitdown_stdin";
}

export interface MarkItDownError {
  ok: false;
  error: string;
  source: string;
}

export type MarkItDownOutput = MarkItDownResult | MarkItDownError;

/** Check if the markitdown binary is available. */
export function isMarkItDownAvailable(): boolean {
  try {
    execFileSync(MARKITDOWN_BIN, ["--help"], { timeout: 5000, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert an HTML string to markdown using markitdown via stdin.
 */
export function convertHtmlToMarkdown(
  html: string,
  source: string
): Promise<MarkItDownOutput> {
  return new Promise((resolve) => {
    const proc = execFile(
      MARKITDOWN_BIN,
      [],
      { timeout: TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            ok: false,
            error: `markitdown failed: ${error.message}${stderr ? ` — ${stderr}` : ""}`,
            source,
          });
          return;
        }
        resolve({
          ok: true,
          markdown: stdout,
          source,
          method: "markitdown_stdin",
        });
      }
    );
    proc.stdin?.write(html);
    proc.stdin?.end();
  });
}

/**
 * Convert a local file (PDF, DOCX, PPTX, HTML, etc.) to markdown.
 */
export function convertFileToMarkdown(
  filePath: string,
  source: string
): Promise<MarkItDownOutput> {
  return new Promise((resolve) => {
    execFile(
      MARKITDOWN_BIN,
      [filePath],
      { timeout: TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            ok: false,
            error: `markitdown failed on ${filePath}: ${error.message}${stderr ? ` — ${stderr}` : ""}`,
            source,
          });
          return;
        }
        resolve({
          ok: true,
          markdown: stdout,
          source,
          method: "markitdown_file",
        });
      }
    );
  });
}

/**
 * Fetch a URL and convert to markdown using markitdown.
 * This is the main entry point for the cost hierarchy:
 *   fetch(url) → raw HTML → markitdown → clean markdown (FREE)
 */
export async function fetchAndConvert(url: string): Promise<MarkItDownOutput> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GitGod/1.0; +https://github.com/Th3Sp3ct3R/gitgod)",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status} ${resp.statusText}`, source: url };
    }

    const contentType = resp.headers.get("content-type") || "";

    // For PDFs and other binary formats, save to tmp file and convert
    if (
      contentType.includes("application/pdf") ||
      contentType.includes("application/vnd.openxmlformats") ||
      contentType.includes("application/msword")
    ) {
      const buffer = Buffer.from(await resp.arrayBuffer());
      const ext = contentType.includes("pdf")
        ? ".pdf"
        : contentType.includes("msword")
          ? ".docx"
          : ".bin";
      const tmpPath = path.join(tmpdir(), `gitgod-mid-${Date.now()}${ext}`);
      writeFileSync(tmpPath, buffer);
      const result = await convertFileToMarkdown(tmpPath, url);
      try { unlinkSync(tmpPath); } catch { /* ignore */ }
      return result;
    }

    // HTML/text — pipe through stdin
    const html = await resp.text();

    // Quick SPA detection: if body is mostly empty or just a JS loader, signal it
    const textContent = html.replace(/<[^>]+>/g, "").trim();
    if (html.length > 500 && textContent.length < 100) {
      return {
        ok: false,
        error: "SPA_DETECTED: page is JS-rendered, needs headless browser",
        source: url,
      };
    }

    return await convertHtmlToMarkdown(html, url);
  } catch (err: any) {
    return {
      ok: false,
      error: `fetch failed: ${err.message}`,
      source: url,
    };
  }
}
