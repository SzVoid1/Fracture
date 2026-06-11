export interface ParsedTime {
  expiresAt: number;
  originalInput: string;
  totalMs: number;
}

const TIME_REGEX = /^(\d+)(day|[dhms])$/i;
const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?$/;

export function parseTimeInput(input: string): ParsedTime {
  const trimmed = input.trim();
  const now = Date.now();

  const dateMatch = trimmed.match(DATE_REGEX);
  if (dateMatch) {
    const year = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1;
    const day = parseInt(dateMatch[3], 10);
    const hour = dateMatch[4] ? parseInt(dateMatch[4], 10) : 0;
    const minute = dateMatch[5] ? parseInt(dateMatch[5], 10) : 0;

    const targetDate = new Date(year, month, day, hour, minute, 0, 0);
    const expiresAt = targetDate.getTime();

    if (expiresAt <= now) {
      throw new Error('Geçmiş bir tarih giremezsiniz.');
    }

    return { expiresAt, originalInput: trimmed, totalMs: expiresAt - now };
  }

  const parts = trimmed.split(/\s+/).filter(p => p.length > 0);
  if (parts.length === 0) {
    throw new Error('Geçerli bir zaman formatı giriniz. Örn: "1h 30d" veya "2024-12-31 23:59"');
  }

  let totalMs = 0;
  for (const part of parts) {
    const match = part.match(TIME_REGEX);
    if (!match) {
      throw new Error(`Geçersiz zaman formatı: "${part}". Kullanım: 5d (5dk), 1h, 30s, 1day (1gün)`);
    }
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'day': totalMs += value * 24 * 60 * 60 * 1000; break;
      case 'd': totalMs += value * 60 * 1000; break;
      case 'h': totalMs += value * 60 * 60 * 1000; break;
      case 'm': totalMs += value * 60 * 1000; break;
      case 's': totalMs += value * 1000; break;
    }
  }

  if (totalMs === 0) {
    throw new Error('Süre 0 olamaz.');
  }

  const expiresAt = now + totalMs;
  return { expiresAt, originalInput: trimmed, totalMs };
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

export function getTimeUntil(expiresAt: number): number {
  return Math.max(0, expiresAt - Date.now());
}

export function getTotalDuration(totalMs: number): number {
  return totalMs;
}