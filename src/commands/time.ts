import type { CommandInteraction, ChatInputCommandInteraction, ModalSubmitInteraction, ChannelSelectMenuInteraction, RoleSelectMenuInteraction, StringSelectMenuInteraction, ButtonInteraction } from 'discord.js';
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
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder
} from 'discord.js';
import { parseColonDuration, formatColonPreview } from '../utils/timeParser.ts';
import { getGuildSettings, addAnnouncement, getAnnouncement, removeAnnouncement, isIntroDismissed, dismissIntro } from '../utils/storage.ts';
import { buildAnnouncementEmbed, buildAnnouncementButtons, buildCancelledEmbed } from '../utils/announcementEmbed.ts';

// ───── Slash Commands ─────
export const timeCommand = new SlashCommandBuilder()
  .setName('time')
  .setDescription('Zaman bazlı duyuru oluşturma sihirbazını açar')
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

// ───── Wizard State ─────
interface WizardState {
  guildId: string;
  userId: string;
  channelId?: string;
  roleId?: string;
  totalMs?: number;
  expiresAt?: number;
  originalInput?: string;
  title?: string;
  description?: string;
  step: number; // 1=kanal,2=rol,3=süre,4=içerik,5=preview
  updatedAt: number;
}

const wizardStates = new Map<string, WizardState>();
const wizardTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const WIZARD_TTL = 10 * 60 * 1000;

function wizardKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

function setWizardState(key: string, state: WizardState): void {
  wizardStates.set(key, { ...state, updatedAt: Date.now() });
  const old = wizardTimeouts.get(key);
  if (old) clearTimeout(old);
  const t = setTimeout(() => {
    wizardStates.delete(key);
    wizardTimeouts.delete(key);
  }, WIZARD_TTL);
  // @ts-ignore
  if (t.unref) t.unref();
  wizardTimeouts.set(key, t);
}

function getWizardState(key: string): WizardState | undefined {
  return wizardStates.get(key);
}

function clearWizardState(key: string): void {
  wizardStates.delete(key);
  const t = wizardTimeouts.get(key);
  if (t) clearTimeout(t);
  wizardTimeouts.delete(key);
}

function hasPermission(guildId: string, member: any): boolean {
  const settings = getGuildSettings(guildId);
  const memberRoles = member.roles?.cache;
  return settings?.allowedRoles?.some((roleId: string) => memberRoles?.has(roleId))
    || member.permissions?.has(0x0000000000000008n);
}

function progressBar(step: number, total = 4): string {
  let s = '';
  for (let i = 1; i <= total; i++) s += i <= step ? '●' : '○';
  return `\`${s}\` Adım ${step}/${total}`;
}

// ───── Intro ─────
function buildIntroEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📘 /time Kullanım Kılavuzu')
    .setDescription('Sihirbazı başlatmadan önce kısa bir bilgilendirme. **İleri** ile devam edebilir veya **Bir Daha Gösterme** ile bu ekranı kalıcı olarak kapatabilirsin.')
    .addFields(
      { name: '🔢 Adım Sırası', value: '**1.** Kanal seç → **2.** Rol seç → **3.** Süre seç → **4.** Başlık & Açıklama → **5.** Önizleme & Onayla', inline: false },
      { name: '⏰ Zaman Formatı', value: '`GG:HH:MM:SS` (Gün:Saat:Dakika:Saniye)\n`00` veya `0` = es geçilir, en az 1 değer >0 olmalı\n**Kısayollar (sağa dayalı):**\n• `30` → 30 saniye\n• `2:00` → 2 dakika\n• `2:0:0` → 2 saat\n• `00:2:00:00` / `0:2:0:0` → 2 saat\n• `01:20:00:00` → 1 gün 20 saat', inline: false },
      { name: '⚠️ Limitler & Kurallar', value: '• Gün ≤ `365`, Saat ≤ `24`, Dakika ≤ `60`, Saniye ≤ `60`\n• Toplam süre max `365 gün` (fazlası hata)\n• `25` saat yazarsan otomatik `1 gün 1 saat`e eklenir (60sn→1dk, 60dk→1sa, 24sa→1gün)\n• Sadece sayı ve `:` kullanın', inline: false },
      { name: '🎮 Tuşlar', value: '`İleri →` → bir sonraki adıma geç\n`◀ Geri` → önceki adıma dön\n`❌ İptal` → sihirbazı kapat\n`🔕 Bir Daha Gösterme` → bu kılavuzu kalıcı kapat', inline: false }
    )
    .setFooter({ text: 'İleri ile devam et • Sihirbaz 10dk sonra zaman aşımına uğrar' })
    .setTimestamp();
}

function buildIntroComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('wizard_intro_next').setLabel('İleri →').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('wizard_intro_dismiss').setLabel('Bir Daha Gösterme').setEmoji('🔕').setStyle(ButtonStyle.Secondary)
    )
  ];
}

async function showIntro(interaction: CommandInteraction | ButtonInteraction): Promise<void> {
  const embed = buildIntroEmbed();
  const components = buildIntroComponents();
  if (interaction.isRepliable()) {
    // @ts-ignore
    if ((interaction as any).replied || (interaction as any).deferred) {
      await (interaction as ButtonInteraction).update({ embeds: [embed], components });
    } else {
      await interaction.reply({ embeds: [embed], components, flags: 64 });
    }
  }
}

async function showStep1(interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ChannelSelectMenuInteraction | RoleSelectMenuInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const key = wizardKey(guildId, userId);
  const existing = getWizardState(key);
  const state: WizardState = existing ? { ...existing, step: 1, updatedAt: Date.now() } : { guildId, userId, step: 1, updatedAt: Date.now() };
  setWizardState(key, state);

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('📢 Zamanlı Duyuru — Adım 1/4')
    .setDescription(`${progressBar(1)}\n\n**Hangi kanala gönderilsin?**\nAşağıdaki menüden bir metin kanalı seç.`)
    .setFooter({ text: 'İpucu: Sadece metin kanalları listelenir' });

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('wizard_channel')
    .setPlaceholder('Kanal seçin')
    .addChannelTypes(ChannelType.GuildText);

  const row1 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('wizard_cancel').setLabel('İptal').setStyle(ButtonStyle.Danger).setEmoji('❌')
  );

  if (interaction.isButton() || interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu() || interaction.isStringSelectMenu()) {
    await (interaction as any).update({ embeds: [embed], components: [row1, row2] });
  } else {
    await interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
  }
}

async function showStep2(interaction: ChannelSelectMenuInteraction | ButtonInteraction | StringSelectMenuInteraction | RoleSelectMenuInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const key = wizardKey(guildId, userId);
  const state = getWizardState(key);
  if (!state) {
    await (interaction as any).reply({ content: '❌ Oturum zaman aşımına uğradı. Lütfen `/time` ile yeniden başlat.', flags: 64 });
    return;
  }
  state.step = 2;
  setWizardState(key, state);

  const channelMention = state.channelId ? `<#${state.channelId}>` : '—';
  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('📢 Zamanlı Duyuru — Adım 2/4')
    .setDescription(`${progressBar(2)}\n\n**Hangi rol etiketlensin?**\nKanal: ${channelMention}\nAşağıdan bir rol seç.`)
    .setFooter({ text: 'Seçilen rol duyuru mesajında etiketlenecek' });

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId('wizard_role')
    .setPlaceholder('Rol seçin');

  const row1 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('wizard_back').setLabel('Geri').setStyle(ButtonStyle.Secondary).setEmoji('◀'),
    new ButtonBuilder().setCustomId('wizard_cancel').setLabel('İptal').setStyle(ButtonStyle.Danger).setEmoji('❌')
  );

  await (interaction as any).update({ embeds: [embed], components: [row1, row2] });
}

async function showStep3(interaction: RoleSelectMenuInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction | ChannelSelectMenuInteraction): Promise<void> {
  const guildId = (interaction as any).guildId as string;
  const userId = interaction.user.id;
  const key = wizardKey(guildId, userId);
  const state = getWizardState(key);
  if (!state) {
    await (interaction as any).reply({ content: '❌ Oturum zaman aşımına uğradı. `/time` ile yeniden başlat.', flags: 64 });
    return;
  }
  state.step = 3;
  setWizardState(key, state);

  const channelMention = state.channelId ? `<#${state.channelId}>` : '—';
  const roleMention = state.roleId ? `<@&${state.roleId}>` : '—';
  let desc = `${progressBar(3)}\n\n**Süre ne kadar olsun?**\nKanal: ${channelMention} • Rol: ${roleMention}\n`;
  if (state.totalMs) {
    const preview = formatColonPreview(state.totalMs);
    desc += `\n**Seçili:** \`${state.originalInput}\` → **${preview}**\nBitiş: <t:${Math.floor(state.expiresAt! / 1000)}:F> (<t:${Math.floor(state.expiresAt! / 1000)}:R>)\n`;
  } else {
    desc += `\nAşağıdan hazır süre seç veya **Özel** ile \`GG:HH:MM:SS\` gir.\n`;
  }
  desc += `\nÖrn: \`00:00:15:00\`=15dk, \`00:01:00:00\`=1sa, \`01:00:00:00\`=1gün`;

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('📢 Zamanlı Duyuru — Adım 3/4')
    .setDescription(desc);

  const durationSelect = new StringSelectMenuBuilder()
    .setCustomId('wizard_duration')
    .setPlaceholder('Hazır süre seçin')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('15 Dakika').setValue('00:00:15:00').setDescription('00:00:15:00').setEmoji('⏱️'),
      new StringSelectMenuOptionBuilder().setLabel('30 Dakika').setValue('00:00:30:00').setDescription('00:00:30:00').setEmoji('⏱️'),
      new StringSelectMenuOptionBuilder().setLabel('1 Saat').setValue('00:01:00:00').setDescription('00:01:00:00').setEmoji('⏰'),
      new StringSelectMenuOptionBuilder().setLabel('3 Saat').setValue('00:03:00:00').setDescription('00:03:00:00').setEmoji('⏰'),
      new StringSelectMenuOptionBuilder().setLabel('1 Gün').setValue('01:00:00:00').setDescription('01:00:00:00').setEmoji('📅'),
      new StringSelectMenuOptionBuilder().setLabel('1 Hafta').setValue('07:00:00:00').setDescription('07:00:00:00').setEmoji('🗓️'),
      new StringSelectMenuOptionBuilder().setLabel('Özel Gir...').setValue('custom').setDescription('GG:HH:MM:SS formatında yaz').setEmoji('✏️')
    );

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(durationSelect);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('wizard_duration_custom').setLabel('Özel Süre Gir').setEmoji('⏰').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('wizard_back').setLabel('Geri').setEmoji('◀').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('wizard_cancel').setLabel('İptal').setEmoji('❌').setStyle(ButtonStyle.Danger)
  );

  // Modal submit sonrası gelen interaction ise reply, diğerleri update
  if ((interaction as any).isModalSubmit && (interaction as any).isModalSubmit()) {
    await (interaction as any).reply({ embeds: [embed], components: [row1, row2], flags: 64 });
  } else {
    await (interaction as any).update({ embeds: [embed], components: [row1, row2] });
  }
}

async function showStep4(interaction: StringSelectMenuInteraction | ButtonInteraction | ModalSubmitInteraction): Promise<void> {
  const guildId = (interaction as any).guildId as string;
  const userId = interaction.user.id;
  const key = wizardKey(guildId, userId);
  const state = getWizardState(key);
  if (!state) {
    await (interaction as any).reply({ content: '❌ Oturum bulunamadı.', flags: 64 });
    return;
  }
  state.step = 4;
  setWizardState(key, state);

  const channelMention = state.channelId ? `<#${state.channelId}>` : '—';
  const roleMention = state.roleId ? `<@&${state.roleId}>` : '—';
  const durationPreview = state.totalMs ? `${state.originalInput} → ${formatColonPreview(state.totalMs!)} (Bitiş <t:${Math.floor(state.expiresAt! / 1000)}:R>)` : '—';

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('📢 Zamanlı Duyuru — Adım 4/4')
    .setDescription(`${progressBar(4)}\n\n**Başlık & Açıklama**\nKanal: ${channelMention} • Rol: ${roleMention}\nSüre: ${durationPreview}\n\n${state.title ? `**Başlık:** ${state.title}\n**Açıklama:** ${state.description?.slice(0, 200)}${(state.description?.length || 0) > 200 ? '...' : ''}\n` : 'Aşağıdaki butonla başlık ve açıklama gir.'}`);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('wizard_content_open').setLabel(state.title ? 'Başlık/Açıklamayı Düzenle' : 'Başlık & Açıklama Gir').setEmoji('📝').setStyle(ButtonStyle.Primary)
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('wizard_next_preview').setLabel('Önizlemeye Geç →').setStyle(ButtonStyle.Success).setDisabled(!state.title || !state.description),
    new ButtonBuilder().setCustomId('wizard_back').setLabel('Geri').setEmoji('◀').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('wizard_cancel').setLabel('İptal').setEmoji('❌').setStyle(ButtonStyle.Danger)
  );

  if ((interaction as any).isModalSubmit && (interaction as any).isModalSubmit()) {
    await (interaction as any).reply({ embeds: [embed], components: [row1, row2], flags: 64 });
  } else {
    // StringSelect ve Button için update, ama modal submit değilse
    const isUpdate = (interaction as any).update;
    if (isUpdate && !(interaction as any).replied) {
      try {
        await (interaction as any).update({ embeds: [embed], components: [row1, row2] });
      } catch {
        await (interaction as any).reply({ embeds: [embed], components: [row1, row2], flags: 64 });
      }
    } else {
      await (interaction as any).reply({ embeds: [embed], components: [row1, row2], flags: 64 });
    }
  }
}

async function showPreview(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<void> {
  const guildId = (interaction as any).guildId as string;
  const userId = interaction.user.id;
  const key = wizardKey(guildId, userId);
  const state = getWizardState(key);
  if (!state || !state.channelId || !state.roleId || !state.totalMs || !state.title || !state.description) {
    await (interaction as any).reply({ content: '❌ Eksik bilgi var. Lütfen adımları tamamlayın.', flags: 64 });
    return;
  }
  state.step = 5;
  setWizardState(key, state);

  const expiresSec = Math.floor(state.expiresAt! / 1000);
  const previewEmbed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle(`📢 ${state.title} — Önizleme`)
    .setDescription(state.description)
    .addFields(
      { name: 'Kanal', value: `<#${state.channelId}>`, inline: true },
      { name: 'Rol', value: `<@&${state.roleId}>`, inline: true },
      { name: 'Süre', value: `${state.originalInput} → ${formatColonPreview(state.totalMs)}`, inline: true },
      { name: 'Bitiş', value: `<t:${expiresSec}:F>`, inline: true },
      { name: 'Kalan', value: `<t:${expiresSec}:R>`, inline: true }
    )
    .setFooter({ text: 'Onayla ile gönderilecek • Düzenle ile geri dönebilirsin' })
    .setTimestamp();

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('wizard_confirm').setLabel('✅ Onayla ve Gönder').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('wizard_cancel').setLabel('❌ İptal').setStyle(ButtonStyle.Danger)
  );
  const editSelect = new StringSelectMenuBuilder()
    .setCustomId('wizard_edit')
    .setPlaceholder('Düzenlemek için seç')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Kanalı Düzenle').setValue('edit_channel').setEmoji('📢'),
      new StringSelectMenuOptionBuilder().setLabel('Rolü Düzenle').setValue('edit_role').setEmoji('👥'),
      new StringSelectMenuOptionBuilder().setLabel('Süreyi Düzenle').setValue('edit_duration').setEmoji('⏰'),
      new StringSelectMenuOptionBuilder().setLabel('Başlık/Açıklamayı Düzenle').setValue('edit_content').setEmoji('📝')
    );
  const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(editSelect);

  if ((interaction as any).isModalSubmit && (interaction as any).isModalSubmit()) {
    await (interaction as any).reply({ embeds: [previewEmbed], components: [row1, row2], flags: 64 });
  } else {
    await (interaction as any).update({ embeds: [previewEmbed], components: [row1, row2] });
  }
}

// ───── Handlers ─────
export async function handleTimeCommand(interaction: CommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const member = interaction.member! as any;

  if (!hasPermission(guildId, member)) {
    await interaction.reply({ content: '❌ Bu komutu kullanma yetkiniz yok.', flags: 64 });
    return;
  }

  if (!isIntroDismissed(interaction.user.id)) {
    await showIntro(interaction);
    console.log(`[TIME] Intro gösterildi: ${interaction.user.tag}`);
    return;
  }

  await showStep1(interaction);
  console.log(`[TIME] Wizard başlatıldı: ${interaction.user.tag}`);
}

export async function handleWizardIntroNext(interaction: ButtonInteraction): Promise<void> {
  await showStep1(interaction);
}

export async function handleWizardIntroDismiss(interaction: ButtonInteraction): Promise<void> {
  dismissIntro(interaction.user.id);
  await showStep1(interaction);
  console.log(`[TIME] Intro kapatıldı: ${interaction.user.tag}`);
}

export async function handleWizardChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<void> {
  const key = wizardKey(interaction.guildId!, interaction.user.id);
  const state = getWizardState(key);
  if (!state) {
    await interaction.reply({ content: '❌ Oturum bulunamadı. `/time` ile yeniden başlat.', flags: 64 });
    return;
  }
  const channelId = interaction.values[0];
  // Validate GuildText
  const ch = await interaction.guild?.channels.fetch(channelId).catch(() => null);
  if (!ch || ch.type !== ChannelType.GuildText) {
    await interaction.reply({ content: '❌ Geçersiz kanal. Lütfen bir metin kanalı seçin.', flags: 64 });
    return;
  }
  state.channelId = channelId;
  setWizardState(key, state);
  await showStep2(interaction);
}

export async function handleWizardRoleSelect(interaction: RoleSelectMenuInteraction): Promise<void> {
  const key = wizardKey(interaction.guildId!, interaction.user.id);
  const state = getWizardState(key);
  if (!state) {
    await interaction.reply({ content: '❌ Oturum bulunamadı.', flags: 64 });
    return;
  }
  const roleId = interaction.values[0];
  const role = await interaction.guild?.roles.fetch(roleId).catch(() => null);
  if (!role) {
    await interaction.reply({ content: '❌ Rol bulunamadı.', flags: 64 });
    return;
  }
  state.roleId = roleId;
  setWizardState(key, state);
  await showStep3(interaction);
}

export async function handleWizardDurationSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const key = wizardKey(interaction.guildId!, interaction.user.id);
  const state = getWizardState(key);
  if (!state) {
    await interaction.reply({ content: '❌ Oturum bulunamadı.', flags: 64 });
    return;
  }
  const value = interaction.values[0];
  if (value === 'custom') {
    const modal = new ModalBuilder().setCustomId('wizard_duration_modal').setTitle('Özel Süre Gir');
    const input = new TextInputBuilder()
      .setCustomId('wizard_duration_input')
      .setLabel('Süre (GG:HH:MM:SS)')
      .setPlaceholder('Örn: 01:20:00:00 (1g 20sa) veya 2:00 (2dk) veya 2:0:0 (2sa)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(20);
    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);
    await interaction.showModal(modal);
    return;
  }

  try {
    const parsed = parseColonDuration(value);
    state.totalMs = parsed.totalMs;
    state.expiresAt = parsed.expiresAt;
    state.originalInput = parsed.originalInput;
    setWizardState(key, state);
    await showStep4(interaction);
  } catch (e: any) {
    await interaction.reply({ content: `❌ ${e.message}`, flags: 64 });
  }
}

export async function handleWizardDurationCustomButton(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder().setCustomId('wizard_duration_modal').setTitle('Özel Süre Gir');
  const input = new TextInputBuilder()
    .setCustomId('wizard_duration_input')
    .setLabel('Süre (GG:HH:MM:SS)')
    .setPlaceholder('Örn: 01:20:00:00 veya 2:00 (2dk) veya 2:0:0 (2sa)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20);
  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
  modal.addComponents(row);
  await interaction.showModal(modal);
}

export async function handleWizardDurationModal(interaction: ModalSubmitInteraction): Promise<void> {
  const key = wizardKey(interaction.guildId!, interaction.user.id);
  const state = getWizardState(key);
  if (!state) {
    await interaction.reply({ content: '❌ Oturum bulunamadı. `/time` ile yeniden başlat.', flags: 64 });
    return;
  }
  const raw = interaction.fields.getTextInputValue('wizard_duration_input');
  try {
    const parsed = parseColonDuration(raw);
    state.totalMs = parsed.totalMs;
    state.expiresAt = parsed.expiresAt;
    state.originalInput = parsed.originalInput;
    setWizardState(key, state);
    await showStep4(interaction);
    console.log(`[TIME] Süre girildi: ${parsed.originalInput} -> ${formatColonPreview(parsed.totalMs)}`);
  } catch (e: any) {
    await interaction.reply({ content: `❌ ${e.message}\n\n**Doğru örnekler:** \`00:00:15:00\` (15dk), \`2:00\` (2dk), \`2:0:0\` (2sa), \`01:20:00:00\` (1g20sa)`, flags: 64 });
  }
}

export async function handleWizardContentOpen(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder().setCustomId('wizard_content_modal').setTitle('Başlık & Açıklama');
  const titleInput = new TextInputBuilder()
    .setCustomId('wizard_title')
    .setLabel('Başlık')
    .setPlaceholder('Duyuru başlığını giriniz')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);
  const descInput = new TextInputBuilder()
    .setCustomId('wizard_desc')
    .setLabel('Açıklama')
    .setPlaceholder('Duyuru açıklamasını giriniz')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);
  const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
  const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(descInput);
  modal.addComponents(row1, row2);
  await interaction.showModal(modal);
}

export async function handleWizardContentModal(interaction: ModalSubmitInteraction): Promise<void> {
  const key = wizardKey(interaction.guildId!, interaction.user.id);
  const state = getWizardState(key);
  if (!state) {
    await interaction.reply({ content: '❌ Oturum bulunamadı.', flags: 64 });
    return;
  }
  const title = interaction.fields.getTextInputValue('wizard_title');
  const description = interaction.fields.getTextInputValue('wizard_desc');
  state.title = title;
  state.description = description;
  setWizardState(key, state);
  await showPreview(interaction);
}

export async function handleWizardNextPreview(interaction: ButtonInteraction): Promise<void> {
  const key = wizardKey(interaction.guildId!, interaction.user.id);
  const state = getWizardState(key);
  if (!state?.title || !state?.description) {
    await interaction.reply({ content: '❌ Önce başlık ve açıklama girmen gerekiyor. `📝` butonuna bas.', flags: 64 });
    return;
  }
  await showPreview(interaction);
}

export async function handleWizardBack(interaction: ButtonInteraction): Promise<void> {
  const key = wizardKey(interaction.guildId!, interaction.user.id);
  const state = getWizardState(key);
  if (!state) {
    await interaction.reply({ content: '❌ Oturum bulunamadı.', flags: 64 });
    return;
  }
  if (state.step === 2) await showStep1(interaction);
  else if (state.step === 3) await showStep2(interaction);
  else if (state.step === 4) await showStep3(interaction);
  else if (state.step === 5) await showStep4(interaction);
  else await showStep1(interaction);
}

export async function handleWizardCancel(interaction: ButtonInteraction): Promise<void> {
  const key = wizardKey(interaction.guildId!, interaction.user.id);
  clearWizardState(key);
  await (interaction as any).update({ content: '❌ Sihirbaz iptal edildi.', embeds: [], components: [] });
}

export async function handleWizardEditSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const val = interaction.values[0];
  if (val === 'edit_channel') await showStep1(interaction);
  else if (val === 'edit_role') await showStep2(interaction);
  else if (val === 'edit_duration') await showStep3(interaction);
  else if (val === 'edit_content') {
    await handleWizardContentOpen(interaction as any);
  }
}

export async function handleWizardConfirm(interaction: ButtonInteraction): Promise<void> {
  const key = wizardKey(interaction.guildId!, interaction.user.id);
  const state = getWizardState(key);
  if (!state || !state.channelId || !state.roleId || !state.totalMs || !state.title || !state.description || !state.expiresAt) {
    await interaction.reply({ content: '❌ Eksik bilgi var.', flags: 64 });
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: '❌ Sunucu bulunamadı.', flags: 64 });
    return;
  }

  const channel = await guild.channels.fetch(state.channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: '❌ Kanal bulunamadı veya metin kanalı değil.', flags: 64 });
    return;
  }

  const role = await guild.roles.fetch(state.roleId).catch(() => null);
  if (!role) {
    await interaction.reply({ content: '❌ Rol bulunamadı.', flags: 64 });
    return;
  }

  const annId = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = Date.now();

  const previewAnn = {
    id: annId,
    title: state.title,
    description: state.description,
    channelId: state.channelId,
    roleId: state.roleId,
    createdAt,
    expiresAt: state.expiresAt,
    totalMs: state.totalMs,
    seenBy: [] as string[],
    authorId: interaction.user.id,
    authorTag: interaction.user.tag
  };
  const embed = buildAnnouncementEmbed(previewAnn, 'active');
  const row = buildAnnouncementButtons(annId, 0);

  const textChannel = channel as TextChannel;
  let msg;
  try {
    msg = await textChannel.send({
      content: `<@&${role.id}> **${state.title}** - Yeni duyuru!`,
      embeds: [embed],
      components: [row]
    });
  } catch (e: any) {
    await interaction.reply({ content: `❌ Kanala gönderilemedi: ${e.message}`, flags: 64 });
    return;
  }

  addAnnouncement({
    id: annId,
    guildId: guild.id,
    channelId: channel.id,
    messageId: msg.id,
    roleId: role.id,
    title: state.title,
    description: state.description,
    createdAt,
    expiresAt: state.expiresAt,
    totalMs: state.totalMs,
    seenBy: [],
    halfwayNotified: false,
    finalDmNotified: false,
    authorId: interaction.user.id,
    authorTag: interaction.user.tag
  });

  clearWizardState(key);

  await (interaction as any).update({
    content: `✅ Duyuru oluşturuldu!\n**Kanal:** ${channel}\n**Rol:** ${role}\n**Süre:** \`${state.originalInput}\` → ${formatColonPreview(state.totalMs)}\n**Bitiş:** <t:${Math.floor(state.expiresAt / 1000)}:F>`,
    embeds: [],
    components: []
  });

  console.log(`[TIME] Wizard duyuru oluşturuldu: ${annId} - ${interaction.user.tag}`);
}

// Eski modal artık kullanılmıyor ama geriye dönük import kırılmasın diye stub
export async function handleTimeModal(_interaction: ModalSubmitInteraction): Promise<void> {
  await _interaction.reply({ content: '❌ Bu modal artık kullanılmıyor. Lütfen `/time` ile sihirbazı kullan.', flags: 64 });
}

export async function handleTimestopCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const id = interaction.options.getString('id', true);
  if (!id) {
    await interaction.reply({ content: '❌ Geçerli bir ID girin.', flags: 64 });
    return;
  }

  const announcement = getAnnouncement(id);
  if (!announcement) {
    await interaction.reply({ content: `❌ \`${id}\` ID\'li duyuru bulunamadı.`, flags: 64 });
    return;
  }

  try {
    const channel = await interaction.client.channels.fetch(announcement.channelId);
    if (channel && channel instanceof TextChannel) {
      try {
        const msg = await channel.messages.fetch(announcement.messageId);
        const cancelEmbed = buildCancelledEmbed(announcement as any, interaction.user.tag);
        await msg.edit({ embeds: [cancelEmbed], components: [] });
      } catch {}
    }
  } catch {}

  removeAnnouncement(id);
  await interaction.reply({
    content: `✅ **${announcement.title}** duyurusu iptal edildi.`,
    flags: 64
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
      flags: 64
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
    flags: 64
  });
}
