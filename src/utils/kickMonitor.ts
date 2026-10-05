import type { Client } from 'discord.js';
import { TextChannel, ChannelType } from 'discord.js';
import {
  fetchKickChannel,
  getKickModeLabel,
  KickAuthError,
  KickNetworkError,
  KickNotFoundError,
  KickRateLimitError
} from './kickApi.ts';
import type { KickChannelInfo } from './kickApi.ts';
import { getSettings } from './storage.ts';
import type { Settings } from './storage.ts';
import { getKickState, setKickState, clearKickState } from './kickState.ts';
import type { KickState } from './kickState.ts';
import { renderKickDescription } from './kickText.ts';
import { buildKickLiveEmbed, buildKickEndedEmbed, buildKickLinkButton, buildKickPingContent } from './kickEmbed.ts';
import { resolveKickImage, describeKickAssets } from './kickImages.ts';

const CHECK_INTERVAL = 30 * 1000;

export type KickAction = 'announce' | 'end' | 'update' | 'none';

let intervalId: ReturnType<typeof setInterval> | null = null;
let running = false;

export function resolveKickAction(prev: KickState | undefined, info: KickChannelInfo): KickAction {
  if (info.isLive && prev?.sessionKey !== info.sessionKey) return 'announce';
  if (!info.isLive && prev?.sessionKey) return 'end';
  if (info.isLive && prev && prev.title !== info.title) return 'update';
  return 'none';
}

export function isKickConfiguredForGuild(settings: Settings | undefined): boolean {
  return Boolean(settings?.kickSlug && settings?.kickChannelId);
}

function textData(settings: Settings, guildName: string, info: KickChannelInfo, endedAt: number, durationMs: number) {
  return {
    title: info.title || settings.kickSlug || 'Kick Yayını',
    category: info.category,
    slug: settings.kickSlug ?? '',
    startedAt: info.startedAt,
    endedAt,
    durationMs,
    viewerCount: info.viewerCount,
    guildName
  };
}

async function resolveChannel(client: Client, settings: Settings): Promise<TextChannel | null> {
  const channel = await client.channels.fetch(settings.kickChannelId!).catch(() => null);
  if (!channel) return null;
  if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) return null;
  return channel as TextChannel;
}

async function announce(client: Client, settings: Settings, info: KickChannelInfo): Promise<void> {
  const channel = await resolveChannel(client, settings);
  if (!channel) {
    console.error(`[KICK] Duyuru kanalı bulunamadı/erişilemiyor: ${settings.kickChannelId}`);
    return;
  }

  const guildName = channel.guild.name;
  const description = renderKickDescription(settings.kickLiveText, textData(settings, guildName, info, 0, 0), false);
  const content = buildKickPingContent(settings.kickPingType, settings.kickPingRoleId);
  const image = resolveKickImage('start', info.thumbnail);

  try {
    const message = await channel.send({
      content: content || undefined,
      embeds: [buildKickLiveEmbed(info, description, guildName, image)],
      components: [buildKickLinkButton(settings.kickSlug!)],
      files: image?.attachment ? [image.attachment] : []
    });

    setKickState({
      guildId: settings.guildId,
      sessionKey: info.sessionKey,
      messageId: message.id,
      slug: info.slug,
      title: info.title,
      category: info.category,
      thumbnail: info.thumbnail,
      imageSource: image?.source ?? '',
      startedAt: info.startedAt,
      lastViewers: info.viewerCount,
      lastCheckedAt: Date.now()
    });

    console.log(`[KICK] Duyuru gönderildi: ${settings.guildId} - ${info.slug} - "${info.title}" (görsel: ${image?.source ?? 'yok'})`);
  } catch (error: any) {
    console.error(`[KICK] Duyuru gönderilemedi (${settings.kickChannelId}):`, error?.message ?? error);
  }
}

async function update(client: Client, settings: Settings, state: KickState, info: KickChannelInfo): Promise<void> {
  const channel = await resolveChannel(client, settings);
  if (!channel) return;

  try {
    const message = await channel.messages.fetch(state.messageId);
    const guildName = channel.guild.name;
    const description = renderKickDescription(settings.kickLiveText, textData(settings, guildName, info, 0, 0), false);
    // Görsel kaynağı duyuru anında sabitlenmiştir: mesajda zaten duran attachment'ı
    // tekrar göndermek (ya da yanlışlıkla görseli düşürmek) yerine aynısına referans veriyoruz.
    const image = state.imageSource === 'asset'
      ? { url: 'attachment://start.png', source: 'asset' as const }
      : (info.thumbnail ? { url: info.thumbnail, source: 'kick' as const } : null);
    await message.edit({ embeds: [buildKickLiveEmbed(info, description, guildName, image)] });
    setKickState({ ...state, title: info.title, lastViewers: info.viewerCount, lastCheckedAt: Date.now() });
    console.log(`[KICK] Duyuru güncellendi: ${settings.guildId} - "${info.title}"`);
  } catch (error: any) {
    console.error(`[KICK] Duyuru güncellenemedi (${state.messageId}):`, error?.message ?? error);
  }
}

async function finish(client: Client, settings: Settings, state: KickState): Promise<void> {
  const channel = await resolveChannel(client, settings);
  const endedAt = Date.now();
  const durationMs = state.startedAt > 0 ? Math.max(0, endedAt - state.startedAt) : 0;

  const endedData = {
    slug: state.slug || settings.kickSlug || '',
    title: state.title || 'Kick Yayını',
    category: state.category,
    thumbnail: state.thumbnail,
    startedAt: state.startedAt,
    endedAt,
    viewerCount: state.lastViewers
  };

  if (channel) {
    try {
      const message = await channel.messages.fetch(state.messageId);
      const description = renderKickDescription(settings.kickEndedText, {
        title: endedData.title,
        category: endedData.category,
        slug: endedData.slug,
        startedAt: endedData.startedAt,
        endedAt,
        durationMs,
        viewerCount: endedData.viewerCount,
        guildName: channel.guild.name
      }, true);
      const image = resolveKickImage('finish', endedData.thumbnail);
      await message.edit({
        embeds: [buildKickEndedEmbed(endedData, description, channel.guild.name, image)],
        files: image?.attachment ? [image.attachment] : []
      });
      console.log(`[KICK] Yayın bitti, duyuru güncellendi: ${settings.guildId} - "${endedData.title}" (görsel: ${image?.source ?? 'yok'})`);
    } catch (error: any) {
      console.error(`[KICK] Bitti mesajı güncellenemedi (${state.messageId}):`, error?.message ?? error);
    }
  }

  clearKickState(settings.guildId);
}

export async function runKickCheckForGuild(client: Client, settings: Settings): Promise<void> {
  if (!isKickConfiguredForGuild(settings)) return;

  let info: KickChannelInfo;
  try {
    info = await fetchKickChannel(settings.kickSlug!);
  } catch (error) {
    if (error instanceof KickNotFoundError) {
      console.error(`[KICK] Kanal bulunamadı: ${settings.kickSlug} - /kick slug ile kontrol et`);
    } else if (error instanceof KickAuthError) {
      console.error('[KICK] Yetkilendirme hatası:', error.message);
    } else if (error instanceof KickRateLimitError) {
      console.warn('[KICK] Rate limit, bu tur atlanıyor.');
    } else if (error instanceof KickNetworkError) {
      console.warn('[KICK] Ağ hatası, bu tur atlanıyor:', error.message);
    } else {
      console.error('[KICK] Beklenmeyen hata:', error);
    }
    return;
  }

  const state = getKickState(settings.guildId);
  const action = resolveKickAction(state, info);

  if (action === 'announce') await announce(client, settings, info);
  else if (action === 'end') await finish(client, settings, state!);
  else if (action === 'update' && state) await update(client, settings, state, info);
}

export async function runKickCheck(client: Client): Promise<void> {
  if (running) return;
  running = true;
  try {
    const targets = getSettings().filter(isKickConfiguredForGuild);
    for (const settings of targets) {
      await runKickCheckForGuild(client, settings);
    }
  } finally {
    running = false;
  }
}

export function startKickMonitor(client: Client): void {
  console.log(`[KICK API] Mod: ${getKickModeLabel()}`);
  console.log(`[KICK] Özel görseller: ${describeKickAssets()}`);
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(() => { void runKickCheck(client); }, CHECK_INTERVAL);
  intervalId.unref?.();
  void runKickCheck(client);
}

export function stopKickMonitor(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[KICK] Monitor durduruldu.');
  }
}
