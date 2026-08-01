import type { CommandInteraction, ChatInputCommandInteraction, ModalSubmitInteraction } from 'discord.js';
import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import { parseTimeInput } from '../utils/timeParser.ts';
import { getGuildSettings, addAnnouncement, getAnnouncement, removeAnnouncement } from '../utils/storage.ts';

export const timeCommand = new SlashCommandBuilder()
  .setName('time')
  .setDescription('Zaman bazlı duyuru oluşturma arayüzünü açar')
  .setDefaultMemberPermissions(0x0000000000000008);

export const addCommand = new SlashCommandBuilder()
  .setName('add')
  .setDescription('Zaman duyurusu kullanabilecek rol ekler')
  .addRoleOption(option =>
    option
      .setName('rol')
      .setDescription('Eklenecek rol')
      .setRequired(true)
  );

export const timestopCommand = new SlashCommandBuilder()
  .setName('timestop')
  .setDescription('Devam eden bir duyuruyu iptal eder')
  .addStringOption(option =>
    option
      .setName('id')
      .setDescription('Duyuru ID\'si (duyuru mesajının footer\'ında yazar)')
      .setRequired(true)
      .setMaxLength(50)
  )
  .setDefaultMemberPermissions(0x0000000000000008);

export async function handleTimeCommand(interaction: CommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const member = interaction.member! as any;
  const settings = getGuildSettings(guildId);

  const memberRoles = member.roles?.cache;
  const hasPermission = settings?.allowedRoles?.some((roleId: string) => memberRoles?.has(roleId))
    || member.permissions?.has(0x0000000000000008n);

  if (!hasPermission) {
    await interaction.reply({
      content: '❌ Bu komutu kullanma yetkiniz yok.',
      ephemeral: true
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('timeModal')
    .setTitle('Zamanlı Duyuru Oluştur');

  const titleInput = new TextInputBuilder()
    .setCustomId('timeTitle')
    .setLabel('Başlık')
    .setPlaceholder('Duyuru başlığını giriniz')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const descInput = new TextInputBuilder()
    .setCustomId('timeDesc')
    .setLabel('Açıklama')
    .setPlaceholder('Duyuru açıklamasını giriniz')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);

  const timeInput = new TextInputBuilder()
    .setCustomId('timeDuration')
    .setLabel('Zaman (Örn: 1h 30m veya 2024-12-31 23:59)')
    .setPlaceholder('1h 30m / 2d / 2024-12-31 23:59')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(30);

  const channelInput = new TextInputBuilder()
    .setCustomId('timeChannel')
    .setLabel('Kanal ID veya #kanal-ismi')
    .setPlaceholder('Kanal ID veya #kanal-ismi giriniz')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const roleInput = new TextInputBuilder()
    .setCustomId('timeRole')
    .setLabel('Rol ID veya @rol-ismi')
    .setPlaceholder('Rol ID veya @rol-ismi giriniz')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const titleRow = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
  const descRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descInput);
  const timeRow = new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput);
  const channelRow = new ActionRowBuilder<TextInputBuilder>().addComponents(channelInput);
  const roleRow = new ActionRowBuilder<TextInputBuilder>().addComponents(roleInput);

  modal.addComponents(titleRow, descRow, timeRow, channelRow, roleRow);

  await interaction.showModal(modal);
  console.log(`[TIME] Modal açıldı: ${interaction.user.tag}`);
}

export async function handleTimeModal(interaction: ModalSubmitInteraction): Promise<void> {
  try {
    const title = interaction.fields.getTextInputValue('timeTitle');
    const description = interaction.fields.getTextInputValue('timeDesc');
    const timeStr = interaction.fields.getTextInputValue('timeDuration');
    const channelStr = interaction.fields.getTextInputValue('timeChannel');
    const roleStr = interaction.fields.getTextInputValue('timeRole');

    const parsed = parseTimeInput(timeStr);

    let channelId = channelStr.trim();
    if (channelId.startsWith('<#')) {
      channelId = channelId.slice(2, -1);
    }

    let channel = await interaction.guild?.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) {
      const byName = interaction.guild?.channels.cache.find(
        ch => ch.type === ChannelType.GuildText && (ch.name === channelId || `#${ch.name}` === channelId)
      );
      if (byName) {
        channel = byName;
      } else {
        await interaction.reply({ content: `❌ Kanal bulunamadı: \`${channelStr}\`.`, ephemeral: true });
        return;
      }
    }

    let roleId = roleStr.trim();
    if (roleId.startsWith('<@&')) {
      roleId = roleId.slice(3, -1);
    }

    let role = await interaction.guild?.roles.fetch(roleId).catch(() => null);
    if (!role) {
      const byName = interaction.guild?.roles.cache.find(
        r => r.name === roleId || r.name === roleId.replace(/^@/, '')
      );
      if (byName) {
        role = byName;
      } else {
        await interaction.reply({ content: `❌ Rol bulunamadı: \`${roleStr}\`.`, ephemeral: true });
        return;
      }
    }

    const annId = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`📢 ${title}`)
      .setDescription(description)
      .addFields(
        { name: 'Bitiş Süresi', value: `<t:${Math.floor(parsed.expiresAt / 1000)}:F>`, inline: true },
        { name: 'Kalan Süre', value: `<t:${Math.floor(parsed.expiresAt / 1000)}:R>`, inline: true },
        { name: 'Hedef Rol', value: `<@&${role.id}>`, inline: true }
      )
      .setFooter({ text: `ID: ${annId}` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`seen_${annId}`)
          .setEmoji('👁️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`list_${annId}`)
          .setEmoji('📜')
          .setStyle(ButtonStyle.Secondary)
      );

    const textChannel = channel as TextChannel;
    const msg = await textChannel.send({
      content: `<@&${role.id}> **${title}** - Yeni duyuru!`,
      embeds: [embed],
      components: [row]
    });

    addAnnouncement({
      id: annId,
      guildId: interaction.guildId!,
      channelId: channel.id,
      messageId: msg.id,
      roleId: role.id,
      title,
      description,
      createdAt: Date.now(),
      expiresAt: parsed.expiresAt,
      totalMs: parsed.totalMs,
      seenBy: [],
      halfwayNotified: false,
      finalDmNotified: false
    });

    await interaction.reply({
      content: `✅ Duyuru oluşturuldu!\n**Kanal:** ${channel}\n**Rol:** ${role}\n**Bitiş:** <t:${Math.floor(parsed.expiresAt / 1000)}:F>`,
      ephemeral: true
    });

    console.log(`[TIME] Duyuru oluşturuldu: ${annId}`);
  } catch (error: any) {
    console.error('[TIME MODAL] Hata:', error);
    await interaction.reply({
      content: `❌ Hata: ${error.message || 'Bilinmeyen hata'}`,
      ephemeral: true
    });
  }
}

export async function handleTimestopCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const id = interaction.options.getString('id', true);
  if (!id) {
    await interaction.reply({ content: '❌ Geçerli bir ID girin.', ephemeral: true });
    return;
  }

  const announcement = getAnnouncement(id);
  if (!announcement) {
    await interaction.reply({ content: `❌ \`${id}\` ID\'li duyuru bulunamadı.`, ephemeral: true });
    return;
  }

  try {
    const channel = await interaction.client.channels.fetch(announcement.channelId);
    if (channel && channel instanceof TextChannel) {
      try {
        const msg = await channel.messages.fetch(announcement.messageId);
        const cancelEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle(`🚫 ${announcement.title} - İptal Edildi`)
          .setDescription(`Bu duyuru **${interaction.user.tag}** tarafından iptal edildi.`)
          .addFields(
            { name: 'Orijinal Açıklama', value: announcement.description },
            { name: 'Planlanan Bitiş', value: `<t:${Math.floor(announcement.expiresAt / 1000)}:F>` }
          )
          .setTimestamp();

      await msg.edit({ embeds: [cancelEmbed], components: [] });
      } catch {}
    }
  } catch {}

  removeAnnouncement(id);
  await interaction.reply({
    content: `✅ **${announcement.title}** duyurusu iptal edildi.`,
    ephemeral: true
  });

  console.log(`[TIMESTOP] Duyuru iptal: ${id} - ${interaction.user.tag}`);
}

export const unaddCommand = new SlashCommandBuilder()
  .setName('unadd')
  .setDescription('Özel rol yetkisini kaldırır')
  .setDefaultMemberPermissions(0x0000000000000008);

export async function handleUnaddCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const settings = getGuildSettings(guildId);

  if (!settings || settings.allowedRoles.length === 0) {
    await interaction.reply({
      content: 'ℹ️ Henüz hiç özel rol eklenmemiş.',
      ephemeral: true
    });
    return;
  }

  const options: StringSelectMenuOptionBuilder[] = [];

  for (const roleId of settings.allowedRoles) {
    const role = interaction.guild?.roles.cache.get(roleId);
    if (role) {
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(role.name)
          .setValue(roleId)
          .setDescription(`ID: ${roleId}`)
      );
    } else {
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(`Bilinmeyen Rol (${roleId.slice(0, 8)}...)`)
          .setValue(roleId)
          .setDescription(`Rol silinmiş olabilir. ID: ${roleId}`)
      );
    }
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`unadd_select_${guildId}`)
    .setPlaceholder('Kaldırılacak rolü seçin')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    content: '📋 Aşağıdan yetkisini kaldırmak istediğiniz rolü seçin:',
    components: [row],
    ephemeral: true
  });
}