---
source: https://openrouter.ai/docs/guides/routing/model-variants/thinking
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:24.991Z
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

# Thinking Variant

Copy page

Enable extended reasoning with :thinking

The `:thinking` variant enables extended reasoning capabilities for complex problem-solving tasks.

## Usage

Append `:thinking` to any model ID:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model": "deepseek/deepseek-r1:thinking" |
| 3 | } |
```

## Details

Thinking variants provide access to models with extended reasoning capabilities, allowing for more thorough analysis and step-by-step problem solving. This is particularly useful for complex tasks that benefit from chain-of-thought reasoning.

See also: [Reasoning Tokens](/docs/best-practices/reasoning-tokens)

Was this page helpful?

YesNo

[Previous](/docs/guides/routing/model-variants/exacto)[#### Online Variant

Real-time web search with :online

Next](/docs/guides/routing/model-variants/online)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
