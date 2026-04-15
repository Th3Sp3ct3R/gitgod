---
source: https://openrouter.ai/docs/guides/features/zdr
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:41.834Z
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

* [How OpenRouter Manages Data Policies](#how-openrouter-manages-data-policies)
* [Per-Request ZDR Enforcement](#per-request-zdr-enforcement)
* [Usage](#usage)
* [Caching](#caching)
* [OpenRouter’s Retention Policy](#openrouters-retention-policy)
* [Zero Retention Endpoints](#zero-retention-endpoints)

[Features](/docs/guides/features/presets)

# Zero Data Retention

Copy page

How OpenRouter gives you control over your data

Zero Data Retention (ZDR) means that a provider will not store your data for any period of time.

OpenRouter has a [setting](/settings/privacy) that, when enabled, only allows you to route to endpoints that have a Zero Data Retention policy.

Providers that do not retain your data are also unable to train on your data. However we do have some endpoints & providers who do not train on your data but *do* retain it (e.g. to scan for abuse or for legal reasons). OpenRouter gives you controls over both of these policies.

## How OpenRouter Manages Data Policies

OpenRouter works with providers to understand each of their data policies and structures the policy data in a way that gives you control over which providers you want to route to.

Note that a provider’s general policy may differ from the specific policy for a given endpoint. OpenRouter keeps track of the specific policy for each endpoint, works with providers to keep these policies up to date, and in some cases creates special agreements with providers to ensure data retention or training policies that are more privacy-focused than their default policies.

#####

If OpenRouter is not able to establish or ascertain a clear policy for a provider or endpoint, we take a conservative stance and assume that the endpoint both retains and trains on data and mark it as such.

A full list of providers and their data policies can be found [here](/docs/guides/privacy/provider-logging#data-retention--logging). Note that this list shows the default policy for each provider; if there is a particular endpoint that has a policy that differs from the provider default, it may not be available if “ZDR Only” is enabled.

## Per-Request ZDR Enforcement

In addition to the global ZDR setting in your [privacy settings](/settings/privacy), you can enforce Zero Data Retention on a per-request basis using the `zdr` parameter in your API calls.

The request-level `zdr` parameter operates as an “OR” with your account-wide ZDR setting - if either is enabled, ZDR enforcement will be applied. This means the per-request parameter can only be used to ensure ZDR is enabled for a specific request, not to override or disable account-wide ZDR enforcement.

This is useful for customers who don’t want to globally enforce ZDR but need to ensure specific requests only route to ZDR endpoints.

### Usage

Include the `zdr` parameter in your provider preferences:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model": "gpt-4", |
| 3 | "messages": [...], |
| 4 | "provider": { |
| 5 | "zdr": true |
| 6 | } |
| 7 | } |
```

When `zdr` is set to `true`, the request will only be routed to endpoints that have a Zero Data Retention policy. When `zdr` is `false` or not provided, ZDR enforcement will still apply if enabled in your account settings.

## Caching

Some endpoints/models provide implicit caching of prompts. This keeps repeated prompt data in an in-memory cache in the provider’s datacenter, so that the repeated part of the prompt does not need to be re-processed. This can lead to considerable cost savings.

OpenRouter has taken the stance that in-memory caching of prompts is *not* considered “retaining” data, and we therefore allow endpoints/models with implicit caching to be hit when a ZDR routing policy is in effect.

## OpenRouter’s Retention Policy

OpenRouter itself has a ZDR policy; your prompts are not retained unless you specifically opt in to prompt logging.

## Zero Retention Endpoints

The following endpoints have a ZDR policy. Note that this list is also available progammatically via <https://openrouter.ai/api/v1/endpoints/zdr>. It is automatically updated when there are changes to a provider’s data policy.:

| Model | Provider | Implicit Caching |
| --- | --- | --- |

Was this page helpful?

YesNo

[Previous](/docs/guides/features/zero-completion-insurance)[#### App Attribution

Get your app featured in OpenRouter rankings and analytics

Next](/docs/app-attribution)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
