---
source: https://openrouter.ai/docs/guides/features/plugins/overview
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:35.979Z
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

* [Available Plugins](#available-plugins)
* [Enabling Plugins via API](#enabling-plugins-via-api)
* [Using Multiple Plugins](#using-multiple-plugins)
* [Default Plugin Settings](#default-plugin-settings)
* [Plugin precedence](#plugin-precedence)
* [Disabling a default plugin](#disabling-a-default-plugin)
* [Model Variants as Plugin Shortcuts](#model-variants-as-plugin-shortcuts)

[Features](/docs/guides/features/presets)[Plugins](/docs/guides/features/plugins/overview)

# Plugins

Copy page

Extend model capabilities with OpenRouter plugins

OpenRouter plugins extend the capabilities of any model by injecting or mutating a request or response to add functionality like PDF processing, automatic JSON repair, and context compression. Unlike [server tools](/docs/guides/features/server-tools) (which the model can call 0-N times), plugins always run once when enabled. Plugins can be enabled per-request via the API or configured as defaults for all your API requests through the [Plugins settings page](https://openrouter.ai/settings/plugins).

## Available Plugins

OpenRouter currently supports the following plugins:

| Plugin | Description | Docs |
| --- | --- | --- |
| **Web Search** (deprecated) | Augment LLM responses with real-time web search results. Use the [`openrouter:web_search` server tool](/docs/guides/features/server-tools/web-search) instead. | [Web Search](/docs/guides/features/plugins/web-search) |
| **PDF Inputs** | Parse and extract content from uploaded PDF files | [PDF Inputs](/docs/guides/overview/multimodal/pdfs) |
| **Response Healing** | Automatically fix malformed JSON responses from LLMs | [Response Healing](/docs/guides/features/plugins/response-healing) |
| **Context Compression** | Compress prompts that exceed a model’s context window using middle-out truncation | [Message Transforms](/docs/guides/features/message-transforms) |

## Enabling Plugins via API

Plugins are enabled by adding a `plugins` array to your chat completions request. Each plugin is identified by its `id` and can include optional configuration parameters.

TypeScriptPythoncURL

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
| 12 | content: 'What are the latest developments in AI?' |
| 13 | } |
| 14 | ], |
| 15 | plugins: [ |
| 16 | { id: 'web' } |
| 17 | ] |
| 18 | }), |
| 19 | }); |
| 20 |  |
| 21 | const data = await response.json(); |
| 22 | console.log(data.choices[0].message.content); |
```

## Using Multiple Plugins

You can enable multiple plugins in a single request:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model": "openai/gpt-5.2", |
| 3 | "messages": [...], |
| 4 | "plugins": [ |
| 5 | { "id": "web", "max_results": 3 }, |
| 6 | { "id": "response-healing" } |
| 7 | ], |
| 8 | "response_format": { |
| 9 | "type": "json_schema", |
| 10 | "json_schema": { ... } |
| 11 | } |
| 12 | } |
```

## Default Plugin Settings

Organization admins and individual users can configure default plugin settings that apply to all API requests. This is useful for:

* Enabling plugins like web search or response healing by default across all requests
* Setting consistent plugin configurations without modifying application code
* Enforcing plugin settings that cannot be overridden by individual requests

To configure default plugin settings:

1. Navigate to [Settings > Plugins](https://openrouter.ai/settings/plugins)
2. Toggle plugins on/off to enable them by default
3. Click the configure button to customize plugin settings
4. Optionally enable “Prevent overrides” to enforce settings across all requests

#####

In organizations, the Plugins settings page is only accessible to admins.

#####

When “Prevent overrides” is enabled for a plugin, individual API requests cannot disable or modify that plugin’s configuration. This is useful for enforcing organization-wide policies.

### Plugin precedence

Plugin settings are applied in the following order of precedence:

1. **Request-level settings**: Plugin configurations in the `plugins` array of individual requests
2. **Account defaults**: Settings configured in the Plugins settings page

If a plugin is enabled in your account defaults but not specified in a request, the default configuration will be applied. If you specify a plugin in your request, those settings will override the defaults.

If you want the account setting to take precedence, toggle on “Prevent overrides” in the config for the plugin. It will then be impossible for generations to override the config.

### Disabling a default plugin

If a plugin is enabled by default in your account settings, you can disable it for a specific request by passing `"enabled": false` in the plugins array:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model": "openai/gpt-5.2", |
| 3 | "messages": [...], |
| 4 | "plugins": [ |
| 5 | { "id": "web", "enabled": false } |
| 6 | ] |
| 7 | } |
```

This will turn off the web search plugin for that particular request, even if it’s enabled in your account defaults.

## Model Variants as Plugin Shortcuts

##### Deprecated

The `:online` variant and the web search plugin are deprecated. Use the [`openrouter:web_search` server tool](/docs/guides/features/server-tools/web-search) instead.

Some plugins have convenient model variant shortcuts. For example, appending `:online` to any model ID enables web search:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model": "openai/gpt-5.2:online" |
| 3 | } |
```

This is equivalent to:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model": "openai/gpt-5.2", |
| 3 | "plugins": [{ "id": "web" }] |
| 4 | } |
```

See [Model Variants](/docs/guides/routing/model-variants) for more information about available shortcuts.

Was this page helpful?

YesNo

[Previous](/docs/guides/features/server-tools/datetime)[#### Web Search

Model-agnostic grounding

Next](/docs/guides/features/plugins/web-search)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
