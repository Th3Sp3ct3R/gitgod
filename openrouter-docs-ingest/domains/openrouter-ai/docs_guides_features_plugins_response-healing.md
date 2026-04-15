---
source: https://openrouter.ai/docs/guides/features/plugins/response-healing
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:38.241Z
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
    - [Overview](/docs/guides/features/plugins/overview)
    - [Web Search](/docs/guides/features/plugins/web-search)
    - [Response Healing](/docs/guides/features/plugins/response-healing)
    - [PDF Inputs](/docs/guides/overview/multimodal/pdfs)
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
* [How It Works](#how-it-works)
* [What Gets Fixed](#what-gets-fixed)
* [JSON Syntax Errors](#json-syntax-errors)
* [Markdown Code Blocks](#markdown-code-blocks)
* [Mixed Text and JSON](#mixed-text-and-json)
* [Trailing Commas](#trailing-commas)
* [Unquoted Keys](#unquoted-keys)
* [Complete Example](#complete-example)
* [Limitations](#limitations)

[Features](/docs/guides/features/presets)[Plugins](/docs/guides/features/plugins/overview)

# Response Healing

Copy page

Automatically fix malformed JSON responses

The Response Healing plugin automatically validates and repairs malformed JSON responses from AI models. When models return imperfect formatting – missing brackets, trailing commas, markdown wrappers, or mixed text – this plugin attempts to repair the response so you receive valid, parseable JSON.

## Overview

Response Healing provides:

* **Automatic JSON repair**: Fixes missing brackets, commas, quotes, and other syntax errors
* **Markdown extraction**: Extracts JSON from markdown code blocks

## How It Works

The plugin activates for non-streaming requests when you use `response_format` with either `type: "json_schema"` or `type: "json_object"`, and include the response-healing plugin in your `plugins` array. See the [Complete Example](/_/openrouter.ai/_/_/_/docs/guides/features/plugins/response-healing#complete-example) below for a full implementation.

## What Gets Fixed

The Response Healing plugin handles common issues in LLM responses:

### JSON Syntax Errors

**Input:** Missing closing bracket

```
|  |
| --- |
| {"name": "Alice", "age": 30 |
```

**Output:** Fixed

```
|  |  |
| --- | --- |
| 1 | {"name": "Alice", "age": 30} |
```

### Markdown Code Blocks

**Input:** Wrapped in markdown

```
|  |
| --- |
| ```json |
| {"name": "Bob"} |
| ``` |
```

**Output:** Extracted

```
|  |  |
| --- | --- |
| 1 | {"name": "Bob"} |
```

### Mixed Text and JSON

**Input:** Text before JSON

```
|  |
| --- |
| Here's the data you requested: |
| {"name": "Charlie", "age": 25} |
```

**Output:** Extracted

```
|  |  |
| --- | --- |
| 1 | {"name": "Charlie", "age": 25} |
```

### Trailing Commas

**Input:** Invalid trailing comma

```
|  |
| --- |
| {"name": "David", "age": 35,} |
```

**Output:** Fixed

```
|  |  |
| --- | --- |
| 1 | {"name": "David", "age": 35} |
```

### Unquoted Keys

**Input:** JavaScript-style

```
|  |
| --- |
| {name: "Eve", age: 40} |
```

**Output:** Fixed

```
|  |  |
| --- | --- |
| 1 | {"name": "Eve", "age": 40} |
```

## Complete Example

TypeScriptPython

```
|  |  |
| --- | --- |
| 1 | const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { |
| 2 | method: 'POST', |
| 3 | headers: { |
| 4 | Authorization: 'Bearer {{API_KEY_REF}}', |
| 5 | 'Content-Type': 'application/json', |
| 6 | }, |
| 7 | body: JSON.stringify({ |
| 8 | model: '{{MODEL}}', |
| 9 | messages: [ |
| 10 | { |
| 11 | role: 'user', |
| 12 | content: 'Generate a product listing with name, price, and description' |
| 13 | } |
| 14 | ], |
| 15 | response_format: { |
| 16 | type: 'json_schema', |
| 17 | json_schema: { |
| 18 | name: 'Product', |
| 19 | schema: { |
| 20 | type: 'object', |
| 21 | properties: { |
| 22 | name: { |
| 23 | type: 'string', |
| 24 | description: 'Product name' |
| 25 | }, |
| 26 | price: { |
| 27 | type: 'number', |
| 28 | description: 'Price in USD' |
| 29 | }, |
| 30 | description: { |
| 31 | type: 'string', |
| 32 | description: 'Product description' |
| 33 | } |
| 34 | }, |
| 35 | required: ['name', 'price'] |
| 36 | } |
| 37 | } |
| 38 | }, |
| 39 | plugins: [ |
| 40 | { id: 'response-healing' } |
| 41 | ] |
| 42 | }), |
| 43 | }); |
| 44 |  |
| 45 | const data = await response.json(); |
| 46 | const product = JSON.parse(data.choices[0].message.content); |
| 47 | // The plugin attempts to repair malformed JSON syntax |
| 48 | console.log(product.name, product.price); |
```

## Limitations

##### Non-Streaming Requests Only

Response Healing only applies to non-streaming requests.

##### Will not repair all JSON

Some malformed JSON responses may still be unrepairable. In particular, if the response is truncated by `max_tokens`, the plugin will not be able to repair it.

Was this page helpful?

YesNo

[Previous](/docs/guides/features/plugins/web-search)[#### Structured Outputs

Return structured data from your models

Next](/docs/guides/features/structured-outputs)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
