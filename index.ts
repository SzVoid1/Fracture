import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, Events } from 'discord.js';
import { timeCommand, addCommand, timestopCommand, unaddCommand, handleTimeCommand, handleTimestopCommand, handleUnaddCommand } from './src/commands/time.ts';
import { reportCommand, handleReportCommand, handleReportModal } from './src/commands/report.ts';
import { ssCommand, handleSsCommand, handleSsModal } from './src/commands/ss.ts';
import { upCommand, handleUpCommand, setStartTime } from './src/commands/up.ts';
import { helpCommand, handleHelpCommand } from './src/commands/help.ts';
import { updateCommand, handleUpdateCommand } from './src/commands/update.ts';
import { kickCommand, handleKickCommand } from './src/commands/kick.ts';
import { handleReady } from './src/events/ready.ts';
import { handleInteractionCreate } from './src/events/interactionCreate.ts';
import { addAllowedRole } from './src/utils/storage.ts';

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
  updateCommand.toJSON(),
  kickCommand.toJSON()
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

// ───── Global Error Handlers (ECONNRESET / WS çökmesini engeller) ─────
client.on(Events.Error, (error) => console.error('[CLIENT ERROR]', error));
client.on(Events.ShardError, (error) => console.error('[SHARD ERROR]', error));
client.on(Events.ShardDisconnect, (event, shardId) => console.warn(`[SHARD DISCONNECT] shard=${shardId}`, event?.code, event?.reason));
(client as any).on('error', (error: any) => console.error('[CLIENT RAW ERROR]', error));
client.rest.on('rateLimited', (info) => console.warn('[RATE LIMITED]', info));

process.on('unhandledRejection', (reason) => console.error('[UNHANDLED REJECTION]', reason));
process.on('uncaughtException', (err) => console.error('[UNCAUGHT EXCEPTION]', err));

client.once(Events.ClientReady, async (c) => {
  setStartTime();
  await registerCommands();
  await handleReady(c);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
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
      case 'kick':
        await handleKickCommand(interaction);
        break;
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    switch (interaction.customId) {
      case 'timeModal': {
        const { handleTimeModal } = await import('./src/commands/time.ts');
        await handleTimeModal(interaction);
        return;
      }
      case 'wizard_duration_modal': {
        const { handleWizardDurationModal } = await import('./src/commands/time.ts');
        await handleWizardDurationModal(interaction);
        return;
      }
      case 'wizard_content_modal': {
        const { handleWizardContentModal } = await import('./src/commands/time.ts');
        await handleWizardContentModal(interaction);
        return;
      }
      case 'reportModal':
        await handleReportModal(interaction);
        return;
      case 'ssModal':
        await handleSsModal(interaction);
        return;
    }
  }

  await handleInteractionCreate(interaction);
  } catch (err) {
    console.error('[INTERACTION ERROR]', err);
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Bir hata oluştu.', flags: 64 });
      } else if (interaction.isRepliable() && interaction.deferred) {
        await (interaction as any).editReply({ content: '❌ Bir hata oluştu.' });
      }
    } catch {}
  }
});

async function handleAddCommand(interaction: any): Promise<void> {
  if (!interaction.member?.permissions?.has(0x0000000000000008n)) {
    await interaction.reply({ content: '❌ Bu komutu kullanma yetkiniz yok.', flags: 64 });
    return;
  }

  const role = interaction.options.getRole('rol');
  if (!role) {
    await interaction.reply({ content: '❌ Geçerli bir rol seçin.', flags: 64 });
    return;
  }

  addAllowedRole(interaction.guildId!, role.id);

  await interaction.reply({
    content: `✅ \`/time\` komutunu kullanma izni **${role.name}** rolüne verildi!`,
    flags: 64
  });

  console.log(`[ADD] Rol eklendi: ${role.name} (${role.id}) - ${interaction.user.tag}`);
}

async function loginWithRetry(retries = 5, delayMs = 5000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await client.login(TOKEN);
      return;
    } catch (error: any) {
      const isNetwork = error?.code === 'ECONNRESET' || error?.code === 'ENOTFOUND' || error?.code === 'ETIMEDOUT' || error?.message?.includes('ECONNRESET');
      console.error(`[BOT] Giriş hatası (deneme ${attempt}/${retries}):`, error?.code || error?.message || error);
      if (!isNetwork || attempt === retries) {
        console.error('[BOT] Tüm giriş denemeleri başarısız. 2sn sonra çıkış.');
        setTimeout(() => process.exit(1), 2000);
        return;
      }
      console.log(`[BOT] ${delayMs / 1000}s sonra yeniden deneniyor...`);
      await new Promise(r => setTimeout(r, delayMs));
      delayMs *= 1.5;
    }
  }
}

// TLS / ağ dalgalanmasında çökme yerine yeniden bağlanmayı dene
client.on(Events.ShardReconnecting, () => console.log('[SHARD] Yeniden bağlanılıyor...'));

loginWithRetry();