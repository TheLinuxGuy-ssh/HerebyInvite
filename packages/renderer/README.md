# Invitation renderer

`renderSite` produces a deterministic, escaped HTML invitation from a validated `SiteSpec`.

The output includes:

- occasion-specific section hierarchy selected by the generation plan
- responsive typography, palette, schedule cards, venue CTA, and visual placeholders
- progressive CSS motion with `prefers-reduced-motion` support
- optional HTTPS-hosted hero, gallery, and ambient video assets with accessible alt text
- semantic headings, landmarks, links, and section IDs for browser verification

The renderer intentionally has no runtime model dependency. Media is resolved before rendering by the worker through a provider interface. With no provider configured, the same visual composition falls back to its designed gradients and placeholders.
