import type { Client } from "discord.js";
import { ActivityType } from "discord.js";
import { startScheduler } from "../utils/scheduler.ts";
import { startKickMonitor } from "../utils/kickMonitor.ts";

export async function handleReady(client: Client<true>): Promise<void> {
  console.log(`[BOT] ${client.user.tag} olarak giriş yapıldı!`);
  console.log(`[BOT] Sunucu sayısı: ${client.guilds.cache.size}`);

  client.user.setPresence({
    activities: [{ name: "/help for commands", type: ActivityType.Streaming }],
    status: "online",
  });

  startScheduler(client);
  startKickMonitor(client);
}
