import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType } from 'discord.js';
import { getAnnouncements, updateAnnouncement, removeAnnouncement } from './storage.js';
import { formatDuration, getTimeUntil } from './timeParser.js';

const CHECK_INTERVAL = 30 * 1000;
const DELAY_THRESHOLD = CHECK_INTERVAL * 3;

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startScheduler(client: Client): void {
  console.log(`[SCHEDULER] Başlatılıyor... Kontrol aralığı: ${CHECK_INTERVAL / 1000}s`);

  if (intervalId) {
    clearInterval(intervalId);
  }

  intervalId = setInterval(() => {
    checkAnnouncements(client);
  }, CHECK_INTERVAL);

  checkAnnouncements(client);
}

export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[SCHEDULER] Durduruldu.');
  }
}

function getBaseEmbed(announcement: any): EmbedBuilder {
  return new EmbedBuilder()
    .setDescription(announcement.description)
    .addFields(
      { name: 'Bitiş Süresi', value: `<t:${Math.floor(announcement.expiresAt / 1000)}:F>`, inline: true },
      { name: 'Kalan Süre', value: `<t:${Math.floor(announcement.expiresAt / 1000)}:R>`, inline: true },
      { name: 'Hedef Rol', value: `<@&${announcement.roleId}>`, inline: true }
    )
    .setFooter({ text: `ID: ${announcement.id}` })
    .setTimestamp();
}

function getButtons(announcement: any): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`seen_${announcement.id}`)
        .setEmoji('👁️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`list_${announcement.id}`)
        .setEmoji('📜')
        .setStyle(ButtonStyle.Secondary)
    );
}

async function editAnnouncementMessage(client: Client, announcement: any, embed: EmbedBuilder, keepButtons: boolean): Promise<void> {
  try {
    const channel = await client.channels.fetch(announcement.channelId);
    if (!channel || !(channel instanceof TextChannel)) return;

    const msg = await channel.messages.fetch(announcement.messageId);
    await msg.edit({
      embeds: [embed],
      components: keepButtons ? [getButtons(announcement)] : []
    });
  } catch { }
}

function getDelayNotice(threshold: number, elapsed: number): string {
  return elapsed > threshold + DELAY_THRESHOLD
    ? '\n\n⚠️ **Bot yeniden başlatıldığı için bu bildirim gecikmeli gönderilmiştir. Kusura bakmayın.**'
    : '';
}

function getPct(pct: number): number {
  return Math.round(pct * 100);
}

async function checkAnnouncements(client: Client): Promise<void> {
  const announcements = getAnnouncements();

  for (const ann of announcements) {
    const timeLeft = getTimeUntil(ann.expiresAt);
    const totalMs = ann.totalMs || 3600000;
    const elapsed = totalMs - timeLeft;
    const threshold50 = totalMs * 0.50;
    const threshold75 = totalMs * 0.75;

    // Expired
    if (timeLeft <= 0) {
      console.log(`[SCHEDULER] Duyuru süresi doldu: ${ann.id}`);

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle(`🚫 ${ann.title} - Süre Doldu!`)
        .setDescription(`${ann.description}\n\n⏳ **Bu duyurunun süresi dolmuştur.**`)
        .addFields(
          { name: 'Planlanan Bitiş', value: `<t:${Math.floor(ann.expiresAt / 1000)}:F>`, inline: true }
        )
        .setTimestamp();

      await editAnnouncementMessage(client, ann, embed, false);

      const channel = await client.channels.fetch(ann.channelId);
      if (channel && channel instanceof TextChannel) {
        await channel.send(`<@&${ann.roleId}> **${ann.title}** süresi doldu!`);
      }

      removeAnnouncement(ann.id);
      continue;
    }

    // %50 elapsed → edit embed + channel ping
    if (elapsed >= threshold50 && !ann.halfwayNotified) {
      const delay = getDelayNotice(threshold50, elapsed);
      console.log(`[SCHEDULER] %50 kanal bildirimi: ${ann.id}${delay ? ' (gecikmeli)' : ''}`);

      const embed = getBaseEmbed(ann)
        .setColor(0xFFA500)
        .setTitle(`⏰ ${ann.title} - %${getPct(0.50)}`)
        .setDescription(ann.description + delay)
        .spliceFields(2, 1, { name: 'Durum', value: `⚡ **%${getPct(0.50)} tamamlandı!**`, inline: true });

      await editAnnouncementMessage(client, ann, embed, true);

      const channel = await client.channels.fetch(ann.channelId);
      if (channel && channel instanceof TextChannel) {
        await channel.send(`<@&${ann.roleId}> **${ann.title}** süresinin yarısı doldu!`);
      }

      updateAnnouncement(ann.id, { halfwayNotified: true });
    }

    // %75 elapsed → DM notification
    if (elapsed >= threshold75 && !ann.finalDmNotified) {
      const delay = getDelayNotice(threshold75, elapsed);
      console.log(`[SCHEDULER] %75 DM bildirimi: ${ann.id}${delay ? ' (gecikmeli)' : ''}`);

      const embed = getBaseEmbed(ann)
        .setColor(0xE67E22)
        .setTitle(`🔔 ${ann.title} - %${getPct(0.75)}`)
        .setDescription(ann.description + delay)
        .spliceFields(2, 1, { name: 'Durum', value: `🔴 **%${getPct(0.75)} tamamlandı!**`, inline: true });

      await editAnnouncementMessage(client, ann, embed, true);
      await sendFinalDMs(client, ann, timeLeft, delay);

      updateAnnouncement(ann.id, { finalDmNotified: true });
    }
  }
}

async function sendFinalDMs(client: Client, announcement: any, timeLeft: number, delayNotice: string): Promise<void> {
  try {
    const guild = await client.guilds.fetch(announcement.guildId);
    if (!guild) return;

    await guild.members.fetch();
    const role = await guild.roles.fetch(announcement.roleId);
    if (!role) return;

    for (const [memberId, member] of role.members) {
      if (announcement.seenBy.includes(memberId)) {
        continue;
      }

      try {
        const isStreaming = member.presence?.activities?.some(
          activity => activity.type === ActivityType.Streaming
        );

        if (isStreaming) {
          const dmRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`ping_yes_${announcement.id}`)
                .setLabel('Evet, ping al')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`ping_no_${announcement.id}`)
                .setLabel('Hayır, ping alma')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger)
            );

          const dmEmbed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('📡 Yayında Olduğunuz İçin Ping Almadınız')
            .setDescription(
              `**${announcement.title}** duyurusu için süre bitiyor. Yayında olduğunuz için otomatik ping atılmadı.\n\nYine de ping almak ister misiniz?`
              + delayNotice
            )
            .addFields({ name: 'Duyuru', value: announcement.description })
            .setTimestamp();

          await member.send({ embeds: [dmEmbed], components: [dmRow] });
          continue;
        }

        const dmEmbed = new EmbedBuilder()
          .setColor(0xFF4444)
          .setTitle(`🚨 ${announcement.title} - Süre Bitiyor!`)
          .setDescription(announcement.description + delayNotice)
          .addFields(
            { name: 'Kalan Süre', value: formatDuration(timeLeft), inline: true },
            { name: 'Durum', value: '🔴 **%75 tamamlandı!**', inline: true }
          )
          .setTimestamp();

        await member.send({ embeds: [dmEmbed] });
      } catch { }
    }
  } catch (error) {
    console.error(`[SCHEDULER] DM toplu hatası (${announcement.id}):`, error);
  }
}