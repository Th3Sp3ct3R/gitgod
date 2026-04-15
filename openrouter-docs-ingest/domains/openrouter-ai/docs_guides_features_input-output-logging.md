---
source: https://openrouter.ai/docs/guides/features/input-output-logging
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:45.480Z
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

* [Enabling Input & Output Logging](#enabling-input--output-logging)
* [Viewing Stored Prompts](#viewing-stored-prompts)
* [Storage, Privacy, and Access](#storage-privacy-and-access)
* [EU Routing Limitation](#eu-routing-limitation)
* [Comparison with Broadcast](#comparison-with-broadcast)
* [Comparison with OpenRouter Using Inputs/Outputs](#comparison-with-openrouter-using-inputsoutputs)

[Features](/docs/guides/features/presets)

# Input & Output Logging

Copy page

Privately store and review your prompts and completions

Input & Output Logging lets you privately save and review the full content of your requests and responses. Use it to debug issues, compare model responses, and optimize your prompts. Once enabled, your prompts and completions are accessible from your [Logs](https://openrouter.ai/logs) page.

#####

This feature is currently in **Beta**.

## Enabling Input & Output Logging

Navigate to your [**Observability**](https://openrouter.ai/workspaces/default/observability) settings and toggle **Input & Output Logging** to enable it. For organizations, only admins can view and toggle this setting.

## Viewing Stored Prompts

Once Input & Output Logging is enabled, you can view your stored prompts and completions from the [Logs](https://openrouter.ai/logs) page:

1. Open your **Logs** page
2. Click on a generation in the list to open the generation detail view
3. Switch between the **Prompt** and **Completion** tabs to review the full content

The generation detail view also shows metadata including the model used, provider, token counts, and cost.

#####

Only generations made after enabling Input & Output Logging will have stored content.

## Storage, Privacy, and Access

* **Storage**: Prompt and response data is stored in an isolated Google Cloud Storage project with separate access controls. All data is encrypted at rest using Google Cloud’s [default encryption](https://docs.cloud.google.com/docs/security/encryption/default-encryption) (AES-256).
* **Retention**: Data is retained for a minimum of 3 months, and may be retained beyond 3 months at OpenRouter’s discretion unless you request deletion. Account owners can request deletion of their stored data at any time by contacting support@openrouter.ai.
* **Privacy**: OpenRouter does not access or use your prompt and response data logged with this feature for model training, analytics, or any other purpose. The data is stored solely for your own review and use. See the [Privacy Policy](/privacy) for full details.
* **Organization access**: For organization accounts, only organization admins can view stored prompt and response content. Non-admin members cannot access it.

## EU Routing Limitation

At this time, Input & Output Logging does **not** apply to requests routed through `eu.openrouter.ai`. If you have EU routing enabled, requests processed through the EU endpoint will work as normal but input/output logging will be skipped.

## Comparison with Broadcast

Input & Output Logging allows you to view your prompts and completions in your logs on the OpenRouter platform. Broadcast sends your data to an external observability tool. Both features are configured in your workspace’s [Observability settings](https://openrouter.ai/settings/observability) and can be used together for comprehensive observability.

|  | Input & Output Logging | Broadcast |
| --- | --- | --- |
| **Where data is stored** | On OpenRouter | On your external platform |
| **Setup** | Single toggle | Configure destinations and credentials |
| **Access** | Logs page | Your observability platform |
| **Use case** | Quick debugging, evaluating responses, and optimizing prompts | Production monitoring and analytics |
| **Privacy** | Always private (admin-only access) | Configurable per destination |

## Comparison with OpenRouter Using Inputs/Outputs

Input & Output Logging keeps your data strictly private for your own use, makes your prompts and completions visible in logs, and is enabled in Observability. Enabling OpenRouter to use your inputs/outputs is an independent setting, enabled in Privacy, that allows OpenRouter to use your data to improve the product in exchange for a 1% discount on all model usage. You can enable one, the other, or both.

|  | Input & Output Logging | Data Discount Logging |
| --- | --- | --- |
| **Purpose** | Private review and debugging | Discount in exchange for data sharing |
| **Privacy** | Never used by OpenRouter | OpenRouter may use data to improve the product |
| **Discount** | No discount | 1% discount on all LLMs |
| **Where to enable** | Observability settings | Privacy settings |

Was this page helpful?

YesNo

[Previous](/docs/guides/features/service-tiers)[#### Broadcast

Send traces to external observability platforms

Next](/docs/guides/features/broadcast/overview)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
