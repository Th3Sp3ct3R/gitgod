---
source: https://openrouter.ai/docs
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:02.874Z
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

* [Using the OpenRouter SDK (Beta)](#using-the-openrouter-sdk-beta)
* [Using the OpenRouter API directly](#using-the-openrouter-api-directly)
* [Using the OpenAI SDK](#using-the-openai-sdk)
* [Using third-party SDKs](#using-third-party-sdks)

[Overview](/docs/quickstart)

# Quickstart

Copy page

Get started with OpenRouter

OpenRouter provides a unified API that gives you access to hundreds of AI models through a single endpoint, while automatically handling fallbacks and selecting the most cost-effective options. Get started with just a few lines of code using your preferred SDK or framework.

#####

```
|  |
| --- |
| Read https://openrouter.ai/skills/create-agent/SKILL.md and follow the instructions to build an agent using OpenRouter. |
```

#####

Looking for information about free models and rate limits? Please see the [FAQ](/docs/faq#how-are-rate-limits-calculated)

In the examples below, the OpenRouter-specific headers are optional. Setting them allows your app to appear on the OpenRouter leaderboards. For detailed information about app attribution, see our [App Attribution guide](/docs/app-attribution).

## Using the OpenRouter SDK (Beta)

First, install the SDK:

npmyarnpnpm

```
|  |  |
| --- | --- |
| $ | npm install @openrouter/sdk |
```

Then use it in your code:

TypeScript SDK

```
|  |  |
| --- | --- |
| 1 | import { OpenRouter } from '@openrouter/sdk'; |
| 2 |  |
| 3 | const openRouter = new OpenRouter({ |
| 4 | apiKey: '<OPENROUTER_API_KEY>', |
| 5 | defaultHeaders: { |
| 6 | 'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai. |
| 7 | 'X-OpenRouter-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai. |
| 8 | }, |
| 9 | }); |
| 10 |  |
| 11 | const completion = await openRouter.chat.send({ |
| 12 | model: 'openai/gpt-5.2', |
| 13 | messages: [ |
| 14 | { |
| 15 | role: 'user', |
| 16 | content: 'What is the meaning of life?', |
| 17 | }, |
| 18 | ], |
| 19 | stream: false, |
| 20 | }); |
| 21 |  |
| 22 | console.log(completion.choices[0].message.content); |
```

## Using the OpenRouter API directly

#####

You can use the interactive [Request Builder](/request-builder) to generate OpenRouter API requests in the language of your choice.

PythonTypeScript (fetch)Shell

```
|  |  |
| --- | --- |
| 1 | import requests |
| 2 | import json |
| 3 |  |
| 4 | response = requests.post( |
| 5 | url="https://openrouter.ai/api/v1/chat/completions", |
| 6 | headers={ |
| 7 | "Authorization": "Bearer <OPENROUTER_API_KEY>", |
| 8 | "HTTP-Referer": "<YOUR_SITE_URL>", # Optional. Site URL for rankings on openrouter.ai. |
| 9 | "X-OpenRouter-Title": "<YOUR_SITE_NAME>", # Optional. Site title for rankings on openrouter.ai. |
| 10 | }, |
| 11 | data=json.dumps({ |
| 12 | "model": "openai/gpt-5.2", # Optional |
| 13 | "messages": [ |
| 14 | { |
| 15 | "role": "user", |
| 16 | "content": "What is the meaning of life?" |
| 17 | } |
| 18 | ] |
| 19 | }) |
| 20 | ) |
```

## Using the OpenAI SDK

TypescriptPython

```
|  |  |
| --- | --- |
| 1 | import OpenAI from 'openai'; |
| 2 |  |
| 3 | const openai = new OpenAI({ |
| 4 | baseURL: 'https://openrouter.ai/api/v1', |
| 5 | apiKey: '<OPENROUTER_API_KEY>', |
| 6 | defaultHeaders: { |
| 7 | 'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai. |
| 8 | 'X-OpenRouter-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai. |
| 9 | }, |
| 10 | }); |
| 11 |  |
| 12 | async function main() { |
| 13 | const completion = await openai.chat.completions.create({ |
| 14 | model: 'openai/gpt-5.2', |
| 15 | messages: [ |
| 16 | { |
| 17 | role: 'user', |
| 18 | content: 'What is the meaning of life?', |
| 19 | }, |
| 20 | ], |
| 21 | }); |
| 22 |  |
| 23 | console.log(completion.choices[0].message); |
| 24 | } |
| 25 |  |
| 26 | main(); |
```

The API also supports [streaming](/docs/api/reference/streaming).

## Using third-party SDKs

For information about using third-party SDKs and frameworks with OpenRouter, please [see our frameworks documentation.](/docs/guides/community/frameworks-and-integrations-overview)

Was this page helpful?

YesNo

[#### Principles

Core principles and values of OpenRouter

Next](/docs/guides/overview/principles)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
