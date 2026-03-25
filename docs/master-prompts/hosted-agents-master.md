---
name: hosted-agents-master
description: "Master prompt for building hosted/remote agent infrastructure, sandboxed environments, and background agents"
---

# HOSTED AGENTS - MASTER

> Complete guide to building hosted agent infrastructure, sandboxed environments, and remote agent execution

---

## CORE CONCEPT

Hosted agents run in remote sandboxed environments rather than on local machines. They provide:

- ✅ **Unlimited concurrency** - Scale beyond local resources
- ✅ **Reproducible environments** - Consistent execution every time
- ✅ **Multiplayer collaboration** - Shared state, multiple users
- ✅ **Persistent sessions** - Resume anytime

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  Client  │────▶│  API Layer   │────▶│  Sandbox    │
│ (Slack,  │     │ (State Mgmt) │     │ (Isolated) │
│  Web,    │     │              │     │             │
│  IDE)    │     └──────────────┘     └─────────────┘
└──────────┘            │                     │
                        ▼                     ▼
                  ┌──────────────┐     ┌─────────────┐
                  │ Agent Logic  │     │  Session    │
                  │ (Server)    │     │  Manager    │
                  └──────────────┘     └─────────────┘
```

---

## ARCHITECTURE LAYERS

### 1. Sandbox Infrastructure
Isolated execution environment for agent workloads

### 2. API Layer  
State management and client coordination

### 3. Client Interfaces
User interaction across platforms (Slack, Web, IDE)

---

## SANDBOX PATTERNS

### Image Registry Pattern

Pre-build environment images on a regular cadence (every 30 minutes):

```
Image contains:
├── Cloned repository at known commit
├── All runtime dependencies installed
├── Initial setup completed
└── Cached files from app/test runs
```

```yaml
# Image build schedule
schedule: "*/30 * * * *"  # Every 30 minutes
base_image: "ubuntu:22.04"
preinstall:
  - npm install
  - npm run build
```

### Snapshot and Restore

Take snapshots at key points:

| Snapshot | When | Use Case |
|:---------|:-----|:---------|
| Base | After image build | Fresh start |
| Session | After agent changes | Restore for follow-up |
| Pre-exit | Before sandbox closes | Resume later |

```python
class SnapshotManager:
    def take_snapshot(self, session_id: str, name: str):
        """Take filesystem snapshot"""
        snapshot = self.snapshotter.create(
            source=self.sessions[session_id].filesystem,
            tags={"session": session_id, "name": name}
        )
        return snapshot.id
    
    def restore_snapshot(self, snapshot_id: str):
        """Restore from snapshot"""
        self.snapshotter.restore(snapshot_id)
```

### Warm Pool Strategy

Maintain pre-warmed sandboxes:

```
User starts typing ──▶ Start warming sandbox (predictive)
                         │
                         ▼
                   ┌─────────────┐
                   │ Clone repo  │
                   │ Install deps│
                   │ Build cache │
                   └─────────────┘
                         │
                         ▼
                   Sandbox ready before user hits enter!
```

```python
class WarmPool:
    def __init__(self, max_size: int = 5):
        self.pool = asyncio.Queue(max_size)
        self.warming = set()
    
    async def get_or_warm(self, repo_id: str) -> Sandbox:
        # Try to get from pool
        try:
            return self.pool.get_nowait()
        except asyncio.QueueEmpty:
            # Start warming if not already
            if repo_id not in self.warming:
                asyncio.create_task(self.warm(repo_id))
            # Wait for warming
            return await self._wait_for_warm(repo_id)
```

---

## AGENT FRAMEWORK SELECTION

### Server-First Architecture

Choose frameworks structured as a server first:

| Feature | Why It Matters |
|:--------|:---------------|
| Multiple clients | Don't duplicate agent logic |
| Consistent behavior | Same everywhere |
| Plugin system | Extend functionality |
| Event-driven | Real-time updates |

### Code as Source of Truth

The agent should be able to read its own source code to understand its behavior. This prevents hallucination about capabilities.

### Plugin System Requirements

```python
class Plugin:
    async def on_tool_execute(self, tool: Tool, args: dict):
        """Called before tool execution"""
        pass
    
    async def on_tool_result(self, tool: Tool, result: Any):
        """Called after tool execution"""
        pass
    
    def can_block(self) -> bool:
        return False
    
    async def should_block(self, tool: Tool, args: dict) -> bool:
        return False
```

---

## SPEED OPTIMIZATIONS

### Predictive Warm-Up

```python
class PredictiveWarmer:
    async def on_user_typing(self, user_id: str, repo_id: str):
        # Start warming BEFORE they hit enter
        asyncio.create_task(self.warm_sandbox(repo_id))
        
        # By the time they hit enter, sandbox might be ready!
```

### Parallel File Reading

```
Traditional: Wait for sync ──▶ Read files

Optimized: 
  ┌──────────────┐
  │ Read files   │ ──▶ Start immediately
  │ (old commit) │
  └──────────────┘
         │
         ▼
  ┌──────────────┐
  │ Sync latest  │ ──▶ Background
  └──────────────┘
         │
         ▼
  Block edits until sync complete
```

### Maximize Build-Time Work

Move to image build:
- ✅ Full dependency installation
- ✅ Database schema setup  
- ✅ App/test suite runs (cache warming)
- ✅ Static asset compilation

---

## GIT CONFIGURATION FOR HOSTED AGENTS

### Token-Based Auth

```python
class GitConfig:
    def configure_for_session(self, session: Session, user: User):
        # Generate GitHub app token for this session
        token = self.token_generator.create(
            installation_id=session.installation_id,
            permissions={"contents": "write"}
        )
        
        # Configure git
        self.exec("git config user.name", user.name)
        self.exec("git config user.email", user.email)
        self.exec("git config credential.helper", f'!echo password={token}')
```

### Commits by User Identity

```python
# The prompting user's identity, NOT the app identity
commit = {
    "author": {
        "name": user.name,  # User's name
        "email": user.email  # User's email
    },
    "message": f"[Agent] {task_description}"
}
```

---

## SESSION MANAGEMENT

### Session Lifecycle

```
┌─────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐
│ Create  │───▶│ Warmup   │───▶│ Active  │───▶│ Snapshot │
│ Session │    │ Sandbox  │    │ (work)  │    │ & Store  │
└─────────┘    └──────────┘    └─────────┘    └──────────┘
                                              │
                                              ▼
                                        ┌──────────┐
                                        │  Resume  │ (later)
                                        └──────────┘
```

### State Persistence

```python
class SessionState:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.filesystem = FilesystemSnapshot()
        self.environment = EnvironmentVars()
        self.context = ContextWindow()
        self.memory = VectorStore()
    
    def snapshot(self) -> SessionSnapshot:
        return SessionSnapshot(
            session_id=self.session_id,
            filesystem=self.filesystem.capture(),
            environment=self.environment.dump(),
            context=self.context.serialize(),
            memory=self.memory.persist()
        )
    
    def restore(self, snapshot: SessionSnapshot):
        self.filesystem.restore(snapshot.filesystem)
        self.environment.load(snapshot.environment)
        self.context.restore(snapshot.context)
        self.memory.load(snapshot.memory)
```

---

## MULTI-PLAYER COLLABORATION

### Shared State

```python
class SharedState:
    def __init__(self):
        self.sessions = {}  # session_id -> state
        self.watches = {}    # file_path -> [session_ids]
    
    async def broadcast(self, event: str, data: dict):
        """Broadcast to all watching sessions"""
        for session_id in self.watches.get(event, []):
            await self.sessions[session_id].notify(event, data)
    
    def watch_file(self, session_id: str, file_path: str):
        if file_path not in self.watches:
            self.watches[file_path] = []
        self.watches[file_path].append(session_id)
```

### Presence

```python
class Presence:
    async def user_joined(self, user: User, session_id: str):
        # Notify other users
        await self.broadcast("presence", {
            "type": "join",
            "user": user.name,
            "session": session_id
        })
        
        # Show in UI
        await self.ui.show_avatar(user, session_id)
```

---

## SECURITY

### Sandbox Isolation

| Layer | Isolation |
|:------|:----------|
| Filesystem | Separate root, no host access |
| Network | Isolated VPC, rate limits |
| Compute | Ephemeral, no persistent state |
| Secrets | Injected at runtime, not stored |

### Secrets Management

```python
class SecretsManager:
    def inject_for_session(self, session: Session) -> dict:
        # Get secrets for this session's repos
        secrets = {}
        for repo in session.repos:
            secrets.update(self.vault.get(repo))
        
        # Inject as environment variables
        return {
            "env": secrets,
            "files": self.write_temp_secrets(secrets)
        }
```

---

## PROVIDERS

| Provider | Best For |
|:---------|:---------|
| **Modal** | Serverless, pay-per-use |
| **Railway** | Full VMs, easy deployment |
| **Fly.io** | Global edge, fast |
| **HuggingFace Spaces** | Free, ML workloads |
| **CodeSandbox** | Quick prototypes |
| **Gitpod** | GitHub integration |

---

## BEST PRACTICES

1. **Pre-build images** - Don't build from scratch on each session
2. **Use snapshots** - Enable instant resume
3. **Warm pools** - Have sandboxes ready before users need them
4. **Predictive warming** - Start warming as user types
5. **Cache everything** - npm cache, build cache, test results
6. **User identity** - Commit with user's identity, not app's
7. **Isolate everything** - No cross-session state leakage
8. **Monitor costs** - Track per-session resource usage
