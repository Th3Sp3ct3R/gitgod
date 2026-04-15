---
source: https://openrouter.ai/docs/guides/features/broadcast/datadog
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:51.372Z
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

* [Step 1: Create a Datadog API key](#step-1-create-a-datadog-api-key)
* [Step 2: Enable Broadcast in OpenRouter](#step-2-enable-broadcast-in-openrouter)
* [Step 3: Configure Datadog](#step-3-configure-datadog)
* [Step 4: Test and save](#step-4-test-and-save)
* [Step 5: Send a test trace](#step-5-send-a-test-trace)
* [Custom Metadata](#custom-metadata)
* [Supported Metadata Keys](#supported-metadata-keys)
* [Tags and Metadata](#tags-and-metadata)
* [Example](#example)
* [Viewing in Datadog](#viewing-in-datadog)
* [Privacy Mode](#privacy-mode)

[Features](/docs/guides/features/presets)[Broadcast](/docs/guides/features/broadcast/overview)

# Datadog

Copy page

Send traces to Datadog

With [Datadog LLM Observability](https://docs.datadoghq.com/llm_observability), you can investigate the root cause of issues, monitor operational performance, and evaluate the quality, privacy, and safety of your LLM applications.

## Step 1: Create a Datadog API key

In Datadog, go to **Organization Settings > API Keys** and create a new key.

## Step 2: Enable Broadcast in OpenRouter

Go to [Settings > Observability](https://openrouter.ai/settings/observability) and toggle **Enable Broadcast**.

![Enable Broadcast](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/3e095d95758bab05594f468011be81b7d5a2fb19293fa91d5b3923d9f09b81d8/content/pages/features/broadcast/broadcast-enable.png)

## Step 3: Configure Datadog

Click the edit icon next to **Datadog** and enter:

* **Api Key**: Your Datadog API key
* **Ml App**: A name for your application (e.g., “production-app”)
* **Url** (optional): Default is `https://api.us5.datadoghq.com`. Change for other regions

![Datadog Configuration](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/bd0388077ffa2902197f1d1fa6119f5ce77bf529fe0d8c7c4c95f9fb46059daf/content/pages/features/broadcast/broadcast-datadog-config.png)

## Step 4: Test and save

Click **Test Connection** to verify the setup. The configuration only saves if the test passes.

![Datadog Configured](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/755c64c80cd8210cb44151d7d67c6937a16c70eb7cc3abe752c788bf72b5dc20/content/pages/features/broadcast/broadcast-datadog-configured.png)

## Step 5: Send a test trace

Make an API request through OpenRouter and view the trace in Datadog.

![Datadog Trace](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/2bf9b44fd78abdb48c8a14645b5113b0f0ce1b754828a17fc07d1fe7cdcbe1e0/content/pages/features/broadcast/broadcast-datadog-trace.png)

## Custom Metadata

Datadog LLM Observability supports tags and custom metadata for organizing and filtering your traces.

### Supported Metadata Keys

| Key | Datadog Mapping | Description |
| --- | --- | --- |
| `trace_id` | Trace ID | Group multiple requests into a single trace |
| `trace_name` | Span Name | Custom name for the root span |
| `span_name` | Span Name | Name for intermediate workflow spans |
| `generation_name` | Span Name | Name for the LLM span |

### Tags and Metadata

Datadog uses tags for filtering and grouping traces. The following are automatically added as tags:

* `service:{ml_app}` - Your configured ML App name
* `user_id:{user}` - From the `user` field in your request

Any additional keys in `trace` are passed to the span’s `meta` object and can be viewed in Datadog’s trace details.

### Example

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model": "openai/gpt-4o", |
| 3 | "messages": [{ "role": "user", "content": "Hello!" }], |
| 4 | "user": "user_12345", |
| 5 | "session_id": "session_abc", |
| 6 | "trace": { |
| 7 | "trace_name": "Customer Support Bot", |
| 8 | "environment": "production", |
| 9 | "team": "support", |
| 10 | "ticket_id": "TICKET-1234" |
| 11 | } |
| 12 | } |
```

### Viewing in Datadog

In Datadog LLM Observability, you can:

* Filter traces by tags in the trace list
* View custom metadata in the trace details panel
* Create monitors and dashboards using metadata fields

## Privacy Mode

When [Privacy Mode](/docs/guides/features/broadcast#privacy-mode) is enabled for this destination, prompt and completion content is excluded from traces. All other trace data — token usage, costs, timing, model information, and custom metadata — is still sent normally. See [Privacy Mode](/docs/guides/features/broadcast#privacy-mode) for details.

Was this page helpful?

YesNo

[Previous](/docs/guides/features/broadcast/opik)[#### Grafana Cloud

Send traces to Grafana Cloud

Next](/docs/guides/features/broadcast/grafana)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
