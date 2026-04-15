---
source: https://openrouter.ai/docs/guides/features/presets
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:30.543Z
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

* [What are Presets?](#what-are-presets)
* [Quick Start](#quick-start)
* [Benefits](#benefits)
* [Separation of Concerns](#separation-of-concerns)
* [Rapid Iteration](#rapid-iteration)
* [Using Presets](#using-presets)
* [Other Notes](#other-notes)

[Features](/docs/guides/features/presets)

# Presets

Copy page

Manage your LLM configurations

[Presets](/settings/presets) allow you to separate your LLM configuration from your code. Create and manage presets through the OpenRouter web application to control provider routing, model selection, system prompts, and other parameters, then reference them in OpenRouter API requests.

## What are Presets?

Presets are named configurations that encapsulate all the settings needed for a specific use case. For example, you might create:

* An “email-copywriter” preset for generating marketing copy
* An “inbound-classifier” preset for categorizing customer inquiries
* A “code-reviewer” preset for analyzing pull requests

Each preset can manage:

* Provider routing preferences (sort by price, latency, etc.)
* Model selection (specific model or array of models with fallbacks)
* System prompts
* Generation parameters (temperature, top\_p, etc.)
* Provider inclusion/exclusion rules

## Quick Start

1. [Create a preset](/settings/presets). For example, select a model and restrict provider routing to just a few providers.
   ![Creating a new preset](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/97a7df1a610c25007f695f0390f51f942c4666b001b0d069b067b52a0b1aee2a/content/assets/preset-example.png "A new preset")
2. Make an API request to the preset:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model": "@preset/ravenel-bridge", |
| 3 | "messages": [ |
| 4 | { |
| 5 | "role": "user", |
| 6 | "content": "What's your opinion of the Golden Gate Bridge? Isn't it beautiful?" |
| 7 | } |
| 8 | ] |
| 9 | } |
```

## Benefits

### Separation of Concerns

Presets help you maintain a clean separation between your application code and LLM configuration. This makes your code more semantic and easier to maintain.

### Rapid Iteration

Update your LLM configuration without deploying code changes:

* Switch to new model versions
* Adjust system prompts
* Modify parameters
* Change provider preferences

## Using Presets

There are three ways to use presets in your API requests.

1. **Direct Model Reference**

You can reference the preset as if it was a model by sending requests to `@preset/preset-slug`

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model": "@preset/email-copywriter", |
| 3 | "messages": [ |
| 4 | { |
| 5 | "role": "user", |
| 6 | "content": "Write a marketing email about our new feature" |
| 7 | } |
| 8 | ] |
| 9 | } |
```

2. **Preset Field**

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model": "openai/gpt-4", |
| 3 | "preset": "email-copywriter", |
| 4 | "messages": [ |
| 5 | { |
| 6 | "role": "user", |
| 7 | "content": "Write a marketing email about our new feature" |
| 8 | } |
| 9 | ] |
| 10 | } |
```

3. **Combined Model and Preset**

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model": "openai/gpt-4@preset/email-copywriter", |
| 3 | "messages": [ |
| 4 | { |
| 5 | "role": "user", |
| 6 | "content": "Write a marketing email about our new feature" |
| 7 | } |
| 8 | ] |
| 9 | } |
```

## Other Notes

1. If you’re using an organization account, all members can access organization presets. This is a great way to share best practices across teams.
2. Version history is kept in order to understand changes that were made, and to be able to roll back. However when addressing a preset through the API, the latest version is always used.
3. If you provide parameters in the request, they will be shallow-merged with the options configured in the preset.

Was this page helpful?

YesNo

[Previous](/docs/guides/routing/routers/free-models-router)[#### Tool & Function Calling

Use tools in your prompts

Next](/docs/guides/features/tool-calling)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
