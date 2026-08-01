import type { Interaction, GuildMember } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { getAnnouncement, updateAnnouncement, removeAllowedRole } from '../utils/storage.ts';

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  // Unadd select menu
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('unadd_select_')) {
    const roleId = interaction.values[0];
    const guildId = interaction.guildId!;
    const role = interaction.guild?.roles.cache.get(roleId);

    removeAllowedRole(guildId, roleId);

    const roleName = role ? role.name : `\`${roleId}\``;
    await interaction.update({
      content: `✅ **${roleName}** rolünün yetkisi kaldırıldı!`,
      components: [],
    });

    console.log(`[UNADD] Rol yetkisi kaldırıldı: ${roleName} (${roleId}) - ${interaction.user.tag}`);
    return;
  }

  if (!interaction.isButton()) return;

  const customId = interaction.customId;
  const member = interaction.member as GuildMember;

  // Seen button
  if (customId.startsWith('seen_')) {
    const annId = customId.slice(5);
    const announcement = getAnnouncement(annId);

    if (!announcement) {
      await interaction.reply({ content: '❌ Bu duyuru bulunamadı veya süresi doldu.', ephemeral: true });
      return;
    }

    if (announcement.seenBy.includes(interaction.user.id)) {
      await interaction.reply({ content: '👁️ Bu duyuruyu zaten gördünüz.', ephemeral: true });
      return;
    }

    updateAnnouncement(annId, {
      seenBy: [...announcement.seenBy, interaction.user.id]
    });

    await interaction.reply({
      content: '✅ Duyuru görüldü olarak işaretlendi! Sürenin %75\'inde DM atılmayacak.',
      ephemeral: true
    });

    console.log(`[BUTTON] Görüldü: ${interaction.user.tag} - ${annId}`);
    return;
  }

  // List button
  if (customId.startsWith('list_')) {
    const annId = customId.slice(5);
    const announcement = getAnnouncement(annId);

    if (!announcement) {
      await interaction.reply({ content: '❌ Duyuru bulunamadı.', ephemeral: true });
      return;
    }

    const guild = interaction.guild;
    if (!guild) return;

    const seenMembers: string[] = [];

    for (const userId of announcement.seenBy) {
      try {
        const member = await guild.members.fetch(userId);
        seenMembers.push(`• ${member.user.tag} (${member.user.id})`);
      } catch {
        seenMembers.push(`• Bilinmeyen Kullanıcı (${userId})`);
      }
    }

    const total = announcement.seenBy.length;

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle(`📜 ${announcement.title} - Görenler`)
      .setDescription(seenMembers.length > 0
        ? seenMembers.join('\n')
        : 'Henüz kimse görmedi.')
      .setFooter({ text: `Toplam: ${total} kişi` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    console.log(`[BUTTON] Liste sorgulandı: ${interaction.user.tag} - ${annId}`);
    return;
  }

  // Streaming DM ping response - Yes (send actual announcement DM)
  if (customId.startsWith('ping_yes_')) {
    const annId = customId.slice(9);
    const announcement = getAnnouncement(annId);

    if (!announcement) {
      await interaction.reply({ content: '❌ Bu duyuru bulunamadı.', ephemeral: true });
      return;
    }

    // Send the actual announcement DM
    try {
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`📢 ${announcement.title}`)
        .setDescription(announcement.description)
        .addFields(
          { name: 'Bitiş Süresi', value: `<t:${Math.floor(announcement.expiresAt / 1000)}:F>`, inline: true },
          { name: 'Kalan Süre', value: `<t:${Math.floor(announcement.expiresAt / 1000)}:R>`, inline: true }
        )
        .setTimestamp();

      await interaction.user.send({ embeds: [embed] });
    } catch {}
    
    // Mark as seen so they don't get another DM
    updateAnnouncement(annId, {
      seenBy: [...announcement.seenBy, interaction.user.id]
    });

    await interaction.reply({
      content: '✅ Duyuru DM olarak gönderildi!',
      ephemeral: true
    });

    console.log(`[BUTTON] Yayıncı ping kabul: ${interaction.user.tag} - ${annId}`);
    return;
  }

  // Streaming DM ping response - No
  if (customId.startsWith('ping_no_')) {
    const annId = customId.slice(8);
    const announcement = getAnnouncement(annId);

    await interaction.reply({
      content: '✅ Ping almayı reddettiniz. Yayınınızda başarılar!',
      ephemeral: true
    });

    console.log(`[BUTTON] Yayıncı ping red: ${interaction.user.tag} - ${annId}`);
    return;
  }
}