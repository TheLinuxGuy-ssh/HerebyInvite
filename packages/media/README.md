# Media providers

This package keeps media acquisition separate from invitation generation and rendering.

`MediaProvider` supports:

- stock-image search through Pexels
- image generation through an OpenAI-compatible NVIDIA NIM image endpoint
- hosted HTTPS assets that the renderer can safely publish

Video generation is intentionally not faked as a synchronous image call. NIM video models have model-specific asynchronous contracts, so a job adapter should be added when the selected deployment is known. The shared `MediaAsset` contract already supports video and poster URLs.
