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
      return `<section class="scene hero" id="welcome" data-reveal="hero"><div class="hero-orbit" aria-hidden="true"></div><div class="hero-content"><p class="eyebrow">You are invited</p><h1>${escapeHtml(scene.headline)}</h1>${scene.subline ? `<p class="hero-subline">${escapeHtml(scene.subline)}</p>` : ''}<span class="scroll-cue" aria-hidden="true">Scroll to enter</span></div></section>`;
    case 'countdown':
      return `<section class="scene countdown" id="countdown" data-reveal><p class="section-kicker">The moment is near</p><h2>Counting down to the celebration</h2><time datetime="${escapeHtml(scene.targetDateTime)}">${escapeHtml(scene.targetDateTime)}</time></section>`;
    case 'story':
      return `<section class="scene story" id="story" data-reveal><p class="section-kicker">A note from us</p><h2>Our story</h2>${scene.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</section>`;
    case 'schedule':
      return `<section class="scene schedule" id="schedule" data-reveal><p class="section-kicker">Save the moments</p><h2>Schedule</h2><div class="schedule-list">${scene.items.map((item) => `<article><div class="schedule-time">${escapeHtml(item.time)}</div><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.date)} · ${escapeHtml(item.venue)}</p></div></article>`).join('')}</div></section>`;
    case 'venue':
      return `<section class="scene venue" id="venue" data-reveal><p class="section-kicker">Gather with us</p><h2>${escapeHtml(scene.name)}</h2><p>${escapeHtml(scene.address)}</p><a class="button-link" href="${escapeHtml(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(scene.mapsQuery)}`)}" rel="noopener noreferrer">Open in maps</a></section>`;
    case 'gallery':
      return `<section class="scene gallery" id="gallery" data-reveal><p class="section-kicker">The feeling of the day</p><h2>Moments to remember</h2><div class="gallery-list">${scene.imageQueries.map((query, index) => `<div class="gallery-placeholder gallery-${index % 3}" role="img" aria-label="${escapeHtml(query)}"><span>${escapeHtml(query)}</span></div>`).join('')}</div></section>`;
    case 'details':
      return `<section class="scene details" id="details" data-reveal><p class="section-kicker">Good to know</p><h2>${escapeHtml(scene.title)}</h2><dl class="details-list">${scene.items.map((item) => `<div><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`).join('')}</dl></section>`;
    case 'closing':
      return `<section class="scene closing" id="closing" data-reveal><div class="closing-mark" aria-hidden="true">✦</div><p>${escapeHtml(scene.message)}</p></section>`;
    default:
      return '';
  }
}

function renderStyles(spec: SiteSpec): string {
  const { primary, secondary, accent, background, text } = spec.theme.palette;
  return `<style>
    :root{--primary:${primary};--secondary:${secondary};--accent:${accent};--background:${background};--text:${text}}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--background);color:var(--text);font-family:${spec.theme.typography.body === 'merriweather' ? 'Georgia,serif' : 'system-ui,-apple-system,sans-serif'};line-height:1.7}
    main{max-width:920px;margin:0 auto;overflow:hidden}.scene{position:relative;padding:clamp(4rem,12vw,9rem) clamp(1.25rem,6vw,4rem);border-bottom:1px solid color-mix(in srgb,var(--primary),transparent 84%);isolation:isolate}
    .hero{text-align:center;min-height:92vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 35%,color-mix(in srgb,var(--accent),transparent 25%),transparent 42%),linear-gradient(135deg,var(--background),color-mix(in srgb,var(--accent),transparent 20%))}
    .hero-content{position:relative;z-index:1;max-width:680px}.hero-orbit{position:absolute;width:min(70vw,520px);height:min(70vw,520px);border:1px solid color-mix(in srgb,var(--secondary),transparent 60%);border-radius:50%;box-shadow:0 0 0 24px color-mix(in srgb,var(--secondary),transparent 92%),0 0 0 48px color-mix(in srgb,var(--secondary),transparent 95%);animation:orbit 18s linear infinite}
    h1,h2,h3{line-height:1.1;margin-top:0;color:var(--primary);font-family:${spec.theme.typography.heading === 'playfair' || spec.theme.typography.heading === 'cormorant' ? 'Georgia,serif' : 'system-ui,-apple-system,sans-serif'}}h1{font-size:clamp(3rem,10vw,7rem);font-weight:500;letter-spacing:-.04em}.hero-subline{font-size:clamp(1rem,2vw,1.3rem);opacity:.8}.eyebrow,.section-kicker{color:var(--secondary);letter-spacing:.16em;text-transform:uppercase;font-size:.74rem;font-weight:700}.scroll-cue{display:block;margin-top:4rem;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;opacity:.6}
    .scene:not(.hero)>*{max-width:680px;margin-left:auto;margin-right:auto}.scene h2{font-size:clamp(2rem,5vw,4rem)}.story p{font-size:clamp(1.1rem,2vw,1.35rem)}.countdown,.closing{text-align:center}.countdown time{display:block;font-size:clamp(1.6rem,5vw,3rem);color:var(--primary);font-variant-numeric:tabular-nums}
    .schedule-list{display:grid;gap:.8rem}.schedule-list article{display:grid;grid-template-columns:5rem 1fr;gap:1rem;padding:1.2rem;border-left:2px solid var(--secondary);background:color-mix(in srgb,var(--accent),transparent 52%);border-radius:0 1rem 1rem 0}.schedule-time{color:var(--primary);font-weight:700}.schedule-list h3{margin-bottom:.25rem}.schedule-list p{margin:0;opacity:.75}
    .venue{background:linear-gradient(120deg,transparent,color-mix(in srgb,var(--accent),transparent 45%))}.button-link{display:inline-block;margin-top:1rem;padding:.75rem 1.1rem;border:1px solid var(--primary);border-radius:999px;color:var(--primary);font-weight:700;text-decoration:none}.details{background:color-mix(in srgb,var(--accent),transparent 70%)}.details-list{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;margin:0}.details-list div{padding:1rem 0;border-top:1px solid color-mix(in srgb,var(--primary),transparent 70%)}.details-list dt{color:var(--primary);font-weight:700}.details-list dd{margin:.25rem 0 0;opacity:.8}.gallery-list{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem}.gallery-placeholder{min-height:13rem;padding:1rem;display:grid;place-items:end;border-radius:1.2rem;background:linear-gradient(145deg,color-mix(in srgb,var(--primary),white 35%),var(--accent));color:var(--background);font-weight:700;box-shadow:0 1rem 2rem color-mix(in srgb,var(--primary),transparent 88%)}.gallery-placeholder span{padding:.35rem .6rem;border-radius:999px;background:color-mix(in srgb,var(--text),transparent 25%);font-size:.75rem}.gallery-1{transform:translateY(2rem);background:linear-gradient(145deg,var(--secondary),var(--primary))}.gallery-2{background:linear-gradient(145deg,var(--accent),var(--secondary));color:var(--text)}
    .closing{min-height:45vh;display:grid;place-content:center}.closing-mark{color:var(--secondary);font-size:2rem;margin-bottom:1rem}.closing p{font-family:Georgia,serif;font-size:clamp(1.6rem,4vw,3rem);line-height:1.2}
    @media (prefers-reduced-motion: no-preference){[data-reveal]{animation:rise .8s cubic-bezier(.2,.8,.2,1) both}.hero-orbit{animation:orbit 18s linear infinite}}@media (prefers-reduced-motion: reduce){html{scroll-behavior:auto}.hero-orbit{animation:none}.gallery-1{transform:none}}    @media(max-width:560px){.gallery-list,.details-list{grid-template-columns:1fr}.gallery-1{transform:none}}
    @keyframes rise{from{opacity:0;transform:translateY(1.5rem)}to{opacity:1;transform:none}}@keyframes orbit{to{transform:rotate(360deg)}}
  </style>`;
}

export function renderSite(spec: SiteSpec, options: RenderOptions = {}): string {
  const title = escapeHtml(spec.sharing.title);
  const description = escapeHtml(spec.sharing.description);
  const canonical = options.canonicalUrl ? `<link rel="canonical" href="${escapeHtml(options.canonicalUrl)}">` : '';
  return `<!doctype html><html lang="${spec.event.language === 'hi' ? 'hi' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${title}</title><meta name="description" content="${description}"><meta name="theme-color" content="${escapeHtml(spec.sharing.themeColor)}">${canonical}${renderStyles(spec)}</head><body><main data-occasion="${escapeHtml(spec.event.type)}" data-motion="${escapeHtml(spec.motion.preset)}">${spec.scenes.map(renderScene).join('')}</main></body></html>`;
}
