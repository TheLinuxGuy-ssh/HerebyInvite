import type { SiteSpec } from '@hereby/spec';

export interface RenderOptions {
  canonicalUrl?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderScene(scene: SiteSpec['scenes'][number]): string {
  switch (scene.type) {
    case 'hero':
      return `<section class="scene hero"><p class="eyebrow">You are invited</p><h1>${escapeHtml(scene.headline)}</h1>${scene.subline ? `<p>${escapeHtml(scene.subline)}</p>` : ''}</section>`;
    case 'countdown':
      return `<section class="scene countdown"><h2>Counting down to the celebration</h2><time datetime="${escapeHtml(scene.targetDateTime)}">${escapeHtml(scene.targetDateTime)}</time></section>`;
    case 'story':
      return `<section class="scene story"><h2>Our story</h2>${scene.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</section>`;
    case 'schedule':
      return `<section class="scene schedule"><h2>Schedule</h2><div class="schedule-list">${scene.items.map((item) => `<article><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.date)} · ${escapeHtml(item.time)} · ${escapeHtml(item.venue)}</p></article>`).join('')}</div></section>`;
    case 'venue':
      return `<section class="scene venue"><h2>${escapeHtml(scene.name)}</h2><p>${escapeHtml(scene.address)}</p><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(scene.mapsQuery)}" rel="noopener noreferrer">Open in maps</a></section>`;
    case 'gallery':
      return `<section class="scene gallery"><h2>Moments to remember</h2><div class="gallery-list">${scene.imageQueries.map((query) => `<div class="gallery-placeholder" role="img" aria-label="${escapeHtml(query)}">${escapeHtml(query)}</div>`).join('')}</div></section>`;
    case 'closing':
      return `<section class="scene closing"><p>${escapeHtml(scene.message)}</p></section>`;
    default:
      return '';
  }
}

function renderStyles(spec: SiteSpec): string {
  const { primary, secondary, accent, background, text } = spec.theme.palette;
  return `<style>
    :root{--primary:${primary};--secondary:${secondary};--accent:${accent};--background:${background};--text:${text}}
    *{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--text);font-family:system-ui,-apple-system,sans-serif;line-height:1.6}
    main{max-width:760px;margin:0 auto;padding:1rem}.scene{padding:clamp(2.5rem,10vw,7rem) 1.25rem;border-bottom:1px solid color-mix(in srgb,var(--primary),transparent 80%)}
    .hero{text-align:center;min-height:70vh;display:grid;place-content:center;background:linear-gradient(135deg,var(--background),var(--accent))}
    h1,h2,h3{line-height:1.15;margin-top:0;color:var(--primary)}h1{font-size:clamp(2.6rem,10vw,5.5rem);font-weight:700}.eyebrow{color:var(--secondary);letter-spacing:.14em;text-transform:uppercase;font-size:.8rem}
    .countdown,.closing{text-align:center}.countdown time{font-size:clamp(1.5rem,5vw,2.5rem);color:var(--primary)}
    .schedule-list{display:grid;gap:1rem}.schedule-list article,.gallery-placeholder{padding:1rem;border:1px solid color-mix(in srgb,var(--primary),transparent 75%);border-radius:1rem;background:color-mix(in srgb,var(--accent),transparent 35%)}
    a{color:var(--primary);font-weight:700}.gallery-list{display:grid;gap:1rem}.gallery-placeholder{min-height:8rem;display:grid;place-items:center;text-align:center}
    @media(prefers-reduced-motion:no-preference){.scene{animation:rise .7s ease both}}@keyframes rise{from{opacity:.2;transform:translateY(1rem)}to{opacity:1;transform:none}}
  </style>`;
}

export function renderSite(spec: SiteSpec, options: RenderOptions = {}): string {
  const title = escapeHtml(spec.sharing.title);
  const description = escapeHtml(spec.sharing.description);
  const canonical = options.canonicalUrl ? `<link rel="canonical" href="${escapeHtml(options.canonicalUrl)}">` : '';
  return `<!doctype html><html lang="${spec.event.language === 'hi' ? 'hi' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${description}"><meta name="theme-color" content="${escapeHtml(spec.sharing.themeColor)}">${canonical}${renderStyles(spec)}</head><body><main>${spec.scenes.map(renderScene).join('')}</main></body></html>`;
}
