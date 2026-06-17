import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, Events } from 'discord.js';
import { timeCommand, addCommand, timestopCommand, unaddCommand, handleTimeCommand, handleTimestopCommand, handleUnaddCommand } from './src/commands/time';
import { reportCommand, handleReportCommand, handleReportModal } from './src/commands/report';
import { ssCommand, handleSsCommand, handleSsModal } from './src/commands/ss';
import { upCommand, handleUpCommand, setStartTime } from './src/commands/up';
import { helpCommand, handleHelpCommand } from './src/commands/help';
import { updateCommand, handleUpdateCommand } from './src/commands/update';
import { handleReady } from './src/events/ready';
import { handleInteractionCreate } from './src/events/interactionCreate';
import { addAllowedRole } from './src/utils/storage';

const TOKEN: string = process.env.DISCORD_TOKEN ?? '';
const CLIENT_ID: string = process.env.CLIENT_ID ?? '';
const GUILD_ID: string | undefined = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('[BOT] DISCORD_TOKEN ve CLIENT_ID çevre değişkenleri zorunludur!');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

const commands = [
  timeCommand.toJSON(),
  addCommand.toJSON(),
  timestopCommand.toJSON(),
  unaddCommand.toJSON(),
  reportCommand.toJSON(),
  ssCommand.toJSON(),
  upCommand.toJSON(),
  helpCommand.toJSON(),
  updateCommand.toJSON()
];
const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands(): Promise<void> {
  try {
    console.log('[BOT] Slash komutları kaydediliyor...');

    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log(`[BOT] Komutlar guild'e kaydedildi: ${GUILD_ID}`);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('[BOT] Komutlar global olarak kaydedildi.');
    }
  } catch (error) {
    console.error('[BOT] Komut kaydı hatası:', error);
  }
}

client.once(Events.ClientReady, async (c) => {
  setStartTime();
  await registerCommands();
  await handleReady(c);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    switch (interaction.commandName) {
      case 'time':
        await handleTimeCommand(interaction);
        break;
      case 'add':
        await handleAddCommand(interaction);
        break;
      case 'timestop':
        await handleTimestopCommand(interaction);
        break;
      case 'unadd':
        await handleUnaddCommand(interaction);
        break;
      case 'report':
        await handleReportCommand(interaction);
        break;
      case 'ss':
        await handleSsCommand(interaction);
        break;
      case 'up':
        await handleUpCommand(interaction);
        break;
      case 'help':
        await handleHelpCommand(interaction);
        break;
      case 'update':
        await handleUpdateCommand(interaction);
        break;
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    switch (interaction.customId) {
      case 'timeModal':
        const { handleTimeModal } = require('./src/commands/time');
        await handleTimeModal(interaction);
        return;
      case 'reportModal':
        await handleReportModal(interaction);
        return;
      case 'ssModal':
        await handleSsModal(interaction);
        return;
    }
  }

  await handleInteractionCreate(interaction);
});

async function handleAddCommand(interaction: any): Promise<void> {
  if (!interaction.member?.permissions?.has(0x0000000000000008n)) {
    await interaction.reply({ content: '❌ Bu komutu kullanma yetkiniz yok.', ephemeral: true });
    return;
  }

  const role = interaction.options.getRole('rol');
  if (!role) {
    await interaction.reply({ content: '❌ Geçerli bir rol seçin.', ephemeral: true });
    return;
  }

  addAllowedRole(interaction.guildId!, role.id);

  await interaction.reply({
    content: `✅ \`/time\` komutunu kullanma izni **${role.name}** rolüne verildi!`,
    ephemeral: true
  });

  console.log(`[ADD] Rol eklendi: ${role.name} (${role.id}) - ${interaction.user.tag}`);
}

client.login(TOKEN).catch((error) => {
  console.error('[BOT] Giriş hatası:', error);
  process.exit(1);
});