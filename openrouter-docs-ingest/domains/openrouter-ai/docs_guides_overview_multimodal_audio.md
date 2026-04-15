---
source: https://openrouter.ai/docs/guides/overview/multimodal/audio
domain: https://openrouter.ai
category: sdk
format: json_with_md
confidence: 0.8999999999999999
scraped_at: 2026-04-14T16:09:11.059Z
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

* [Audio Inputs](#audio-inputs)
* [Sending Audio Files](#sending-audio-files)
* [Supported Audio Input Formats](#supported-audio-input-formats)
* [Audio Output](#audio-output)
* [Requesting Audio Output](#requesting-audio-output)
* [Streaming Chunk Format](#streaming-chunk-format)
* [Audio Configuration Options](#audio-configuration-options)

[Overview](/docs/quickstart)[Multimodal](/docs/guides/overview/multimodal/overview)

# Audio

Copy page

How to send and receive audio with OpenRouter models

OpenRouter supports both sending audio files to compatible models and receiving audio responses via the API. This guide covers how to work with audio inputs and outputs.

## Audio Inputs

Send audio files to compatible models for transcription, analysis, and processing. Audio input requests use the `/api/v1/chat/completions` API with the `input_audio` content type. Audio files must be base64-encoded and include the format specification.

**Note**: Audio files must be **base64-encoded** - direct URLs are not supported for audio content.

You can search for models that support audio input by filtering to audio input modality on our [Models page](/models?fmt=cards&input_modalities=audio).

### Sending Audio Files

Here’s how to send an audio file for processing:

TypeScript SDKPythonTypeScript (fetch)

```
|  |  |
| --- | --- |
| 1 | import { OpenRouter } from '@openrouter/sdk'; |
| 2 | import fs from "fs/promises"; |
| 3 |  |
| 4 | const openRouter = new OpenRouter({ |
| 5 | apiKey: '{{API_KEY_REF}}', |
| 6 | }); |
| 7 |  |
| 8 | async function encodeAudioToBase64(audioPath: string): Promise<string> { |
| 9 | const audioBuffer = await fs.readFile(audioPath); |
| 10 | return audioBuffer.toString("base64"); |
| 11 | } |
| 12 |  |
| 13 | // Read and encode the audio file |
| 14 | const audioPath = "path/to/your/audio.wav"; |
| 15 | const base64Audio = await encodeAudioToBase64(audioPath); |
| 16 |  |
| 17 | const result = await openRouter.chat.send({ |
| 18 | model: "{{MODEL}}", |
| 19 | messages: [ |
| 20 | { |
| 21 | role: "user", |
| 22 | content: [ |
| 23 | { |
| 24 | type: "text", |
| 25 | text: "Please transcribe this audio file.", |
| 26 | }, |
| 27 | { |
| 28 | type: "input_audio", |
| 29 | inputAudio: { |
| 30 | data: base64Audio, |
| 31 | format: "wav", |
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

### Supported Audio Input Formats

Supported audio formats vary by provider. Common formats include:

* `wav` - WAV audio
* `mp3` - MP3 audio
* `aiff` - AIFF audio
* `aac` - AAC audio
* `ogg` - OGG Vorbis audio
* `flac` - FLAC audio
* `m4a` - M4A audio
* `pcm16` - PCM16 audio
* `pcm24` - PCM24 audio

**Note:** Check your model’s documentation to confirm which audio formats it supports. Not all models support all formats.

## Audio Output

OpenRouter supports receiving audio responses from models that have audio output capabilities. To request audio output, include the `modalities` and `audio` parameters in your request.

You can search for models that support audio output by filtering to audio output modality on our [Models page](/models?fmt=cards&output_modalities=audio).

### Requesting Audio Output

To receive audio output, set `modalities` to `["text", "audio"]` and provide the `audio` configuration with your desired voice and format:

PythonTypeScript (fetch)

```
|  |  |
| --- | --- |
| 1 | import requests |
| 2 | import json |
| 3 | import base64 |
| 4 |  |
| 5 | url = "https://openrouter.ai/api/v1/chat/completions" |
| 6 | headers = { |
| 7 | "Authorization": f"Bearer {API_KEY_REF}", |
| 8 | "Content-Type": "application/json" |
| 9 | } |
| 10 |  |
| 11 | payload = { |
| 12 | "model": "{{MODEL}}", |
| 13 | "messages": [ |
| 14 | { |
| 15 | "role": "user", |
| 16 | "content": "Say hello in a friendly tone." |
| 17 | } |
| 18 | ], |
| 19 | "modalities": ["text", "audio"], |
| 20 | "audio": { |
| 21 | "voice": "alloy", |
| 22 | "format": "wav" |
| 23 | }, |
| 24 | "stream": True |
| 25 | } |
| 26 |  |
| 27 | # Audio output requires streaming — the response is delivered as SSE chunks |
| 28 | response = requests.post(url, headers=headers, json=payload, stream=True) |
| 29 |  |
| 30 | audio_data_chunks = [] |
| 31 | transcript_chunks = [] |
| 32 |  |
| 33 | for line in response.iter_lines(): |
| 34 | if not line: |
| 35 | continue |
| 36 | decoded = line.decode("utf-8") |
| 37 | if not decoded.startswith("data: "): |
| 38 | continue |
| 39 | data = decoded[len("data: "):] |
| 40 | if data.strip() == "[DONE]": |
| 41 | break |
| 42 | chunk = json.loads(data) |
| 43 | delta = chunk["choices"][0].get("delta", {}) |
| 44 | audio = delta.get("audio", {}) |
| 45 | if audio.get("data"): |
| 46 | audio_data_chunks.append(audio["data"]) |
| 47 | if audio.get("transcript"): |
| 48 | transcript_chunks.append(audio["transcript"]) |
| 49 |  |
| 50 | transcript = "".join(transcript_chunks) |
| 51 | print(f"Transcript: {transcript}") |
| 52 |  |
| 53 | # Combine and decode the base64 audio chunks, then save |
| 54 | full_audio_b64 = "".join(audio_data_chunks) |
| 55 | audio_bytes = base64.b64decode(full_audio_b64) |
| 56 | with open("output.wav", "wb") as f: |
| 57 | f.write(audio_bytes) |
```

### Streaming Chunk Format

Audio output requires streaming (`stream: true`). Audio data and transcript are delivered incrementally via the `delta.audio` field in each chunk:

```
|  |  |
| --- | --- |
| 1 | { |
| 2 | "choices": [ |
| 3 | { |
| 4 | "delta": { |
| 5 | "audio": { |
| 6 | "data": "<base64-encoded audio chunk>", |
| 7 | "transcript": "Hello" |
| 8 | } |
| 9 | } |
| 10 | } |
| 11 | ] |
| 12 | } |
```

### Audio Configuration Options

The `audio` parameter accepts the following options:

| Option | Description |
| --- | --- |
| `voice` | The voice to use for audio generation (e.g., `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`). Available voices vary by model. |
| `format` | The audio format for the output (e.g., `wav`, `mp3`, `flac`, `opus`, `pcm16`). Available formats vary by model. |

Was this page helpful?

YesNo

[Previous](/docs/guides/overview/multimodal/pdfs)[#### Video Inputs

How to send video files to OpenRouter models

Next](/docs/guides/overview/multimodal/videos)[Built with](https://buildwithfern.com/?utm_campaign=buildWith&utm_medium=docs&utm_source=openrouter.ai)

[![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/5a7e2b0bd58241d151e9e352d7a4f898df12c062576c0ce0184da76c3635c5d3/content/assets/logo.svg)![Logo](https://files.buildwithfern.com/openrouter.docs.buildwithfern.com/docs/6f95fbca823560084c5593ea2aa4073f00710020e6a78f8a3f54e835d97a8a0b/content/assets/logo-white.svg)](https://openrouter.ai/)

[Models](https://openrouter.ai/models)[Chat](https://openrouter.ai/chat)[Rankings](https://openrouter.ai/rankings)[Docs](/docs/api-reference/overview)
