---
source: https://openrouter.ai/docs/guides/overview/multimodal/images
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:07.458Z
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

* [Using Image URLs](#using-image-urls)
* [Using Base64 Encoded Images](#using-base64-encoded-images)

[Overview](/docs/quickstart)[Multimodal](/docs/guides/overview/multimodal/overview)

# Image Inputs

Copy page

How to send images to OpenRouter models

Requests with images, to multimodel models, are available via the `/api/v1/chat/completions` API with a multi-part `messages` parameter. The `image_url` can either be a URL or a base64-encoded image. Note that multiple images can be sent in separate content array entries. The number of images you can send in a single request varies per provider and per model. Due to how the content is parsed, we recommend sending the text prompt first, then the images. If the images must come first, we recommend putting it in the system prompt.

OpenRouter supports both **direct URLs** and **base64-encoded data** for images:

* **URLs**: More efficient for publicly accessible images as they don’t require local encoding
* **Base64**: Required for local files or private images that aren’t publicly accessible

### Using Image URLs

Here’s how to send an image using a URL:

TypeScript SDKPythonTypeScript (fetch)

```
|  |  |
| --- | --- |
| 1 | import { OpenRouter } from '@openrouter/sdk'; |
| 2 |  |
| 3 | const openRouter = new OpenRouter({ |
| 4 | apiKey: '{{API_KEY_REF}}', |
| 5 | }); |
| 6 |  |
| 7 | const result = await openRouter.chat.send({ |
| 8 | model: '{{MODEL}}', |
| 9 | messages: [ |
| 10 | { |
| 11 | role: 'user', |
| 12 | content: [ |
| 13 | { |
| 14 | type: 'text', |
| 15 | text: "What's in this image?", |
| 16 | }, |
| 17 | { |
| 18 | type: 'image_url', |
| 19 | imageUrl: { |
| 20 | url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg', |
| 21 | }, |
| 22 | }, |
| 23 | ], |
| 24 | }, |
| 25 | ], |
| 26 | stream: false, |
| 27 | }); |
| 28 |  |
| 29 | console.log(result); |
```

### Using Base64 Encoded Images

For locally stored images, you can send them using base64 encoding. Here’s how to do it:

TypeScript SDKPythonTypeScript (fetch)

```
|  |  |
| --- | --- |
| 1 | import { OpenRouter } from '@openrouter/sdk'; |
| 2 | import * as fs from 'fs'; |
| 3 |  |
| 4 | const openRouter = new OpenRouter({ |
| 5 | apiKey: '{{API_KEY_REF}}', |
| 6 | }); |
| 7 |  |
| 8 | async function encodeImageToBase64(imagePath: string): Promise<string> { |
| 9 | const imageBuffer = await fs.promises.readFile(imagePath); |
| 10 | const base64Image = imageBuffer.toString('base64'); |
| 11 | return `data:image/jpeg;base64,${base64Image}`; |
| 12 | } |
| 13 |  |
| 14 | // Read and encode the image |
| 15 | const imagePath = 'path/to/your/image.jpg'; |
| 16 | const base64Image = await encodeImageToBase64(imagePath); |
| 17 |  |
| 18 | const result = await openRouter.chat.send({ |
| 19 | model: '{{MODEL}}', |
| 20 | messages: [ |
| 21 | { |
| 22 | role: 'user', |
| 23 | content: [ |
| 24 | { |
| 25 | type: 'text', |
| 26 | text: "What's in this image?", |
| 27 | }, |
| 28 | { |
| 29 | type: 'image_url', |
| 30 | imageUrl: { |
| 31 | url: base64Image, |
| 32 | }, |
| 33 | }, |
| 34 | ], |
| 35 | }, |
| 36 | ], |
| 37 | stream: false, |
| 38 | }); |
| 39 |  |
| 40 | console.log(result); |
```

Supported image content types are:

* `image/png`
* `image/jpeg`
* `image/webp`
* `image/gif`

Was this page helpful?

YesNo

[Previous](/docs/guides/overview/multimodal/overview)[#### Image Generation

How to generate images with OpenRouter models

Next](/docs/guides/overview/multimodal/image-generation)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
