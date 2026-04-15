import { describe, expect, test } from "vitest";
import { parseTrendshiftTopicMarkdown } from "./trendshift-topic.js";

const SAMPLE_TOPIC_MARKDOWN = `# AI agent

[oguzbilgic/agent-kernel](https://trendshift.io/repositories/23977)

159

12

[GitHub](https://github.com/oguzbilgic/agent-kernel)

[#AI agent](https://trendshift.io/topics/ai-agent) [#AI memory](https://trendshift.io/topics/ai-memory)

Minimal kernel to make any AI coding agent stateful. Clone, point your agent, go.

[CoderLuii/HolyClaude](https://trendshift.io/repositories/23901)

Dockerfile

30

5

[GitHub](https://github.com/CoderLuii/HolyClaude)

[#AI agent](https://trendshift.io/topics/ai-agent) [#AI coding assistant](https://trendshift.io/topics/ai-coding) [#Headless browser](https://trendshift.io/topics/headless-browser)

AI coding workstation: Claude Code + web UI + 5 AI CLIs + headless browser + 50+ tools

Load more repositories (AI agent)`;

describe("parseTrendshiftTopicMarkdown", () => {
  test("extracts repository cards from a Trendshift topic page", () => {
    const result = parseTrendshiftTopicMarkdown(
      SAMPLE_TOPIC_MARKDOWN,
      "https://trendshift.io/topics/ai-agent"
    );

    expect(result.topicName).toBe("AI agent");
    expect(result.topicUrl).toBe("https://trendshift.io/topics/ai-agent");
    expect(result.repos).toHaveLength(2);
    expect(result.repos[0]).toMatchObject({
      repoName: "oguzbilgic/agent-kernel",
      trendshiftRepoUrl: "https://trendshift.io/repositories/23977",
      githubUrl: "https://github.com/oguzbilgic/agent-kernel",
      metrics: [159, 12],
      tags: ["AI agent", "AI memory"],
    });
    expect(result.repos[0].description).toContain("stateful");
    expect(result.repos[1]).toMatchObject({
      repoName: "CoderLuii/HolyClaude",
      githubUrl: "https://github.com/CoderLuii/HolyClaude",
      language: "Dockerfile",
      metrics: [30, 5],
      tags: ["AI agent", "AI coding assistant", "Headless browser"],
    });
  });

  test("parses k-suffixed metrics into integers", () => {
    const markdown = `# AI agent

[HKUDS/ClawTeam](https://trendshift.io/repositories/23721)

Python

3.3k

458

[GitHub](https://github.com/HKUDS/ClawTeam)

[#AI agent](https://trendshift.io/topics/ai-agent)

ClawTeam: Agent Swarm Intelligence`;

    const result = parseTrendshiftTopicMarkdown(
      markdown,
      "https://trendshift.io/topics/ai-agent"
    );

    expect(result.repos[0]?.metrics).toEqual([3300, 458]);
  });
});
