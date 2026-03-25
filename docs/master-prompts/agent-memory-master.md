---
name: agent-memory-master
description: "Master prompt for implementing agent memory systems - short-term, long-term, vector stores, session persistence"
---

# AGENT MEMORY SYSTEMS - MASTER

> Complete guide to implementing memory architectures for AI agents

---

## WHY MEMORY MATTERS

Without memory, every agent interaction starts from zero. With memory, agents accumulate knowledge across sessions.

```
Without Memory:
User: "Yesterday we worked on auth"
Agent: "I don't have context about that"

With Memory:
User: "Yesterday we worked on auth"  
Agent: "Right, we implemented JWT authentication..."
```

---

## MEMORY TIERS

### Tier 1: Context Window
Current conversation - lives in LLM context

```python
class ContextMemory:
    def __init__(self, max_tokens: int = 100000):
        self.max_tokens = max_tokens
        self.messages = []
    
    def add(self, message: dict):
        self.messages.append(message)
        
        # Trim if over limit
        while self.count_tokens() > self.max_tokens:
            self.messages.pop(0)
    
    def get_context(self) -> List[dict]:
        return self.messages
```

### Tier 2: Working Memory
Current task context - volatile

```python
class WorkingMemory:
    def __init__(self):
        self.data = {}
    
    def set(self, key: str, value: Any):
        self.data[key] = value
    
    def get(self, key: str) -> Any:
        return self.data.get(key)
    
    def clear(self):
        self.data = {}
    
    def merge(self, other: dict):
        self.data.update(other)
```

### Tier 3: Session Memory
Current session - persists until session ends

```python
class SessionMemory:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.created_at = datetime.now()
        self.data = {}
        self.access_count = 0
    
    def store(self, key: str, value: Any):
        self.data[key] = {
            "value": value,
            "created": datetime.now(),
            "accesses": 0
        }
    
    def retrieve(self, key: str) -> Any:
        if key in self.data:
            self.data[key]["accesses"] += 1
            self.access_count += 1
            return self.data[key]["value"]
        return None
    
    def list_keys(self) -> List[str]:
        return list(self.data.keys())
```

### Tier 4: Long-Term Memory
Persistent across sessions - vector store

```python
class LongTermMemory:
    def __init__(self, vector_store: VectorStore):
        self.vector_store = vector_store
    
    def add(self, content: str, metadata: dict = {}):
        embedding = self.embed(content)
        self.vector_store.add(
            embedding=embedding,
            content=content,
            metadata=metadata
        )
    
    def search(self, query: str, k: int = 5) -> List[MemoryItem]:
        query_embedding = self.embed(query)
        return self.vector_store.search(query_embedding, k=k)
    
    def search_by_time(self, query: str, since: datetime) -> List[MemoryItem]:
        results = self.search(query, k=20)
        return [r for r in results if r.metadata.get("created", datetime.min) > since]
```

---

## VECTOR STORE IMPLEMENTATIONS

### ChromaDB

```python
import chromadb

class ChromaMemory:
    def __init__(self, collection_name: str = "memory"):
        self.client = chromadb.Client()
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )
    
    def add(self, content: str, metadata: dict = {}):
        embedding = self.embed(content)
        self.collection.add(
            embeddings=[embedding],
            documents=[content],
            ids=[self.generate_id()]
        )
    
    def search(self, query: str, k: int = 5) -> List[dict]:
        query_embedding = self.embed(query)
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=k
        )
        return results
```

### Pinecone

```python
from pinecone import Pinecone

class PineconeMemory:
    def __init__(self, index_name: str):
        self.pc = Pinecone()
        self.index = self.pc.Index(index_name)
    
    def add(self, content: str, metadata: dict = {}):
        embedding = self.embed(content)
        self.index.upsert([{
            "id": self.generate_id(),
            "values": embedding,
            "metadata": metadata
        }])
    
    def search(self, query: str, k: int = 5) -> List[dict]:
        query_embedding = self.embed(query)
        results = self.index.query(
            vector=query_embedding,
            top_k=k,
            include_metadata=True
        )
        return results["matches"]
```

---

## AGENT MEMORY MCP SERVER

### Setup

```bash
git clone https://github.com/webzler/agentMemory.git .agent/skills/agent-memory
cd .agent/skills/agent-memory
npm install
npm run compile
npm run start-server my-project $(pwd)
```

### Tools

| Tool | Description |
|:-----|:------------|
| `memory_search` | Search by query, type, or tags |
| `memory_write` | Record new knowledge/decisions |
| `memory_read` | Retrieve by key |
| `memory_stats` | View analytics |

### Usage

```python
# Search memory
memory_search({
    query: "authentication patterns",
    type: "pattern"
})

# Write memory
memory_write({
    key: "auth-v1",
    type: "decision", 
    content: "Chose JWT over sessions for stateless auth",
    tags: ["auth", "security", "architecture"]
})

# Read memory
memory_read({
    key: "auth-v1"
})
```

---

## COMPRESSION STRATEGIES

### Summarization

```python
class Summarizer:
    def __init__(self, llm):
        self.llm = llm
    
    def summarize(self, messages: List[dict]) -> str:
        prompt = f"""Summarize these conversation messages concisely:
        
{messages}
        
Keep key decisions, important context, and any unfinished tasks."""
        
        return self.llm.complete(prompt)
```

### Extraction

```python
class EntityExtractor:
    def extract(self, messages: List[dict]) -> dict:
        entities = {
            "people": [],
            "projects": [],
            "files": [],
            "decisions": []
        }
        
        for msg in messages:
            entities["people"].extend(self.find_people(msg))
            entities["files"].extend(self.find_files(msg))
            entities["decisions"].extend(self.find_decisions(msg))
        
        return entities
```

---

## RECENCY WEIGHTING

```python
class RecencyWeightedSearch:
    def __init__(self, memory: LongTermMemory):
        self.memory = memory
    
    def search(self, query: str, k: int = 5) -> List[MemoryItem]:
        # Get more results than needed
        results = self.memory.search(query, k=k * 3)
        
        # Score by recency
        now = datetime.now()
        scored = []
        for r in results:
            age = (now - r.metadata["created"]).total_seconds()
            recency_score = 1 / (1 + age / 86400)  # Decay over days
            relevance = r.score
            
            combined = (recency_score * 0.3) + (relevance * 0.7)
            scored.append((combined, r))
        
        # Return top k
        scored.sort(reverse=True)
        return [r for _, r in scored[:k]]
```

---

## MEMORY ARCHITECTURE PATTERNS

### Hierarchical Memory

```python
class HierarchicalAgentMemory:
    def __init__(self):
        self.context = ContextMemory()      # Current conversation
        self.working = WorkingMemory()         # Current task
        self.session = SessionMemory()        # This session
        self.long_term = LongTermMemory()    # All sessions
    
    def store(self, content: str, tier: str = "session", **metadata):
        if tier == "context":
            self.context.add({"role": "user", "content": content})
        elif tier == "working":
            self.working.set(metadata.get("key", "default"), content)
        elif tier == "session":
            self.session.store(metadata.get("key", "default"), content)
        elif tier == "long_term":
            self.long_term.add(content, metadata)
    
    def retrieve(self, query: str, tiers: List[str] = None) -> List[Any]:
        tiers = tiers or ["working", "session", "long_term"]
        results = []
        
        if "working" in tiers:
            results.extend(self.working.data.values())
        
        if "session" in tiers:
            results.extend(self.session.list_keys())
        
        if "long_term" in tiers:
            results.extend(self.long_term.search(query))
        
        return results
```

---

## BEST PRACTICES

### 1. Tier Appropriately
| Data Type | Tier |
|:----------|:-----|
| Current message | Context |
| Current task vars | Working |
| Session history | Session |
| Learned knowledge | Long-term |

### 2. Implement Compression
- Summarize old conversations
- Extract entities and decisions
- Prune redundant entries

### 3. Add Recency Bias
- Recent memories should rank higher
- Time-decay scoring

### 4. Enable Forgetting
- Set memory TTLs
- Archive old sessions
- Clear sensitive data

### 5. Support Search
- Vector similarity search
- Time-based queries
- Tag/category filtering

---

## MONITORING

```python
class MemoryStats:
    def __init__(self, memory: HierarchicalAgentMemory):
        self.memory = memory
    
    def get_stats(self) -> dict:
        return {
            "context_size": len(self.memory.context.messages),
            "working_keys": len(self.memory.working.data),
            "session_entries": len(self.memory.session.data),
            "long_term_count": self.memory.long_term.count(),
            "total_tokens": self.memory.context.count_tokens()
        }
```
