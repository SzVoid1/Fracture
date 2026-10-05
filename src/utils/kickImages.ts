import * as fs from 'fs';
import * as path from 'path';
import { AttachmentBuilder } from 'discord.js';

export const KICK_ASSETS_DIR = path.join(process.cwd(), 'assets', 'kick');

export type KickImageKind = 'start' | 'finish';

export interface KickImage {
  url: string;
  attachment?: AttachmentBuilder;
  source: 'asset' | 'kick';
}

export function ensureKickAssetsDir(): string {
  if (!fs.existsSync(KICK_ASSETS_DIR)) {
    fs.mkdirSync(KICK_ASSETS_DIR, { recursive: true });
  }
  return KICK_ASSETS_DIR;
}

export function getKickAssetPath(kind: KickImageKind): string | null {
  const filePath = path.join(ensureKickAssetsDir(), `${kind}.png`);
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) return filePath;
  } catch {
    return null;
  }
  return null;
}

export function hasKickAsset(kind: KickImageKind): boolean {
  return getKickAssetPath(kind) !== null;
}

/**
 * Öncelik `assets/kick/{kind}.png` dosyasıdır; yoksa Kick'in verdiği thumbnail kullanılır.
 * Yerel dosya seçilirse Discord embed'da gösterebilmek için `attachment://` referansı
 * üretilir ve dosya `attachment` olarak geri döner (mesaja `files` ile eklenmeli).
 */
export function resolveKickImage(kind: KickImageKind, fallbackUrl: string): KickImage | null {
  const assetPath = getKickAssetPath(kind);
  if (assetPath) {
    try {
      return {
        url: `attachment://${kind}.png`,
        attachment: new AttachmentBuilder(assetPath),
        source: 'asset'
      };
    } catch {
      // Bozuk/okunamayan dosya → Kick görseline düş
    }
  }
  return fallbackUrl ? { url: fallbackUrl, source: 'kick' } : null;
}

export function describeKickAssets(): string {
  return `${hasKickAsset('start') ? '✅ start.png' : '— start.png'} · ${hasKickAsset('finish') ? '✅ finish.png' : '— finish.png'}`;
}