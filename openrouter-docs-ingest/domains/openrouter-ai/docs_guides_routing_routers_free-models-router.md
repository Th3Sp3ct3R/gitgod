---
source: https://openrouter.ai/docs/guides/routing/routers/free-models-router
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:29.679Z
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
* [Available Free Models](#available-free-models)
* [Pricing](#pricing)
* [Use Cases](#use-cases)
* [Limitations](#limitations)
* [Selecting Specific Free Models](#selecting-specific-free-models)
* [Related](#related)

[Models & Routing](/docs/guides/routing/model-fallbacks)[Routers](/docs/guides/routing/routers/auto-router)

# Free Models Router

Copy page

Get free AI inference by routing to available free models

The [Free Models Router](https://openrouter.ai/openrouter/free) (`openrouter/free`) automatically selects a free model at random from the available free models on OpenRouter. The router intelligently filters for models that support the features your request needs, such as image understanding, tool calling, and structured outputs.

## Overview

Instead of manually choosing a specific free model, let the Free Models Router handle model selection for you. This is ideal for experimentation, learning, and low-volume use cases where you want zero-cost inference without worrying about which specific model to use.

To try the Free Models Router without writing any code, see the [Chat Playground guide](/docs/guides/get-started/free-models-router-playground).

## Usage

Set your model to `openrouter/free`:

TypeScript SDKTypeScript (fetch)PythoncURL

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
| 8 | model: 'openrouter/free', |
| 9 | messages: [ |
| 10 | { |
| 11 | role: 'user', |
| 12 | content: 'Hello! What can you help me with today?', |
| 13 | }, |
| 14 | ], |
| 15 | }); |
| 16 |  |
| 17 | console.log(completion.choices[0].message.content); |
| 18 | // Check which model was selected |
| 19 | console.log('Model used:', completion.model); |
```

## Response

The response includes the `model` field showing which free model was actually used:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "id": "gen-...", |
| 3 | "model": "upstage/solar-pro-3:free", |
| 4 | "choices": [ |
| 5 | { |
| 6 | "message": { |
| 7 | "role": "assistant", |
| 8 | "content": "..." |
| 9 | } |
| 10 | } |
| 11 | ], |
| 12 | "usage": { |
| 13 | "prompt_tokens": 12, |
| 14 | "completion_tokens": 85, |
| 15 | "total_tokens": 97 |
| 16 | } |
| 17 | } |
```

## How It Works

1. **Request Analysis**: Your request is analyzed to determine required capabilities (e.g., vision, tool calling, structured outputs)
2. **Model Filtering**: The router filters available free models to those supporting your request’s requirements
3. **Random Selection**: A model is randomly selected from the filtered pool
4. **Request Forwarding**: Your request is forwarded to the selected free model
5. **Response Tracking**: The response includes metadata showing which model was used

## Available Free Models

The Free Models Router selects from all currently available free models on OpenRouter. Some popular options include:

#####

Free model availability changes frequently. Check the [models page](https://openrouter.ai/models?pricing=free) for the current list of free models.

* **DeepSeek R1 (free)** - DeepSeek’s reasoning model
* **Llama models (free)** - Various Meta Llama models
* **Qwen models (free)** - Alibaba’s Qwen family
* And other community-contributed free models

## Pricing

The Free Models Router is completely free. There is no charge for:

* Using the router itself
* Requests routed to free models

## Use Cases

* **Learning and experimentation**: Try AI capabilities without any cost
* **Prototyping**: Build and test applications before committing to paid models
* **Low-volume applications**: Suitable for personal projects or demos
* **Education**: Perfect for students and educators exploring AI

## Limitations

* **Rate limits**: Free models may have lower rate limits than paid models
* **Availability**: Free model availability can vary; some may be temporarily unavailable
* **Performance**: Free models may have higher latency during peak usage
* **Model selection**: You cannot control which specific model is selected (use the `:free` variant suffix on a specific model if you need a particular free model)

## Selecting Specific Free Models

If you prefer to use a specific free model rather than random selection, you can:

1. **Use the `:free` variant**: Append `:free` to any model that has a free variant:

   ```
   |  |  |
   | --- | --- |
   | 1 | { |
   | 2 | "model": "meta-llama/llama-3.2-3b-instruct:free" |
   | 3 | } |
   ```
2. **Browse free models**: Visit the [models page](https://openrouter.ai/models?pricing=free) to see all available free models and select one directly.

## Related

* [Free Models Router in Chat Playground](/docs/guides/get-started/free-models-router-playground) - Try the router without writing code
* [Free Variant](/docs/guides/routing/model-variants/free) - Use the `:free` suffix for specific models
* [Auto Router](/docs/guides/routing/routers/auto-router) - Intelligent model selection (paid models)
* [Body Builder](/docs/guides/routing/routers/body-builder) - Generate multiple parallel API requests
* [Model Fallbacks](/docs/guides/routing/model-fallbacks) - Configure fallback models

Was this page helpful?

YesNo

[Previous](/docs/guides/routing/routers/body-builder)[#### Presets

Manage your LLM configurations

Next](/docs/guides/features/presets)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
