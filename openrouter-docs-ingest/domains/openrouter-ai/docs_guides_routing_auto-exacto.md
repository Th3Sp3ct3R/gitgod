---
source: https://openrouter.ai/docs/guides/routing/auto-exacto
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:21.180Z
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

* [How It Works](#how-it-works)
* [Results](#results)
* [Opting Out](#opting-out)

[Models & Routing](/docs/guides/routing/model-fallbacks)

# Auto Exacto

Copy page

Automatic tool-calling provider optimization

Auto Exacto is a routing step that automatically optimizes provider ordering for all requests that include tools. It runs by default on every tool-calling request, requiring no configuration.

## How It Works

When your request includes tools, Auto Exacto reorders the available providers for your chosen model using a combination of real-world performance signals:

* **Throughput** — real-time tokens-per-second metrics (visible on the [Performance tab](https://openrouter.ai/models) of any model page).
* **Tool-calling success rate** — how reliably each provider completes tool calls (also visible on the Performance tab).
* **Benchmark data** — internal evaluation results we are actively collecting. This data will be shown publicly soon but is not yet available on the site.

Providers that underperform on these signals are deprioritized, while providers with strong track records are moved to the front of the list.

## Results

We have observed notable improvements in [tau-bench](https://github.com/sierra-research/tau-bench) scores and tool-calling success rates when Auto Exacto is active. More detailed benchmark results will be published as our evaluation data becomes publicly available.

## Opting Out

Without Auto Exacto, OpenRouter’s default routing is primarily [price-weighted](/docs/guides/routing/provider-selection#price-based-load-balancing-default-strategy) — requests are load balanced across providers with a strong preference for lower cost. Auto Exacto changes this for tool-calling requests by reordering providers based on quality signals instead of price.

If you want to restore the previous price-weighted behavior for tool-calling requests, you can opt out by explicitly sorting by price using any of the following methods:

* **`provider.sort` parameter** — set `sort` to `"price"` in the `provider` object of your request body. See [Provider Sorting](/docs/guides/routing/provider-selection#provider-sorting) for details.
* **`:floor` virtual variant** — append `:floor` to any model slug (e.g. `openai/gpt-4o:floor`) to sort by price. See [Floor Price Shortcut](/docs/guides/routing/provider-selection#floor-price-shortcut).
* **Default sort in account settings** — set your default provider sort to price in your [account settings](https://openrouter.ai/settings/preferences) to apply price sorting across all requests.

Any of these will bypass Auto Exacto and return to the standard price-weighted provider ordering.

Was this page helpful?

YesNo

[Previous](/docs/guides/routing/provider-selection)[#### Free Variant

Access free models with the :free variant

Next](/docs/guides/routing/model-variants/free)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
