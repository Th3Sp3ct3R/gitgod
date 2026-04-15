---
source: https://openrouter.ai/docs/guides/features/structured-outputs
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:39.156Z
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

* [Overview](#overview)
* [Using Structured Outputs](#using-structured-outputs)
* [Model Support](#model-support)
* [Best Practices](#best-practices)
* [Example Implementation](#example-implementation)
* [Streaming with Structured Outputs](#streaming-with-structured-outputs)
* [Error Handling](#error-handling)
* [Response Healing](#response-healing)

[Features](/docs/guides/features/presets)

# Structured Outputs

Copy page

Return structured data from your models

OpenRouter supports structured outputs for compatible models, ensuring responses follow a specific JSON Schema format. This feature is particularly useful when you need consistent, well-formatted responses that can be reliably parsed by your application.

## Overview

Structured outputs allow you to:

* Enforce specific JSON Schema validation on model responses
* Get consistent, type-safe outputs
* Avoid parsing errors and hallucinated fields
* Simplify response handling in your application

## Using Structured Outputs

To use structured outputs, include a `response_format` parameter in your request, with `type` set to `json_schema` and the `json_schema` object containing your schema:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "messages": [ |
| 3 | { "role": "user", "content": "What's the weather like in London?" } |
| 4 | ], |
| 5 | "response_format": { |
| 6 | "type": "json_schema", |
| 7 | "json_schema": { |
| 8 | "name": "weather", |
| 9 | "strict": true, |
| 10 | "schema": { |
| 11 | "type": "object", |
| 12 | "properties": { |
| 13 | "location": { |
| 14 | "type": "string", |
| 15 | "description": "City or location name" |
| 16 | }, |
| 17 | "temperature": { |
| 18 | "type": "number", |
| 19 | "description": "Temperature in Celsius" |
| 20 | }, |
| 21 | "conditions": { |
| 22 | "type": "string", |
| 23 | "description": "Weather conditions description" |
| 24 | } |
| 25 | }, |
| 26 | "required": ["location", "temperature", "conditions"], |
| 27 | "additionalProperties": false |
| 28 | } |
| 29 | } |
| 30 | } |
| 31 | } |
```

The model will respond with a JSON object that strictly follows your schema:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "location": "London", |
| 3 | "temperature": 18, |
| 4 | "conditions": "Partly cloudy with light drizzle" |
| 5 | } |
```

## Model Support

Structured outputs are supported by select models.

You can find a list of models that support structured outputs on the [models page](https://openrouter.ai/models?order=newest&supported_parameters=structured_outputs).

* OpenAI models (GPT-4o and later versions) [Docs](https://platform.openai.com/docs/guides/structured-outputs)
* Google Gemini models [Docs](https://ai.google.dev/gemini-api/docs/structured-output)
* Anthropic models (Sonnet 4.5, Opus 4.1+) [Docs](https://docs.claude.com/en/docs/build-with-claude/structured-outputs)
* Most open-source models
* All Fireworks provided models [Docs](https://docs.fireworks.ai/structured-responses/structured-response-formatting#structured-response-modes)

To ensure your chosen model supports structured outputs:

1. Check the model’s supported parameters on the [models page](https://openrouter.ai/models)
2. Set `require_parameters: true` in your provider preferences (see [Provider Routing](/docs/features/provider-routing))
3. Include `response_format` and set `type: json_schema` in the required parameters

## Best Practices

1. **Include descriptions**: Add clear descriptions to your schema properties to guide the model
2. **Use strict mode**: Always set `strict: true` to ensure the model follows your schema exactly

## Example Implementation

Here’s a complete example using the Fetch API:

TypeScript SDKPythonTypeScript (fetch)

```
|  |  |
| --- | --- |
| 1 | import { OpenRouter } from '@openrouter/sdk'; |
| 2 |  |
| 3 | const openRouter = new OpenRouter({ |
| 4 | apiKey: '{{API_KEY_REF}}', |
| 5 | }); |
| 6 |  |
| 7 | const response = await openRouter.chat.send({ |
| 8 | model: '{{MODEL}}', |
| 9 | messages: [ |
| 10 | { role: 'user', content: 'What is the weather like in London?' }, |
| 11 | ], |
| 12 | responseFormat: { |
| 13 | type: 'json_schema', |
| 14 | jsonSchema: { |
| 15 | name: 'weather', |
| 16 | strict: true, |
| 17 | schema: { |
| 18 | type: 'object', |
| 19 | properties: { |
| 20 | location: { |
| 21 | type: 'string', |
| 22 | description: 'City or location name', |
| 23 | }, |
| 24 | temperature: { |
| 25 | type: 'number', |
| 26 | description: 'Temperature in Celsius', |
| 27 | }, |
| 28 | conditions: { |
| 29 | type: 'string', |
| 30 | description: 'Weather conditions description', |
| 31 | }, |
| 32 | }, |
| 33 | required: ['location', 'temperature', 'conditions'], |
| 34 | additionalProperties: false, |
| 35 | }, |
| 36 | }, |
| 37 | }, |
| 38 | stream: false, |
| 39 | }); |
| 40 |  |
| 41 | const weatherInfo = response.choices[0].message.content; |
```

## Streaming with Structured Outputs

Structured outputs are also supported with streaming responses. The model will stream valid partial JSON that, when complete, forms a valid response matching your schema.

To enable streaming with structured outputs, simply add `stream: true` to your request:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "stream": true, |
| 3 | "response_format": { |
| 4 | "type": "json_schema", |
| 5 | // ... rest of your schema |
| 6 | } |
| 7 | } |
```

## Error Handling

When using structured outputs, you may encounter these scenarios:

1. **Model doesn’t support structured outputs**: The request will fail with an error indicating lack of support
2. **Invalid schema**: The model will return an error if your JSON Schema is invalid

## Response Healing

For non-streaming requests using `response_format` with `type: "json_schema"`, you can enable the [Response Healing](/docs/guides/features/plugins/response-healing) plugin to reduce the risk of invalid JSON when models return imperfect formatting. Learn more in the [Response Healing documentation](/docs/guides/features/plugins/response-healing).

Was this page helpful?

YesNo

[Previous](/docs/guides/features/plugins/response-healing)[#### Message Transforms

Transform prompt messages

Next](/docs/guides/features/message-transforms)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
