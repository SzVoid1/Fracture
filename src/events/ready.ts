import { Client, ActivityType } from "discord.js";
import { startScheduler } from "../utils/scheduler";

export async function handleReady(client: Client<true>): Promise<void> {
  console.log(`[BOT] ${client.user.tag} olarak giriş yapıldı!`);
  console.log(`[BOT] Sunucu sayısı: ${client.guilds.cache.size}`);

  client.user.setPresence({
    activities: [{ name: "/help for commands", type: ActivityType.Streaming }],
    status: "online",
  });

  startScheduler(client);
}
