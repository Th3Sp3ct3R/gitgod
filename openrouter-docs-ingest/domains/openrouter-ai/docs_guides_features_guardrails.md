---
source: https://openrouter.ai/docs/guides/features/guardrails
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:43.551Z
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

* [Enabling Guardrails](#enabling-guardrails)
* [Guardrail Settings](#guardrail-settings)
* [Assigning Guardrails](#assigning-guardrails)
* [Guardrail Hierarchy](#guardrail-hierarchy)
* [Eligibility Preview](#eligibility-preview)
* [Budget Enforcement](#budget-enforcement)
* [API Access](#api-access)

[Features](/docs/guides/features/presets)

# Guardrails

Copy page

Control spending and model access for your organization

Guardrails let organizations control how their members and API keys can use OpenRouter. You can set spending limits, restrict which models and providers are available, and enforce data privacy policies.

Any existing account wide settings will continue to apply. Guardrails help enforce tighter restrictions for individual API keys or users.

## Enabling Guardrails

To create and manage guardrails for your account or organization:

1. Navigate to [Settings > Privacy](https://openrouter.ai/settings/privacy) in your OpenRouter dashboard
2. Scroll to the Guardrails section
3. Click “New Guardrail” to create your first guardrail

#####

If you’re using an organization account, you must be an organization admin to create and manage guardrails.

## Guardrail Settings

Each guardrail can include any combination of:

* **Budget limit** - Spending cap in USD that resets daily, weekly, or monthly. Requests are rejected when the limit is reached.
* **Model allowlist** - Restrict to specific models. Leave empty to allow all.
* **Provider allowlist** - Restrict to specific providers. Leave empty to allow all.
* **Zero Data Retention** - Require ZDR-compatible providers for all requests.

#####

Individual API key budgets still apply. The lower limit wins.

## Assigning Guardrails

Guardrails can be assigned at multiple levels:

* **Member assignments** - Assign to specific organization members. Sets a baseline for all their API keys and chatroom usage.
* **API key assignments** - Assign directly to specific keys for granular control. Layers on top of member guardrails.

Only one guardrail can be directly assigned to a user or key. All of an organization member’s created API keys will implicitly follow that user’s guardrail assignment, even if the API Key is further restricted with its own guardrail assignment.

## Guardrail Hierarchy

Account-wide privacy and provider settings are always enforced as a default guardrail. When additional guardrails apply to a request, they are combined using the following rules:

* **Provider allowlists**: Intersection across all guardrails (only providers allowed by all guardrails are available)
* **Model allowlists**: Intersection across all guardrails (only models allowed by all guardrails are available)
* **Zero Data Retention**: OR logic (if any guardrail enforces ZDR, it is enforced)
* **Budget limits**: Each guardrail’s budget is checked independently. See [Budget Enforcement](/_/openrouter.ai/_/_/_/docs/guides/features/guardrails#budget-enforcement) for details.

This means stricter rules always win when multiple guardrails apply. For example, if a member guardrail allows providers A, B, and C, but an API key guardrail only allows providers A and B, only providers A and B will be available for that key.

## Eligibility Preview

When viewing a guardrail, you can see an eligibility preview that shows which providers and models are available with that guardrail combined with your account settings. This helps you understand the effective restrictions before assigning the guardrail.

## Budget Enforcement

Guardrail budgets are enforced per-user and per-key, not shared across all users with that guardrail. When an API key makes a request, its usage counts toward both the key’s budget and the owning member’s budget.

**Example 1: Member guardrail with $50/day limit**

You assign a guardrail with a $50/day budget to three team members: Alice, Bob, and Carol. Each member gets their own $50/day allowance. If Alice spends $50, she is blocked, but Bob and Carol can still spend up to $50 each.

**Example 2: API key usage accumulates to member usage**

Alice creates two API keys, both assigned a guardrail with a $20/day limit. Key A spends $15 and Key B spends $10. Each key is within its own $20 limit, but Alice’s total member usage is $25. If Alice also has a member guardrail with a $20/day limit, her requests would be blocked because her combined usage ($25) exceeds the member limit ($20).

**Example 3: Layered guardrails**

Bob has a member guardrail with a $100/day limit. His API key has a separate guardrail with a $30/day limit. The key can only spend $30/day (its own limit), but Bob’s total usage across all his keys cannot exceed $100/day. Both limits are checked independently on each request.

## API Access

You can manage guardrails programmatically using the OpenRouter API. This allows you to create, update, delete, and assign guardrails to API keys and organization members directly from your code.

See the [Guardrails API reference](/docs/api/api-reference/guardrails/list-guardrails) for available endpoints and usage examples.

Was this page helpful?

YesNo

[Previous](/docs/app-attribution)[#### Service Tiers

Control cost and latency tradeoffs with service tier selection

Next](/docs/guides/features/service-tiers)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
