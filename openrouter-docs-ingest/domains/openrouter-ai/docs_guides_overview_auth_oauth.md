---
source: https://openrouter.ai/docs/guides/overview/auth/oauth
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:14.430Z
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
    - [OAuth](/docs/guides/overview/auth/oauth)
    - [Management API Keys](/docs/guides/overview/auth/management-api-keys)
    - [BYOK](/docs/guides/overview/auth/byok)
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

* [PKCE Guide](#pkce-guide)
* [Step 1: Send your user to OpenRouter](#step-1-send-your-user-to-openrouter)
* [How to Generate a Code Challenge](#how-to-generate-a-code-challenge)
* [Localhost Apps](#localhost-apps)
* [Step 2: Exchange the code for a user-controlled API key](#step-2-exchange-the-code-for-a-user-controlled-api-key)
* [Step 3: Use the API key](#step-3-use-the-api-key)
* [Error Codes](#error-codes)
* [External Tools](#external-tools)

[Overview](/docs/quickstart)[Authentication](/docs/guides/overview/auth/oauth)

# OAuth PKCE

Copy page

Connect your users to OpenRouter

Users can connect to OpenRouter in one click using [Proof Key for Code Exchange (PKCE)](https://oauth.net/2/pkce/).

Here’s a step-by-step guide:

## PKCE Guide

### Step 1: Send your user to OpenRouter

To start the PKCE flow, send your user to OpenRouter’s `/auth` URL with a `callback_url` parameter pointing back to your site:

With S256 Code Challenge (Recommended)With Plain Code ChallengeWithout Code Challenge

```
|  |
| --- |
| https://openrouter.ai/auth?callback_url=<YOUR_SITE_URL>&code_challenge=<CODE_CHALLENGE>&code_challenge_method=S256 |
```

The `code_challenge` parameter is optional but recommended.

Your user will be prompted to log in to OpenRouter and authorize your app. After authorization, they will be redirected back to your site with a `code` parameter in the URL:

![Alt text](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5c315bc747b843ac0f3c7fd78ef45b58e9b00397e0685020ff6ac837884c8a71/content/pages/auth/auth-request.png)

##### Use SHA-256 for Maximum Security

For maximum security, set `code_challenge_method` to `S256`, and set `code_challenge` to the base64 encoding of the sha256 hash of `code_verifier`.

For more info, [visit Auth0’s docs](https://auth0.com/docs/get-started/authentication-and-authorization-flow/call-your-api-using-the-authorization-code-flow-with-pkce#parameters).

#### How to Generate a Code Challenge

The following example leverages the Web Crypto API and the Buffer API to generate a code challenge for the S256 method. You will need a bundler to use the Buffer API in the web browser:

Generate Code Challenge

```
|  |  |
| --- | --- |
| 1 | import { Buffer } from 'buffer'; |
| 2 |  |
| 3 | async function createSHA256CodeChallenge(input: string) { |
| 4 | const encoder = new TextEncoder(); |
| 5 | const data = encoder.encode(input); |
| 6 | const hash = await crypto.subtle.digest('SHA-256', data); |
| 7 | return Buffer.from(hash).toString('base64url'); |
| 8 | } |
| 9 |  |
| 10 | const codeVerifier = 'your-random-string'; |
| 11 | const generatedCodeChallenge = await createSHA256CodeChallenge(codeVerifier); |
```

#### Localhost Apps

If your app is a local-first app or otherwise doesn’t have a public URL, it is recommended to test with `http://localhost:3000` as the callback and referrer URLs.

When moving to production, replace the localhost/private referrer URL with a public GitHub repo or a link to your project website.

### Step 2: Exchange the code for a user-controlled API key

After the user logs in with OpenRouter, they are redirected back to your site with a `code` parameter in the URL:

![Alt text](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/7c5e0e22334f718612a4a2e88168d104d9a4a3f97c40cb344aa27bb4e335188a/content/pages/auth/code-challenge.png)

Extract this code using the browser API:

Extract Code

```
|  |  |
| --- | --- |
| 1 | const urlParams = new URLSearchParams(window.location.search); |
| 2 | const code = urlParams.get('code'); |
```

Then use it to make an API call to `https://openrouter.ai/api/v1/auth/keys` to exchange the code for a user-controlled API key:

Exchange Code

```
|  |  |
| --- | --- |
| 1 | const response = await fetch('https://openrouter.ai/api/v1/auth/keys', { |
| 2 | method: 'POST', |
| 3 | headers: { |
| 4 | 'Content-Type': 'application/json', |
| 5 | }, |
| 6 | body: JSON.stringify({ |
| 7 | code: '<CODE_FROM_QUERY_PARAM>', |
| 8 | code_verifier: '<CODE_VERIFIER>', // If code_challenge was used |
| 9 | code_challenge_method: '<CODE_CHALLENGE_METHOD>', // If code_challenge was used |
| 10 | }), |
| 11 | }); |
| 12 |  |
| 13 | const { key } = await response.json(); |
```

And that’s it for the PKCE flow!

### Step 3: Use the API key

Store the API key securely within the user’s browser or in your own database, and use it to [make OpenRouter requests](/api-reference/completion).

TypeScript SDKTypeScript (fetch)

```
|  |  |
| --- | --- |
| 1 | import { OpenRouter } from '@openrouter/sdk'; |
| 2 |  |
| 3 | const openRouter = new OpenRouter({ |
| 4 | apiKey: key, // The key from Step 2 |
| 5 | }); |
| 6 |  |
| 7 | const completion = await openRouter.chat.send({ |
| 8 | model: 'openai/gpt-5.2', |
| 9 | messages: [ |
| 10 | { |
| 11 | role: 'user', |
| 12 | content: 'Hello!', |
| 13 | }, |
| 14 | ], |
| 15 | stream: false, |
| 16 | }); |
| 17 |  |
| 18 | console.log(completion.choices[0].message); |
```

## Error Codes

* `400 Invalid code_challenge_method`: Make sure you’re using the same code challenge method in step 1 as in step 2.
* `403 Invalid code or code_verifier`: Make sure your user is logged in to OpenRouter, and that `code_verifier` and `code_challenge_method` are correct.
* `405 Method Not Allowed`: Make sure you’re using `POST` and `HTTPS` for your request.

## External Tools

* [PKCE Tools](https://example-app.com/pkce)
* [Online PKCE Generator](https://tonyxu-io.github.io/pkce-generator/)

Was this page helpful?

YesNo

[Previous](/docs/guides/overview/multimodal/video-generation)[#### Management API Keys

Manage API keys programmatically

Next](/docs/guides/overview/auth/management-api-keys)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
