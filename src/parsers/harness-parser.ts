import { readFileSync } from "node:fs";
import type { Category, CLICommand, Tool, WorkflowChain } from "../types.js";

export interface SkillMetadata {
  summary: string;
  tags: string[];
  usageExamples: string[];
}

export interface HarnessParserResult {
  categories: Category[];
  workflowRelations: Array<{
    workflowId: string;
    fromCommandId?: string;
    toCommandId: string;
  }>;
}

function parseSkillMetadata(skillMdPath: string): SkillMetadata {
  const raw = readFileSync(skillMdPath, "utf-8");
  const desc = raw.match(/^\s*description:\s*(.+)$/m)?.[1]?.trim() ?? "CLI-Anything generated harness.";

  const explicitTags: string[] = [];
  const tagMatch = raw.match(/^\s*tags:\s*\[(.+)\]\s*$/m)?.[1];
  if (tagMatch) {
    for (const t of tagMatch.split(",")) {
      const cleaned = t.trim().replace(/^["']|["']$/g, "");
      if (cleaned) explicitTags.push(cleaned);
    }
  }

  const usageExamples = [...raw.matchAll(/`([^`]+\s--json[^`]*)`/g)].map((m) => m[1]);
  return {
    summary: desc,
    tags: explicitTags.length > 0 ? explicitTags : ["harness", "cli-anything", "agent-native"],
    usageExamples,
  };
}

function commandToTool(command: CLICommand, cliName: string, metadata: SkillMetadata): Tool {
  const cmd = command.name.trim();
  const group = command.group?.trim();
  const fullName = group ? `${group} ${cmd}` : cmd;
  const urlCommand = fullName.replace(/\s+/g, "/");

  return {
    name: fullName,
    url: `cli://${cliName}/${urlCommand}`,
    description: command.description || metadata.summary,
    link_type: "tool",
    status: "alive",
    scraped: {
      title: fullName,
      description: command.description || metadata.summary,
      content_preview: metadata.usageExamples.slice(0, 3).join("\n"),
      scraped_at: new Date().toISOString(),
    },
    synthesis: {
      summary: command.description || metadata.summary,
      tags: [...metadata.tags, ...(group ? [group] : []), "json-output"],
      relevance_score: 5,
      cross_categories: ["Harness / CLI"],
      duplicates: [],
    },
  };
}

function buildWorkflowRelations(workflows: WorkflowChain[]): HarnessParserResult["workflowRelations"] {
  const relations: HarnessParserResult["workflowRelations"] = [];
  for (const workflow of workflows) {
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      relations.push({
        workflowId: workflow.id,
        fromCommandId: i > 0 ? workflow.steps[i - 1].commandId : undefined,
        toCommandId: step.commandId,
      });
    }
  }
  return relations;
}

export function parseHarnessToGraph(
  cliName: string,
  commands: CLICommand[],
  workflows: WorkflowChain[],
  skillMdPath: string
): HarnessParserResult {
  const metadata = parseSkillMetadata(skillMdPath);
  const tools = commands.map((c) => commandToTool(c, cliName, metadata));
  const categories: Category[] = [
    {
      category: "Harness / CLI",
      depth: 1,
      tools,
      subcategories: [],
    },
  ];

  return {
    categories,
    workflowRelations: buildWorkflowRelations(workflows),
  };
}
