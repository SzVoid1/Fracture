const OFFICIAL_API = 'https://api.kick.com/public/v1/channels';
const PUBLIC_V2_API = 'https://kick.com/api/v2/channels';
const TOKEN_URL = 'https://id.kick.com/oauth/token';
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 15 * 1000;

export type KickApiMode = 'official' | 'public-v2';

export interface KickChannelInfo {
  slug: string;
  title: string;
  category: string;
  thumbnail: string;
  isLive: boolean;
  sessionKey: string;
  startedAt: number;
  viewerCount: number;
}

export class KickAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KickAuthError';
  }
}

export class KickNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KickNotFoundError';
  }
}

export class KickRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KickRateLimitError';
  }
}

export class KickNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KickNetworkError';
  }
}

export function isKickConfigured(): boolean {
  return Boolean(process.env.KICK_CLIENT_ID && process.env.KICK_CLIENT_SECRET);
}

export function getKickApiMode(): KickApiMode {
  if (process.env.KICK_API_MODE === 'public-v2') return 'public-v2';
  if (process.env.KICK_API_MODE === 'official') return isKickConfigured() ? 'official' : 'public-v2';
  return isKickConfigured() ? 'official' : 'public-v2';
}

export function getKickModeLabel(): string {
  return getKickApiMode() === 'official'
    ? 'official (api.kick.com, App Access Token)'
    : 'public-v2 (kick.com/api/v2, yetkisiz yedek)';
}

export function normalizeKickSlug(input: string): string {
  let slug = input.trim().toLowerCase();
  slug = slug.replace(/^https?:\/\/(www\.)?kick\.com\//, '');
  slug = slug.replace(/^kick\.com\//, '');
  slug = slug.split(/[/?#]/)[0];
  return slug;
}

export function isValidKickSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{1,24}$/.test(slug);
}

export function parseKickDate(value: string | null | undefined): number {
  if (!value) return 0;

  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('0001-01-01')) return 0;

  // v2 "2026-04-06 05:03:57" → ISO
  const spaceSeparated = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(trimmed);
  if (spaceSeparated) {
    const [, y, mo, d, h, mi, s] = spaceSeparated;
    return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function emptyInfo(slug: string): KickChannelInfo {
  return {
    slug,
    title: '',
    category: '',
    thumbnail: '',
    isLive: false,
    sessionKey: '',
    startedAt: 0,
    viewerCount: 0
  };
}

function str(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

export function __resetKickTokenCache(): void {
  tokenCache = null;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    throw new KickNetworkError(error instanceof Error ? error.message : 'Kick API isteği başarısız');
  } finally {
    clearTimeout(timer);
  }
}

async function requestAppToken(force: boolean): Promise<string> {
  if (!force && tokenCache && tokenCache.expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
    return tokenCache.token;
  }

  const clientId = process.env.KICK_CLIENT_ID ?? '';
  const clientSecret = process.env.KICK_CLIENT_SECRET ?? '';
  if (!clientId || !clientSecret) {
    throw new KickAuthError('KICK_CLIENT_ID veya KICK_CLIENT_SECRET tanımlı değil');
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      })
    });
  } catch (error) {
    if (tokenCache) return tokenCache.token;
    throw error;
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new KickAuthError(`Kick token alınamadı (HTTP ${response.status}) - KICK_CLIENT_ID/SECRET kontrol edilmeli`);
    }
    if (response.status === 429) throw new KickRateLimitError('Kick token isteği rate limit yedi (429)');
    if (tokenCache) return tokenCache.token;
    throw new KickNetworkError(`Kick token isteği başarısız (HTTP ${response.status})`);
  }

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  const token = str(payload.access_token);
  if (!token) {
    if (tokenCache) return tokenCache.token;
    throw new KickNetworkError('Kick token yanıtında access_token yok');
  }

  const expiresIn = num(payload.expires_in) || 3600;
  tokenCache = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

function normalizeOfficialChannel(raw: unknown, fallbackSlug: string): KickChannelInfo {
  const data = raw as Record<string, unknown>;
  const stream = (data.stream ?? {}) as Record<string, unknown>;
  const category = (data.category ?? {}) as Record<string, unknown>;

  const slug = str(data.slug) || fallbackSlug;
  const isLive = stream.is_live === true;
  const startedAt = parseKickDate(str(stream.start_time));
  const startTime = str(stream.start_time);

  return {
    slug,
    title: str(data.stream_title),
    category: str(category.name),
    thumbnail: str(stream.thumbnail),
    isLive,
    sessionKey: isLive ? (startTime || slug) : '',
    startedAt,
    viewerCount: num(stream.viewer_count)
  };
}

function normalizeV2Channel(raw: unknown, fallbackSlug: string): KickChannelInfo {
  const data = raw as Record<string, unknown>;
  const livestream = (data.livestream ?? null) as Record<string, unknown> | null;
  const isLive = Boolean(livestream);

  const categories = Array.isArray(livestream?.categories) ? livestream!.categories as unknown[] : [];
  const firstCategory = (categories[0] ?? null) as Record<string, unknown> | null;
  const recent = Array.isArray(data.recent_categories) ? data.recent_categories as unknown[] : [];
  const firstRecent = (recent[0] ?? null) as Record<string, unknown> | null;

  const slug = str(data.slug) || fallbackSlug;
  const livestreamId = str(livestream?.id);
  const banner = (data.banner_image ?? {}) as Record<string, unknown>;

  return {
    slug,
    title: str(livestream?.session_title),
    category: str(firstCategory?.name) || str(firstRecent?.name),
    // Bazı yayınlarda livestream.thumbnail boş geliyor; o durumda kanal banner'ı kullan.
    thumbnail: str(livestream?.thumbnail) || str(banner.url),
    isLive,
    sessionKey: isLive ? (livestreamId || str(livestream?.start_time) || slug) : '',
    startedAt: parseKickDate(str(livestream?.start_time)),
    viewerCount: num(livestream?.viewer_count)
  };
}

async function fetchOfficial(slug: string): Promise<KickChannelInfo> {
  const url = `${OFFICIAL_API}?slug=${encodeURIComponent(slug)}`;

  const token = await requestAppToken(false);
  let response = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });

  if (response.status === 401 || response.status === 403) {
    tokenCache = null;
    const retryToken = await requestAppToken(true);
    response = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${retryToken}` } });
  }

  if (response.status === 404) throw new KickNotFoundError(`Kick kanalı bulunamadı: ${slug}`);
  if (response.status === 429) throw new KickRateLimitError('Kick API rate limit yedi (429)');
  if (!response.ok) throw new KickNetworkError(`Kick API hatası (HTTP ${response.status})`);

  const payload = (await response.json()) as { data?: unknown[] };
  const entry = Array.isArray(payload.data) ? payload.data[0] : undefined;
  if (!entry) return emptyInfo(slug);

  return normalizeOfficialChannel(entry, slug);
}

async function fetchPublicV2(slug: string): Promise<KickChannelInfo> {
  const response = await fetchWithTimeout(`${PUBLIC_V2_API}/${encodeURIComponent(slug)}`, {
    headers: { Accept: 'application/json' }
  });

  if (response.status === 404) throw new KickNotFoundError(`Kick kanalı bulunamadı: ${slug}`);
  if (response.status === 429) throw new KickRateLimitError('Kick API rate limit yedi (429)');
  if (!response.ok) throw new KickNetworkError(`Kick API hatası (HTTP ${response.status})`);

  return normalizeV2Channel(await response.json(), slug);
}

export async function fetchKickChannel(slugInput: string): Promise<KickChannelInfo> {
  const slug = normalizeKickSlug(slugInput);
  if (!slug) throw new KickNotFoundError('Kick kanal slug boş');

  return getKickApiMode() === 'official' ? fetchOfficial(slug) : fetchPublicV2(slug);
}
