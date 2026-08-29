import type { Interaction, GuildMember } from 'discord.js';
import { EmbedBuilder, TextChannel } from 'discord.js';
import { getAnnouncement, updateAnnouncement, removeAllowedRole } from '../utils/storage.ts';

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  // ───── Wizard: ChannelSelect ─────
  if (interaction.isChannelSelectMenu() && interaction.customId === 'wizard_channel') {
    const { handleWizardChannelSelect } = await import('../commands/time.ts');
    await handleWizardChannelSelect(interaction);
    return;
  }

  // ───── Wizard: RoleSelect ─────
  if (interaction.isRoleSelectMenu() && interaction.customId === 'wizard_role') {
    const { handleWizardRoleSelect } = await import('../commands/time.ts');
    await handleWizardRoleSelect(interaction);
    return;
  }

  // ───── Wizard: StringSelect ─────
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'wizard_duration') {
      const { handleWizardDurationSelect } = await import('../commands/time.ts');
      await handleWizardDurationSelect(interaction);
      return;
    }
    if (interaction.customId === 'wizard_edit') {
      const { handleWizardEditSelect } = await import('../commands/time.ts');
      await handleWizardEditSelect(interaction);
      return;
    }
    if (interaction.customId.startsWith('unadd_select_')) {
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
  }

  // ───── Wizard: Buttons ─────
  if (interaction.isButton()) {
    const customId = interaction.customId;

    if (customId === 'wizard_intro_next') {
      const { handleWizardIntroNext } = await import('../commands/time.ts');
      await handleWizardIntroNext(interaction);
      return;
    }
    if (customId === 'wizard_intro_dismiss') {
      const { handleWizardIntroDismiss } = await import('../commands/time.ts');
      await handleWizardIntroDismiss(interaction);
      return;
    }
    if (customId === 'wizard_cancel') {
      const { handleWizardCancel } = await import('../commands/time.ts');
      await handleWizardCancel(interaction);
      return;
    }
    if (customId === 'wizard_back') {
      const { handleWizardBack } = await import('../commands/time.ts');
      await handleWizardBack(interaction);
      return;
    }
    if (customId === 'wizard_duration_custom') {
      const { handleWizardDurationCustomButton } = await import('../commands/time.ts');
      await handleWizardDurationCustomButton(interaction);
      return;
    }
    if (customId === 'wizard_content_open') {
      const { handleWizardContentOpen } = await import('../commands/time.ts');
      await handleWizardContentOpen(interaction);
      return;
    }
    if (customId === 'wizard_next_preview') {
      const { handleWizardNextPreview } = await import('../commands/time.ts');
      await handleWizardNextPreview(interaction);
      return;
    }
    if (customId === 'wizard_confirm') {
      const { handleWizardConfirm } = await import('../commands/time.ts');
      await handleWizardConfirm(interaction);
      return;
    }

    // Seen button — dinamik sayaç: 📜 n
    if (customId.startsWith('seen_')) {
      const annId = customId.slice(5);
      const announcement = getAnnouncement(annId);
      if (!announcement) {
        await interaction.reply({ content: '❌ Bu duyuru bulunamadı veya süresi doldu.', flags: 64 });
        return;
      }
      if (announcement.seenBy.includes(interaction.user.id)) {
        await interaction.reply({ content: '👁️ Bu duyuruyu zaten gördünüz.', flags: 64 });
        return;
      }
      const newSeen = [...announcement.seenBy, interaction.user.id];
      updateAnnouncement(annId, { seenBy: newSeen });
      // Orijinal duyuru mesajındaki buton sayacını güncelle
      try {
        const updated = getAnnouncement(annId);
        const { buildAnnouncementButtons } = await import('../utils/announcementEmbed.ts');
        if (updated) {
          const channel = await interaction.client.channels.fetch(updated.channelId);
          if (channel && channel instanceof TextChannel) {
            const msg = await channel.messages.fetch(updated.messageId);
            await msg.edit({ components: [buildAnnouncementButtons(annId, updated.seenBy.length)] });
          }
        }
      } catch {}
      await interaction.reply({ content: '✅ Duyuru görüldü olarak işaretlendi! Sürenin %75\'inde DM atılmayacak.', flags: 64 });
      console.log(`[BUTTON] Görüldü: ${interaction.user.tag} - ${annId}`);
      return;
    }

    // List button
    if (customId.startsWith('list_')) {
      const annId = customId.slice(5);
      const announcement = getAnnouncement(annId);
      if (!announcement) {
        await interaction.reply({ content: '❌ Duyuru bulunamadı.', flags: 64 });
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
        .setDescription(seenMembers.length > 0 ? seenMembers.join('\n') : 'Henüz kimse görmedi.')
        .setFooter({ text: `Toplam: ${total} kişi` })
        .setTimestamp();
      await interaction.reply({ embeds: [embed], flags: 64 });
      console.log(`[BUTTON] Liste sorgulandı: ${interaction.user.tag} - ${annId}`);
      return;
    }

    // Streaming DM ping response - Yes
    if (customId.startsWith('ping_yes_')) {
      const annId = customId.slice(9);
      const announcement = getAnnouncement(annId);
      if (!announcement) {
        await interaction.reply({ content: '❌ Bu duyuru bulunamadı.', flags: 64 });
        return;
      }
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
      const newSeenPing = [...announcement.seenBy, interaction.user.id];
      updateAnnouncement(annId, { seenBy: newSeenPing });
      try {
        const { buildAnnouncementButtons } = await import('../utils/announcementEmbed.ts');
        const upd = getAnnouncement(annId);
        if (upd) {
          const ch = await interaction.client.channels.fetch(upd.channelId);
          if (ch && ch instanceof TextChannel) {
            const m = await ch.messages.fetch(upd.messageId);
            await m.edit({ components: [buildAnnouncementButtons(annId, upd.seenBy.length)] });
          }
        }
      } catch {}
      await interaction.reply({ content: '✅ Duyuru DM olarak gönderildi!', flags: 64 });
      console.log(`[BUTTON] Yayıncı ping kabul: ${interaction.user.tag} - ${annId}`);
      return;
    }

    // Streaming DM ping response - No
    if (customId.startsWith('ping_no_')) {
      await interaction.reply({ content: '✅ Ping almayı reddettiniz. Yayınınızda başarılar!', flags: 64 });
      console.log(`[BUTTON] Yayıncı ping red: ${interaction.user.tag}`);
      return;
    }
  }
}
