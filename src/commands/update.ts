import { SlashCommandBuilder, ChatInputCommandInteraction, REST, Routes } from 'discord.js';
import { timeCommand, addCommand, timestopCommand, unaddCommand } from './time.js';
import { reportCommand } from './report.js';
import { ssCommand } from './ss.js';
import { upCommand } from './up.js';
import { helpCommand } from './help.js';

export const updateCommand = new SlashCommandBuilder()
  .setName('update')
  .setDescription('Komutları yeniden derler (belirli komut veya tümü)')
  .addStringOption(option =>
    option
      .setName('komut')
      .setDescription('Yeniden derlenecek komut adı (opsiyonel, tümü için boş bırakın)')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(0x0000000000000008);

const commandMap: Record<string, { toJSON(): any }> = {
  time: timeCommand,
  add: addCommand,
  timestop: timestopCommand,
  unadd: unaddCommand,
  report: reportCommand,
  ss: ssCommand,
  up: upCommand,
  help: helpCommand,
};

export async function handleUpdateCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const commandName = interaction.options.getString('komut');
  const TOKEN = process.env.DISCORD_TOKEN ?? '';
  const CLIENT_ID = process.env.CLIENT_ID ?? '';
  const GUILD_ID = process.env.GUILD_ID;

  if (!TOKEN || !CLIENT_ID) {
    await interaction.reply({ content: '❌ Token veya Client ID bulunamadı.', ephemeral: true });
    return;
  }

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const guildRoute = GUILD_ID ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) : Routes.applicationCommands(CLIENT_ID);

  if (commandName) {
    if (commandName === 'update') {
      await interaction.reply({ content: '❌ `/update` komutu kendi kendine güncellenemez. Tümünü güncellemek için komut adı belirtmeden `/update` kullanın.', ephemeral: true });
      return;
    }

    const builder = commandMap[commandName];
    if (!builder) {
      await interaction.reply({ content: `❌ \`${commandName}\` adlı bir komut bulunamadı. Mevcut komutlar: ${Object.keys(commandMap).join(', ')}`, ephemeral: true });
      return;
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const existingCommands = await rest.get(guildRoute) as any[];
      const existing = existingCommands.find((c: any) => c.name === commandName);

      if (existing) {
        const commandRoute = GUILD_ID
          ? Routes.applicationGuildCommand(CLIENT_ID, GUILD_ID, existing.id)
          : Routes.applicationCommand(CLIENT_ID, existing.id);
        await rest.patch(commandRoute, { body: builder.toJSON() });
      } else {
        await rest.post(guildRoute, { body: builder.toJSON() });
      }

      await interaction.editReply({ content: `✅ \`${commandName}\` komutu başarıyla güncellendi!` });
      console.log(`[UPDATE] Komut güncellendi: ${commandName} - ${interaction.user.tag}`);
    } catch (error: any) {
      console.error(`[UPDATE] ${commandName} hatası:`, error);
      await interaction.editReply({ content: `❌ \`${commandName}\` güncellenirken hata: ${error.message}` });
    }
    return;
  }

  const allCommands = [
    timeCommand.toJSON(),
    addCommand.toJSON(),
    timestopCommand.toJSON(),
    unaddCommand.toJSON(),
    reportCommand.toJSON(),
    ssCommand.toJSON(),
    upCommand.toJSON(),
    helpCommand.toJSON(),
    updateCommand.toJSON(),
  ];

  try {
    await interaction.deferReply({ ephemeral: true });
    await rest.put(guildRoute, { body: allCommands });
    await interaction.editReply({ content: '✅ Tüm komutlar başarıyla yeniden derlendi!' });
    console.log(`[UPDATE] Tüm komutlar yeniden derlendi - ${interaction.user.tag}`);
  } catch (error: any) {
    console.error('[UPDATE] Tüm komutlar hatası:', error);
    await interaction.editReply({ content: `❌ Komutlar güncellenirken hata: ${error.message}` });
  }
}
