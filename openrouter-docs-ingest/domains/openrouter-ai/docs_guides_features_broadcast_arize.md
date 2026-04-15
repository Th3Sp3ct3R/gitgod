---
source: https://openrouter.ai/docs/guides/features/broadcast/arize
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:47.469Z
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

* [Step 1: Get your Arize credentials](#step-1-get-your-arize-credentials)
* [Step 2: Enable Broadcast in OpenRouter](#step-2-enable-broadcast-in-openrouter)
* [Step 3: Configure Arize AI](#step-3-configure-arize-ai)
* [Step 4: Test and save](#step-4-test-and-save)
* [Step 5: Send a test trace](#step-5-send-a-test-trace)
* [Custom Metadata](#custom-metadata)
* [Supported Metadata Keys](#supported-metadata-keys)
* [Example](#example)
* [Additional Context](#additional-context)
* [Privacy Mode](#privacy-mode)

[Features](/docs/guides/features/presets)[Broadcast](/docs/guides/features/broadcast/overview)

# Arize AI

Copy page

Send traces to Arize AI

[Arize AX](https://arize.com/) is an evaluation and observability platform developed by Arize AI; it offers tools for agent tracing, evals, prompt optimization, and more.

## Step 1: Get your Arize credentials

In Arize, navigate to your space settings to find your API key and space key:

1. Log in to your Arize account
2. Go to **Space Settings** to find your Space Key
3. Go to **API Keys** to create or copy your API key
4. Note the Model ID you want to use for organizing traces

## Step 2: Enable Broadcast in OpenRouter

Go to [Settings > Observability](https://openrouter.ai/settings/observability) and toggle **Enable Broadcast**.

![Enable Broadcast](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/3e095d95758bab05594f468011be81b7d5a2fb19293fa91d5b3923d9f09b81d8/content/pages/features/broadcast/broadcast-enable.png)

## Step 3: Configure Arize AI

Click the edit icon next to **Arize AI** and enter:

* **Api Key**: Your Arize API key
* **Space Key**: Your Arize space key
* **Model Id**: The model identifier for organizing your traces in Arize
* **Base Url** (optional): Default is `https://otlp.arize.com`

## Step 4: Test and save

Click **Test Connection** to verify the setup. The configuration only saves if the test passes.

## Step 5: Send a test trace

Make an API request through OpenRouter and view the trace in your Arize
dashboard under the specified model.

![Arize Trace View](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/a917bd16b2036c129bd72451d4650953812a85f8c7585dd39804fceef83857d9/content/pages/features/broadcast/broadcast-arize-trace.png)

## Custom Metadata

Arize uses the [OpenInference](https://github.com/Arize-ai/openinference) semantic convention for tracing. Custom metadata from the `trace` field is sent as span attributes in the OTLP payload.

### Supported Metadata Keys

| Key | Arize Mapping | Description |
| --- | --- | --- |
| `trace_id` | Trace ID | Group multiple requests into a single trace |
| `trace_name` | Span Name | Custom name for the root trace |
| `span_name` | Span Name | Name for intermediate spans in the hierarchy |
| `generation_name` | Span Name | Name for the LLM generation span |
| `parent_span_id` | Parent Span ID | Link to an existing span in your trace hierarchy |

### Example

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model": "openai/gpt-4o", |
| 3 | "messages": [{ "role": "user", "content": "Classify this text..." }], |
| 4 | "user": "user_12345", |
| 5 | "session_id": "session_abc", |
| 6 | "trace": { |
| 7 | "trace_id": "classification_pipeline_001", |
| 8 | "trace_name": "Text Classification", |
| 9 | "generation_name": "Classify Sentiment", |
| 10 | "dataset": "customer_feedback", |
| 11 | "experiment_id": "exp_v3" |
| 12 | } |
| 13 | } |
```

### Additional Context

* Custom metadata keys from `trace` are included as span attributes under the `metadata.*` namespace
* The `user` field maps to user identification in span attributes
* The `session_id` field maps to session tracking in span attributes
* Token usage, costs, and model parameters are automatically included as OpenInference-compatible attributes

## Privacy Mode

When [Privacy Mode](/docs/guides/features/broadcast#privacy-mode) is enabled for this destination, prompt and completion content is excluded from traces. All other trace data — token usage, costs, timing, model information, and custom metadata — is still sent normally. See [Privacy Mode](/docs/guides/features/broadcast#privacy-mode) for details.

Was this page helpful?

YesNo

[Previous](/docs/guides/features/broadcast/overview)[#### Braintrust

Send traces to Braintrust

Next](/docs/guides/features/broadcast/braintrust)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
