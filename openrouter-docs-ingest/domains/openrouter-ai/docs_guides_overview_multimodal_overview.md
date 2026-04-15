---
source: https://openrouter.ai/docs/guides/overview/multimodal/overview
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:06.551Z
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

* [Supported Modalities](#supported-modalities)
* [Images](#images)
* [Image Generation](#image-generation)
* [PDFs](#pdfs)
* [Audio](#audio)
* [Video](#video)
* [Video Generation](#video-generation)
* [Getting Started](#getting-started)
* [Model Compatibility](#model-compatibility)
* [Input Format Support](#input-format-support)
* [URLs (Recommended for public content)](#urls-recommended-for-public-content)
* [Base64 Encoding (Required for local files)](#base64-encoding-required-for-local-files)
* [Frequently Asked Questions](#frequently-asked-questions)

[Overview](/docs/quickstart)[Multimodal](/docs/guides/overview/multimodal/overview)

# Multimodal Capabilities

Copy page

Send images, PDFs, audio, and video to OpenRouter models

OpenRouter supports multiple input modalities beyond text, allowing you to send images, PDFs, audio, and video files to compatible models through our unified API. This enables rich multimodal interactions for a wide variety of use cases.

## Supported Modalities

### Images

Send images to vision-capable models for analysis, description, OCR, and more. OpenRouter supports multiple image formats and both URL-based and base64-encoded images.

[Learn more about image inputs →](/docs/features/multimodal/images)

### Image Generation

Generate images from text prompts using AI models with image output capabilities. OpenRouter supports various image generation models that can create high-quality images based on your descriptions.

[Learn more about image generation →](/docs/features/multimodal/image-generation)

### PDFs

Process PDF documents with any model on OpenRouter. Our intelligent PDF parsing system extracts text and handles both text-based and scanned documents.

[Learn more about PDF processing →](/docs/features/multimodal/pdfs)

### Audio

Send audio files to speech-capable models for transcription, analysis, and processing, or receive audio responses from models with audio output capabilities. OpenRouter supports common audio formats for both input and output.

[Learn more about audio →](/docs/features/multimodal/audio)

### Video

Send video files to video-capable models for analysis, description, object detection, and action recognition. OpenRouter supports multiple video formats for comprehensive video understanding tasks.

[Learn more about video inputs →](/docs/features/multimodal/videos)

### Video Generation

Generate videos from text prompts using AI models with video output capabilities. OpenRouter supports an asynchronous video generation API with configurable resolution, aspect ratio, duration, and optional reference images.

[Learn more about video generation →](/docs/features/multimodal/video-generation)

## Getting Started

All multimodal inputs use the same `/api/v1/chat/completions` endpoint with the `messages` parameter. Different content types are specified in the message content array:

* **Images**: Use `image_url` content type
* **PDFs**: Use `file` content type with PDF data
* **Audio**: Use `input_audio` content type
* **Video**: Use `video_url` content type

You can combine multiple modalities in a single request, and the number of files you can send varies by provider and model.

## Model Compatibility

Not all models support every modality. OpenRouter automatically filters available models based on your request content:

* **Vision models**: Required for image processing
* **File-compatible models**: Can process PDFs natively or through our parsing system
* **Audio-capable models**: Required for audio input processing
* **Video-capable models**: Required for video input processing

Use our [Models page](https://openrouter.ai/models) to find models that support your desired input modalities.

## Input Format Support

OpenRouter supports both **direct URLs** and **base64-encoded data** for multimodal inputs:

### URLs (Recommended for public content)

* **Images**: `https://example.com/image.jpg`
* **PDFs**: `https://example.com/document.pdf`
* **Audio**: Not supported via URL (base64 only)
* **Video**: Provider-specific (e.g., YouTube links for Gemini on AI Studio)

### Base64 Encoding (Required for local files)

* **Images**: `data:image/jpeg;base64,{base64_data}`
* **PDFs**: `data:application/pdf;base64,{base64_data}`
* **Audio**: Raw base64 string with format specification
* **Video**: `data:video/mp4;base64,{base64_data}`

#####

URLs are more efficient for large files as they don’t require local encoding and reduce request payload size. Base64 encoding is required for local files or when the content is not publicly accessible.

**Note for video URLs**: Video URL support varies by provider. For example, Google Gemini on AI Studio only supports YouTube links. See the [video inputs documentation](/docs/features/multimodal/videos) for provider-specific details.

## Frequently Asked Questions

###### Can I mix different modalities in one request?

Yes! You can send text, images, PDFs, audio, and video in the same request. The model will process all inputs together.

###### How is multimodal content priced?

* **Images**: Typically priced per image or as input tokens
* **PDFs**: Free text extraction, paid OCR processing, or native model pricing
* **Audio input**: Priced as input tokens based on duration
* **Audio output**: Priced as completion tokens
* **Video**: Priced as input tokens based on duration and resolution

###### Which models support video input?

Video support varies by model. Use the [Models page](/models?fmt=cards&input_modalities=video) to filter for video-capable models. Check each model’s documentation for specific video format and duration limits.

###### How does video generation work?

Video generation uses an asynchronous API at `/api/v1/videos`. You submit a prompt, receive a job ID, then poll until the video is ready to download. See the [video generation documentation](/docs/features/multimodal/video-generation) for details.

Was this page helpful?

YesNo

[Previous](/docs/guides/overview/models)[#### Image Inputs

How to send images to OpenRouter models

Next](/docs/guides/overview/multimodal/images)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
