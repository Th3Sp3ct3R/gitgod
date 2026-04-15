#!/usr/bin/env tsx
/**
 * Content Pipeline Integrations
 * 
 * Executes the actions decided by RepoContentRouter:
 * - API tracking → monitors external APIs for our LLM docs
 * - Blog posts → generates outlines ready for writing
 * - Twitter threads → generates thread outlines
 * - Newsletter items → adds to queue
 * - Docs updates → updates our documentation
 * - Skill extraction → creates SKILL.md files
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

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
// INTEGRATION 1: API TRACKING → Our LLM API Docs
// ═════════════════════════════════════════════════════════════════════════════

interface APITracker {
  name: string;
  repo: string;
  sources: string[];
  tracked_endpoints: string[];
  last_checked: string;
  changes_detected: APIChange[];
}

interface APIChange {
  date: string;
  source: string;
  endpoint: string;
  change_type: "added" | "removed" | "modified";
  summary: string;
  diff_url?: string;
}

function createAPITracker(repoName: string, repoUrl: string, sources: string[]): APITracker {
  const tracker: APITracker = {
    name: repoName,
    repo: repoUrl,
    sources,
    tracked_endpoints: [],
    last_checked: new Date().toISOString(),
    changes_detected: []
  };
  
  // Map sources to our API doc structure
  const sourceMapping: Record<string, string[]> = {
    "stripe": ["charges", "customers", "subscriptions", "webhooks"],
    "github": ["repos", "issues", "pulls", "actions"],
    "anthropic": ["messages", "completions"],
    "openai": ["chat", "embeddings", "fine-tuning"],
    "mdn": ["web-apis", "javascript", "css"],
    "python": ["peps"],
    "rfcs": ["http", "tcp", "udp"]
  };
  
  for (const source of sources) {
    const endpoints = sourceMapping[source] || ["general"];
    tracker.tracked_endpoints.push(...endpoints.map(e => `${source}/${e}`));
  }
  
  return tracker;
}

function updateOurAPIDocs(tracker: APITracker) {
  // This would integrate with your actual API docs system
  const docsPath = `docs/external-api-tracking/${tracker.name}.json`;
  mkdirSync(path.dirname(docsPath), { recursive: true });
  writeFileSync(docsPath, JSON.stringify(tracker, null, 2));
  
  console.log(`  📡 Created API tracker: ${docsPath}`);
  console.log(`     Tracking ${tracker.tracked_endpoints.length} endpoints`);
  console.log(`     Sources: ${tracker.sources.join(", ")}`);
  
  // Generate a monitoring script
  const monitorScript = generateMonitorScript(tracker);
  const scriptPath = `scripts/monitor-${tracker.name}.sh`;
  writeFileSync(scriptPath, monitorScript);
  console.log(`  🔧 Monitor script: ${scriptPath}`);
}

function generateMonitorScript(tracker: APITracker): string {
  return `#!/bin/bash
# Auto-generated API monitor for ${tracker.name}
# Sources: ${tracker.sources.join(", ")}

REPO_URL="${tracker.repo}"
TRACKER_FILE="docs/external-api-tracking/${tracker.name}.json"
LAST_CHECKED=$(jq -r '.last_checked' $TRACKER_FILE)

echo "Checking ${tracker.name} for API changes..."
echo "Last checked: $LAST_CHECKED"

# Clone/fetch the repo and check for new commits
git ls-remote $REPO_URL HEAD | awk '{print $1}' > /tmp/${tracker.name}-latest.txt

# In production, this would:
# 1. Fetch the repo
# 2. Compare docs/ files against our last known state
# 3. Generate diffs
# 4. Update our API docs if changes found
# 5. Send notifications

echo "Monitor complete. Run 'npm run api-sync' to apply changes."
`;
}

// ═════════════════════════════════════════════════════════════════════════════
// INTEGRATION 2: BLOG POST GENERATION
// ═════════════════════════════════════════════════════════════════════════════

interface BlogPostOutline {
  title: string;
  slug: string;
  target_audience: string;
  repo_source: string;
  sections: BlogSection[];
  key_takeaways: string[];
  cta: string;
  status: "draft" | "in_review" | "published";
  created_at: string;
}

interface BlogSection {
  heading: string;
  content_points: string[];
  source_material?: string;
}

function generateBlogPostOutline(
  repoName: string,
  repoUrl: string,
  description: string,
  features: string[],
  angle: string,
  audience: string
): BlogPostOutline {
  const slug = repoName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  
  const outline: BlogPostOutline = {
    title: angle,
    slug,
    target_audience: audience,
    repo_source: repoUrl,
    sections: [
      {
        heading: "Introduction",
        content_points: [
          `What is ${repoName}?`,
          `Why ${audience} should care`,
          `The problem it solves`
        ]
      },
      {
        heading: "Key Features",
        content_points: features.slice(0, 4).map(f => `- ${f}`)
      },
      {
        heading: "How to Use It",
        content_points: [
          "Installation/setup",
          "Basic usage example",
          "Advanced tips"
        ]
      },
      {
        heading: "Real-World Applications",
        content_points: [
          `Use cases for ${audience}`,
          "Integration with existing workflows"
        ]
      },
      {
        heading: "Conclusion",
        content_points: [
          "Summary of benefits",
          "Next steps for readers"
        ]
      }
    ],
    key_takeaways: features.slice(0, 3),
    cta: `Check out ${repoName} at ${repoUrl} and let us know what you build!`,
    status: "draft",
    created_at: new Date().toISOString()
  };
  
  return outline;
}

function saveBlogPostOutline(outline: BlogPostOutline) {
  const outputDir = "content/blog/outlines";
  mkdirSync(outputDir, { recursive: true });
  
  const filePath = `${outputDir}/${outline.slug}.json`;
  writeFileSync(filePath, JSON.stringify(outline, null, 2));
  
  // Also generate a markdown template
  const mdTemplate = generateBlogMarkdownTemplate(outline);
  const mdPath = `${outputDir}/${outline.slug}.md`;
  writeFileSync(mdPath, mdTemplate);
  
  console.log(`  📝 Blog outline created:`);
  console.log(`     JSON: ${filePath}`);
  console.log(`     Markdown: ${mdPath}`);
  console.log(`     Title: "${outline.title}"`);
  console.log(`     Audience: ${outline.target_audience}`);
}

function generateBlogMarkdownTemplate(outline: BlogPostOutline): string {
  return `---
title: "${outline.title}"
slug: ${outline.slug}
audience: ${outline.target_audience}
status: draft
created_at: ${outline.created_at}
source_repo: ${outline.repo_source}
---

# ${outline.title}

${outline.sections.map(s => `
## ${s.heading}

${s.content_points.map(p => `- ${p}`).join("\n")}

[Write content here...]
`).join("\n")}

## Key Takeaways

${outline.key_takeaways.map(k => `- ${k}`).join("\n")}

---

${outline.cta}
`;
}

// ═════════════════════════════════════════════════════════════════════════════
// INTEGRATION 3: TWITTER THREAD GENERATION
// ═════════════════════════════════════════════════════════════════════════════

interface TwitterThread {
  hook: string;
  tweets: string[];
  repo: string;
  url: string;
  created_at: string;
}

function generateTwitterThread(
  repoName: string,
  repoUrl: string,
  description: string,
  features: string[],
  hook: string
): TwitterThread {
  const tweets: string[] = [];
  
  // Tweet 1: Hook
  tweets.push(`${hook}\n\nA thread 🧵👇`);
  
  // Tweet 2: What is it
  tweets.push(`${repoName}: ${description.slice(0, 200)}\n\nHere's what makes it interesting:`);
  
  // Tweet 3-5: Key features (one per tweet)
  for (const feature of features.slice(0, 3)) {
    tweets.push(`🔹 ${feature.slice(0, 240)}`);
  }
  
  // Tweet 6: How to get started
  tweets.push(`Want to try it?\n\nCheck it out here 👇\n${repoUrl}`);
  
  return {
    hook,
    tweets,
    repo: repoName,
    url: repoUrl,
    created_at: new Date().toISOString()
  };
}

function saveTwitterThread(thread: TwitterThread) {
  const outputDir = "content/twitter/threads";
  mkdirSync(outputDir, { recursive: true });
  
  const filePath = `${outputDir}/${thread.repo}-thread.json`;
  writeFileSync(filePath, JSON.stringify(thread, null, 2));
  
  // Also save as text for easy copy-paste
  const textPath = `${outputDir}/${thread.repo}-thread.txt`;
  const textContent = thread.tweets.map((t, i) => `Tweet ${i + 1}/${thread.tweets.length}:\n${t}\n\n---\n`).join("\n");
  writeFileSync(textPath, textContent);
  
  console.log(`  🐦 Twitter thread created:`);
  console.log(`     JSON: ${filePath}`);
  console.log(`     Text: ${textPath}`);
  console.log(`     ${thread.tweets.length} tweets`);
}

// ═════════════════════════════════════════════════════════════════════════════
// INTEGRATION 4: NEWSLETTER QUEUE
// ═════════════════════════════════════════════════════════════════════════════

interface NewsletterItem {
  section: string;
  headline: string;
  blurb: string;
  link: string;
  added_at: string;
  status: "queued" | "scheduled" | "sent";
}

function addToNewsletter(section: string, repoName: string, description: string, url: string) {
  const queuePath = "content/newsletter/queue.json";
  
  let queue: NewsletterItem[] = [];
  if (existsSync(queuePath)) {
    queue = JSON.parse(readFileSync(queuePath, "utf-8"));
  }
  
  const item: NewsletterItem = {
    section,
    headline: repoName,
    blurb: description.slice(0, 200),
    link: url,
    added_at: new Date().toISOString(),
    status: "queued"
  };
  
  queue.push(item);
  mkdirSync(path.dirname(queuePath), { recursive: true });
  writeFileSync(queuePath, JSON.stringify(queue, null, 2));
  
  console.log(`  📧 Added to newsletter queue:`);
  console.log(`     Section: ${section}`);
  console.log(`     Headline: ${repoName}`);
  console.log(`     Queue size: ${queue.length} items`);
}

// ═════════════════════════════════════════════════════════════════════════════
// INTEGRATION 5: SKILL EXTRACTION
// ═════════════════════════════════════════════════════════════════════════════

interface Skill {
  name: string;
  type: string;
  description: string;
  commands: string[];
  usage_examples: string[];
  install_instructions: string[];
  source_repo: string;
  tags: string[];
}

function extractSkill(
  skillName: string,
  repoUrl: string,
  repoType: string,
  description: string,
  commands: string[],
  usage: string[]
): Skill {
  return {
    name: skillName,
    type: repoType,
    description,
    commands: commands || [],
    usage_examples: usage || [],
    install_instructions: commands?.filter(c => c.includes("install") || c.includes("npm") || c.includes("curl")) || [],
    source_repo: repoUrl,
    tags: [repoType, "cli", "automation"]
  };
}

function saveSkill(skill: Skill) {
  const outputDir = "skills/external";
  mkdirSync(outputDir, { recursive: true });
  
  const filePath = `${outputDir}/${skill.name}.json`;
  writeFileSync(filePath, JSON.stringify(skill, null, 2));
  
  // Generate SKILL.md template
  const skillMd = generateSkillMarkdown(skill);
  const mdPath = `${outputDir}/${skill.name}.md`;
  writeFileSync(mdPath, skillMd);
  
  console.log(`  🎯 Skill extracted:`);
  console.log(`     JSON: ${filePath}`);
  console.log(`     Markdown: ${mdPath}`);
  console.log(`     Commands: ${skill.commands.length}`);
  console.log(`     Usage examples: ${skill.usage_examples.length}`);
}

function generateSkillMarkdown(skill: Skill): string {
  return `---
name: ${skill.name}
type: ${skill.type}
source: ${skill.source_repo}
tags: ${skill.tags.join(", ")}
---

# ${skill.name}

${skill.description}

## Installation

${skill.install_instructions.map(i => `\`\`\`bash\n${i}\n\`\`\``).join("\n\n")}

## Commands

${skill.commands.map(c => `- \`${c}\``).join("\n")}

## Usage Examples

${skill.usage_examples.map(u => `- ${u}`).join("\n")}

## Source

[${skill.source_repo}](${skill.source_repo})
`;
}

// ═════════════════════════════════════════════════════════════════════════════
// INTEGRATION 6: DOC UPDATES
// ═════════════════════════════════════════════════════════════════════════════

function updateDocs(docPath: string, repoName: string, repoUrl: string, content: string) {
  const fullPath = `docs/${docPath}`;
  mkdirSync(path.dirname(fullPath), { recursive: true });
  
  const docContent = `---
title: ${repoName}
source: ${repoUrl}
updated_at: ${new Date().toISOString()}
---

# ${repoName}

${content}
`;
  
  writeFileSync(fullPath, docContent);
  
  console.log(`  📚 Documentation updated:`);
  console.log(`     Path: ${fullPath}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═════════════════════════════════════════════════════════════════════════════

function loadRepoData(repoName: string) {
  // Load from the parsed repos file
  const reposPath = "/tmp/parsed-repos.json";
  if (!existsSync(reposPath)) {
    console.error("No parsed repos file found. Run repo-content-router first.");
    return null;
  }
  
  const repos = JSON.parse(readFileSync(reposPath, "utf-8"));
  return repos.find((r: any) => r.name === repoName || r.repo.includes(repoName));
}

function executeAction(action: Action, repoData: any) {
  switch (action.type) {
    case "api_track":
      const tracker = createAPITracker(repoData.name, repoData.url, action.sources);
      updateOurAPIDocs(tracker);
      break;
      
    case "blog_post":
      const outline = generateBlogPostOutline(
        repoData.name,
        repoData.url,
        repoData.description,
        repoData.key_features || [],
        action.angle,
        action.audience
      );
      saveBlogPostOutline(outline);
      break;
      
    case "twitter_thread":
      const thread = generateTwitterThread(
        repoData.name,
        repoData.url,
        repoData.description,
        repoData.key_features || [],
        action.hook
      );
      saveTwitterThread(thread);
      break;
      
    case "newsletter_item":
      addToNewsletter(action.section, repoData.name, repoData.description, repoData.url);
      break;
      
    case "add_to_docs":
      updateDocs(action.doc_path, repoData.name, repoData.url, repoData.content || repoData.description);
      break;
      
    case "skill_extract":
      const skill = extractSkill(
        action.skill_name,
        repoData.url,
        repoData.type,
        repoData.description,
        repoData.install_commands || [],
        repoData.usage_examples || []
      );
      saveSkill(skill);
      break;
      
    case "monitor":
      console.log(`  👁️  Monitor configured: ${action.check_interval}`);
      break;
  }
}

function main() {
  // Load decisions from the router
  const decisionsPath = process.argv[2];
  if (!decisionsPath) {
    console.log("Usage: tsx content-pipeline-integrations.ts <content-decisions.json>");
    process.exit(1);
  }
  
  const decisions: ContentDecision[] = JSON.parse(readFileSync(decisionsPath, "utf-8"));
  
  console.log("═".repeat(70));
  console.log("CONTENT PIPELINE INTEGRATIONS");
  console.log("═".repeat(70));
  console.log();
  
  for (const decision of decisions) {
    const repoName = decision.repo.split("/")[1];
    const repoData = loadRepoData(repoName);
    
    if (!repoData) {
      console.warn(`⚠️  No data found for ${repoName}`);
      continue;
    }
    
    console.log(`\n📦 ${repoName}`);
    console.log(`   Priority: ${decision.priority.toUpperCase()}`);
    console.log("   " + "-".repeat(50));
    
    for (const action of decision.actions) {
      executeAction(action, repoData);
    }
  }
  
  console.log();
  console.log("═".repeat(70));
  console.log("INTEGRATION COMPLETE");
  console.log("═".repeat(70));
  console.log();
  console.log("Next steps:");
  console.log("  1. Review generated blog outlines in content/blog/outlines/");
  console.log("  2. Copy twitter threads from content/twitter/threads/");
  console.log("  3. Check newsletter queue in content/newsletter/queue.json");
  console.log("  4. Review extracted skills in skills/external/");
  console.log("  5. Run monitor scripts in scripts/ for API tracking");
}

main();
