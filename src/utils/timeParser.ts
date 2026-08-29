export interface ParsedTime {
  expiresAt: number;
  originalInput: string;
  totalMs: number;
}

// Yeni format: GG:HH:MM:SS sağa dayalı kısayol
// 1 parça  -> SS
// 2 parça -> MM:SS
// 3 parça -> HH:MM:SS
// 4 parça -> DD:HH:MM:SS
// 00 / 0 es geçilir, en az 1 değer >0 olmalı
// Limitler: Gün ≤365, Saat ≤24, Dakika ≤60, Saniye ≤60 (fazlası bir üst birime eklenir / carry)
// Toplam >365 gün ise hata
const MAX_TOTAL_MS = 365 * 24 * 60 * 60 * 1000;

export function parseColonDuration(input: string): ParsedTime {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error('Süre boş olamaz. Örn: `00:02:00:00` (2 saat) veya `2:00` (2 dakika).');
  }

  const parts = trimmed.split(':');
  if (parts.length < 1 || parts.length > 4) {
    throw new Error('Geçersiz format. Kullanım: `GG:HH:MM:SS` (örn `01:20:00:00`), kısayol `2:00` (2dk), `2:0:0` (2sa).');
  }

  // Her parça sadece rakamlardan oluşmalı
  for (const p of parts) {
    if (p.length === 0 || !/^\d+$/.test(p)) {
      throw new Error(`Geçersiz değer: "${p}". Sadece sayılar ve ":" kullanın. Örn: \`00:02:00:00\``);
    }
    // Sayı aralığı kontrolü totalMs üzerinden yapılacak; tek parça için özel limit yok
    // Gün/Saat/Dakika/Saniye limitleri totalMs hesabıyla normalize edilir (25 saat → 1g 1sa)
  }

  const nums = parts.map(p => parseInt(p, 10));

  let d = 0, h = 0, m = 0, s = 0;
  if (nums.length === 4) {
    [d, h, m, s] = nums;
  } else if (nums.length === 3) {
    [h, m, s] = nums;
  } else if (nums.length === 2) {
    [m, s] = nums;
  } else {
    [s] = nums;
  }

  const totalMs = d * 24 * 60 * 60 * 1000 + h * 60 * 60 * 1000 + m * 60 * 1000 + s * 1000;

  if (totalMs === 0) {
    throw new Error('Süre 0 olamaz. En az bir değer 0\'dan büyük olmalı. Örn: `00:00:15:00` (15dk).');
  }

  if (totalMs > MAX_TOTAL_MS) {
    throw new Error('Maksimum süre 365 günü aşamaz.');
  }

  const now = Date.now();
  return { expiresAt: now + totalMs, originalInput: trimmed, totalMs };
}

// Geriye dönük alias — artık sadece colon formatı destekleniyor
export function parseTimeInput(input: string): ParsedTime {
  return parseColonDuration(input);
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return 'Süre doldu';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}g ${hours % 24}s ${minutes % 60}dk`;
  if (hours > 0) return `${hours}s ${minutes % 60}dk ${seconds % 60}sn`;
  if (minutes > 0) return `${minutes}dk ${seconds % 60}sn`;
  return `${seconds}sn`;
}

// Wizard preview için daha okunabilir format
export function formatColonPreview(totalMs: number): string {
  if (totalMs <= 0) return '0sn';
  let remaining = Math.floor(totalMs / 1000);
  const d = Math.floor(remaining / 86400); remaining %= 86400;
  const h = Math.floor(remaining / 3600); remaining %= 3600;
  const m = Math.floor(remaining / 60); remaining %= 60;
  const s = remaining;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}g`);
  if (h > 0) parts.push(`${h}sa`);
  if (m > 0) parts.push(`${m}dk`);
  if (s > 0) parts.push(`${s}sn`);
  return parts.join(' ') || '0sn';
}

export function getTimeUntil(expiresAt: number): number {
  return Math.max(0, expiresAt - Date.now());
}

export function getTotalDuration(totalMs: number): number {
  return totalMs;
}
