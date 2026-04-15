---
source: https://openrouter.ai/docs/guides/overview/auth/byok
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:16.488Z
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

* [Bring your own API Keys](#bring-your-own-api-keys)
* [Key Priority and Fallback](#key-priority-and-fallback)
* [BYOK with Provider Ordering](#byok-with-provider-ordering)
* [Partial BYOK with Provider Ordering](#partial-byok-with-provider-ordering)
* [Multiple BYOK Keys for the Same Provider](#multiple-byok-keys-for-the-same-provider)
* [Azure API Keys](#azure-api-keys)
* [AWS Bedrock API Keys](#aws-bedrock-api-keys)
* [Option 1: Bedrock API Keys (Recommended)](#option-1-bedrock-api-keys-recommended)
* [Option 2: AWS Credentials](#option-2-aws-credentials)
* [Google Vertex API Keys](#google-vertex-api-keys)
* [Debugging BYOK Issues](#debugging-byok-issues)
* [Viewing Provider Responses](#viewing-provider-responses)
* [Common BYOK Error Codes](#common-byok-error-codes)
* [Debugging Permission Issues](#debugging-permission-issues)

[Overview](/docs/quickstart)[Authentication](/docs/guides/overview/auth/oauth)

# BYOK

Copy page

Bring your own provider API keys

## Bring your own API Keys

OpenRouter supports both OpenRouter credits and the option to bring your own provider keys (BYOK).

When you use OpenRouter credits, your rate limits for each provider are managed by OpenRouter.

Using provider keys enables direct control over rate limits and costs via your provider account.

Your provider keys are securely encrypted and used for all requests routed through the specified provider.

Manage keys in your [account settings](/settings/integrations).

The cost of using custom provider keys on OpenRouter is **5% of what the same model/provider would cost normally on OpenRouter** and will be deducted from your OpenRouter credits.
This fee is waived for the first 1M BYOK requests per-month.

### Key Priority and Fallback

OpenRouter always prioritizes using your provider keys when available. By default, if your key encounters a rate limit or failure, OpenRouter will fall back to using shared OpenRouter credits.

You can configure individual keys with “Always use this key” to prevent any fallback to OpenRouter credits. When this option is enabled, OpenRouter will only use your key for requests to that provider, which may result in rate limit errors if your key is exhausted, but ensures all requests go through your account.

### BYOK with Provider Ordering

When you combine BYOK keys with [provider ordering](/docs/features/provider-routing#ordering-specific-providers), OpenRouter **always prioritizes BYOK endpoints first**, regardless of where that provider appears in your specified order. After all BYOK endpoints are exhausted, OpenRouter falls back to shared capacity in the order you specified.

This means BYOK keys effectively override your provider ordering for the initial routing attempts. There is currently no way to change this behavior.

For example, if you have BYOK keys for Amazon Bedrock, Google Vertex AI, and Anthropic, and you send a request with:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "provider": { |
| 3 | "allow_fallbacks": true, |
| 4 | "order": ["amazon-bedrock", "google-vertex", "anthropic"] |
| 5 | } |
| 6 | } |
```

The routing order will be:

1. Amazon Bedrock (your BYOK key)
2. Google Vertex AI (your BYOK key)
3. Anthropic (your BYOK key)
4. Amazon Bedrock (OpenRouter’s shared capacity)
5. Google Vertex AI (OpenRouter’s shared capacity)
6. Anthropic (OpenRouter’s shared capacity)

#### Partial BYOK with Provider Ordering

If you only have a BYOK key for some of the providers in your order, the BYOK provider is still tried first. For example, if you specify `order: ["amazon-bedrock", "google-vertex"]` but only have a BYOK key for Google Vertex AI:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "provider": { |
| 3 | "allow_fallbacks": true, |
| 4 | "order": ["amazon-bedrock", "google-vertex"] |
| 5 | } |
| 6 | } |
```

The routing order will be:

1. Google Vertex AI (your BYOK key)
2. Amazon Bedrock (OpenRouter’s shared capacity)
3. Google Vertex AI (OpenRouter’s shared capacity)

Note that even though Amazon Bedrock is listed first in the `order` array, the Google Vertex AI BYOK endpoint takes priority.

If you want to prevent fallback to OpenRouter’s shared capacity entirely, configure your API key with “Always use this key” in your [account settings](/settings/integrations).

### Multiple BYOK Keys for the Same Provider

If you have multiple BYOK keys configured for the same provider, all of them will be used for routing. However, the order in which multiple keys for the same provider are tried is not guaranteed. If deterministic ordering between keys matters for your use case, consider using separate provider accounts or contacting support.

### Azure API Keys

To use Azure AI Services with OpenRouter, you’ll need to provide your Azure API key configuration in JSON format. Each key configuration requires the following fields:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model_slug": "the-openrouter-model-slug", |
| 3 | "endpoint_url": "https://<resource>.services.ai.azure.com/deployments/<model-id>/chat/completions?api-version=<api-version>", |
| 4 | "api_key": "your-azure-api-key", |
| 5 | "model_id": "the-azure-model-id" |
| 6 | } |
```

You can find these values in your Azure AI Services resource:

1. **endpoint\_url**: Navigate to your Azure AI Services resource in the Azure portal. In the “Overview” section, you’ll find your endpoint URL. Make sure to append `/chat/completions` to the base URL. You can read more in the [Azure Foundry documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/model-inference/concepts/endpoints?tabs=python).
2. **api\_key**: In the same “Overview” section of your Azure AI Services resource, you can find your API key under “Keys and Endpoint”.
3. **model\_id**: This is the name of your model deployment in Azure AI Services.
4. **model\_slug**: This is the OpenRouter model identifier you want to use this key for.

Since Azure supports multiple model deployments, you can provide an array of configurations for different models:

```
|  |  |
| --- | --- |
| 1 | [ |
| 2 | { |
| 3 | "model_slug": "mistralai/mistral-large", |
| 4 | "endpoint_url": "https://example-project.openai.azure.com/openai/deployments/mistral-large/chat/completions?api-version=2024-08-01-preview", |
| 5 | "api_key": "your-azure-api-key", |
| 6 | "model_id": "mistral-large" |
| 7 | }, |
| 8 | { |
| 9 | "model_slug": "openai/gpt-5.2", |
| 10 | "endpoint_url": "https://example-project.openai.azure.com/openai/deployments/gpt-5.2/chat/completions?api-version=2024-08-01-preview", |
| 11 | "api_key": "your-azure-api-key", |
| 12 | "model_id": "gpt-5.2" |
| 13 | } |
| 14 | ] |
```

Make sure to replace the url with your own project url. Also the url should end with /chat/completions with the api version that you would like to use.

### AWS Bedrock API Keys

To use Amazon Bedrock with OpenRouter, you can authenticate using either Bedrock API keys or traditional AWS credentials.

#### Option 1: Bedrock API Keys (Recommended)

Amazon Bedrock API keys provide a simpler authentication method. Simply provide your Bedrock API key as a string:

```
|  |
| --- |
| your-bedrock-api-key-here |
```

**Note:** Bedrock API keys are tied to a specific AWS region and cannot be used to change regions. If you need to use models in different regions, use the AWS credentials option below.

You can generate Bedrock API keys in the AWS Management Console. Learn more in the [Amazon Bedrock API keys documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.html).

#### Option 2: AWS Credentials

Alternatively, you can use traditional AWS credentials in JSON format. This option allows you to specify the region and provides more flexibility:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "accessKeyId": "your-aws-access-key-id", |
| 3 | "secretAccessKey": "your-aws-secret-access-key", |
| 4 | "region": "your-aws-region" |
| 5 | } |
```

You can find these values in your AWS account:

1. **accessKeyId**: This is your AWS Access Key ID. You can create or find your access keys in the AWS Management Console under “Security Credentials” in your AWS account.
2. **secretAccessKey**: This is your AWS Secret Access Key, which is provided when you create an access key.
3. **region**: The AWS region where your Amazon Bedrock models are deployed (e.g., “us-east-1”, “us-west-2”).

Make sure your AWS IAM user or role has the necessary permissions to access Amazon Bedrock services. At minimum, you’ll need permissions for:

* `bedrock:InvokeModel`
* `bedrock:InvokeModelWithResponseStream` (for streaming responses)

Example IAM policy:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "Version": "2012-10-17", |
| 3 | "Statement": [ |
| 4 | { |
| 5 | "Effect": "Allow", |
| 6 | "Action": [ |
| 7 | "bedrock:InvokeModel", |
| 8 | "bedrock:InvokeModelWithResponseStream" |
| 9 | ], |
| 10 | "Resource": "*" |
| 11 | } |
| 12 | ] |
| 13 | } |
```

For enhanced security, we recommend creating dedicated IAM users with limited permissions specifically for use with OpenRouter.

Learn more in the [AWS Bedrock Getting Started with the API](https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started-api.html) documentation, [IAM Permissions Setup](https://docs.aws.amazon.com/bedrock/latest/userguide/security-iam.html) guide, or the [AWS Bedrock API Reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/welcome.html).

### Google Vertex API Keys

To use Google Vertex AI with OpenRouter, you’ll need to provide your Google Cloud service account key in JSON format. The service account key should include all standard Google Cloud service account fields, with an optional `region` field for specifying the deployment region.

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "type": "service_account", |
| 3 | "project_id": "your-project-id", |
| 4 | "private_key_id": "your-private-key-id", |
| 5 | "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n", |
| 6 | "client_email": "your-service-account@your-project.iam.gserviceaccount.com", |
| 7 | "client_id": "your-client-id", |
| 8 | "auth_uri": "https://accounts.google.com/o/oauth2/auth", |
| 9 | "token_uri": "https://oauth2.googleapis.com/token", |
| 10 | "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs", |
| 11 | "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-service-account@your-project.iam.gserviceaccount.com", |
| 12 | "universe_domain": "googleapis.com", |
| 13 | "region": "global" |
| 14 | } |
```

You can find these values in your Google Cloud Console:

1. **Service Account Key**: Navigate to the Google Cloud Console, go to “IAM & Admin” > “Service Accounts”, select your service account, and create/download a JSON key.
2. **region** (optional): Specify the region for your Vertex AI deployment. Use `"global"` to allow requests to run in any available region, or specify a specific region like `"us-central1"` or `"europe-west1"`.

Make sure your service account has the necessary permissions to access Vertex AI services:

* `aiplatform.endpoints.predict`

Example IAM policy:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "bindings": [ |
| 3 | { |
| 4 | "role": "roles/aiplatform.user", |
| 5 | "members": [ |
| 6 | "serviceAccount:your-service-account@your-project.iam.gserviceaccount.com" |
| 7 | ] |
| 8 | } |
| 9 | ] |
| 10 | } |
```

Learn more in the [Google Cloud Vertex AI documentation](https://cloud.google.com/vertex-ai/docs/start/introduction-unified-platform) and [Service Account setup guide](https://cloud.google.com/iam/docs/service-accounts-create).

### Debugging BYOK Issues

If your BYOK requests fail, you can debug the issue by viewing provider responses on the Activity page.

#### Viewing Provider Responses

1. Navigate to your [Activity page](https://openrouter.ai/activity) in the OpenRouter dashboard.
2. Find the generation you want to debug and click on it to view the details.
3. Click “View Raw Metadata” to display the raw metadata in JSON format.
4. In the JSON, look for the `provider_responses` field, which shows the HTTP status code from each provider attempt.

The `provider_responses` field contains an array of responses from each provider attempted during routing. Each entry includes the provider name and HTTP status code, which can help you identify permission issues, rate limits, or other errors.

#### Common BYOK Error Codes

When debugging BYOK issues, look for these common HTTP status codes in the provider responses:

* **400 Bad Request**: The request format was invalid for the provider. Check that your model and key configuration is correct.
* **401 Unauthorized**: Your API key is invalid or has been revoked. Verify your key in your provider’s console.
* **403 Forbidden**: Your API key doesn’t have permission to access the requested resource. For AWS Bedrock, ensure your IAM policy includes the required `bedrock:InvokeModel` permissions. For Google Vertex, verify your service account has `aiplatform.endpoints.predict` permissions.
* **429 Too Many Requests**: You’ve hit the rate limit on your provider account. Check your provider’s rate limit settings or wait before retrying.
* **500 Server Error**: The provider encountered an internal error. This is typically a temporary issue on the provider’s side.

#### Debugging Permission Issues

If you encounter 403 errors with BYOK, the issue is often related to permissions. For AWS Bedrock, verify that:

1. Your IAM user/role has the `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` permissions.
2. The model you’re trying to access is enabled in your AWS account for the specified region.
3. Your credentials (access key and secret) are correct and active.

For Google Vertex, verify that your service account has `aiplatform.endpoints.predict` permissions.

You can test your provider permissions directly in the provider’s console (AWS Console, Google Cloud Console, etc.) by attempting to invoke the model there first.

Was this page helpful?

YesNo

[Previous](/docs/guides/overview/auth/management-api-keys)[#### Frequently Asked Questions

Common questions about OpenRouter

Next](/docs/faq)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
