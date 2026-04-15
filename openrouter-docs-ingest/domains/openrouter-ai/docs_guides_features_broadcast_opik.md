---
source: https://openrouter.ai/docs/guides/features/broadcast/opik
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:50.364Z
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

* [Step 1: Get your Opik credentials](#step-1-get-your-opik-credentials)
* [Step 2: Enable Broadcast in OpenRouter](#step-2-enable-broadcast-in-openrouter)
* [Step 3: Configure Comet Opik](#step-3-configure-comet-opik)
* [Step 4: Test and save](#step-4-test-and-save)
* [Step 5: Send a test trace](#step-5-send-a-test-trace)
* [Custom Metadata](#custom-metadata)
* [Supported Metadata Keys](#supported-metadata-keys)
* [Example](#example)
* [Additional Context](#additional-context)
* [Privacy Mode](#privacy-mode)

[Features](/docs/guides/features/presets)[Broadcast](/docs/guides/features/broadcast/overview)

# Comet Opik

Copy page

Send traces to Comet Opik

[Comet Opik](https://www.comet.com/site/products/opik/) is an open-source platform for evaluating, testing, and monitoring LLM applications.

## Step 1: Get your Opik credentials

In Comet, set up your Opik workspace and project:

1. Log in to your Comet account
2. Create or select a workspace for your LLM traces
3. Create a project within the workspace
4. Go to **Settings > API Keys** to create or copy your API key

## Step 2: Enable Broadcast in OpenRouter

Go to [Settings > Observability](https://openrouter.ai/settings/observability) and toggle **Enable Broadcast**.

![Enable Broadcast](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/3e095d95758bab05594f468011be81b7d5a2fb19293fa91d5b3923d9f09b81d8/content/pages/features/broadcast/broadcast-enable.png)

## Step 3: Configure Comet Opik

Click the edit icon next to **Comet Opik** and enter:

* **Api Key**: Your Comet API key (starts with `opik_...`)
* **Workspace**: Your Comet workspace name
* **Project Name**: The project name where traces will be logged

## Step 4: Test and save

Click **Test Connection** to verify the setup. The configuration only saves if the test passes.

## Step 5: Send a test trace

Make an API request through OpenRouter and view the trace in your Opik
project dashboard.

![Opik Trace View](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/bd71a7fd9d80d09e76d05ea52e654e94dd15e68914669145afe6416e832a0103/content/pages/features/broadcast/broadcast-opik-trace.png)

## Custom Metadata

Comet Opik supports custom metadata on both traces and spans for organizing and filtering your LLM evaluations.

### Supported Metadata Keys

| Key | Opik Mapping | Description |
| --- | --- | --- |
| `trace_id` | Trace metadata (`openrouter_trace_id`) | Group multiple requests into a single trace |
| `trace_name` | Trace Name | Custom name displayed in the Opik trace list |
| `span_name` | Span Name | Name for intermediate spans in the hierarchy |
| `generation_name` | Span Name | Name for the LLM generation span |

### Example

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model": "openai/gpt-4o", |
| 3 | "messages": [{ "role": "user", "content": "Evaluate this response..." }], |
| 4 | "user": "user_12345", |
| 5 | "session_id": "session_abc", |
| 6 | "trace": { |
| 7 | "trace_name": "Response Quality Eval", |
| 8 | "generation_name": "Quality Assessment", |
| 9 | "eval_suite": "quality_v2", |
| 10 | "test_case_id": "tc_001" |
| 11 | } |
| 12 | } |
```

### Additional Context

* Custom metadata keys from `trace` are included in both the trace and span metadata objects
* Cost information (input, output, total) is automatically added to span metadata
* Model parameters and finish reasons are included in span metadata when available
* The `user` field maps to user identification in trace metadata
* Opik uses UUIDv7 format for trace and span IDs internally; original OpenRouter IDs are stored in metadata as `openrouter_trace_id` and `openrouter_observation_id`

## Privacy Mode

When [Privacy Mode](/docs/guides/features/broadcast#privacy-mode) is enabled for this destination, prompt and completion content is excluded from traces. All other trace data — token usage, costs, timing, model information, and custom metadata — is still sent normally. See [Privacy Mode](/docs/guides/features/broadcast#privacy-mode) for details.

Was this page helpful?

YesNo

[Previous](/docs/guides/features/broadcast/clickhouse)[#### Datadog

Send traces to Datadog

Next](/docs/guides/features/broadcast/datadog)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
