---
source: https://openrouter.ai/docs/guides/features/server-tools/datetime
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:34.940Z
method: markitdown
---
Search

`/`

Ask AI

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)

[Docs](/docs/quickstart)[API Reference](/docs/api/reference/overview)[SDK Reference](/docs/sdks/agentic-usage)

[Docs](/docs/quickstart)[API Reference](/docs/api/reference/overview)[SDK Reference](/docs/sdks/agentic-usage)

* Overview

  + [Quickstart](/docs/quickstart)
  + [Principles](/docs/guides/overview/principles)
  + [Models](/docs/guides/overview/models)
  + Multimodal
  + Authentication
  + [FAQ](/docs/faq)
  + [Report Feedback](/docs/guides/overview/report-feedback)
  + [Enterprise](https://openrouter.ai/enterprise)
* Models & Routing

  + [Model Fallbacks](/docs/guides/routing/model-fallbacks)
  + [Provider Selection](/docs/guides/routing/provider-selection)
  + [Auto Exacto](/docs/guides/routing/auto-exacto)
  + Model Variants
  + Routers
* Features

  + [Presets](/docs/guides/features/presets)
  + [Tool Calling](/docs/guides/features/tool-calling)
  + Server Tools
    - [Overview](/docs/guides/features/server-tools/overview)
    - [Web Search](/docs/guides/features/server-tools/web-search)
    - [Datetime](/docs/guides/features/server-tools/datetime)
  + Plugins
  + [Structured Outputs](/docs/guides/features/structured-outputs)
  + [Message Transforms](/docs/guides/features/message-transforms)
  + [Zero Completion Insurance](/docs/guides/features/zero-completion-insurance)
  + [ZDR](/docs/guides/features/zdr)
  + [App Attribution](/docs/app-attribution)
  + [Guardrails](/docs/guides/features/guardrails)
  + [Service Tiers](/docs/guides/features/service-tiers)
  + [Input & Output Logging](/docs/guides/features/input-output-logging)
  + Broadcast
* + Privacy
  + Best Practices
  + Guides
  + Community

Light

On this page

* [Quick Start](#quick-start)
* [Configuration](#configuration)
* [Response](#response)
* [Pricing](#pricing)
* [Next Steps](#next-steps)

[Features](/docs/guides/features/presets)[Server Tools](/docs/guides/features/server-tools/overview)

# Datetime

Beta

Copy page

Give any model access to the current date and time

##### Beta

Server tools are currently in beta. The API and behavior may change.

The `openrouter:datetime` server tool gives any model access to the current date and time. This is useful for prompts that require temporal awareness — scheduling, time-sensitive questions, or any task where the model needs to know “right now.”

## Quick Start

TypeScriptPythoncURL

```
|  |  |
| --- | --- |
| 1 | const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { |
| 2 | method: 'POST', |
| 3 | headers: { |
| 4 | Authorization: 'Bearer {{API_KEY_REF}}', |
| 5 | 'Content-Type': 'application/json', |
| 6 | }, |
| 7 | body: JSON.stringify({ |
| 8 | model: '{{MODEL}}', |
| 9 | messages: [ |
| 10 | { |
| 11 | role: 'user', |
| 12 | content: 'What day of the week is it today?' |
| 13 | } |
| 14 | ], |
| 15 | tools: [ |
| 16 | { type: 'openrouter:datetime' } |
| 17 | ] |
| 18 | }), |
| 19 | }); |
| 20 |  |
| 21 | const data = await response.json(); |
| 22 | console.log(data.choices[0].message.content); |
```

## Configuration

The datetime tool accepts an optional `timezone` parameter:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "type": "openrouter:datetime", |
| 3 | "parameters": { |
| 4 | "timezone": "America/New_York" |
| 5 | } |
| 6 | } |
```

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `timezone` | string | `UTC` | IANA timezone name (e.g. `"America/New_York"`, `"Europe/London"`, `"Asia/Tokyo"`) |

## Response

When the model calls the datetime tool, it receives a response like:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "datetime": "2025-07-15T14:30:00.000-04:00", |
| 3 | "timezone": "America/New_York" |
| 4 | } |
```

## Pricing

The datetime tool has no additional cost beyond standard token usage.

## Next Steps

* [Server Tools Overview](/docs/guides/features/server-tools) — Learn about server tools
* [Web Search](/docs/guides/features/server-tools/web-search) — Search the web for real-time information
* [Tool Calling](/docs/guides/features/tool-calling) — Learn about user-defined tool calling

Was this page helpful?

YesNo

[Previous](/docs/guides/features/server-tools/web-search)[#### Plugins

Extend model capabilities with OpenRouter plugins

Next](/docs/guides/features/plugins/overview)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
