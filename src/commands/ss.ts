import type { ChatInputCommandInteraction, ModalSubmitInteraction } from 'discord.js';
import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder
} from 'discord.js';

const OWNER_ID = '1068171016603443202';

export const ssCommand = new SlashCommandBuilder()
  .setName('ss')
  .setDescription('Bot geliştiricisine istek/öneri gönderir');

export async function handleSsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('ssModal')
    .setTitle('İstek / Öneri Gönder');

  const descInput = new TextInputBuilder()
    .setCustomId('ssDesc')
    .setLabel('İstek / Öneri')
    .setPlaceholder('Bot için önerinizi veya isteğinizi yazın')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000);

  const descRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descInput);
  modal.addComponents(descRow);

  await interaction.showModal(modal);
}

export async function handleSsModal(interaction: ModalSubmitInteraction): Promise<void> {
  try {
    const desc = interaction.fields.getTextInputValue('ssDesc');

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('💡 İstek / Öneri')
      .setDescription(`**Gönderen:** ${interaction.user.tag} (\`${interaction.user.id}\`)`)
      .addFields({ name: '📝 Açıklama', value: desc })
      .setFooter({ text: `Kullanıcı ID: ${interaction.user.id}` })
      .setTimestamp();

    const owner = await interaction.client.users.fetch(OWNER_ID);
    await owner.send({ embeds: [embed] });

    await interaction.reply({
      content: '✅ İstek/öneriniz başarıyla iletildi! Teşekkürler.',
      ephemeral: true
    });

    console.log(`[SS] Gönderildi: ${interaction.user.tag} - ${desc.slice(0, 50)}...`);
  } catch (error) {
    console.error('[SS MODAL] Hata:', error);
    await interaction.reply({
      content: '❌ Gönderilirken bir hata oluştu.',
      ephemeral: true
    });
  }
}