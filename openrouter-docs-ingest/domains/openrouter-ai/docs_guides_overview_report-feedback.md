---
source: https://openrouter.ai/docs/guides/overview/report-feedback
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:18.372Z
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
* [Feedback Categories](#feedback-categories)
* [Reporting from the Chatroom](#reporting-from-the-chatroom)
* [Reporting from the Activity Page](#reporting-from-the-activity-page)
* [Per-Generation Feedback](#per-generation-feedback)
* [General Feedback Button](#general-feedback-button)
* [What Happens After You Submit](#what-happens-after-you-submit)

[Overview](/docs/quickstart)

# Report Feedback

Copy page

Help us improve OpenRouter by reporting issues with AI generations. You can submit feedback directly from the Chatroom or the Activity page.

## Overview

The Report Feedback feature allows you to flag problematic generations with a category and description. This helps our team identify and address issues with model responses, latency, billing, and more.

### Feedback Categories

When reporting feedback, select the category that best describes the issue:

* **Latency**: Response was slower than expected
* **Incoherence**: Response didn’t make sense or was off-topic
* **Incorrect Response**: Response contained factual errors or wrong information
* **Formatting**: Response had formatting issues (markdown, code blocks, etc.)
* **Billing**: Unexpected charges or token counts
* **API Error**: Technical errors or failed requests
* **Other**: Any other issue not covered above

## Reporting from the Chatroom

In the Chatroom, you can report feedback on individual assistant messages:

1. Hover over an assistant message to reveal the action buttons
2. Click the bug icon to open the Report Feedback dialog
3. Select a category that describes the issue
4. Add a comment explaining what went wrong
5. Click **Submit** to send your feedback

The generation ID is automatically captured from the message, so you don’t need to look it up.

## Reporting from the Activity Page

The Activity page offers two ways to report feedback:

### Per-Generation Feedback

Each row in your activity history has a feedback button:

1. Go to [openrouter.ai/activity](https://openrouter.ai/activity)
2. Find the generation you want to report
3. Click the bug icon on that row
4. Select a category and add your comment
5. Click **Submit**

### General Feedback Button

For reporting issues when you have a generation ID handy:

1. Go to [openrouter.ai/activity](https://openrouter.ai/activity)
2. Click the **Report Feedback** button in the header (top right)
3. Enter the generation ID (found in your API response or activity row)
4. Select a category and add your comment
5. Click **Submit**

##### Finding Your Generation ID

The generation ID is returned in the API response under the `id` field. You can also find it by clicking on a row in the Activity page to view the generation details.

## What Happens After You Submit

Your feedback is reviewed by our team to help improve:

* Model routing and provider selection
* Error handling and recovery
* Billing accuracy
* Overall platform reliability

We appreciate your help in making OpenRouter better for everyone.

Was this page helpful?

YesNo

[Previous](/docs/faq)[#### Model Fallbacks

Automatic failover between models

Next](/docs/guides/routing/model-fallbacks)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
