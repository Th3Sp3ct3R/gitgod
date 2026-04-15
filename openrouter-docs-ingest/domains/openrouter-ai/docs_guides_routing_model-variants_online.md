---
source: https://openrouter.ai/docs/guides/routing/model-variants/online
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:26.030Z
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
    - [Free](/docs/guides/routing/model-variants/free)
    - [Extended](/docs/guides/routing/model-variants/extended)
    - [Exacto](/docs/guides/routing/model-variants/exacto)
    - [Thinking](/docs/guides/routing/model-variants/thinking)
    - [Online](/docs/guides/routing/model-variants/online)
    - [Nitro](/docs/guides/routing/model-variants/nitro)
  + Routers
* Features

  + [Presets](/docs/guides/features/presets)
  + [Tool Calling](/docs/guides/features/tool-calling)
  + Server Tools
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

* [Usage](#usage)
* [Details](#details)

[Models & Routing](/docs/guides/routing/model-fallbacks)[Model Variants](/docs/guides/routing/model-variants/free)

# Online Variant

Copy page

Real-time web search with :online

##### Deprecated

The `:online` variant is deprecated. Use the [`openrouter:web_search` server tool](/docs/guides/features/server-tools/web-search) instead, which gives the model control over when and how often to search.

If your application already provides the `web_search` tool (e.g. OpenAI’s built-in web search tool type), OpenRouter automatically recognizes it and hoists it to the `openrouter:web_search` server tool. This means you can safely remove the `:online` suffix from any model slug — as long as the application exposes the `web_search` tool, web search functionality will still work as a server tool with any model on OpenRouter.

The `:online` variant enables real-time web search capabilities for any model on OpenRouter.

## Usage

Append `:online` to any model ID:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model": "openai/gpt-5.2:online" |
| 3 | } |
```

This is a shortcut for using the `web` plugin, and is exactly equivalent to:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model": "openrouter/auto", |
| 3 | "plugins": [{ "id": "web" }] |
| 4 | } |
```

## Details

The Online variant incorporates relevant web search results into model responses, providing access to real-time information and current events. This is particularly useful for queries that require up-to-date information beyond the model’s training data.

For the recommended approach, see: [Web Search Server Tool](/docs/guides/features/server-tools/web-search). For legacy plugin details, see: [Web Search Plugin](/docs/guides/features/plugins/web-search).

Was this page helpful?

YesNo

[Previous](/docs/guides/routing/model-variants/thinking)[#### Nitro Variant

High-speed model inference with :nitro

Next](/docs/guides/routing/model-variants/nitro)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
