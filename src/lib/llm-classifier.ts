/**
 * Classifier-Ω — LLM competitive-intel + agent-detection (optional enrich step).
 * Canonical prompt: docs/prompts/CLASSIFIER-OMEGA-SYSTEM.md
 * Enable: GITGOD_CLASSIFIER_OMEGA=1
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callOmegaLLM } from "./llm.js";
import type { OmegaClassification } from "../types.js";

export const CLASSIFIER_OMEGA_MAX_INPUT_CHARS = 120_000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function defaultPromptPath(): string {
  const cwd = process.cwd();
  const rel = path.join(cwd, "docs/prompts/CLASSIFIER-OMEGA-SYSTEM.md");
  if (existsSync(rel)) return rel;
  const fromLib = path.resolve(__dirname, "../../docs/prompts/CLASSIFIER-OMEGA-SYSTEM.md");
  if (existsSync(fromLib)) return fromLib;
  return rel;
}

export function resolveClassifierOmegaPromptPath(): string {
  const override = process.env.GITGOD_CLASSIFIER_OMEGA_PROMPT?.trim();
  if (override) return path.resolve(override);
  return defaultPromptPath();
}

/**
 * Load markdown file and return system prompt text (strip doc title / intro before first `---`).
 */
export function loadClassifierOmegaSystemPrompt(): string {
  const filePath = resolveClassifierOmegaPromptPath();
  const raw = readFileSync(filePath, "utf8");
  const sep = "\n---\n";
  const idx = raw.indexOf(sep);
  if (idx !== -1) return raw.slice(idx + sep.length).trim();
  return raw.trim();
}

/** 
 * True when Ω classification should run (enrich or classifier-omega command).
 * Omega now runs by default. Set GITGOD_CLASSIFIER_OMEGA=0 to disable.
 */
export function isClassifierOmegaEnabled(): boolean {
  const v = process.env.GITGOD_CLASSIFIER_OMEGA?.toLowerCase();
  // Default to enabled (opt-out instead of opt-in)
  if (v === undefined || v === "") return true;
  return v !== "0" && v !== "false" && v !== "no" && v !== "off";
}

/**
 * Extract a JSON object from model output (handles optional fenced blocks).
 */
export function extractJsonObject(text: string): string {
  let s = text.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)```/m.exec(s);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model output");
  return s.slice(start, end + 1);
}

function clampConfidence(n: unknown): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Normalize parsed JSON into OmegaClassification with safe defaults. */
export function normalizeOmegaClassification(raw: Record<string, unknown>): OmegaClassification {
  return {
    website_type: String(raw.website_type ?? "other"),
    is_competitor: Boolean(raw.is_competitor),
    competitor_reason:
      raw.competitor_reason === null || raw.competitor_reason === undefined
        ? null
        : String(raw.competitor_reason),
    is_another_agent: Boolean(raw.is_another_agent),
    agent_type:
      raw.agent_type === null || raw.agent_type === undefined ? null : String(raw.agent_type),
    agent_capabilities: Array.isArray(raw.agent_capabilities)
      ? raw.agent_capabilities.map(String)
      : [],
    threat_level: String(raw.threat_level ?? "LOW"),
    threat_justification: String(raw.threat_justification ?? ""),
    key_technologies: Array.isArray(raw.key_technologies) ? raw.key_technologies.map(String) : [],
    target_audience: String(raw.target_audience ?? ""),
    red_flags: Array.isArray(raw.red_flags) ? raw.red_flags.map(String) : [],
    summary: String(raw.summary ?? ""),
    action_recommendation: String(raw.action_recommendation ?? "IGNORE"),
    confidence: clampConfidence(raw.confidence),
    ethics_notes:
      raw.ethics_notes === null || raw.ethics_notes === undefined
        ? null
        : String(raw.ethics_notes),
  };
}

export interface ClassifyWithOmegaOptions {
  systemPrompt?: string;
}

/**
 * Run Classifier-Ω via configured LLM. Returns null on failure (caller keeps heuristic-only enrich).
 */
export async function classifyWithOmega(
  content: string,
  urlOrSlug: string,
  options?: ClassifyWithOmegaOptions,
): Promise<OmegaClassification | null> {
  const systemPrompt = options?.systemPrompt ?? loadClassifierOmegaSystemPrompt();
  const body = content.slice(0, CLASSIFIER_OMEGA_MAX_INPUT_CHARS);
  const userMessage = `URL/Slug: ${urlOrSlug}\n\nContent to classify:\n${body}`;

  try {
    // Use callOmegaLLM which automatically selects cheaper/faster models
    const rawText = await callOmegaLLM(systemPrompt, userMessage, {
      temperature: 0,
      maxTokens: 4096,
      jsonMode: true,
    });
    const jsonStr = extractJsonObject(rawText);
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    return normalizeOmegaClassification(parsed);
  } catch (e) {
    console.warn(`[Classifier-Ω] failed for ${urlOrSlug}:`, e instanceof Error ? e.message : e);
    return null;
  }
}
