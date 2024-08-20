import cors from "cors";
import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { WebSocket, WebSocketServer } from "ws";

const app = express();
dotenv.config();
app.use(cors());

type UserDetails = {
  id: string;
  message: String[];
  color: string;
};

type Message = {
  message: string;
  id: string;
  date: Date;
  color: string;
};

let users: Record<string, UserDetails> = {};
let messages: Message[] = [];

// Pool of bright colors
const brightColors = [
  "#FF5733",
  "#33FF57",
  "#3357FF",
  "#FF33A6",
  "#FF9633",
  "#B833FF",
  "#33FFF3",
  "#FFEB33",
  "#FF33B5",
  "#33FF6E",
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildPresences],
});

client.once("ready", () => {
  console.log("Discord bot is ready!");
  checkUserStatus();
});

client.login(process.env.DISCORD_TOKEN);

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

const handleDiscordOnConnection = (ws: WebSocket) => {
  ws.send(JSON.stringify({ type: "user_status", user, activity: activity! }));

  client.on("presenceUpdate", async (_oldPresence, newPresence) => {
    user["status"] = newPresence.status || "offline";
    const activity = newPresence.activities[0];

    ws.send(JSON.stringify({ type: "user_activity", activity, user }));
  });
};

const sendUserCount = () => {
  wss.clients.forEach((client) => {
    const len = { count: Object.keys(users).length, type: "user_count" };
    client.send(JSON.stringify(len));
  });
};

const broadcastMessage = () => {
  const sentBy = messages[0]?.id ?? "0";
  console.log({ sentBy });

  wss.clients.forEach((client) => {
    const msgResponse = {
      type: "messages",
      sentBy,
      messages,
    };
    client.send(JSON.stringify(msgResponse));
  });
};

const handleUserConnection = (ws: WebSocket) => {
  const uuid = uuidv4();
  const color = brightColors.pop() || "#000000";

  users[uuid] = {
    id: uuid,
    message: [],
    color,
  };

  const response = {
    id: uuid,
    type: "user_id",
    color,
  };

  const msgResponse = {
    type: "messages",
    messages,
  };
  ws.send(JSON.stringify(msgResponse));
  ws.send(JSON.stringify(response));
  sendUserCount();

  ws.on("message", (data: any) => {
    data = JSON.parse(data);

    switch (data.type) {
      case "send_message":
        const { message, date, id, color } = data;
        messages = [{ message, date, id, color }, ...messages];
        broadcastMessage();
        break;

      default:
        break;
    }
  });

  ws.on("close", () => {
    delete users[uuid];
    brightColors.push(color);
    sendUserCount();
    if (Object.keys(users).length === 1) {
      messages = [];
      broadcastMessage();
    }
    if (!Object.keys(users).length) {
      messages = [];
    }
  });
};

const wss = new WebSocketServer({ server: app.listen(8080) });

wss.on("connection", (ws: WebSocket, req) => {
  handleDiscordOnConnection(ws);
  handleUserConnection(ws);
});
