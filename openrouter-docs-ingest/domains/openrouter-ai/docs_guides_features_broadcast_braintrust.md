---
source: https://openrouter.ai/docs/guides/features/broadcast/braintrust
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:48.417Z
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
    - [Overview](/docs/guides/features/broadcast/overview)
    - [Arize AI](/docs/guides/features/broadcast/arize)
    - [Braintrust](/docs/guides/features/broadcast/braintrust)
    - [ClickHouse](/docs/guides/features/broadcast/clickhouse)
    - [Comet Opik](/docs/guides/features/broadcast/opik)
    - [Datadog](/docs/guides/features/broadcast/datadog)
    - [Grafana Cloud](/docs/guides/features/broadcast/grafana)
    - [Langfuse](/docs/guides/features/broadcast/langfuse)
    - [LangSmith](/docs/guides/features/broadcast/langsmith)
    - [New Relic](/docs/guides/features/broadcast/newrelic)
    - [OpenTelemetry Collector](/docs/guides/features/broadcast/otel-collector)
    - [PostHog](/docs/guides/features/broadcast/posthog)
    - [Ramp](/docs/guides/features/broadcast/ramp)
    - [S3 / S3-Compatible](/docs/guides/features/broadcast/s3)
    - [Sentry](/docs/guides/features/broadcast/sentry)
    - [Snowflake](/docs/guides/features/broadcast/snowflake)
    - [W&B Weave](/docs/guides/features/broadcast/weave)
    - [Webhook](/docs/guides/features/broadcast/webhook)
* + Privacy
  + Best Practices
  + Guides
  + Community

Light

On this page

* [Step 1: Get your Braintrust API key and Project ID](#step-1-get-your-braintrust-api-key-and-project-id)
* [Step 2: Enable Broadcast in OpenRouter](#step-2-enable-broadcast-in-openrouter)
* [Step 3: Configure Braintrust](#step-3-configure-braintrust)
* [Step 4: Test and save](#step-4-test-and-save)
* [Step 5: Send a test trace](#step-5-send-a-test-trace)
* [Custom Metadata](#custom-metadata)
* [Supported Metadata Keys](#supported-metadata-keys)
* [Example](#example)
* [Metrics and Costs](#metrics-and-costs)
* [Additional Context](#additional-context)
* [Privacy Mode](#privacy-mode)

[Features](/docs/guides/features/presets)[Broadcast](/docs/guides/features/broadcast/overview)

# Braintrust

Copy page

Send traces to Braintrust

[Braintrust](https://www.braintrust.dev/) is an end-to-end platform for evaluating, monitoring, and improving LLM applications.

## Step 1: Get your Braintrust API key and Project ID

In Braintrust, go to your [Account Settings](https://www.braintrust.dev/app/settings) to create an API key, and find your Project ID in your project’s settings.

![Braintrust Project ID](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/ae8543a6d27222b8f750e4e9510f7205c32f1a999073400ef14fd0a88ba649b1/content/pages/features/broadcast/braintrust-project-id-example.png)

## Step 2: Enable Broadcast in OpenRouter

Go to [Settings > Observability](https://openrouter.ai/settings/observability) and toggle **Enable Broadcast**.

![Enable Broadcast](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/3e095d95758bab05594f468011be81b7d5a2fb19293fa91d5b3923d9f09b81d8/content/pages/features/broadcast/broadcast-enable.png)

## Step 3: Configure Braintrust

Click the edit icon next to **Braintrust** and enter:

* **Api Key**: Your Braintrust API key
* **Project Id**: Your Braintrust project ID
* **Base Url** (optional): Default is `https://api.braintrust.dev`

![Braintrust Configuration](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/2e424e28cce938fe94f28acee1c34fc83695c7c0085d98bcbc2cc9434f695cd9/content/pages/features/broadcast/broadcast-braintrust-config.png)

## Step 4: Test and save

Click **Test Connection** to verify the setup. The configuration only saves if the test passes.

![Braintrust Configured](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/447023a4f5241b7d572d70b210fadd341824c4ee7a97d6e0a87bd8d45692457d/content/pages/features/broadcast/broadcast-braintrust-configured.png)

## Step 5: Send a test trace

Make an API request through OpenRouter and view the trace in Braintrust.

![Braintrust Trace](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/0ef5e7f7e6f1632eac10774e85b4570829e4a4236592049b3b8d0e7dbc745c19/content/pages/features/broadcast/broadcast-braintrust-trace.png)

## Custom Metadata

Braintrust supports custom metadata, tags, and nested span structures for organizing your LLM logs.

### Supported Metadata Keys

| Key | Braintrust Mapping | Description |
| --- | --- | --- |
| `trace_id` | Span ID / Root Span ID | Group multiple logs into a single trace |
| `trace_name` | Name | Custom name displayed in the Braintrust log view |
| `span_name` | Name | Name for intermediate spans in the hierarchy |
| `generation_name` | Name | Name for the LLM span |

### Example

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model": "openai/gpt-4o", |
| 3 | "messages": [{ "role": "user", "content": "Generate a summary..." }], |
| 4 | "user": "user_12345", |
| 5 | "session_id": "session_abc", |
| 6 | "trace": { |
| 7 | "trace_id": "eval_run_456", |
| 8 | "trace_name": "Summarization Eval", |
| 9 | "generation_name": "GPT-4o Summary", |
| 10 | "eval_dataset": "news_articles", |
| 11 | "experiment_id": "exp_789" |
| 12 | } |
| 13 | } |
```

### Metrics and Costs

Braintrust receives detailed metrics for each LLM call:

* Token counts (prompt, completion, total)
* Cached token usage when available
* Reasoning token counts for supported models
* Cost information (input, output, total costs)
* Duration and timing metrics

### Additional Context

* The `user` field maps to Braintrust’s `user_id` in metadata
* The `session_id` field maps to `session_id` in metadata
* Custom metadata keys are included in the span’s metadata object
* Tags are passed through for filtering in the Braintrust UI

## Privacy Mode

When [Privacy Mode](/docs/guides/features/broadcast#privacy-mode) is enabled for this destination, prompt and completion content is excluded from traces. All other trace data — token usage, costs, timing, model information, and custom metadata — is still sent normally. See [Privacy Mode](/docs/guides/features/broadcast#privacy-mode) for details.

Was this page helpful?

YesNo

[Previous](/docs/guides/features/broadcast/arize)[#### ClickHouse

Send traces to ClickHouse

Next](/docs/guides/features/broadcast/clickhouse)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
