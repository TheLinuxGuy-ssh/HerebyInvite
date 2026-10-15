export interface MediaAsset {
  kind: 'image' | 'video' | 'icon';
  src: string;
  alt: string;
  poster?: string;
  width?: number;
  height?: number;
}

export interface MediaSearchOptions {
  query: string;
  orientation?: 'landscape' | 'portrait' | 'square';
  limit?: number;
}

export interface MediaSearchResult {
  assets: MediaAsset[];
  provider: string;
}

export interface MediaGenerationOptions {
  prompt: string;
  kind: 'image' | 'video';
  aspectRatio?: string;
  durationSeconds?: number;
}

export interface MediaProvider {
  searchImages(options: MediaSearchOptions): Promise<MediaSearchResult>;
  generate(options: MediaGenerationOptions): Promise<MediaAsset>;
}

function requireHttpsUrl(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.startsWith('https://')) {
    throw new Error(`${field} must be an HTTPS URL.`);
  }
  return value;
}

export class PexelsMediaProvider implements MediaProvider {
  constructor(private readonly apiKey = process.env.PEXELS_API_KEY ?? '') {
    if (!apiKey) throw new Error('PEXELS_API_KEY is required for image search.');
  }

  async searchImages(options: MediaSearchOptions): Promise<MediaSearchResult> {
    const url = new URL('https://api.pexels.com/v1/search');
    url.searchParams.set('query', options.query);
    url.searchParams.set('per_page', String(Math.min(options.limit ?? 4, 8)));
    if (options.orientation) url.searchParams.set('orientation', options.orientation);
    const response = await fetch(url, { headers: { Authorization: this.apiKey } });
    if (!response.ok) throw new Error(`Pexels image search failed with status ${response.status}.`);
    const payload = await response.json() as { photos?: Array<{ alt?: string; width?: number; height?: number; src?: { large2x?: string; large?: string } }> };
    const assets = (payload.photos ?? []).flatMap((photo) => {
      const src = photo.src?.large2x ?? photo.src?.large;
      if (!src) return [];
      return [{
        kind: 'image' as const,
        src: requireHttpsUrl(src, 'Pexels image URL'),
        alt: photo.alt?.trim() || options.query,
        ...(photo.width ? { width: photo.width } : {}),
        ...(photo.height ? { height: photo.height } : {}),
      }];
    });
    return { assets, provider: 'pexels' };
  }

  generate(): Promise<MediaAsset> {
    return Promise.reject(new Error('Pexels does not generate media. Configure NVIDIA NIM for generation.'));
  }
}

export class NvidiaNimMediaProvider implements MediaProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly imageModel: string;
  private readonly videoModel: string;

  constructor(options: { baseUrl?: string; apiKey?: string; imageModel?: string; videoModel?: string } = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.NIM_BASE_URL ?? '').replace(/\/$/, '');
    this.apiKey = options.apiKey ?? process.env.NIM_API_KEY ?? '';
    this.imageModel = options.imageModel ?? process.env.NIM_IMAGE_MODEL ?? 'black-forest-labs/flux.1-dev';
    this.videoModel = options.videoModel ?? process.env.NIM_VIDEO_MODEL ?? 'nvidia/cosmos3-nano';
    if (!this.baseUrl || !this.apiKey) throw new Error('NIM_BASE_URL and NIM_API_KEY are required for generated media.');
  }

  searchImages(): Promise<MediaSearchResult> {
    return Promise.reject(new Error('NVIDIA NIM generates media but does not provide stock-image search. Configure Pexels for search.'));
  }

  async generate(options: MediaGenerationOptions): Promise<MediaAsset> {
    if (options.kind === 'video') {
      throw new Error('NVIDIA NIM video generation requires a configured asynchronous job adapter for the selected model.');
    }
    const response = await fetch(`${this.baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.imageModel,
        prompt: options.prompt,
        n: 1,
        size: options.aspectRatio === 'square' ? '1024x1024' : '1536x1024',
        response_format: 'url',
      }),
    });
    if (!response.ok) throw new Error(`NVIDIA NIM image generation failed with status ${response.status}.`);
    const payload = await response.json() as { data?: Array<{ url?: string; b64_json?: string }> };
    const result = payload.data?.[0];
    const src = result?.url;
    if (!src) throw new Error('NVIDIA NIM returned no hosted image URL. Upload base64 output to object storage before publishing.');
    return { kind: 'image', src: requireHttpsUrl(src, 'NVIDIA NIM image URL'), alt: options.prompt };
  }
}

export function createMediaProvider(preferred?: 'search' | 'generate'): MediaProvider | null {
  if (preferred === 'search' && process.env.PEXELS_API_KEY) return new PexelsMediaProvider();
  if (process.env.NIM_BASE_URL && process.env.NIM_API_KEY) return new NvidiaNimMediaProvider();
  if (process.env.PEXELS_API_KEY) return new PexelsMediaProvider();
  return null;
}
