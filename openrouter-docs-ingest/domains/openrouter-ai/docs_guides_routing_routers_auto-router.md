---
source: https://openrouter.ai/docs/guides/routing/routers/auto-router
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:27.836Z
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
    - [Auto Router](/docs/guides/routing/routers/auto-router)
    - [Body Builder](/docs/guides/routing/routers/body-builder)
    - [Free Models Router](/docs/guides/routing/routers/free-models-router)
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

* [Overview](#overview)
* [Usage](#usage)
* [Response](#response)
* [How It Works](#how-it-works)
* [Supported Models](#supported-models)
* [Configuring Allowed Models](#configuring-allowed-models)
* [Via API Request](#via-api-request)
* [Via Settings UI](#via-settings-ui)
* [Pattern Syntax](#pattern-syntax)
* [Pricing](#pricing)
* [Use Cases](#use-cases)
* [Limitations](#limitations)
* [Related](#related)

[Models & Routing](/docs/guides/routing/model-fallbacks)[Routers](/docs/guides/routing/routers/auto-router)

# Auto Router

Copy page

Automatically select the best model for your prompt

The [Auto Router](https://openrouter.ai/openrouter/auto) (`openrouter/auto`) automatically selects the best model for your prompt, powered by [NotDiamond](https://www.notdiamond.ai/).

## Overview

Instead of manually choosing a model, let the Auto Router analyze your prompt and select the optimal model from a curated set of high-quality options. The router considers factors like prompt complexity, task type, and model capabilities.

## Usage

Set your model to `openrouter/auto`:

TypeScript SDKTypeScript (fetch)Python

```
|  |  |
| --- | --- |
| 1 | import { OpenRouter } from '@openrouter/sdk'; |
| 2 |  |
| 3 | const openRouter = new OpenRouter({ |
| 4 | apiKey: '<OPENROUTER_API_KEY>', |
| 5 | }); |
| 6 |  |
| 7 | const completion = await openRouter.chat.send({ |
| 8 | model: 'openrouter/auto', |
| 9 | messages: [ |
| 10 | { |
| 11 | role: 'user', |
| 12 | content: 'Explain quantum entanglement in simple terms', |
| 13 | }, |
| 14 | ], |
| 15 | }); |
| 16 |  |
| 17 | console.log(completion.choices[0].message.content); |
| 18 | // Check which model was selected |
| 19 | console.log('Model used:', completion.model); |
```

## Response

The response includes the `model` field showing which model was actually used:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "id": "gen-...", |
| 3 | "model": "anthropic/claude-sonnet-4.5",  // The model that was selected |
| 4 | "choices": [ |
| 5 | { |
| 6 | "message": { |
| 7 | "role": "assistant", |
| 8 | "content": "..." |
| 9 | } |
| 10 | } |
| 11 | ], |
| 12 | "usage": { |
| 13 | "prompt_tokens": 15, |
| 14 | "completion_tokens": 150, |
| 15 | "total_tokens": 165 |
| 16 | } |
| 17 | } |
```

## How It Works

1. **Prompt Analysis**: Your prompt is analyzed by NotDiamond’s routing system
2. **Model Selection**: The optimal model is selected based on the task requirements
3. **Request Forwarding**: Your request is forwarded to the selected model
4. **Response Tracking**: The response includes metadata showing which model was used

## Supported Models

The Auto Router selects from a curated set of high-quality models including:

#####

Model slugs change as new versions are released. The examples below are current as of December 4, 2025. Check the [models page](https://openrouter.ai/models) for the latest available models.

* Claude Sonnet 4.5 (`anthropic/claude-sonnet-4.5`)
* Claude Opus 4.5 (`anthropic/claude-opus-4.5`)
* GPT-5.1 (`openai/gpt-5.1`)
* Gemini 3.1 Pro (`google/gemini-3.1-pro-preview`)
* DeepSeek 3.2 (`deepseek/deepseek-v3.2`)
* And other top-performing models

The exact model pool may be updated as new models become available.

## Configuring Allowed Models

You can restrict which models the Auto Router can select from using the `plugins` parameter. This is useful when you want to limit routing to specific providers or model families.

### Via API Request

Use wildcard patterns to filter models. For example, `anthropic/*` matches all Anthropic models:

TypeScript SDKTypeScript (fetch)Python

```
|  |  |
| --- | --- |
| 1 | const completion = await openRouter.chat.send({ |
| 2 | model: 'openrouter/auto', |
| 3 | messages: [ |
| 4 | { |
| 5 | role: 'user', |
| 6 | content: 'Explain quantum entanglement', |
| 7 | }, |
| 8 | ], |
| 9 | plugins: [ |
| 10 | { |
| 11 | id: 'auto-router', |
| 12 | allowed_models: ['anthropic/*', 'openai/gpt-5.1'], |
| 13 | }, |
| 14 | ], |
| 15 | }); |
```

### Via Settings UI

You can also configure default allowed models in your [Plugin Settings](https://openrouter.ai/settings/plugins):

1. Navigate to **Settings > Plugins**
2. Find **Auto Router** and click the configure button
3. Enter model patterns (one per line)
4. Save your settings

These defaults apply to all your API requests unless overridden per-request.

### Pattern Syntax

| Pattern | Matches |
| --- | --- |
| `anthropic/*` | All Anthropic models |
| `openai/gpt-5*` | All GPT-5 variants |
| `google/*` | All Google models |
| `openai/gpt-5.1` | Exact match only |
| `*/claude-*` | Any provider with claude in model name |

When no patterns are configured, the Auto Router uses all supported models.

## Pricing

You pay the standard rate for whichever model is selected. There is no additional fee for using the Auto Router.

## Use Cases

* **General-purpose applications**: When you don’t know what types of prompts users will send
* **Cost optimization**: Let the router choose efficient models for simpler tasks
* **Quality optimization**: Ensure complex prompts get routed to capable models
* **Experimentation**: Discover which models work best for your use case

## Limitations

* The router requires `messages` format (not `prompt`)
* Streaming is supported
* All standard OpenRouter features (tool calling, etc.) work with the selected model

## Related

* [Body Builder](/docs/guides/routing/routers/body-builder) - Generate multiple parallel API requests
* [Model Fallbacks](/docs/guides/routing/model-fallbacks) - Configure fallback models
* [Provider Selection](/docs/guides/routing/provider-selection) - Control which providers are used

Was this page helpful?

YesNo

[Previous](/docs/guides/routing/model-variants/nitro)[#### Body Builder

Generate multiple parallel API requests from natural language

Next](/docs/guides/routing/routers/body-builder)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
