---
source: https://openrouter.ai/docs/guides/routing/model-variants/exacto
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:24.087Z
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

* [Using the Exacto Variant](#using-the-exacto-variant)
* [What Is the Exacto Variant?](#what-is-the-exacto-variant)
* [Why Use Exacto?](#why-use-exacto)
* [Why We Built It](#why-we-built-it)
* [Recommended Use Cases](#recommended-use-cases)
* [How Exacto Works](#how-exacto-works)
* [Exacto vs. Auto Exacto](#exacto-vs-auto-exacto)
* [Supported Models](#supported-models)

[Models & Routing](/docs/guides/routing/model-fallbacks)[Model Variants](/docs/guides/routing/model-variants/free)

# Exacto Variant

Copy page

Route requests with quality-first provider sorting

Exacto is a virtual model variant that explicitly applies quality-first provider sorting. When you add `:exacto` to a model slug, OpenRouter prefers providers with stronger tool-calling quality signals for that model instead of using the default price-weighted ordering.

## Using the Exacto Variant

Add `:exacto` to the end of any supported model slug. This is a shortcut for setting the provider sort to Exacto on that model.

TypeScript SDKTypeScript (OpenAI SDK)cURL

```
|  |  |
| --- | --- |
| 1 | import { OpenRouter } from '@openrouter/sdk'; |
| 2 |  |
| 3 | const openRouter = new OpenRouter({ |
| 4 | apiKey: process.env.OPENROUTER_API_KEY, |
| 5 | }); |
| 6 |  |
| 7 | const completion = await openRouter.chat.send({ |
| 8 | model: "moonshotai/kimi-k2-0905:exacto", |
| 9 | messages: [ |
| 10 | { |
| 11 | role: "user", |
| 12 | content: "Draft a concise changelog entry for the Exacto launch.", |
| 13 | }, |
| 14 | ], |
| 15 | stream: false, |
| 16 | }); |
| 17 |  |
| 18 | console.log(completion.choices[0].message.content); |
```

#####

You can still supply fallback models with the `models` array. Any model that
carries the `:exacto` suffix will request Exacto sorting when it is selected.

## What Is the Exacto Variant?

Exacto is a routing shortcut for quality-first provider ordering. Unlike standard routing, which primarily favors lower-cost providers, Exacto prefers providers with stronger signals for tool-calling reliability and deprioritizes weaker performers.

## Why Use Exacto?

### Why We Built It

Providers serving the same model can vary meaningfully in tool-use behavior. Exacto gives you an explicit, request-level way to prefer higher-quality providers when you care more about tool-calling reliability than the default price-weighted route.

### Recommended Use Cases

Exacto is useful for quality-sensitive, agentic workflows where tool-calling accuracy and reliability matter more than raw cost efficiency.

## How Exacto Works

Exacto uses the same provider-ranking signals as [Auto Exacto](/docs/guides/routing/auto-exacto), but applies them explicitly because you chose the `:exacto` suffix.

We use three classes of signals:

* Tool-calling success and reliability from real traffic
* Provider performance metrics such as throughput and latency
* Benchmark and evaluation data as it becomes available

Providers with strong track records are moved toward the front of the list. Providers with limited data are kept behind well-established performers, and providers with poor quality signals are deprioritized further.

## Exacto vs. Auto Exacto

* **Auto Exacto** runs automatically on tool-calling requests and requires no model suffix.
* **`:exacto`** is the explicit shortcut when you want to request the Exacto sorting mode directly on a specific model slug.

If you explicitly sort by price, throughput, or latency, that explicit sort still takes precedence.

## Supported Models

Exacto is a virtual variant and is not backed by a separate endpoint pool. It can be used anywhere provider sorting is meaningful, especially on models with multiple compatible providers.

In practice, Exacto is most useful on models that:

* Support tool calling
* Have multiple providers available on OpenRouter
* Show meaningful provider variance in tool-use reliability

#####

If you have feedback on the Exacto variant, please fill out this form:
<https://openrouter.notion.site/2932fd57c4dc8097ba74ffb6d27f39d1?pvs=105>

Was this page helpful?

YesNo

[Previous](/docs/guides/routing/model-variants/extended)[#### Thinking Variant

Enable extended reasoning with :thinking

Next](/docs/guides/routing/model-variants/thinking)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
