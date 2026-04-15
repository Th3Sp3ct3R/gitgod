---
source: https://openrouter.ai/docs/guides/features/service-tiers
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:44.552Z
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

* [Service Tiers](#service-tiers)
* [Supported Providers](#supported-providers)
* [API Response Differences](#api-response-differences)

[Features](/docs/guides/features/presets)

# Service Tiers

Copy page

Control cost and latency tradeoffs with service tier selection

## Service Tiers

The `service_tier` parameter lets you control cost and latency tradeoffs when sending requests through OpenRouter. You can pass it in your request to select a specific processing tier, and the response will indicate which tier was actually used.

### Supported Providers

**OpenAI**

Accepted request values: `auto`, `default`, `flex`, `priority`

Learn more in OpenAI’s [Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create#(resource)%20chat.completions%20%3E%20(method)%20create%20%3E%20(params)%200.non_streaming%20%3E%20(param)%20service_tier%20%3E%20(schema)) and [Responses](https://developers.openai.com/api/reference/resources/responses/methods/create#(resource)%20responses%20%3E%20(method)%20create%20%3E%20(params)%200.non_streaming%20%3E%20(param)%20service_tier%20%3E%20(schema)) API documentation. See OpenAI’s [pricing page](https://developers.openai.com/api/docs/pricing) for details on cost differences between tiers.

### API Response Differences

The API response includes a `service_tier` field that indicates which capacity tier was actually used to serve your request. The placement of this field varies by API format:

* **Chat Completions API** (`/api/v1/chat/completions`): `service_tier` is returned at the **top level** of the response object, matching OpenAI’s native format.
* **Responses API** (`/api/v1/responses`): `service_tier` is returned at the **top level** of the response object, matching OpenAI’s native format.
* **Messages API** (`/api/v1/messages`): `service_tier` is returned inside the **`usage` object**, matching Anthropic’s native format.

Was this page helpful?

YesNo

[Previous](/docs/guides/features/guardrails)[#### Input & Output Logging

Privately store and review your prompts and completions

Next](/docs/guides/features/input-output-logging)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
