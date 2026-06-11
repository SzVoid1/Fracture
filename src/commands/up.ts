import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  version as djsVersion
} from 'discord.js';

let startTime = Date.now();

export function setStartTime(): void {
  startTime = Date.now();
}

export const upCommand = new SlashCommandBuilder()
  .setName('up')
  .setDescription('Botun çalışma süresi ve gecikme bilgisini gösterir');

export async function handleUpCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const now = Date.now();
  const uptimeMs = now - startTime;
  const apiLatency = Math.round(interaction.client.ws.ping);
  const botLatency = Date.now() - interaction.createdTimestamp;

  const days = Math.floor(uptimeMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((uptimeMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((uptimeMs % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((uptimeMs % (60 * 1000)) / 1000);

  const uptimeStr = `${days}g ${hours}s ${minutes}dk ${seconds}sn`;

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('🤖 Bot Durumu')
    .addFields(
      { name: '📈 Çalışma Süresi', value: uptimeStr, inline: true },
      { name: '📡 API Gecikmesi', value: `${apiLatency}ms`, inline: true },
      { name: '🔄 Bot Gecikmesi', value: `${botLatency}ms`, inline: true },
      { name: '📦 Discord.js', value: `v${djsVersion}`, inline: true },
      { name: '⚡ Node.js', value: process.version, inline: true }
    )
    .setFooter({ text: 'Fracture Bot' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}