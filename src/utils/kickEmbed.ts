import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { KickImage } from './kickImages.ts';

export const KICK_LIVE_COLOR = 0xFF3B3B;
export const KICK_ENDED_COLOR = 0x2F3136;

export interface KickLiveData {
  slug: string;
  title: string;
  category: string;
  thumbnail: string;
  startedAt: number;
}

export interface KickEndedData extends KickLiveData {
  endedAt: number;
  viewerCount: number;
}

function kickUrl(slug: string): string {
  return `https://kick.com/${slug}`;
}

function addFooter(embed: EmbedBuilder, slug: string, guildName?: string): EmbedBuilder {
  const label = guildName ? `${guildName} • ` : '';
  return embed.setFooter({ text: `Fracture • ${label}${kickUrl(slug)}` });
}

export function buildKickLiveEmbed(data: KickLiveData, description: string, guildName?: string, image?: KickImage | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(KICK_LIVE_COLOR)
    .setTitle('🔴 YAYINDAYIZ!')
    .setDescription(description);

  if (data.category) {
    embed.addFields({ name: '🎮 Kategori', value: data.category.slice(0, 1024), inline: true });
  }
  embed.addFields({
    name: '🕐 Başlangıç',
    value: data.startedAt > 0 ? `<t:${Math.floor(data.startedAt / 1000)}:F>` : 'Bilinmiyor',
    inline: true
  });

  if (image?.url) embed.setImage(image.url);

  return addFooter(embed, data.slug, guildName);
}

export function buildKickEndedEmbed(data: KickEndedData, description: string, guildName?: string, image?: KickImage | null): EmbedBuilder {
  const startSec = data.startedAt > 0 ? Math.floor(data.startedAt / 1000) : 0;
  const endSec = data.endedAt > 0 ? Math.floor(data.endedAt / 1000) : 0;
  const durationMs = data.startedAt > 0 && data.endedAt > data.startedAt ? data.endedAt - data.startedAt : 0;

  const embed = new EmbedBuilder()
    .setColor(KICK_ENDED_COLOR)
    .setTitle('⚫ YAYIN BİTTİ!');

  if (description) embed.setDescription(description);

  if (data.category) {
    embed.addFields({ name: '🎮 Kategori', value: data.category.slice(0, 1024), inline: true });
  }
  embed.addFields(
    {
      name: '👥 Son İzleyici',
      value: data.viewerCount > 0 ? data.viewerCount.toLocaleString('tr-TR') : 'Bilinmiyor',
      inline: true
    },
    {
      name: '🕐 Başlangıç',
      value: startSec > 0 ? `<t:${startSec}:F>` : 'Bilinmiyor',
      inline: true
    },
    {
      name: '🕑 Bitiş',
      value: endSec > 0 ? `<t:${endSec}:F>` : 'Bilinmiyor',
      inline: true
    },
    {
      name: '⏱️ Süre',
      value: durationMs > 0 ? formatLiveDuration(durationMs) : 'Bilinmiyor',
      inline: true
    }
  );

  if (image?.url) embed.setImage(image.url);

  return addFooter(embed, data.slug, guildName);
}

function formatLiveDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return hours > 0 ? `${days}g ${hours}sa` : `${days}g`;
  if (hours > 0) return minutes > 0 ? `${hours}sa ${minutes}dk` : `${hours}sa`;
  if (minutes > 0) return `${minutes}dk`;
  return '1dkden az';
}

export function buildKickLinkButton(slug: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Kick\'te İzle')
      .setURL(kickUrl(slug))
      .setEmoji('🔗')
      .setStyle(ButtonStyle.Link)
  );
}

export function buildKickPingContent(pingType: string | undefined, pingRoleId?: string): string {
  if (pingType === 'everyone') return '@everyone';
  if (pingType === 'role' && pingRoleId) return `<@&${pingRoleId}>`;
  return '';
}
