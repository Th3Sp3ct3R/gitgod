---
source: https://openrouter.ai/docs/guides/routing/routers/body-builder
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:28.923Z
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
* [Response Format](#response-format)
* [Executing Generated Requests](#executing-generated-requests)
* [Use Cases](#use-cases)
* [Model Benchmarking](#model-benchmarking)
* [Redundancy and Reliability](#redundancy-and-reliability)
* [A/B Testing](#ab-testing)
* [Exploration](#exploration)
* [Model Selection](#model-selection)
* [Pricing](#pricing)
* [Limitations](#limitations)
* [Related](#related)

[Models & Routing](/docs/guides/routing/model-fallbacks)[Routers](/docs/guides/routing/routers/auto-router)

# Body Builder

Copy page

Generate multiple parallel API requests from natural language

The [Body Builder](https://openrouter.ai/openrouter/bodybuilder) (`openrouter/bodybuilder`) transforms natural language prompts into structured OpenRouter API requests, enabling you to easily run the same task across multiple models in parallel.

## Overview

Body Builder uses AI to understand your intent and generate valid OpenRouter API request bodies. Simply describe what you want to accomplish and which models you want to use, and Body Builder returns ready-to-execute JSON requests.

#####

Body Builder is **free to use**. There is no charge for generating the request bodies.

## Usage

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
| 8 | model: 'openrouter/bodybuilder', |
| 9 | messages: [ |
| 10 | { |
| 11 | role: 'user', |
| 12 | content: 'Count to 10 using Claude Sonnet and GPT-5', |
| 13 | }, |
| 14 | ], |
| 15 | }); |
| 16 |  |
| 17 | // Parse the generated requests |
| 18 | const generatedRequests = JSON.parse(completion.choices[0].message.content); |
| 19 | console.log(generatedRequests); |
```

## Response Format

Body Builder returns a JSON object containing an array of OpenRouter-compatible request bodies:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "requests": [ |
| 3 | { |
| 4 | "model": "anthropic/claude-sonnet-4.5", |
| 5 | "messages": [ |
| 6 | {"role": "user", "content": "Count to 10"} |
| 7 | ] |
| 8 | }, |
| 9 | { |
| 10 | "model": "openai/gpt-5.1", |
| 11 | "messages": [ |
| 12 | {"role": "user", "content": "Count to 10"} |
| 13 | ] |
| 14 | } |
| 15 | ] |
| 16 | } |
```

## Executing Generated Requests

After generating the request bodies, execute them in parallel:

TypeScriptPython

```
|  |  |
| --- | --- |
| 1 | // Generate the requests |
| 2 | const builderResponse = await openRouter.chat.send({ |
| 3 | model: 'openrouter/bodybuilder', |
| 4 | messages: [{ role: 'user', content: 'Explain gravity using Gemini and Claude' }], |
| 5 | }); |
| 6 |  |
| 7 | const { requests } = JSON.parse(builderResponse.choices[0].message.content); |
| 8 |  |
| 9 | // Execute all requests in parallel |
| 10 | const results = await Promise.all( |
| 11 | requests.map((req) => openRouter.chat.send(req)) |
| 12 | ); |
| 13 |  |
| 14 | // Process results |
| 15 | results.forEach((result, i) => { |
| 16 | console.log(`Model: ${requests[i].model}`); |
| 17 | console.log(`Response: ${result.choices[0].message.content}\n`); |
| 18 | }); |
```

## Use Cases

### Model Benchmarking

Compare how different models handle the same task:

```
|  |
| --- |
| "Write a haiku about programming using Claude Sonnet, GPT-5, and Gemini" |
```

### Redundancy and Reliability

Get responses from multiple providers for critical applications:

```
|  |
| --- |
| "Answer 'What is 2+2?' using three different models for verification" |
```

### A/B Testing

Test prompts across models to find the best fit:

```
|  |
| --- |
| "Summarize this article using the top 5 coding models: [article text]" |
```

### Exploration

Discover which models excel at specific tasks:

```
|  |
| --- |
| "Generate a creative story opening using various creative writing models" |
```

## Model Selection

Body Builder has access to all available OpenRouter models and will:

* Use the latest model versions by default
* Select appropriate models based on your description
* Understand model aliases and common names

#####

Model slugs change as new versions are released. The examples below are current as of December 4, 2025. Check the [models page](https://openrouter.ai/models) for the latest available models.

Example model references that work:

* “Claude Sonnet” → `anthropic/claude-sonnet-4.5`
* “Claude Opus” → `anthropic/claude-opus-4.5`
* “GPT-5” → `openai/gpt-5.1`
* “Gemini” → `google/gemini-3.1-pro-preview`
* “DeepSeek” → `deepseek/deepseek-v3.2`

## Pricing

* **Body Builder requests**: Free (no charge for generating request bodies)
* **Executing generated requests**: Standard model pricing applies

## Limitations

* Requires `messages` format input
* Generated requests use minimal required fields by default
* System messages in your input are preserved and forwarded

## Related

* [Auto Router](/docs/guides/routing/routers/auto-router) - Automatic single-model selection
* [Model Fallbacks](/docs/guides/routing/model-fallbacks) - Configure fallback models
* [Structured Outputs](/docs/guides/features/structured-outputs) - Get structured JSON responses

Was this page helpful?

YesNo

[Previous](/docs/guides/routing/routers/auto-router)[#### Free Models Router

Get free AI inference by routing to available free models

Next](/docs/guides/routing/routers/free-models-router)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
