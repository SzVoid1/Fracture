import type { ChatInputCommandInteraction } from 'discord.js';
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits
} from 'discord.js';
import {
  fetchKickChannel,
  getKickModeLabel,
  isValidKickSlug,
  normalizeKickSlug,
  KickAuthError,
  KickNetworkError,
  KickNotFoundError,
  KickRateLimitError
} from '../utils/kickApi.ts';
import { getGuildSettings, updateKickSettings, clearKickSettings } from '../utils/storage.ts';
import type { KickPingType } from '../utils/storage.ts';
import { getKickState, clearKickState } from '../utils/kickState.ts';
import { runKickCheckForGuild } from '../utils/kickMonitor.ts';
import { describeKickAssets } from '../utils/kickImages.ts';
import {
  DEFAULT_LIVE_MESSAGE,
  DEFAULT_ENDED_MESSAGE,
  COMMON_PLACEHOLDERS,
  ENDED_PLACEHOLDERS,
  MAX_MESSAGE_LENGTH,
  renderKickDescription
} from '../utils/kickText.ts';

const ADMIN_PERMISSIONS = PermissionFlagsBits.Administrator;

export const kickCommand = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick kanalını izler ve Discord\'a duyuru atar')
  .setDefaultMemberPermissions(ADMIN_PERMISSIONS)
  .addSubcommand(sub => sub
    .setName('slug')
    .setDescription('İzlenecek Kick kanalını ayarlar')
    .addStringOption(option => option
      .setName('kanal')
      .setDescription('Kick kanal adresi veya slug (örn: xqc / https://kick.com/xqc)')
      .setRequired(true)
      .setMaxLength(60))
  )
  .addSubcommand(sub => sub
    .setName('kanal')
    .setDescription('Duyurunun atılacağı Discord kanalını ayarlar')
    .addChannelOption(option => option
      .setName('duyuru')
      .setDescription('Duyuru mesajlarının gönderileceği kanal')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
  )
  .addSubcommand(sub => sub
    .setName('ping')
    .setDescription('Duyuru atarken kim ping olsun')
    .addStringOption(option => option
      .setName('mod')
      .setDescription('Ping modu')
      .setRequired(true)
      .addChoices(
        { name: '👥 Rol ping', value: 'rol' },
        { name: '📢 Herkes (@everyone)', value: 'herkes' },
        { name: '🔇 Ping yok', value: 'kaldir' }
      ))
    .addRoleOption(option => option
      .setName('rol')
      .setDescription('Ping modu "rol" ise hangi rol ping olsun')
      .setRequired(false))
  )
  .addSubcommand(sub => sub
    .setName('mesaj')
    .setDescription('Duyurunun altındaki ek mesajı özelleştirir (başlık her zaman üstte kalır)')
    .addStringOption(option => option
      .setName('tur')
      .setDescription('Hangi mesaj')
      .setRequired(true)
      .addChoices(
        { name: '🔴 Yayın başlarken', value: 'canli' },
        { name: '⚫ Yayın bitince', value: 'bitti' }
      ))
    .addStringOption(option => option
      .setName('icerik')
      .setDescription('Ek mesaj. Boş bırakılırsa varsayılana döner. "b" = başlık.')
      .setRequired(false)
      .setMaxLength(MAX_MESSAGE_LENGTH))
  )
  .addSubcommand(sub => sub
    .setName('test')
    .setDescription('Şu anki durumu kontrol eder ve yayındaysa duyuruyu gönderir'))
  .addSubcommand(sub => sub
    .setName('durum')
    .setDescription('Kick ayarlarını ve son durumu gösterir'))
  .addSubcommand(sub => sub
    .setName('kaldir')
    .setDescription('Tüm Kick ayarlarını siler'));

function requireGuildId(interaction: ChatInputCommandInteraction): string {
  return interaction.guildId!;
}

async function handleSlug(interaction: ChatInputCommandInteraction): Promise<void> {
  const input = interaction.options.getString('kanal', true);
  const slug = normalizeKickSlug(input);

  if (!isValidKickSlug(slug)) {
    await interaction.reply({
      content: '❌ Geçersiz Kick kanal adı. Örnek: `xqc` veya `https://kick.com/xqc`',
      flags: 64
    });
    return;
  }

  let title = '';
  let isLive = false;
  try {
    const info = await fetchKickChannel(slug);
    title = info.title;
    isLive = info.isLive;
  } catch (error) {
    const message = error instanceof KickNotFoundError
      ? '❌ Bu Kick kanalı bulunamadı. Slug\'ı kontrol et.'
      : error instanceof KickAuthError
        ? '❌ Kick API kimlik doğrulaması başarısız. `.env` içindeki `KICK_CLIENT_ID` / `KICK_CLIENT_SECRET` değerlerini kontrol et.'
        : error instanceof KickRateLimitError
          ? '❌ Kick API rate limit yedi, biraz sonra tekrar dene.'
          : '❌ Kick API\'ye ulaşılamadı, biraz sonra tekrar dene.';
    await interaction.reply({ content: message, flags: 64 });
    return;
  }

  updateKickSettings(requireGuildId(interaction), { kickSlug: slug });

  const status = isLive ? '🟢 şu an YAYINDA' : '⚪ şu an yayında değil';
  await interaction.reply({
    content: `✅ Kick kanalı **${slug}** olarak ayarlandı (${status}).\n${title ? `Başlık: *${title}*\n` : ''}Şimdi duyuru kanalını ayarla: \`/kick kanal\`\nAPI modu: ${getKickModeLabel()}`,
    flags: 64
  });
  console.log(`[KICK] Slug ayarlandi: ${slug} (${interaction.user.tag})`);
}

async function handleChannel(interaction: ChatInputCommandInteraction): Promise<void> {
  const option = interaction.options.getChannel('duyuru', true);
  const guildId = requireGuildId(interaction);

  const channel = await interaction.guild!.channels.fetch(option.id).catch(() => null);
  if (!channel) {
    await interaction.reply({ content: '❌ Kanal bulunamadı.', flags: 64 });
    return;
  }
  if (!channel.isSendable()) {
    await interaction.reply({ content: '❌ Bu kanal türüne duyuru gönderilemez. Metin kanalı seç.', flags: 64 });
    return;
  }

  const perms = interaction.guild!.members.me
    ? channel.permissionsFor(interaction.guild!.members.me)
    : null;
  if (perms && !perms.has(['ViewChannel', 'SendMessages'])) {
    await interaction.reply({
      content: '❌ Bu kanala duyuru gönderemiyorum. Bana `Kanalı Görüntüle` ve `Mesaj Gönder` yetkisi ver.',
      flags: 64
    });
    return;
  }

  updateKickSettings(guildId, { kickChannelId: channel.id });

  const settings = getGuildSettings(guildId);
  const next = settings?.kickSlug
    ? '✅ Duyuru kanalı ayarlandı. Her şey hazır!'
    : '✅ Duyuru kanalı ayarlandı. Şimdi Kick kanalını ayarla: `/kick slug`';

  await interaction.reply({ content: `${next}\nDuyuru kanalı: <#${channel.id}>`, flags: 64 });
  console.log(`[KICK] Duyuru kanali ayarlandi: ${channel.id} (${interaction.user.tag})`);
}

async function handlePing(interaction: ChatInputCommandInteraction): Promise<void> {
  const mod = interaction.options.getString('mod', true);
  const role = interaction.options.getRole('rol');
  const guildId = requireGuildId(interaction);

  if (mod === 'rol' && !role) {
    await interaction.reply({ content: '❌ Ping modu "rol" iken bir rol seçmelisin.', flags: 64 });
    return;
  }

  if (mod === 'herkes') {
    const me = interaction.guild?.members.me;
    if (me && !me.permissions.has(PermissionFlagsBits.MentionEveryone)) {
      await interaction.reply({ content: '❌ @everyone ping için bana `Herkesi Bahset` yetkisi ver.', flags: 64 });
      return;
    }
  }

  const pingType = (mod === 'rol' ? 'role' : mod === 'herkes' ? 'everyone' : 'none') as KickPingType;
  updateKickSettings(guildId, {
    kickPingType: pingType,
    kickPingRoleId: pingType === 'role' ? role!.id : null
  });

  const message = pingType === 'role'
    ? `✅ Duyuru atarken ${role} ping'lenecek.`
    : pingType === 'everyone'
      ? '✅ Duyuru atarken @everyone ping\'lenecek. Dikkatli kullan!'
      : '✅ Ping kaldırıldı, duyuru embed olarak gönderilecek.';

  await interaction.reply({ content: message, flags: 64 });
  console.log(`[KICK] Ping modu: ${pingType} (${interaction.user.tag})`);
}

async function handleMessage(interaction: ChatInputCommandInteraction): Promise<void> {
  const tur = interaction.options.getString('tur', true);
  const content = interaction.options.getString('icerik');
  const guildId = requireGuildId(interaction);

  const isLive = tur === 'canli';
  const label = isLive ? 'Yayın başlangıç' : 'Yayın bitiş';
  const field = isLive ? 'kickLiveText' : 'kickEndedText';

  // null = alanı sil → varsayılan metne dön
  updateKickSettings(guildId, { [field]: content?.trim() ? content : null });
  const def = isLive ? DEFAULT_LIVE_MESSAGE : DEFAULT_ENDED_MESSAGE;

  if (!content || !content.trim()) {
    await interaction.reply({
      content: `✅ ${label} ek mesajı **varsayılana döndürüldü**:\n\`\`\`\n${def}\n\`\`\``,
      flags: 64
    });
    return;
  }

  const placeholders = isLive ? COMMON_PLACEHOLDERS : ENDED_PLACEHOLDERS;

  await interaction.reply({
    content:
      `✅ Ek mesaj kaydedildi. Yayın başlığı her zaman mesajın en üstünde görünecek.\n` +
      `**Placeholder'lar:** ${placeholders.join(' ')}\n` +
      `**Önizleme:**\n\`\`\`\n${renderKickDescription(content, { title: 'Örnek Başlık', slug: 'xqc' }, !isLive)}\n\`\`\``,
    flags: 64
  });
  console.log(`[KICK] Ek mesaj guncellendi: ${tur} (${interaction.user.tag})`);
}

async function handleTest(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = requireGuildId(interaction);
  const settings = getGuildSettings(guildId);

  if (!settings?.kickSlug) {
    await interaction.reply({ content: '❌ Kick kanalı ayarlanmamış. Önce `/kick slug` kullan.', flags: 64 });
    return;
  }
  if (!settings.kickChannelId) {
    await interaction.reply({ content: '❌ Duyuru kanalı ayarlanmamış. Önce `/kick kanal` kullan.', flags: 64 });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  const hadState = Boolean(getKickState(guildId));
  try {
    await runKickCheckForGuild(interaction.client, settings);
  } catch (error) {
    await interaction.editReply({ content: `❌ Kontrol sırasında hata: ${error instanceof Error ? error.message : String(error)}` });
    return;
  }

  if (hadState) {
    await interaction.editReply({
      content: '✅ Kontrol tamamlandı. Zaten kayıtlı bir duyuru varsa güncellendi, yoksa duyuru atıldı. Detay için duyuru kanalına bak.'
    });
  } else {
    await interaction.editReply({
      content: '✅ Kontrol tamamlandı. Kanal yayında değilse mesaj gönderilmedi (yayın başlayınca otomatik atılacak).'
    });
  }
}

async function handleDurum(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = requireGuildId(interaction);
  const settings = getGuildSettings(guildId);
  const state = getKickState(guildId);

  let kickChannelName = '—';
  if (settings?.kickChannelId) {
    const channel = await interaction.guild?.channels.fetch(settings.kickChannelId).catch(() => null);
    kickChannelName = channel ? `<#${channel.id}>` : `\`${settings.kickChannelId}\` (bulunamadı)`;
  }

  let pingText = '🔇 Ping yok';
  if (settings?.kickPingType === 'everyone') pingText = '📢 @everyone';
  else if (settings?.kickPingType === 'role' && settings.kickPingRoleId) pingText = `👥 <@&${settings.kickPingRoleId}>`;

  let liveText = '⚪ Yayında değil';
  if (settings?.kickSlug) {
    try {
      const info = await fetchKickChannel(settings.kickSlug);
      liveText = info.isLive
        ? `🟢 Yayında — ${info.title || 'başlıksız'}`
        : '⚪ Yayında değil';
    } catch {
      liveText = '❓ Durum alınamadı';
    }
  } else {
    liveText = '⚙️ Kick kanalı ayarlanmamış';
  }

  const embed = new EmbedBuilder()
    .setColor(0x53E611)
    .setTitle('⚙️ Kick Duyuru Durumu')
    .addFields(
      { name: 'Kick Kanalı', value: settings?.kickSlug ? `\`${settings.kickSlug}\`` : '—', inline: true },
      { name: 'Duyuru Kanalı', value: kickChannelName, inline: true },
      { name: 'Ping', value: pingText, inline: true },
      { name: 'Durum', value: liveText, inline: false },
{
        name: 'Ek Mesajlar',
        value: `Başlangıç: ${settings?.kickLiveText ? '✏️ özelleştirilmiş' : 'varsayılan'}\nBitiş: ${settings?.kickEndedText ? '✏️ özelleştirilmiş' : 'varsayılan'}`,
        inline: false
      },
      {
        name: '🖼️ Özel Görseller',
        value: describeKickAssets(),
        inline: false
      }
    )
    .setFooter({ text: `Fracture • Kick API: ${getKickModeLabel()}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], flags: 64 });
}

async function handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = requireGuildId(interaction);
  const settings = getGuildSettings(guildId);

  if (!settings?.kickSlug && !settings?.kickChannelId) {
    await interaction.reply({ content: 'ℹ️ Zaten kayıtlı Kick ayarı yok.', flags: 64 });
    return;
  }

  clearKickSettings(guildId);
  clearKickState(guildId);

  await interaction.reply({ content: '🗑️ Tüm Kick ayarları ve yayın kaydı silindi.', flags: 64 });
  console.log(`[KICK] Ayarlar silindi: ${guildId} (${interaction.user.tag})`);
}

export async function handleKickCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({ content: '❌ Bu komut sadece sunucularda kullanılabilir.', flags: 64 });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ Bu komutu kullanma yetkiniz yok.', flags: 64 });
    return;
  }

  switch (interaction.options.getSubcommand()) {
    case 'slug':
      await handleSlug(interaction);
      break;
    case 'kanal':
      await handleChannel(interaction);
      break;
    case 'ping':
      await handlePing(interaction);
      break;
    case 'mesaj':
      await handleMessage(interaction);
      break;
    case 'test':
      await handleTest(interaction);
      break;
    case 'durum':
      await handleDurum(interaction);
      break;
    case 'kaldir':
      await handleRemove(interaction);
      break;
  }
}
