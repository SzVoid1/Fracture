import { formatDuration } from './timeParser.ts';

export const DEFAULT_LIVE_MESSAGE = 'Herkesi bekliyoruz! 🎉 Gelin izleyin, sohbete eşlik edin. 💬';
export const DEFAULT_ENDED_MESSAGE = 'Yayınımız sona erdi. Bir sonrakinde yine buradayız! 👋';

// Eski isimlerle geriye uyumluluk
export const DEFAULT_LIVE_TEXT = DEFAULT_LIVE_MESSAGE;
export const DEFAULT_ENDED_TEXT = DEFAULT_ENDED_MESSAGE;

export const MAX_MESSAGE_LENGTH = 1000;
export const TITLE_PLACEHOLDER = '{başlık}';

export const COMMON_PLACEHOLDERS = ['{baslik}', '{b}', '{kategori}', '{slug}', '{link}', '{baslangic}', '{sunucu}'] as const;
export const ENDED_PLACEHOLDERS = [...COMMON_PLACEHOLDERS, '{bitis}', '{sure}', '{izleyici}'] as const;

export interface KickTextData {
  title: string;
  category: string;
  slug: string;
  link: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  viewerCount: number;
  guildName: string;
}

function foldKey(key: string): string {
  return key
    .toLowerCase()
    // NFD, Türkçe noktasız "ı" (U+0131) harfini AYRIŞTIRMAZ.
    // Bu yüzden önce açık eşleme gerekiyor, aksi halde {başlık} -> "baslık" kalıyor.
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function asDiscordTimestamp(ms: number): string {
  return ms > 0 ? `<t:${Math.floor(ms / 1000)}:F>` : 'Bilinmiyor';
}

function asViewerCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return 'Bilinmiyor';
  return count.toLocaleString('tr-TR');
}

export function buildKickTextData(data: Partial<KickTextData>): KickTextData {
  return {
    title: data.title?.trim() || 'Başlıksız Yayın',
    category: data.category?.trim() || '',
    slug: data.slug?.trim() || '',
    link: data.link?.trim() || (data.slug ? `https://kick.com/${data.slug}` : ''),
    startedAt: data.startedAt ?? 0,
    endedAt: data.endedAt ?? 0,
    durationMs: data.durationMs ?? 0,
    viewerCount: data.viewerCount ?? 0,
    guildName: data.guildName?.trim() || ''
  };
}

export function truncateKickText(text: string, maxLength: number = MAX_MESSAGE_LENGTH): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/** `{b}` ve tek başına duran ` b ` ifadelerini `{başlık}` yapar. */
export function expandBShortcut(text: string): string {
  return text
    .replace(/\{b\}/gi, TITLE_PLACEHOLDER)
    .replace(/(^|[\s(])b(?=\s|$|[).,!?;:])/g, `$1${TITLE_PLACEHOLDER}`);
}

/**
 * Başlık artık her zaman en üstte ayrı gösterildiği için, eski kayıtlarda
 * mesajın başında duran {başlık} tekrar etiketlenmesin diye kaldırılır.
 */
export function stripLeadingTitle(template: string): string {
  const pattern = /^\s*\{\s*ba[sş]l[iı]k\s*\}[ \t]*(?:\n+|[—–-]\s*)?/i;
  return template.replace(pattern, '').trim();
}

/**
 * Yalnızca kullanıcının yazdığı ek mesajı placeholder'larla doldurur.
 *
 * Sıra önemli: önce BAŞLIKTAKİ LİTERAL `{başlık}` temizlenir (eski kayıtlarda
 * başlık mesajın içinde de bulunuyordu, üstte tekrar görünmesin), SONRA `b`
 * kısaltması genişletilir. Aksi halde kullanıcının bilerek yazdığı
 * "b konusunda yayındayız" ifadesi sessizce "konusunda yayındayız" olurdu.
 */
export function renderKickMessage(template: string | undefined, data: Partial<KickTextData>, ended = false): string {
  const resolved = buildKickTextData(data);
  const raw = template?.trim() ? template : (ended ? DEFAULT_ENDED_MESSAGE : DEFAULT_LIVE_MESSAGE);
  const source = expandBShortcut(stripLeadingTitle(raw));

  const values: Record<string, string> = {
    baslik: resolved.title,
    kategori: resolved.category,
    slug: resolved.slug,
    link: resolved.link,
    baslangic: asDiscordTimestamp(resolved.startedAt),
    bitis: asDiscordTimestamp(resolved.endedAt),
    sure: resolved.durationMs > 0 ? formatDuration(resolved.durationMs) : 'Bilinmiyor',
    izleyici: asViewerCount(resolved.viewerCount),
    sunucu: resolved.guildName
  };

  // \w ASCII-only olduğu için {başlık} gibi Türkçe placeholder'ları kaçırır.
  // Bu yüzden [^{}\s]+ ile tüm unicode karakterleri kapsıyoruz.
  return truncateKickText(source.replace(/\{([^{}\s]+)\}/g, (match, rawKey: string) => {
    const value = values[foldKey(rawKey)];
    return value === undefined ? match : value;
  }));
}

/**
 * Embed açıklaması: başlık HER ZAMAN en üstte, kullanıcının ek mesajı altında.
 * Ek mesaj boşsa sadece başlık gösterilir.
 */
export function renderKickDescription(template: string | undefined, data: Partial<KickTextData>, ended = false): string {
  const { title } = buildKickTextData(data);
  const extra = renderKickMessage(template, data, ended).trim();
  return truncateKickText(extra ? `${title}\n\n${extra}` : title);
}