import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { formatColonPreview, getTimeUntil } from './timeParser.ts';

export type AnnouncementStatus = 'active' | 'half' | 'critical' | 'expired' | 'cancelled';

interface AnnouncementLike {
  id: string;
  title: string;
  description: string;
  channelId: string;
  roleId: string;
  createdAt: number;
  expiresAt: number;
  totalMs: number;
  seenBy: string[];
  authorId?: string;
  authorTag?: string;
}

const COLOR_MAP: Record<AnnouncementStatus, number> = {
  active: 0x5865F2,   // blurple
  half: 0xF39C12,     // turuncu
  critical: 0xE74C3C, // kırmızı
  expired: 0x8B0000,  // koyu kırmızı
  cancelled: 0xFF0000
};

const TITLE_MAP: Record<AnnouncementStatus, string> = {
  active: '📢',
  half: '⏰',
  critical: '🔔',
  expired: '🚫',
  cancelled: '🚫'
};

function buildProgressBar(totalMs: number, timeLeft: number): { bar: string; pct: number } {
  const elapsed = Math.max(0, totalMs - timeLeft);
  const pct = totalMs > 0 ? Math.round((elapsed / totalMs) * 100) : 0;
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round(clamped / 10);
  const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
  return { bar, pct: clamped };
}

export function buildAnnouncementEmbed(ann: AnnouncementLike, status: AnnouncementStatus = 'active'): EmbedBuilder {
  const timeLeft = getTimeUntil(ann.expiresAt);
  const { bar, pct } = buildProgressBar(ann.totalMs, timeLeft);
  const expSec = Math.floor(ann.expiresAt / 1000);

  let description: string;
  let color = COLOR_MAP[status];
  let titlePrefix = TITLE_MAP[status];

  if (status === 'expired') {
    description = `${ann.description}\n\n⏳ **Bu duyurunun süresi dolmuştur.**\n\`${bar}\` **%100**`;
  } else if (status === 'cancelled') {
    description = ann.description;
  } else {
    // C kompakt: açıklama + tek satır progress
    const remaining = formatColonPreview(timeLeft);
    const progressLine = `\n\n${bar} **%${pct}** • Kalan: **${remaining}** • Bitiş: <t:${expSec}:R>`;
    description = ann.description + progressLine;
  }

  let title: string;
  if (status === 'half') title = `${titlePrefix} ${ann.title} — %50`;
  else if (status === 'critical') title = `${titlePrefix} ${ann.title} — %75`;
  else if (status === 'expired') title = `${titlePrefix} ${ann.title} - Süre Doldu!`;
  else if (status === 'cancelled') title = `${titlePrefix} ${ann.title} - İptal Edildi`;
  else title = `${titlePrefix} ${ann.title}`;

  const creator = (ann as any).authorTag || 'Bilinmeyen';
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .addFields(
      { name: '👥 Rol', value: `<@&${ann.roleId}>`, inline: true },
      { name: '⏰ Bitiş', value: `<t:${expSec}:F>`, inline: true }
    )
    .setFooter({ text: `ID: ${ann.id} • C: ${creator}` })
    .setTimestamp(new Date(ann.createdAt));

  // half/critical durumunda Durum field’ını ekle (opsiyonel, kompaktı bozmamak için description’da zaten % var)
  // İstenirse field eklenebilir, şimdilik sadece color/title ile ayırt ediliyor

  return embed;
}

export function buildAnnouncementButtons(annId: string, seenCount: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`seen_${annId}`)
      .setLabel('Gördüm')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`list_${annId}`)
      .setLabel(`${seenCount}`)
      .setEmoji('📜')
      .setStyle(ButtonStyle.Secondary)
  );
}

export function buildCancelledEmbed(ann: AnnouncementLike, cancelledByTag: string): EmbedBuilder {
  const embed = buildAnnouncementEmbed(ann, 'cancelled');
  embed.setDescription(`Bu duyuru **${cancelledByTag}** tarafından iptal edildi.`);
  embed.spliceFields(0, 2,
    { name: 'Orijinal Açıklama', value: ann.description.slice(0, 1024), inline: false },
    { name: 'Planlanan Bitiş', value: `<t:${Math.floor(ann.expiresAt / 1000)}:F>`, inline: true }
  );
  embed.setColor(COLOR_MAP.cancelled);
  return embed;
}
