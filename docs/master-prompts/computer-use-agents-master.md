---
name: computer-use-agents-master
description: "Master prompt for building AI agents that interact with computers like humans - screen viewing, cursor control, clicking, typing"
---

# COMPUTER USE AGENTS - MASTER

> Complete guide to building AI agents that interact with computers like humans do

---

## CORE ARCHITECTURE

### Perception-Reasoning-Action Loop

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Perception │───▶│  Reasoning  │───▶│   Action    │
│ (screenshot)│    │ (analyze)   │    │ (click/type)│
└─────────────┘    └─────────────┘    └─────────────┘
       ▲                                      │
       └──────────────────────────────────────┘
              (observe result & iterate)
```

### Implementation

```python
class ComputerUseAgent:
    def __init__(self, client, model: str = "claude-sonnet-4-20250514"):
        self.client = client
        self.model = model
        self.max_steps = 50
        self.action_delay = 0.5
    
    def capture_screenshot(self) -> str:
        """Capture screen and return base64 encoded image."""
        screenshot = pyautogui.screenshot()
        # Resize for token efficiency (1280x800 is good balance)
        screenshot = screenshot.resize((1280, 800), Image.LANCZOS)
        
        buffer = io.BytesIO()
        screenshot.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()
    
    async def execute(self, task: str) -> str:
        for step in range(self.max_steps):
            # Perception: Capture screen
            screenshot = self.capture_screenshot()
            
            # Reasoning: Analyze screenshot + task
            action = await self.reason(screenshot, task)
            
            # Action: Execute
            result = self.execute_action(action)
            
            # Observe: Check result
            if self.is_complete(task, result):
                return "Task complete"
            
            await asyncio.sleep(self.action_delay)
        
        return "Max iterations reached"
    
    def execute_action(self, action: dict) -> dict:
        action_type = action.get("type")
        
        if action_type == "click":
            x, y = action["x"], action["y"]
            button = action.get("button", "left")
            pyautogui.click(x, y, button=button)
            return {"success": True, "action": f"clicked at ({x}, {y})"}
        
        elif action_type == "type":
            text = action["text"]
            pyautogui.typewrite(text, interval=0.02)
            return {"success": True, "action": f"typed {len(text)} chars"}
        
        elif action_type == "key":
            key = action["key"]
            pyautogui.press(key)
            return {"success": True, "action": f"pressed {key}"}
        
        elif action_type == "scroll":
            direction = action.get("direction", "down")
            amount = action.get("amount", 3)
            scroll = -amount if direction == "down" else amount
            pyautogui.scroll(scroll)
            return {"success": True, "action": f"scrolled {direction}"}
        
        elif action_type == "wait":
            time.sleep(action.get("seconds", 1))
            return {"success": True, "action": f"waited {action.get('seconds')}s"}
        
        return {"success": False, "error": "Unknown action type"}
```

---

## PROVIDERS

### Anthropic Computer Use

```python
from anthropic import Anthropic

client = Anthropic()

# Use with messages API
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": task}],
    tools=[{
        "name": "computer",
        "description": "Use the computer tool to interact with the screen",
        "input_schema": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "enum": ["click", "type", "key", "scroll"]},
                        # ... other params
                    }
                }
            }
        }
    }]
)
```

### OpenAI Operator/CUA

```python
from openai import OpenAI

client = OpenAI()

# Use with computer use capability
response = client.responses.create(
    model="operator-preview",
    input=[
        {"type": "input", "text": task},
        {"type": "computer", "display_width": 1280, "display_height": 800}
    ]
)
```

---

## SANDBOXED ENVIRONMENTS

### Critical Security Requirements

Computer use agents MUST run in isolated, sandboxed environments:

| Isolation Layer | Requirement |
|:---------------|:------------|
| **Network** | Restrict to necessary endpoints only |
| **Filesystem** | Read-only or scoped to temp directories |
| **Credentials** | No access to host credentials |
| **Syscalls** | Filter dangerous system calls |
| **Resources** | Limit CPU, memory, time |

### Docker Sandbox Setup

```dockerfile
# Dockerfile for sandboxed computer use environment

FROM ubuntu:22.04

# Install desktop environment
RUN apt-get update && apt-get install -y \
    xvfb \
    x11vnc \
    fluxbox \
    xterm \
    firefox \
    python3 \
    python3-pip

# Create non-root user
RUN useradd -m -s /bin/bash agent

# Restrict network
RUN echo "127.0.0.1 localhost" > /etc/hosts

# Switch to agent user
USER agent
WORKDIR /home/agent

# Install Python automation tools
RUN pip install pyautogui pillow playwright

CMD ["/bin/bash"]
```

### Docker Compose for Isolation

```yaml
version: '3.8'
services:
  agent:
    build: .
    ports:
      - "5900:5900"  # VNC
    environment:
      - DISPLAY=:99
    volumes:
      - ./workspace:/workspace:rw
    network_mode: "none"  # No network!
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
```

---

## ELEMENT DETECTION

### Screen Analysis

```python
class ElementDetector:
    def __init__(self, vision_model):
        self.vision = vision_model
    
    def detect_elements(self, screenshot: Image) -> List[Element]:
        """Detect clickable elements on screen."""
        # Use OCR to find text
        text_regions = self OCR(screenshot)
        
        # Use CV to find buttons, inputs
        buttons = self.find_buttons(screenshot)
        inputs = self.find_inputs(screenshot)
        
        return text_regions + buttons + inputs
    
    def find_clickable_at(self, screenshot: Image, x: int, y: int) -> Element:
        """Find what element is at x,y coordinates."""
        for element in self.detect_elements(screenshot):
            if element.contains(x, y):
                return element
        return None
```

### Accessibility Tree

```python
class AccessibilityTree:
    def get_tree(self) -> AccessibilityNode:
        """Get accessibility tree for current screen."""
        # Use platform-specific APIs
        if sys.platform == "darwin":
            return self.get_darwin_tree()
        elif sys.platform == "linux":
            return self.get_linux_tree()
        else:
            return self.get_windows_tree()
    
    def find_by_role(self, role: str) -> List[AccessibilityNode]:
        """Find elements by accessibility role."""
        tree = self.get_tree()
        return tree.find_all(role=role)
    
    def click_element(self, element: AccessibilityNode):
        """Click element via accessibility API."""
        element.click()
```

---

## ERROR HANDLING

### Retry Logic

```python
class RetryHandler:
    def __init__(self, max_retries: int = 3):
        self.max_retries = max_retries
    
    async def execute_with_retry(self, action_fn):
        errors = []
        
        for attempt in range(self.max_retries):
            try:
                return await action_fn()
            except ElementNotFoundError as e:
                errors.append(e)
                # Scroll and try again
                await self.scroll_and_retry()
            except ActionFailedError as e:
                errors.append(e)
                # Wait and try again
                await asyncio.sleep(1)
        
        raise MaxRetriesExceeded(errors)
```

### Detection of Failures

```python
class FailureDetector:
    def detect_failure(self, screenshot: Image, action: str) -> FailureType:
        """Detect if action failed."""
        
        # Check for error dialogs
        if self.has_error_dialog(screenshot):
            return FailureType.ERROR_DIALOG
        
        # Check for stuck loading
        if self.is_loading_forever(screenshot):
            return FailureType.LOOP
        
        # Check for wrong page
        if self.is_wrong_page(screenshot):
            return FailureType.WRONG_PAGE
        
        # Check for action didn't work
        if not self.action_worked(screenshot, action):
            return FailureType.ACTION_FAILED
        
        return FailureType.NONE
```

---

## BEST PRACTICES

### 1. Always Sandbox
- ❌ NEVER run on host machine
- ✅ Use Docker/VM isolation
- ✅ Minimal network access
- ✅ Scoped filesystem

### 2. Limit Iterations
```python
self.max_steps = 50  # Prevent runaway loops
```

### 3. Add Delays
```python
self.action_delay = 0.5  # Wait between actions
```

### 4. Check for Completion
```python
def is_complete(self, task: str, result: dict) -> bool:
    # Verify task accomplished
    return result.get("success", False)
```

### 5. Handle Errors Gracefully
- Detect failure patterns
- Implement retry logic
- Have fallback actions

### 6. Log Everything
```python
def log_action(self, action: dict, result: dict):
    logger.info(f"Action: {action} -> Result: {result}")
```

---

## USE CASES

| Use Case | Example |
|:---------|:--------|
| Web Automation | Fill forms, scrape data |
| Testing | E2E test automation |
| Data Entry | Migrate data between systems |
| Bug Reproduction | Record and replay issues |
| Accessibility | Automate for accessibility testing |

---

## MONITORING

### Session Recording

```python
class SessionRecorder:
    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        self.frames = []
    
    def record_frame(self, screenshot: Image, action: dict, result: dict):
        self.frames.append({
            "timestamp": datetime.now(),
            "screenshot": screenshot,
            "action": action,
            "result": result
        })
    
    def save_session(self, session_id: str):
        # Save as video or GIF
        self.save_video(f"{session_id}.mp4")
        self.save_logs(f"{session_id}.json")
```
