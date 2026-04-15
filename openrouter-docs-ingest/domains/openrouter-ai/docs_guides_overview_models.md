---
source: https://openrouter.ai/docs/guides/overview/models
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:05.526Z
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

* [Query Parameters](#query-parameters)
* [output\_modalities](#output_modalities)
* [supported\_parameters](#supported_parameters)
* [Models API Standard](#models-api-standard)
* [API Response Schema](#api-response-schema)
* [Root Response Object](#root-response-object)
* [Model Object Schema](#model-object-schema)
* [Architecture Object](#architecture-object)
* [Pricing Object](#pricing-object)
* [Top Provider Object](#top-provider-object)
* [Supported Parameters](#supported-parameters)
* [For Providers](#for-providers)

[Overview](/docs/quickstart)

# Models

Copy page

One API for hundreds of models

Explore and browse 300+ models and providers [on our website](/models), or [with our API](/docs/api-reference/models/get-models). You can also subscribe to our [RSS feed](/api/v1/models?use_rss=true) to stay updated on new models.

## Query Parameters

The Models API supports query parameters to filter the list of models returned.

### `output_modalities`

Filter models by their output capabilities. Accepts a comma-separated list of modalities or `"all"` to include every model regardless of output type.

| Value | Description |
| --- | --- |
| `text` | Models that produce text output (default) |
| `image` | Models that generate images |
| `audio` | Models that produce audio output |
| `embeddings` | Embedding models |
| `all` | Include all models, skip modality filtering |

Examples:

```
|  |  |
| --- | --- |
| $ | # Default — text models only |
| $ | curl "https://openrouter.ai/api/v1/models" |
| $ |  |
| $ | # Image generation models only |
| $ | curl "https://openrouter.ai/api/v1/models?output_modalities=image" |
| $ |  |
| $ | # Text and image models |
| $ | curl "https://openrouter.ai/api/v1/models?output_modalities=text,image" |
| $ |  |
| $ | # All models regardless of modality |
| $ | curl "https://openrouter.ai/api/v1/models?output_modalities=all" |
```

The same parameter is available on the [`/v1/models/count`](/docs/api-reference/models/count) endpoint so that counts stay consistent with list results.

### `supported_parameters`

Filter models by the API parameters they support. For example, to find models that support tool calling:

```
|  |  |
| --- | --- |
| $ | curl "https://openrouter.ai/api/v1/models?supported_parameters=tools" |
```

## Models API Standard

Our [Models API](/docs/api-reference/models/get-models) makes the most important information about all LLMs freely available as soon as we confirm it.

### API Response Schema

The Models API returns a standardized JSON response format that provides comprehensive metadata for each available model. This schema is cached at the edge and designed for reliable integration with production applications.

#### Root Response Object

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "data": [ |
| 3 | /* Array of Model objects */ |
| 4 | ] |
| 5 | } |
```

#### Model Object Schema

Each model in the `data` array contains the following standardized fields:

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique model identifier used in API requests (e.g., `"google/gemini-2.5-pro-preview"`) |
| `canonical_slug` | `string` | Permanent slug for the model that never changes |
| `name` | `string` | Human-readable display name for the model |
| `created` | `number` | Unix timestamp of when the model was added to OpenRouter |
| `description` | `string` | Detailed description of the model’s capabilities and characteristics |
| `context_length` | `number` | Maximum context window size in tokens |
| `architecture` | `Architecture` | Object describing the model’s technical capabilities |
| `pricing` | `Pricing` | Lowest price structure for using this model |
| `top_provider` | `TopProvider` | Configuration details for the primary provider |
| `per_request_limits` | Rate limiting information (null if no limits) |  |
| `supported_parameters` | `string[]` | Array of supported API parameters for this model |
| `default_parameters` | `object | null` | Default parameter values for this model (null if none) |
| `expiration_date` | `string | null` | Deprecation date for the model endpoint (null if not deprecated) |

#### Architecture Object

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "input_modalities": string[], // Supported input types: ["file", "image", "text"] |
| 3 | "output_modalities": string[], // Supported output types: ["text"] |
| 4 | "tokenizer": string,          // Tokenization method used |
| 5 | "instruct_type": string | null // Instruction format type (null if not applicable) |
| 6 | } |
```

#### Pricing Object

All pricing values are in USD per token/request/unit. A value of `"0"` indicates the feature is free.

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "prompt": string,           // Cost per input token |
| 3 | "completion": string,       // Cost per output token |
| 4 | "request": string,          // Fixed cost per API request |
| 5 | "image": string,           // Cost per image input |
| 6 | "web_search": string,      // Cost per web search operation |
| 7 | "internal_reasoning": string, // Cost for internal reasoning tokens |
| 8 | "input_cache_read": string,   // Cost per cached input token read |
| 9 | "input_cache_write": string   // Cost per cached input token write |
| 10 | } |
```

#### Top Provider Object

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "context_length": number,        // Provider-specific context limit |
| 3 | "max_completion_tokens": number, // Maximum tokens in response |
| 4 | "is_moderated": boolean         // Whether content moderation is applied |
| 5 | } |
```

#### Supported Parameters

The `supported_parameters` array indicates which OpenAI-compatible parameters work with each model:

* `tools` - Function calling capabilities
* `tool_choice` - Tool selection control
* `max_tokens` - Response length limiting
* `temperature` - Randomness control
* `top_p` - Nucleus sampling
* `reasoning` - Internal reasoning mode
* `include_reasoning` - Include reasoning in response
* `structured_outputs` - JSON schema enforcement
* `response_format` - Output format specification
* `stop` - Custom stop sequences
* `frequency_penalty` - Repetition reduction
* `presence_penalty` - Topic diversity
* `seed` - Deterministic outputs

##### Different models tokenize text in different ways

Some models break up text into chunks of multiple characters (GPT, Claude,
Llama, etc), while others tokenize by character (PaLM). This means that token
counts (and therefore costs) will vary between models, even when inputs and
outputs are the same. Costs are displayed and billed according to the
tokenizer for the model in use. You can use the `usage` field in the response
to get the token counts for the input and output.

If there are models or providers you are interested in that OpenRouter doesn’t have, please tell us about them in our [Discord channel](https://openrouter.ai/discord).

## For Providers

If you’re interested in working with OpenRouter, you can learn more on our [providers page](/docs/use-cases/for-providers).

Was this page helpful?

YesNo

[Previous](/docs/guides/overview/principles)[#### Multimodal Capabilities

Send images, PDFs, audio, and video to OpenRouter models

Next](/docs/guides/overview/multimodal/overview)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
