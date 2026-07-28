import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  EmbedBuilder
} from 'discord.js';
import { checkCooldown, setCooldown } from '../utils/storage.js';

const OWNER_ID = '1068171016603443202';
const REPORT_COOLDOWN = 15 * 60 * 1000;

export const reportCommand = new SlashCommandBuilder()
  .setName('report')
  .setDescription('Bot geliştiricisine hata bildirimi gönderir');

export async function handleReportCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const cooldown = checkCooldown(interaction.user.id);
  if (cooldown.onCooldown) {
    const mins = Math.ceil(cooldown.remainingMs / 60000);
    await interaction.reply({
      content: `⏳ Bir sonraki reportu **${mins} dakika** sonra gönderebilirsiniz.`,
      ephemeral: true
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('reportModal')
    .setTitle('Hata Reportu Gönder');

  const descInput = new TextInputBuilder()
    .setCustomId('reportDesc')
    .setLabel('Açıklama (zorunlu)')
    .setPlaceholder('Karşılaştığınız hatayı detaylıca açıklayın')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000);

  const progressInput = new TextInputBuilder()
    .setCustomId('reportProgress')
    .setLabel('İlerleme / Beklediğiniz Davranış')
    .setPlaceholder('Normalde ne olması gerekirdi? (opsiyonel)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(2000);

  const imageInput = new TextInputBuilder()
    .setCustomId('reportImage')
    .setLabel('Görsel URL (opsiyonel)')
    .setPlaceholder('Ekran görüntüsü linki (varsa)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(500);

  const descRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descInput);
  const progressRow = new ActionRowBuilder<TextInputBuilder>().addComponents(progressInput);
  const imageRow = new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput);

  modal.addComponents(descRow, progressRow, imageRow);

  await interaction.showModal(modal);
}

export async function handleReportModal(interaction: ModalSubmitInteraction): Promise<void> {
  try {
    const desc = interaction.fields.getTextInputValue('reportDesc');
    const progress = interaction.fields.getTextInputValue('reportProgress') || '*Belirtilmemiş*';
    const imageUrl = interaction.fields.getTextInputValue('reportImage') || '';

    setCooldown(interaction.user.id, REPORT_COOLDOWN);

    const embed = new EmbedBuilder()
      .setColor(0xFF4444)
      .setTitle('🐛 Hata Reportu')
      .setDescription(`**Gönderen:** ${interaction.user.tag} (\`${interaction.user.id}\`)`)
      .addFields(
        { name: '📝 Açıklama', value: desc },
        { name: '🔍 Beklenen Davranış', value: progress }
      )
      .setFooter({ text: `Kullanıcı ID: ${interaction.user.id}` })
      .setTimestamp();

    if (imageUrl) {
      embed.setImage(imageUrl);
    }

    const owner = await interaction.client.users.fetch(OWNER_ID);
    await owner.send({ embeds: [embed] });

    await interaction.reply({
      content: '✅ Report başarıyla gönderildi! En kısa sürede incelenecektir.',
      ephemeral: true
    });

    console.log(`[REPORT] Gönderildi: ${interaction.user.tag} - ${desc.slice(0, 50)}...`);
  } catch (error) {
    console.error('[REPORT MODAL] Hata:', error);
    await interaction.reply({
      content: '❌ Report gönderilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
      ephemeral: true
    });
  }
}