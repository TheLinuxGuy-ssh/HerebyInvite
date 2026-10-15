# Invitation renderer

`renderSite` produces a deterministic, escaped HTML invitation from a validated `SiteSpec`.

The output includes:

- occasion-specific section hierarchy selected by the generation plan
- responsive typography, palette, schedule cards, venue CTA, and visual placeholders
- progressive CSS motion with `prefers-reduced-motion` support
- semantic headings, landmarks, links, and section IDs for browser verification

The renderer intentionally has no runtime model or image dependency. External media and richer animation libraries can be added behind this stable HTML contract later.
