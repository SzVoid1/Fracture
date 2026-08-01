import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const helpCommand = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Tüm komutları ve kullanımlarını gösterir');

export async function handleHelpCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📚 Fracture Komutları')
    .setDescription('Aşağıda tüm komutların açıklamaları ve kullanım örneklerini bulabilirsiniz.')
    .addFields(
      {
        name: '📢 /time',
        value: 'Zaman bazlı duyuru oluşturur. Modal arayüzü ile başlık, açıklama, süre, kanal ve rol belirlenir.\n**Örnek:** `/time` → modal açılır\n**Süre formatları:** `1h 30m`, `5d` (dakika), `2day` (gün), `2024-12-31 23:59`',
        inline: false
      },
      {
        name: '⏹ /timestop [id]',
        value: 'Devam eden bir duyuruyu iptal eder. ID, duyuru mesajının footer\'ında yazar.\n**Örnek:** `/timestop id:ann_1712345678_abc123`',
        inline: false
      },
      {
        name: '➕ /add [rol]',
        value: 'Belirtilen role `/time` komutunu kullanma izni verir. (Sadece Admin)\n**Örnek:** `/add rol:@Moderatör`',
        inline: false
      },
      {
        name: '➖ /unadd',
        value: 'Daha önce eklenmiş bir rolün `/time` yetkisini kaldırır. Menüden seçim yapılır. (Sadece Admin)\n**Örnek:** `/unadd` → açılan menüden rol seçilir',
        inline: false
      },
      {
        name: '🔄 /update [komut]',
        value: 'Komutları yeniden derler. Belirli bir komut adı verilirse sadece o komut güncellenir, boş bırakılırsa tüm komutlar yeniden yüklenir. (Sadece Admin)\n**Örnek:** `/update` (tümü) veya `/update komut:time`',
        inline: false
      },
      {
        name: '🐛 /report',
        value: 'Bot geliştiricisine hata bildirimi gönderir. Modal ile açıklama ve ekran görüntüsü eklenebilir. (15dk cooldown)\n**Örnek:** `/report` → modal açılır',
        inline: false
      },
      {
        name: '💡 /ss',
        value: 'Bot geliştiricisine istek veya öneri gönderir.\n**Örnek:** `/ss` → modal açılır',
        inline: false
      },
      {
        name: '🤖 /up',
        value: 'Botun çalışma süresi, API gecikmesi, bot gecikmesi ve sürüm bilgilerini gösterir.\n**Örnek:** `/up`',
        inline: false
      }
    )
    .setFooter({ text: 'Fracture Bot v1.2.0' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
  console.log(`[HELP] Kullanıldı: ${interaction.user.tag}`);
}
