import "dotenv/config";

/**
 * Poll GitHub for repos starred by the authenticated user; diff vs local state;
 * optionally POST new stars / list changes to STARWEBHOOK_URL (e.g. Hermes ingress).
 *
 * Also tracks star list membership via GraphQL — fires a webhook when a repo
 * is added to (or removed from) any of your GitHub star lists (topic lists).
 *
 * Webhook payloads include `hermes.coding_delegate` (default Metatron) so the receiver
 * can route coding work. Set STARWEBHOOK_ROUTING_AGENT / STARWEBHOOK_HERMES_* in `.env`.
 *
 * Usage:
 *   export GITHUB_TOKEN=ghp_...
 *   export STARWEBHOOK_URL=https://hermes.example.com/hooks/gitgod-stars
 *   export STARWEBHOOK_SECRET=...   # optional Bearer for POST
 *   npx tsx scripts/poll-github-starred.ts
 *
 * First run (no state file): saves baseline, prints count, does not POST.
 * Later runs: POSTs only newly starred repos + list changes, then updates state.
 *
 * Cron / “RSS”: GitHub does not push list changes to your URL. Schedule this script
 * (e.g. every 10–15 min via scripts/starred-poll-cron.sh) so each run diffs against
 * STARRED_STATE_FILE — same idea as polling an RSS feed for new items.
 *
 * Flags:
 *   --dry-run   print actions, do not POST or write state
 *   --init      ignore existing state; re-baseline (no POSTs on that run)
 *   --verbose   print GitHub login + API vs state repo counts (debug account mismatch)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const API = "https://api.github.com";
const GRAPHQL = `${API}/graphql`;
const DEFAULT_STATE = path.join("data", "github-starred-state.json");
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StarRow {
  starred_at: string;
  repo: {
    full_name: string;
    html_url: string;
    private?: boolean;
    description: string | null;
  };
}

/** Maps list slug → sorted array of repo full_names */
type ListState = Record<string, string[]>;

interface StateFile {
  repos: string[];
  lists?: ListState;
}

interface ListChange {
  list: string;
  slug: string;
  added: string[];
  removed: string[];
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(): { dryRun: boolean; init: boolean; verbose: boolean } {
  const argv = process.argv.slice(2);
  return {
    dryRun: argv.includes("--dry-run"),
    init: argv.includes("--init"),
    verbose: argv.includes("--verbose"),
  };
}

// ---------------------------------------------------------------------------
// REST helpers
// ---------------------------------------------------------------------------

async function fetchViewerLogin(token: string): Promise<string> {
  const res = await fetch(`${API}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    return "(could not fetch /user)";
  }
  const u = (await res.json()) as { login?: string };
  return u.login ?? "(unknown)";
}

async function fetchAllStarred(token: string): Promise<StarRow[]> {
  const out: StarRow[] = [];
  let page = 1;
  const perPage = 100;

  for (;;) {
    const url = `${API}/user/starred?per_page=${perPage}&page=${page}&sort=created&direction=desc`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.star+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (res.status === 401 || res.status === 403) {
      const t = await res.text();
      throw new Error(`GitHub ${res.status}: ${t.slice(0, 200)}`);
    }
    if (!res.ok) {
      throw new Error(`GitHub ${res.status}: ${await res.text()}`);
    }

    const batch = (await res.json()) as StarRow[];
    if (!batch.length) break;
    out.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }

  return out;
}

// ---------------------------------------------------------------------------
// GraphQL: fetch star lists + their members
// ---------------------------------------------------------------------------

interface GqlListNode {
  name: string;
  slug: string;
  items: {
    totalCount: number;
    nodes: Array<{ __typename: string; nameWithOwner?: string }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

async function fetchStarLists(token: string): Promise<Map<string, { name: string; repos: string[] }>> {
  const lists = new Map<string, { name: string; repos: string[] }>();

  // First pass: get all lists with first 100 items each
  const query = `{
    viewer {
      lists(first: 20) {
        nodes {
          name
          slug
          items(first: 100) {
            totalCount
            nodes {
              __typename
              ... on Repository { nameWithOwner }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }
  }`;

  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    console.error(`GraphQL ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return lists;
  }

  const data = (await res.json()) as { data?: { viewer?: { lists?: { nodes?: GqlListNode[] } } }; errors?: unknown[] };
  if (data.errors) {
    console.error("GraphQL errors:", JSON.stringify(data.errors).slice(0, 300));
  }

  const nodes = data.data?.viewer?.lists?.nodes ?? [];

  for (const node of nodes) {
    const repos: string[] = [];
    for (const item of node.items.nodes) {
      if (item.__typename === "Repository" && item.nameWithOwner) {
        repos.push(item.nameWithOwner);
      }
    }

    // Paginate if list has >100 items
    let pageInfo = node.items.pageInfo;
    while (pageInfo.hasNextPage && pageInfo.endCursor) {
      const pageQuery = `{
        viewer {
          lists(first: 20) {
            nodes {
              slug
              items(first: 100, after: "${pageInfo.endCursor}") {
                nodes {
                  __typename
                  ... on Repository { nameWithOwner }
                }
                pageInfo { hasNextPage endCursor }
              }
            }
          }
        }
      }`;

      const pageRes = await fetch(GRAPHQL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: pageQuery }),
      });

      if (!pageRes.ok) break;
      const pageData = (await pageRes.json()) as { data?: { viewer?: { lists?: { nodes?: GqlListNode[] } } } };
      const match = pageData.data?.viewer?.lists?.nodes?.find((n) => n.slug === node.slug);
      if (!match) break;

      for (const item of match.items.nodes) {
        if (item.__typename === "Repository" && item.nameWithOwner) {
          repos.push(item.nameWithOwner);
        }
      }
      pageInfo = match.items.pageInfo;
    }

    repos.sort();
    lists.set(node.slug, { name: node.name, repos });
  }

  return lists;
}

// ---------------------------------------------------------------------------
// Diff star lists
// ---------------------------------------------------------------------------

function diffLists(
  previous: ListState,
  current: Map<string, { name: string; repos: string[] }>
): ListChange[] {
  const changes: ListChange[] = [];

  for (const [slug, { name, repos }] of current) {
    const prev = new Set(previous[slug] ?? []);
    const curr = new Set(repos);

    const added = repos.filter((r) => !prev.has(r));
    const removed = (previous[slug] ?? []).filter((r) => !curr.has(r));

    if (added.length > 0 || removed.length > 0) {
      changes.push({ list: name, slug, added, removed });
    }
  }

  // Check for lists that were deleted
  for (const slug of Object.keys(previous)) {
    if (!current.has(slug)) {
      changes.push({
        list: slug,
        slug,
        added: [],
        removed: previous[slug],
      });
    }
  }

  return changes;
}

// ---------------------------------------------------------------------------
// State management
// ---------------------------------------------------------------------------

function loadState(file: string): { repos: Set<string>; lists: ListState } | null {
  if (!existsSync(file)) return null;
  try {
    const raw = readFileSync(file, "utf-8");
    const parsed = JSON.parse(raw) as StateFile;
    return {
      repos: new Set(parsed.repos ?? []),
      lists: parsed.lists ?? {},
    };
  } catch {
    return null;
  }
}

function saveState(
  file: string,
  repos: Set<string>,
  lists: Map<string, { name: string; repos: string[] }>,
  dryRun: boolean
): void {
  if (dryRun) return;
  const dir = path.dirname(file);
  mkdirSync(dir, { recursive: true });

  const listState: ListState = {};
  for (const [slug, { repos: r }] of lists) {
    listState[slug] = [...r].sort();
  }

  const state: StateFile = {
    repos: [...repos].sort(),
    lists: listState,
  };
  writeFileSync(file, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

// ---------------------------------------------------------------------------
// Webhooks + Telegram
// ---------------------------------------------------------------------------

type StarWebhookEvent = "repository_starred" | "list_item_added" | "list_item_removed";

/** Merge GitGod + Hermes routing fields for STARWEBHOOK_URL consumers (Nous Hermes → Metatron, etc.). */
function enrichStarWebhookPayload(
  event: StarWebhookEvent,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const codingDelegate =
    process.env.STARWEBHOOK_ROUTING_AGENT?.trim() || "metatron";
  const hermesBase = process.env.STARWEBHOOK_HERMES_BASE_URL?.trim();
  const hermesInstruction = process.env.STARWEBHOOK_HERMES_INSTRUCTION?.trim();
  const codingOnStar =
    process.env.STARWEBHOOK_CODING_HANDOFF_ON_STAR?.trim() === "1";

  const topicFlow = event === "list_item_added";
  const codingHandoff = topicFlow || codingOnStar;

  return {
    ...payload,
    source: "gitgod",
    gitgod: {
      script: "poll-github-starred",
      event,
    },
    hermes: {
      coding_delegate: codingDelegate,
      ...(hermesBase ? { instance_base_url: hermesBase } : {}),
      ...(hermesInstruction ? { instruction: hermesInstruction } : {}),
    },
    ingest: {
      expected_local_ingest: event !== "list_item_removed",
      coding_handoff: codingHandoff,
      topic_assignment: topicFlow,
    },
  };
}

async function postWebhook(
  url: string,
  payload: Record<string, unknown>,
  webhookSecret?: string
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "gitgod-starred-poll/1.0",
  };
  if (webhookSecret) {
    headers.Authorization = `Bearer ${webhookSecret}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Webhook ${res.status}: ${t.slice(0, 300)}`);
  }
}

async function sendTelegram(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }
    );
    if (!res.ok) {
      const t = await res.text();
      console.error(`Telegram ${res.status}: ${t.slice(0, 200)}`);
    }
  } catch (e) {
    console.error(`Telegram error: ${e instanceof Error ? e.message : e}`);
  }
}

function formatStarMessage(fullName: string, description: string | null, isListAdd?: string): string {
  const url = `https://github.com/${fullName}`;
  const desc = description ? `\n_${description.slice(0, 120)}_` : "";
  if (isListAdd) {
    return `\u2B50 *List add:* [${fullName}](${url}) \u2192 *${isListAdd}*${desc}\n\n\u2699\uFE0F Ingesting into gitgod pipeline...`;
  }
  return `\u2B50 *New star:* [${fullName}](${url})${desc}\n\n\u2699\uFE0F Ingesting into gitgod pipeline...`;
}

// ---------------------------------------------------------------------------
// Auto-ingest: spawn `gitgod ingest <url> --analyze` in background (LLM writes data/<slug>/repo-analyzer.md when keys are set)
// ---------------------------------------------------------------------------

const INGEST_QUEUE = path.join("data", "ingest-queue.json");
const INGEST_LOG = path.join("data", "ingest-runs.log");

interface IngestQueue {
  /** repo full_names currently being ingested or already done */
  active: string[];
  done: string[];
}

function loadIngestQueue(): IngestQueue {
  if (!existsSync(INGEST_QUEUE)) return { active: [], done: [] };
  try {
    return JSON.parse(readFileSync(INGEST_QUEUE, "utf-8")) as IngestQueue;
  } catch {
    return { active: [], done: [] };
  }
}

function saveIngestQueue(q: IngestQueue): void {
  mkdirSync(path.dirname(INGEST_QUEUE), { recursive: true });
  writeFileSync(INGEST_QUEUE, JSON.stringify(q, null, 2) + "\n", "utf-8");
}

function logIngest(msg: string): void {
  mkdirSync(path.dirname(INGEST_LOG), { recursive: true });
  appendFileSync(INGEST_LOG, `[${new Date().toISOString()}] ${msg}\n`, "utf-8");
}

function slugFromFullName(fullName: string): string {
  return fullName.replace("/", "-");
}

function cleanupIngestQueue(): void {
  const queue = loadIngestQueue();
  const stillActive: string[] = [];
  for (const repo of queue.active) {
    const kgPath = path.join("data", slugFromFullName(repo), "knowledge-graph.json");
    if (existsSync(kgPath)) {
      queue.done.push(repo);
      logIngest(`CLEANUP ${repo} (found knowledge-graph.json, moved to done)`);
    } else {
      stillActive.push(repo);
    }
  }
  queue.active = stillActive;
  saveIngestQueue(queue);
}

function spawnIngest(fullName: string, listName?: string): void {
  cleanupIngestQueue();
  const queue = loadIngestQueue();
  const all = new Set([...queue.active, ...queue.done]);
  if (all.has(fullName)) {
    console.log(`    skip ingest (already queued/done): ${fullName}`);
    return;
  }

  queue.active.push(fullName);
  saveIngestQueue(queue);

  const url = `https://github.com/${fullName}`;
  const tag = listName ? `[${listName}] ` : "";
  console.log(`    ${tag}spawning ingest: ${fullName}`);
  logIngest(`START ${fullName}${listName ? ` (list: ${listName})` : ""}`);

  const projectDir = path.resolve(import.meta.dirname ?? __dirname, "..");
  const tsx = path.join(projectDir, "node_modules", ".bin", "tsx");
  const cli = path.join(projectDir, "src", "cli.ts");

  const child = spawn(tsx, [cli, "ingest", url, "-d", "data", "--analyze"], {
    cwd: projectDir,
    stdio: "ignore",
    detached: true,
    env: { ...process.env },
  });

  child.unref();

  child.on("exit", (code) => {
    const q = loadIngestQueue();
    q.active = q.active.filter((r) => r !== fullName);
    if (code === 0) {
      q.done.push(fullName);
      logIngest(`DONE ${fullName} (exit 0)`);
    } else {
      logIngest(`FAIL ${fullName} (exit ${code})`);
    }
    saveIngestQueue(q);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { dryRun, init, verbose } = parseArgs();
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    console.error("Missing GITHUB_TOKEN");
    process.exit(1);
  }

  const stateFile = process.env.STARRED_STATE_FILE?.trim() || DEFAULT_STATE;
  const webhook = process.env.STARWEBHOOK_URL?.trim();
  const webhookSecret = process.env.STARWEBHOOK_SECRET?.trim();

  // Fetch repos (REST) and lists (GraphQL) in parallel
  const [rows, currentLists] = await Promise.all([
    fetchAllStarred(token),
    fetchStarLists(token),
  ]);

  const currentRepos = new Set(rows.map((r) => r.repo.full_name));

  if (verbose) {
    const login = await fetchViewerLogin(token);
    const state = loadState(stateFile);
    const stateN = state?.repos.size ?? 0;
    const listSummary = [...currentLists.entries()]
      .map(([slug, { repos }]) => `${slug}(${repos.length})`)
      .join(", ");
    console.log(
      `verbose: user=${login} | repos=${currentRepos.size} | state=${stateN} | lists: ${listSummary}`
    );
  }

  // --init: save baseline, no webhooks
  if (init) {
    const listSummary = [...currentLists.entries()]
      .map(([slug, { repos }]) => `${slug}(${repos.length})`)
      .join(", ");
    console.log(
      `Re-baseline: ${currentRepos.size} repo(s), ${currentLists.size} list(s) [${listSummary}] → ${stateFile}`
    );
    saveState(stateFile, currentRepos, currentLists, dryRun);
    process.exit(0);
  }

  const previous = loadState(stateFile);
  const firstRun = previous === null;

  if (firstRun) {
    const listSummary = [...currentLists.entries()]
      .map(([slug, { repos }]) => `${slug}(${repos.length})`)
      .join(", ");
    console.log(
      `Baseline: ${currentRepos.size} repo(s), ${currentLists.size} list(s) [${listSummary}] → ${stateFile}`
    );
    saveState(stateFile, currentRepos, currentLists, dryRun);
    process.exit(0);
  }

  let anyChanges = false;

  // --- Diff repos ---
  const newStars = rows.filter((r) => !previous!.repos.has(r.repo.full_name));

  if (newStars.length > 0) {
    anyChanges = true;
    console.log(`New star(s): ${newStars.length}`);

    for (const row of newStars) {
      const name = row.repo.full_name;
      const payload = enrichStarWebhookPayload("repository_starred", {
        event: "repository_starred",
        starred_at: row.starred_at,
        full_name: row.repo.full_name,
        html_url: row.repo.html_url,
        private: row.repo.private ?? false,
        description: row.repo.description,
      });

      if (dryRun) {
        console.log(`  [dry-run] would notify + ingest: ${name}`);
      } else {
        if (webhook) {
          await postWebhook(webhook, payload, webhookSecret);
          console.log(`  posted: ${name}`);
        } else {
          console.log(`  new: ${name}`);
        }
        await sendTelegram(formatStarMessage(name, row.repo.description));
        if (!row.repo.private) {
          spawnIngest(name);
        }
      }
    }
  }

  // --- Diff lists ---
  const listChanges = diffLists(previous!.lists, currentLists);

  if (listChanges.length > 0) {
    anyChanges = true;
    console.log(`List change(s): ${listChanges.length} list(s) modified`);

    for (const change of listChanges) {
      if (change.added.length > 0) {
        console.log(`  [${change.list}] +${change.added.length} added:`);
        for (const repo of change.added) {
          const payload = enrichStarWebhookPayload("list_item_added", {
            event: "list_item_added",
            list_name: change.list,
            list_slug: change.slug,
            full_name: repo,
            html_url: `https://github.com/${repo}`,
          });

          if (dryRun) {
            console.log(`    [dry-run] would notify + ingest: ${repo} → ${change.list}`);
          } else {
            if (webhook) {
              await postWebhook(webhook, payload, webhookSecret);
              console.log(`    posted: ${repo} → ${change.list}`);
            } else {
              console.log(`    + ${repo}`);
            }
            await sendTelegram(formatStarMessage(repo, null, change.list));
            spawnIngest(repo, change.list);
          }
        }
      }

      if (change.removed.length > 0) {
        console.log(`  [${change.list}] -${change.removed.length} removed:`);
        for (const repo of change.removed) {
          const payload = enrichStarWebhookPayload("list_item_removed", {
            event: "list_item_removed",
            list_name: change.list,
            list_slug: change.slug,
            full_name: repo,
          });

          if (dryRun) {
            console.log(`    [dry-run] would notify removal: ${repo} ← ${change.list}`);
          } else if (webhook) {
            await postWebhook(webhook, payload, webhookSecret);
            console.log(`    posted removal: ${repo} ← ${change.list}`);
          } else {
            console.log(`    - ${repo}`);
          }
        }
      }
    }
  }

  if (!anyChanges) {
    console.log("No new stars or list changes since last run.");
  }

  saveState(stateFile, currentRepos, currentLists, dryRun);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
