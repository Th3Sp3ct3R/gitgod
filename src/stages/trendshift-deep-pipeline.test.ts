import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildTrendshiftTopicCanonicalManifest,
  runTrendshiftTopicDeepPipeline,
} from "./trendshift-deep-pipeline.js";

describe("trendshift deep pipeline", () => {
  it("canonicalizes topic repos and writes a manifest", async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-trendshift-deep-"));

    try {
      const reposPath = path.join(tmpRoot, "repos.json");
      writeFileSync(
        reposPath,
        JSON.stringify(
          {
            topicName: "AI agent",
            topicUrl: "https://trendshift.io/topics/ai-agent",
            repos: [
              {
                repoName: "foo/bar",
                trendshiftRepoUrl: "https://trendshift.io/repositories/1",
                githubUrl: "https://github.com/foo/bar",
                tags: ["AI agent"],
                metrics: [100, 10],
                description: "first",
              },
              {
                repoName: "foo/bar",
                trendshiftRepoUrl: "https://trendshift.io/repositories/2",
                githubUrl: "https://github.com/Foo/Bar.git",
                tags: ["AI workflow"],
                metrics: [110, 12],
                description: "duplicate",
              },
              {
                repoName: "acme/tool",
                trendshiftRepoUrl: "https://trendshift.io/repositories/3",
                githubUrl: "https://github.com/acme/tool",
                tags: ["AI agent"],
                metrics: [50, 5],
              },
            ],
          },
          null,
          2
        ),
        "utf-8"
      );

      const result = await buildTrendshiftTopicCanonicalManifest(reposPath, {
        outputDir: tmpRoot,
      });

      expect(result.canonicalRepos).toHaveLength(2);
      expect(result.canonicalRepos[0]?.canonicalGitHubUrl).toBe("https://github.com/acme/tool");
      expect(result.canonicalRepos[1]?.canonicalGitHubUrl).toBe("https://github.com/foo/bar");
      expect(result.canonicalRepos[1]?.trendshiftRepoUrls).toHaveLength(2);
      expect(result.canonicalRepos[1]?.sourceTags).toEqual(["AI agent", "AI workflow"]);

      const manifest = JSON.parse(readFileSync(result.manifestPath, "utf-8"));
      expect(manifest.repos).toHaveLength(2);
      expect(manifest.repos[0].pipeline.state).toBe("discovered");
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("runs deep pipeline stages and updates manifest", async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-trendshift-deep-"));

    try {
      const manifestPath = path.join(tmpRoot, "manifest.json");
      writeFileSync(
        manifestPath,
        JSON.stringify(
          {
            topicName: "AI agent",
            topicUrl: "https://trendshift.io/topics/ai-agent",
            generatedAt: new Date().toISOString(),
            repos: [
              {
                repoName: "foo/bar",
                canonicalGitHubUrl: "https://github.com/foo/bar",
                repoSlug: "foo-bar",
                trendshiftRepoUrls: ["https://trendshift.io/repositories/1"],
                sourceTags: ["AI agent"],
                pipeline: { state: "discovered" },
              },
            ],
          },
          null,
          2
        ),
        "utf-8"
      );

      const result = await runTrendshiftTopicDeepPipeline(manifestPath, {
        pipelineDataDir: path.join(tmpRoot, "pipeline"),
        checkoutRootDir: path.join(tmpRoot, "checkouts"),
        cloneRepository: async (url, slug, checkoutRootDir) => {
          const checkoutPath = path.join(checkoutRootDir, slug);
          writeFileSync(path.join(tmpRoot, "clone.log"), `${url} -> ${checkoutPath}`);
          return checkoutPath;
        },
        ingestRepository: async (_url, dataDir) => path.join(dataDir, "foo-bar", "knowledge-graph.json"),
        decomposeKnowledgeGraph: async (kgPath) =>
          path.join(path.dirname(kgPath), "decomposition.json"),
        harnessRepository: async ({ repoPath }) => ({
          status: "harnessed",
          cliName: "foo",
          commands: [],
          skillMdPath: path.join(repoPath, "SKILL.md"),
          testResults: { passed: 0, failed: 0 },
          workflows: [],
          cachePath: path.join(tmpRoot, "pipeline", "harnesses", "foo-bar.json"),
        }),
      });

      expect(result.completed).toBe(1);
      expect(result.fallback).toBe(0);
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      expect(manifest.repos[0].pipeline.state).toBe("harnessed");
      expect(manifest.repos[0].pipeline.knowledgeGraphPath).toContain("knowledge-graph.json");
      expect(manifest.repos[0].pipeline.decompositionPath).toContain("decomposition.json");
      expect(manifest.repos[0].pipeline.checkoutPath).toContain("foo-bar");
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("records decomposed_no_harness instead of failing when fallback harness is returned", async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-trendshift-deep-"));

    try {
      const manifestPath = path.join(tmpRoot, "manifest.json");
      writeFileSync(
        manifestPath,
        JSON.stringify(
          {
            topicName: "AI agent",
            topicUrl: "https://trendshift.io/topics/ai-agent",
            generatedAt: new Date().toISOString(),
            repos: [
              {
                repoName: "foo/bar",
                canonicalGitHubUrl: "https://github.com/foo/bar",
                repoSlug: "foo-bar",
                trendshiftRepoUrls: ["https://trendshift.io/repositories/1"],
                sourceTags: ["AI agent"],
                pipeline: { state: "discovered" },
              },
            ],
          },
          null,
          2
        ),
        "utf-8"
      );

      const result = await runTrendshiftTopicDeepPipeline(manifestPath, {
        pipelineDataDir: path.join(tmpRoot, "pipeline"),
        checkoutRootDir: path.join(tmpRoot, "checkouts"),
        cloneRepository: async (_url, slug, checkoutRootDir) => path.join(checkoutRootDir, slug),
        ingestRepository: async (_url, dataDir) => path.join(dataDir, "foo-bar", "knowledge-graph.json"),
        decomposeKnowledgeGraph: async (kgPath) => path.join(path.dirname(kgPath), "decomposition.json"),
        harnessRepository: async ({ repoPath }) => ({
          status: "decomposed_no_harness",
          cliName: "fallback-foo-bar",
          commands: [],
          skillMdPath: path.join(repoPath, "FALLBACK.md"),
          testResults: { passed: 0, failed: 0 },
          workflows: [
            {
              id: "workflow-0-automation",
              title: "Automation pipeline",
              description: "Fallback workflow",
              steps: [],
            },
          ],
          cachePath: path.join(tmpRoot, "pipeline", "harnesses", "foo-bar.json"),
          workflowPath: path.join(tmpRoot, "pipeline", "harnesses", "foo-bar", "workflows.json"),
          fallbackReason: "No agent-harness directory found",
        }),
      });

      expect(result.completed).toBe(0);
      expect(result.fallback).toBe(1);
      expect(result.failed).toBe(0);
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      expect(manifest.repos[0].pipeline.state).toBe("decomposed_no_harness");
      expect(manifest.repos[0].pipeline.checkoutPath).toContain("foo-bar");
      expect(manifest.repos[0].pipeline.decompositionPath).toContain("decomposition.json");
      expect(manifest.repos[0].pipeline.workflowPath).toContain(path.join("foo-bar", "workflows.json"));
      expect(manifest.repos[0].pipeline.error).toContain("No agent-harness directory found");
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
