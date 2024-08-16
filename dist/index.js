"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const discord_js_1 = require("discord.js");
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const uuid_1 = require("uuid");
const ws_1 = require("ws");
const app = (0, express_1.default)();
dotenv_1.default.config();
app.use((0, cors_1.default)());
let users = {};
let messages = [];
const client = new discord_js_1.Client({
    intents: [discord_js_1.GatewayIntentBits.Guilds, discord_js_1.GatewayIntentBits.GuildPresences],
});
client.once("ready", () => {
    console.log("Discord bot is ready!");
    checkUserStatus();
});
client.login(process.env.DISCORD_TOKEN);
let user = {};
let activity = null;
function checkUserStatus() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const guild = client.guilds.cache.first();
            if (!guild)
                throw new Error("Bot is not in any guilds.");
            const member = yield guild.members.fetch(process.env.DISCORD_USERID);
            if (!member)
                throw new Error("User not found in the guild.");
            const presence = member.presence;
            user["userId"] = member.user.id;
            user["avatar"] = member.user.avatar || "";
            user["status"] = (presence === null || presence === void 0 ? void 0 : presence.status) || "offline";
            user["username"] = member.user.username || "Vishal";
            activity = (_a = member.presence) === null || _a === void 0 ? void 0 : _a.activities[0];
        }
        catch (error) {
            console.error("Error fetching user status:", error);
            user["status"] = "offline";
        }
    });
}
const handleDiscordOnConnection = (ws) => {
    ws.send(JSON.stringify({ type: "user_status", user, activity: activity }));
    client.on("presenceUpdate", (_oldPresence, newPresence) => __awaiter(void 0, void 0, void 0, function* () {
        user["status"] = newPresence.status || "offline";
        const activity = newPresence.activities[0];
        ws.send(JSON.stringify({ type: "user_activity", activity, user }));
    }));
};
const sendUserCount = () => {
    wss.clients.forEach((client) => {
        const len = { count: Object.keys(users).length, type: "user_count" };
        client.send(JSON.stringify(len));
    });
};
const broadcastMessage = () => {
    wss.clients.forEach((client) => {
        const msgResponse = {
            type: "messages",
            messages,
        };
        client.send(JSON.stringify(msgResponse));
    });
};
const handleUserConnection = (ws) => {
    const uuid = (0, uuid_1.v4)();
    users[uuid] = {
        id: uuid,
        message: [],
    };
    const response = {
        id: uuid,
        type: "user_id",
    };
    ws.send(JSON.stringify(response));
    sendUserCount();
    ws.on("message", (data) => {
        data = JSON.parse(data);
        switch (data.type) {
            case "send_message":
                const { message, timestamp, id } = data;
                messages.push({ message, timestamp, userId: id });
                broadcastMessage();
                break;
            default:
                break;
        }
    });
    ws.on("close", () => {
        delete users[uuid];
        console.log(`User with ID ${uuid} disconnected.`);
        sendUserCount();
        if (!Object.keys(users).length) {
            messages = [];
        }
    });
};
const wss = new ws_1.WebSocketServer({ server: app.listen(8080) });
wss.on("connection", (ws, req) => {
    handleDiscordOnConnection(ws);
    handleUserConnection(ws);
});
