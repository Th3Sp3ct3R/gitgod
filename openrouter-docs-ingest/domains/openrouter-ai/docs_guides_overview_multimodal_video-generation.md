---
source: https://openrouter.ai/docs/guides/overview/multimodal/video-generation
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:13.362Z
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
    - [Overview](/docs/guides/overview/multimodal/overview)
    - [Images](/docs/guides/overview/multimodal/images)
    - [Image Generation](/docs/guides/overview/multimodal/image-generation)
    - [PDFs](/docs/guides/overview/multimodal/pdfs)
    - [Audio](/docs/guides/overview/multimodal/audio)
    - [Video](/docs/guides/overview/multimodal/videos)
    - [Video Generation](/docs/guides/overview/multimodal/video-generation)
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

* [Model Discovery](#model-discovery)
* [Via the Video Models API](#via-the-video-models-api)
* [Via the Models API](#via-the-models-api)
* [On the Models Page](#on-the-models-page)
* [How It Works](#how-it-works)
* [API Usage](#api-usage)
* [Submitting a Video Generation Request](#submitting-a-video-generation-request)
* [Request Parameters](#request-parameters)
* [Supported Resolutions](#supported-resolutions)
* [Supported Aspect Ratios](#supported-aspect-ratios)
* [Using Reference Images](#using-reference-images)
* [Provider-Specific Options](#provider-specific-options)
* [Response Format](#response-format)
* [Submit Response (202 Accepted)](#submit-response-202-accepted)
* [Poll Response](#poll-response)
* [Job Statuses](#job-statuses)
* [Downloading the Video](#downloading-the-video)
* [Best Practices](#best-practices)
* [Troubleshooting](#troubleshooting)

[Overview](/docs/quickstart)[Multimodal](/docs/guides/overview/multimodal/overview)

# Video Generation

Copy page

How to generate videos with OpenRouter models

OpenRouter supports video generation through models that have `"video"` in their `output_modalities`. These models can create videos from text prompts (and optional reference images) via a dedicated asynchronous API.

#####

Video generation uses the `/api/v1/videos` endpoint. This API may change.

## Model Discovery

You can find video generation models in several ways:

### Via the Video Models API

Use the dedicated video models endpoint to list all available video generation models along with their supported parameters:

```
|  |  |
| --- | --- |
| $ | curl "https://openrouter.ai/api/v1/videos/models" |
```

The response returns a `data` array where each model includes:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "data": [ |
| 3 | { |
| 4 | "id": "google/veo-3.1", |
| 5 | "canonical_slug": "google/veo-3.1", |
| 6 | "name": "Google: Veo 3.1", |
| 7 | "description": "...", |
| 8 | "created": 1719792000, |
| 9 | "supported_resolutions": ["720p", "1080p"], |
| 10 | "supported_aspect_ratios": ["16:9", "9:16", "1:1"], |
| 11 | "supported_sizes": ["1280x720", "1920x1080"], |
| 12 | "pricing_skus": { |
| 13 | "per-video-second": "0.50", |
| 14 | "per-video-second-1080p": "0.75" |
| 15 | }, |
| 16 | "allowed_passthrough_parameters": ["output_config"] |
| 17 | } |
| 18 | ] |
| 19 | } |
```

| Field | Description |
| --- | --- |
| `id` | Model slug to use in generation requests |
| `canonical_slug` | Permanent model identifier |
| `supported_resolutions` | List of supported output resolutions (e.g., `720p`, `1080p`) |
| `supported_aspect_ratios` | List of supported aspect ratios (e.g., `16:9`, `9:16`) |
| `supported_sizes` | List of supported pixel dimensions (e.g., `1280x720`) |
| `pricing_skus` | Pricing information per SKU |
| `allowed_passthrough_parameters` | Provider-specific parameters that can be passed through via the `provider` option |

Use this endpoint to check which resolutions, aspect ratios, and passthrough parameters are supported by each model before submitting a generation request.

### Via the Models API

You can also use the `output_modalities` query parameter on the [Models API](/docs/api-reference/models/get-models) to discover video generation models:

```
|  |  |
| --- | --- |
| $ | # List only video generation models |
| $ | curl "https://openrouter.ai/api/v1/models?output_modalities=video" |
```

### On the Models Page

Visit the [Models page](/models) and filter by output modalities to find models capable of video generation. Look for models that list `"video"` in their output modalities.

## How It Works

Unlike text or image generation, video generation is **asynchronous** because generating video takes significantly longer. The workflow is:

1. **Submit** a generation request to `POST /api/v1/videos`
2. **Receive** a job ID and polling URL immediately
3. **Poll** the polling URL (`GET /api/v1/videos/{jobId}`) until the status is `completed`
4. **Download** the video from the content URL (`GET /api/v1/videos/{jobId}/content`)

## API Usage

### Submitting a Video Generation Request

PythonTypeScript (fetch)cURL

```
|  |  |
| --- | --- |
| 1 | import requests |
| 2 | import json |
| 3 | import time |
| 4 |  |
| 5 | url = "https://openrouter.ai/api/v1/videos" |
| 6 | headers = { |
| 7 | "Authorization": f"Bearer {API_KEY_REF}", |
| 8 | "Content-Type": "application/json" |
| 9 | } |
| 10 |  |
| 11 | payload = { |
| 12 | "model": "{{MODEL}}", |
| 13 | "prompt": "A golden retriever playing fetch on a sunny beach with waves crashing in the background" |
| 14 | } |
| 15 |  |
| 16 | # Step 1: Submit the generation request |
| 17 | response = requests.post(url, headers=headers, json=payload) |
| 18 | result = response.json() |
| 19 |  |
| 20 | job_id = result["id"] |
| 21 | polling_url = result["polling_url"] |
| 22 | print(f"Job submitted: {job_id}") |
| 23 | print(f"Status: {result['status']}") |
| 24 |  |
| 25 | # Step 2: Poll until completion |
| 26 | while True: |
| 27 | time.sleep(30)  # Wait 30 seconds between polls |
| 28 | poll_response = requests.get(polling_url, headers=headers) |
| 29 | status = poll_response.json() |
| 30 |  |
| 31 | print(f"Status: {status['status']}") |
| 32 |  |
| 33 | if status["status"] == "completed": |
| 34 | # Step 3: Download the video |
| 35 | content_url = status["unsigned_urls"][0] |
| 36 | video_response = requests.get(content_url) |
| 37 | with open("output.mp4", "wb") as f: |
| 38 | f.write(video_response.content) |
| 39 | print("Video saved to output.mp4") |
| 40 | break |
| 41 | elif status["status"] == "failed": |
| 42 | print(f"Generation failed: {status.get('error', 'Unknown error')}") |
| 43 | break |
```

### Request Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `model` | string | Yes | The model to use for video generation (e.g., `google/veo-3.1`) |
| `prompt` | string | Yes | Text description of the video to generate |
| `duration` | integer | No | Duration of the generated video in seconds |
| `resolution` | string | No | Resolution of the output video (e.g., `720p`, `1080p`) |
| `aspect_ratio` | string | No | Aspect ratio of the output video (e.g., `16:9`, `9:16`) |
| `size` | string | No | Exact pixel dimensions in `WIDTHxHEIGHT` format (e.g., `1280x720`). Interchangeable with `resolution` + `aspect_ratio` |
| `input_references` | array | No | Reference images to guide video generation |
| `generate_audio` | boolean | No | Whether to generate audio alongside the video. Defaults to `true` for models that support audio output |
| `seed` | integer | No | Seed for deterministic generation (not guaranteed by all providers) |
| `provider` | object | No | Provider-specific passthrough configuration |

### Supported Resolutions

* `480p`
* `720p`
* `1080p`
* `1K`
* `2K`
* `4K`

### Supported Aspect Ratios

* `16:9` — Widescreen landscape
* `9:16` — Vertical/portrait
* `1:1` — Square
* `4:3` — Standard landscape
* `3:4` — Standard portrait
* `21:9` — Ultra-wide
* `9:21` — Ultra-tall

### Using Reference Images

You can provide reference images to guide the video generation. This is useful for creating videos based on existing visual content:

PythonTypeScript (fetch)

```
|  |  |
| --- | --- |
| 1 | import requests |
| 2 |  |
| 3 | url = "https://openrouter.ai/api/v1/videos" |
| 4 | headers = { |
| 5 | "Authorization": f"Bearer {API_KEY_REF}", |
| 6 | "Content-Type": "application/json" |
| 7 | } |
| 8 |  |
| 9 | payload = { |
| 10 | "model": "{{MODEL}}", |
| 11 | "prompt": "Animate this character walking through a forest", |
| 12 | "input_references": [ |
| 13 | { |
| 14 | "type": "image_url", |
| 15 | "image_url": { |
| 16 | "url": "https://example.com/character.png" |
| 17 | } |
| 18 | } |
| 19 | ], |
| 20 | "aspect_ratio": "16:9", |
| 21 | "resolution": "1080p" |
| 22 | } |
| 23 |  |
| 24 | response = requests.post(url, headers=headers, json=payload) |
| 25 | result = response.json() |
| 26 | print(f"Job submitted: {result['id']}") |
```

### Provider-Specific Options

You can pass provider-specific options using the `provider` parameter. Options are keyed by provider slug, and only the options for the matched provider are forwarded:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "model": "google/veo-3.1", |
| 3 | "prompt": "A time-lapse of a flower blooming", |
| 4 | "provider": { |
| 5 | "options": { |
| 6 | "google-vertex": { |
| 7 | "parameters": { |
| 8 | "personGeneration": "allow", |
| 9 | "negativePrompt": "blurry, low quality" |
| 10 | } |
| 11 | } |
| 12 | } |
| 13 | } |
| 14 | } |
```

Use the [Video Models API](/_/openrouter.ai/_/_/_/docs/guides/overview/multimodal/video-generation#via-the-video-models-api) to check which passthrough parameters each model supports via the `allowed_passthrough_parameters` field.

## Response Format

### Submit Response (202 Accepted)

When you submit a video generation request, you receive an immediate response with the job details:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "id": "abc123", |
| 3 | "polling_url": "https://openrouter.ai/api/v1/videos/abc123", |
| 4 | "status": "pending" |
| 5 | } |
```

### Poll Response

When polling the job status, the response includes additional fields as the job progresses:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "id": "abc123", |
| 3 | "generation_id": "gen-1234567890-abcdef", |
| 4 | "polling_url": "https://openrouter.ai/api/v1/videos/abc123", |
| 5 | "status": "completed", |
| 6 | "unsigned_urls": [ |
| 7 | "https://openrouter.ai/api/v1/videos/abc123/content?index=0" |
| 8 | ], |
| 9 | "usage": { |
| 10 | "cost": 0.25, |
| 11 | "is_byok": false |
| 12 | } |
| 13 | } |
```

### Job Statuses

| Status | Description |
| --- | --- |
| `pending` | The job has been submitted and is queued |
| `in_progress` | The video is being generated |
| `completed` | The video is ready to download |
| `failed` | The generation failed (check the `error` field) |

### Downloading the Video

Once the job status is `completed`, the `unsigned_urls` array contains URLs to download the generated video content. You can also use the content endpoint directly:

```
|  |  |
| --- | --- |
| $ | curl "https://openrouter.ai/api/v1/videos/{jobId}/content?index=0" \ |
| > | -H "Authorization: Bearer $OPENROUTER_API_KEY" \ |
| > | --output video.mp4 |
```

The `index` query parameter defaults to `0` and can be used if the model generates multiple video outputs.

## Best Practices

* **Detailed Prompts**: Provide specific, descriptive prompts for better video quality. Include details about motion, camera angles, lighting, and scene composition
* **Appropriate Resolution**: Higher resolutions take longer to generate and cost more. Choose the resolution that fits your use case
* **Polling Interval**: Use a reasonable polling interval (e.g., 30 seconds) to avoid excessive API calls. Video generation typically takes 30 seconds to several minutes depending on the model and parameters
* **Error Handling**: Always check the job status for `failed` state and handle the `error` field appropriately
* **Reference Images**: When using reference images, ensure they are high quality and relevant to the desired video output

## Troubleshooting

**Job stays in `pending` for a long time?**

* Video generation can take several minutes depending on the model, resolution, and server load
* Continue polling at regular intervals

**Generation failed?**

* Check the `error` field in the poll response for details
* Verify the model supports video generation (`output_modalities` includes `"video"`)
* Ensure your prompt is appropriate and within model guidelines
* Check that any reference images are accessible and in supported formats

**Model not found?**

* Use the [Video Models API](/_/openrouter.ai/_/_/_/docs/guides/overview/multimodal/video-generation#via-the-video-models-api) or the [Models page](/models) to find available video generation models
* Verify the model slug is correct (e.g., `google/veo-3.1`)

Was this page helpful?

YesNo

[Previous](/docs/guides/overview/multimodal/videos)[#### OAuth PKCE

Connect your users to OpenRouter

Next](/docs/guides/overview/auth/oauth)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
