#!/usr/bin/env tsx
/**
 * Repo Content Router Agent
 * 
 * Takes parsed repo data and decides:
 * 1. What type of content generation to trigger
 * 2. What downstream systems to feed
 * 3. What actions to take (track APIs, generate blog posts, etc.)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

interface ParsedRepo {
  name: string;
  repo: string;
  url: string;
  description: string;
  type: "guidelines" | "cli" | "daily-digest" | "tracker" | "data-archive";
  source?: string;
  update_frequency?: string;
  key_features?: string[];
  install_commands?: string[];
  usage_examples?: string[];
  key_files?: string[];
  content: string;
}

interface ContentDecision {
  repo: string;
  actions: Action[];
  priority: "high" | "medium" | "low";
  reasoning: string;
}

type Action = 
  | { type: "api_track"; sources: string[]; target: string }
  | { type: "blog_post"; angle: string; audience: string }
  | { type: "twitter_thread"; hook: string }
  | { type: "newsletter_item"; section: string }
  | { type: "add_to_docs"; doc_path: string }
  | { type: "skill_extract"; skill_name: string }
  | { type: "monitor"; check_interval: string };

// ═════════════════════════════════════════════════════════════════════════════
// AGENT PROMPT TEMPLATE
// ═════════════════════════════════════════════════════════════════════════════

const AGENT_PROMPT = `You are the Repo Content Router Agent.

Your job: Analyze parsed repository data and decide what content/actions to generate.

INPUT: A ParsedRepo object with:
- name, repo, url, description, type
- source (what it tracks, if applicable)
- update_frequency (how often it updates)
- key_features, install_commands, usage_examples, key_files
- content (full README)

OUTPUT: ContentDecision with:
- actions: Array of actions to take
- priority: high/medium/low
- reasoning: Why these actions

AVAILABLE ACTIONS:
1. api_track { sources, target } - Track API docs for changes, feed to our docs
2. blog_post { angle, audience } - Generate blog post idea
3. twitter_thread { hook } - Twitter content angle
4. newsletter_item { section } - Add to newsletter
5. add_to_docs { doc_path } - Update our documentation
6. skill_extract { skill_name } - Extract as reusable skill
7. monitor { check_interval } - Watch for updates

DECISION RULES:

IF type === "tracker" AND source includes API docs:
  → api_track (sources from repo, target="our-api-docs")
  → monitor (check_interval=daily)
  → newsletter_item (section="API Changes")
  priority: high (time-sensitive)

IF type === "daily-digest" AND source === "arXiv":
  → blog_post (angle="Weekly AI Research Roundup", audience="ML engineers")
  → twitter_thread (hook="This week's most interesting AI papers")
  → newsletter_item (section="Research")
  priority: medium

IF type === "daily-digest" AND source === "Hacker News":
  → blog_post (angle="What Developers Are Talking About", audience="devs")
  → twitter_thread (hook="Trending on HN this week")
  priority: medium

IF type === "guidelines":
  → add_to_docs (doc_path="coding-standards.md")
  → skill_extract (skill_name=repo.name)
  priority: high (reusable)

IF type === "cli" AND install_commands includes Claude Code:
  → blog_post (angle="Tool Review: X for Claude Code", audience="AI developers")
  → add_to_docs (doc_path="claude-code-tools.md")
  → skill_extract (skill_name=repo.name)
  priority: medium

IF type === "daily-digest" AND source === "crates.io":
  → twitter_thread (hook="Daily Rust crate you should know")
  → newsletter_item (section="Rust")
  priority: low

Always include:
- At least ONE content generation action (blog, twitter, newsletter)
- At least ONE knowledge base action (docs, skill, monitor)

Respond with valid JSON only.`;

// ═════════════════════════════════════════════════════════════════════════════
// DECISION ENGINE (Local implementation without LLM for speed)
// ═════════════════════════════════════════════════════════════════════════════

function routeRepo(repo: ParsedRepo): ContentDecision {
  const actions: Action[] = [];
  let priority: "high" | "medium" | "low" = "medium";
  const reasoning_parts: string[] = [];

  switch (repo.type) {
    case "tracker":
      if (repo.source?.toLowerCase().includes("api")) {
        // Extract API sources from the source string
        const apiSources = repo.source.match(/(Stripe|GitHub|Anthropic|OpenAI|MDN|Python|RFCs)/g) || ["unknown"];
        actions.push({
          type: "api_track",
          sources: apiSources.map(s => s.toLowerCase()),
          target: "docs/api-changes/"
        });
        actions.push({
          type: "monitor",
          check_interval: repo.update_frequency || "daily"
        });
        actions.push({
          type: "newsletter_item",
          section: "API Changelog"
        });
        priority = "high";
        reasoning_parts.push(`API tracker for ${apiSources.join(", ")} - time-sensitive changes`);
      }
      break;

    case "daily-digest":
      const source = repo.source?.toLowerCase() || "";
      
      if (source.includes("arxiv")) {
        actions.push({
          type: "blog_post",
          angle: "Weekly AI/LLM Research Digest",
          audience: "machine learning engineers and AI researchers"
        });
        actions.push({
          type: "twitter_thread",
          hook: "🧵 This week's most interesting AI papers from arXiv"
        });
        actions.push({
          type: "newsletter_item",
          section: "Research Spotlight"
        });
        priority = "medium";
        reasoning_parts.push("arXiv digest - good for weekly research roundups");
      }
      
      else if (source.includes("hacker")) {
        actions.push({
          type: "blog_post",
          angle: "What Developers Are Actually Talking About",
          audience: "software developers and tech founders"
        });
        actions.push({
          type: "twitter_thread",
          hook: "📰 Trending on Hacker News this week"
        });
        priority = "medium";
        reasoning_parts.push("HN front page - signals developer interest");
      }
      
      else if (source.includes("crates")) {
        actions.push({
          type: "twitter_thread",
          hook: "🦀 Daily Rust crate you should know about"
        });
        actions.push({
          type: "newsletter_item",
          section: "Rust Ecosystem"
        });
        priority = "low";
        reasoning_parts.push("Rust crate discovery - niche but valuable");
      }
      break;

    case "guidelines":
      actions.push({
        type: "add_to_docs",
        doc_path: `docs/coding-standards/${repo.name}.md`
      });
      actions.push({
        type: "skill_extract",
        skill_name: repo.name
      });
      actions.push({
        type: "blog_post",
        angle: `How to Apply ${repo.name} in Your Projects`,
        audience: "software engineers"
      });
      priority = "high";
      reasoning_parts.push("Coding guidelines - reusable across all projects");
      break;

    case "cli":
      const isClaudeRelated = repo.description.toLowerCase().includes("claude") ||
                              repo.install_commands?.some(c => c.includes("claude"));
      
      actions.push({
        type: "blog_post",
        angle: `Tool Review: ${repo.name} - ${isClaudeRelated ? "Claude Code" : "CLI"} Power-Up`,
        audience: isClaudeRelated ? "Claude Code users" : "CLI enthusiasts"
      });
      actions.push({
        type: "add_to_docs",
        doc_path: isClaudeRelated ? "docs/claude-code/tools.md" : "docs/cli-tools.md"
      });
      if (repo.key_features && repo.key_features.length > 0) {
        actions.push({
          type: "skill_extract",
          skill_name: repo.name
        });
      }
      priority = "medium";
      reasoning_parts.push(`CLI tool${isClaudeRelated ? " for Claude Code" : ""} - practical utility content`);
      break;
  }

  // Always add monitoring for daily-updated repos
  if (repo.update_frequency?.includes("daily")) {
    const hasMonitor = actions.some(a => a.type === "monitor");
    if (!hasMonitor) {
      actions.push({
        type: "monitor",
        check_interval: "daily"
      });
      reasoning_parts.push("Daily updates - worth monitoring");
    }
  }

  return {
    repo: repo.repo,
    actions,
    priority,
    reasoning: reasoning_parts.join("; ")
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// ACTION EXECUTORS
// ═════════════════════════════════════════════════════════════════════════════

function executeAction(action: Action, repo: ParsedRepo): string {
  const timestamp = new Date().toISOString().split("T")[0];
  
  switch (action.type) {
    case "api_track": {
      // Create API tracking config
      const configPath = `docs/api-changes/${action.sources.join("-")}-tracker.json`;
      const config = {
        name: repo.name,
        repo: repo.url,
        sources: action.sources,
        last_checked: timestamp,
        tracked_files: repo.key_files,
        notify_on_change: true
      };
      
      // In real implementation, write to file
      console.log(`  📡 API_TRACK: Created tracker for ${action.sources.join(", ")}`);
      console.log(`     Config: ${configPath}`);
      console.log(`     Will monitor: ${repo.key_files?.join(", ") || "docs/*"}`);
      
      return `api-track:${action.sources.join(",")}`;
    }

    case "blog_post": {
      // Generate blog post outline
      const outline = {
        title: action.angle,
        target_audience: action.audience,
        repo: repo.repo,
        key_points: repo.key_features || [repo.description],
        outline: [
          `Introduction: What is ${repo.name}?`,
          `Problem it solves`,
          `Key features overview`,
          `Installation/Setup`,
          `Usage examples`,
          `Conclusion`
        ],
        source_material: repo.url,
        generated_at: timestamp
      };
      
      console.log(`  📝 BLOG_POST: "${action.angle}"`);
      console.log(`     Audience: ${action.audience}`);
      console.log(`     Key points: ${outline.key_points.slice(0, 3).join("; ")}`);
      
      return `blog-post:${action.angle}`;
    }

    case "twitter_thread": {
      const thread = {
        hook: action.hook,
        repo: repo.name,
        url: repo.url,
        tweet_count: 5,
        key_insights: repo.key_features?.slice(0, 3) || [repo.description],
        call_to_action: `Check it out: ${repo.url}`
      };
      
      console.log(`  🐦 TWITTER_THREAD: "${action.hook}"`);
      console.log(`     ${thread.key_insights.length} key insights`);
      
      return `twitter:${action.hook}`;
    }

    case "newsletter_item": {
      const item = {
        section: action.section,
        headline: repo.name,
        blurb: repo.description,
        link: repo.url,
        added_at: timestamp
      };
      
      console.log(`  📧 NEWSLETTER_ITEM: [${action.section}] ${repo.name}`);
      
      return `newsletter:${action.section}`;
    }

    case "add_to_docs": {
      console.log(`  📚 ADD_TO_DOCS: ${action.doc_path}`);
      console.log(`     Content from: ${repo.url}`);
      
      return `docs:${action.doc_path}`;
    }

    case "skill_extract": {
      const skill = {
        name: action.skill_name,
        type: repo.type,
        commands: repo.install_commands || [],
        usage: repo.usage_examples || [],
        source_repo: repo.url
      };
      
      console.log(`  🎯 SKILL_EXTRACT: ${action.skill_name}`);
      console.log(`     Commands: ${skill.commands.length}`);
      console.log(`     Usage examples: ${skill.usage.length}`);
      
      return `skill:${action.skill_name}`;
    }

    case "monitor": {
      console.log(`  👁️  MONITOR: ${action.check_interval} checks`);
      console.log(`     Source: ${repo.source || repo.url}`);
      
      return `monitor:${action.check_interval}`;
    }

    default:
      return "unknown";
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════

function main() {
  // Load parsed repos from stdin or file
  const args = process.argv.slice(2);
  let repos: ParsedRepo[] = [];
  
  if (args[0] === "--file") {
    const data = JSON.parse(readFileSync(args[1], "utf-8"));
    repos = Array.isArray(data) ? data : [data];
  } else if (args[0]) {
    // Assume single repo JSON
    repos = [JSON.parse(args[0])];
  } else {
    // Demo with the repos we just parsed
    console.log("No input provided. Run with --file <repos.json> or pass repo JSON.\n");
    console.log("Example usage:");
    console.log("  tsx repo-content-router.ts --file repos.json");
    console.log("  tsx repo-content-router.ts '{\"name\":\"...\",\"type\":\"...\"}'\n");
    process.exit(0);
  }

  console.log("═".repeat(70));
  console.log("REPO CONTENT ROUTER AGENT");
  console.log("═".repeat(70));
  console.log();

  const results: ContentDecision[] = [];

  for (const repo of repos) {
    console.log(`\n📦 ${repo.name}`);
    console.log(`   ${repo.repo}`);
    console.log(`   Type: ${repo.type} | Source: ${repo.source || "N/A"}`);
    console.log("   " + "-".repeat(50));
    
    const decision = routeRepo(repo);
    results.push(decision);
    
    console.log(`   Priority: ${decision.priority.toUpperCase()}`);
    console.log(`   Reasoning: ${decision.reasoning}`);
    console.log();
    console.log("   Actions:");
    
    for (const action of decision.actions) {
      executeAction(action, repo);
      console.log();
    }
  }

  console.log("═".repeat(70));
  console.log("SUMMARY");
  console.log("═".repeat(70));
  
  const byPriority = {
    high: results.filter(r => r.priority === "high").length,
    medium: results.filter(r => r.priority === "medium").length,
    low: results.filter(r => r.priority === "low").length
  };
  
  const byAction = {
    api_track: results.reduce((sum, r) => sum + r.actions.filter(a => a.type === "api_track").length, 0),
    blog_post: results.reduce((sum, r) => sum + r.actions.filter(a => a.type === "blog_post").length, 0),
    twitter_thread: results.reduce((sum, r) => sum + r.actions.filter(a => a.type === "twitter_thread").length, 0),
    newsletter_item: results.reduce((sum, r) => sum + r.actions.filter(a => a.type === "newsletter_item").length, 0),
    add_to_docs: results.reduce((sum, r) => sum + r.actions.filter(a => a.type === "add_to_docs").length, 0),
    skill_extract: results.reduce((sum, r) => sum + r.actions.filter(a => a.type === "skill_extract").length, 0),
    monitor: results.reduce((sum, r) => sum + r.actions.filter(a => a.type === "monitor").length, 0)
  };
  
  console.log(`Total repos processed: ${results.length}`);
  console.log(`Priority: High=${byPriority.high}, Medium=${byPriority.medium}, Low=${byPriority.low}`);
  console.log();
  console.log("Actions triggered:");
  Object.entries(byAction).forEach(([action, count]) => {
    if (count > 0) console.log(`  ${action}: ${count}`);
  });
  
  // Write results
  const outputPath = `content-decisions-${Date.now()}.json`;
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log();
  console.log(`Results saved to: ${outputPath}`);
}

main();
