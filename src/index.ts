import cors from "cors";
import { Client, GatewayIntentBits, User } from "discord.js";
import dotenv from "dotenv";
import express from "express";
import { WebSocket, WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";

const app = express();
dotenv.config();
app.use(cors());

type UserDetails = {
  ws: WebSocket;
  message: String[];
}

const activeUsers: Record<string, UserDetails> = {}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildPresences],
});

client.once("ready", () => {
  console.log("Discord bot is ready!");
  checkUserStatus();
});

let user: Record<string, string | boolean> = {};
let activity = null;

async function checkUserStatus() {
  try {
    const guild = client.guilds.cache.first();

    if (!guild) throw new Error("Bot is not in any guilds.");

    const member = await guild.members.fetch(process.env.DISCORD_USERID!);
    if (!member) throw new Error("User not found in the guild.");

    const presence = member.presence;

    user["userId"] = member.user.id;
    user["avatar"] = member.user.avatar || "";
    user["status"] = presence?.status || "offline";
    user["username"] = member.user.username || "Vishal";

    activity = member.presence?.activities[0];
  } catch (error) {
    console.error("Error fetching user status:", error);
    user["status"] = "offline";
  }
}

const logWs = (ws: WebSocket) => {
  wss.clients.forEach((client) => {
    if (client == ws) {
      console.log(`${client}`);
    }
  });
};

const handleDiscordOnConnection = (ws: WebSocket) => {
  ws.send(JSON.stringify({ type: "user_status", user, activity: activity! }));

  client.on("presenceUpdate", async (oldPresence, newPresence) => {
    user["status"] = newPresence.status || "offline";
    const activity = newPresence.activities[0];

    ws.send(JSON.stringify({ type: "user_activity", activity, user }));
  });
};

client.login(process.env.DISCORD_TOKEN);

const wss = new WebSocketServer({ server: app.listen(8080) });

wss.on("connection", (ws: WebSocket, req) => {
  const uuid = uuidv4();
  console.log({ uuid });

  handleDiscordOnConnection(ws);
});

app.listen(3001, () => {
  console.log("Server is running on port 3001");
});
