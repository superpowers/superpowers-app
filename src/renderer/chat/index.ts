 import * as net from "net";
import * as tls from "tls";
import * as SlateIRC from "slate-irc";

import * as settings from "../settings";
import * as tabs from "../tabs";
import * as sidebarMe from "../sidebar/me";

import ChatTab from "./ChatTab";

export const nicknamePattern = /^([A-Za-z][A-Za-z0-9_-]{1,15})$/;
export const nicknamePatternString = nicknamePattern.toString().slice(1, -1);

export const languageChatRooms = [ "fr" ];

export let irc: SlateIRC.Client;
let socket: net.Socket;
export const ircNetwork = { host: "irc.freenode.net", port: 6697 };
let mentionRegex: RegExp;

const statusChatTab = new ChatTab("status", { label: ircNetwork.host, showTab: false });
statusChatTab.paneElt.dataset["persist"] = "true";

const channelChatTabs: { [name: string]: ChatTab } = {};
const privateChatTabs: { [name: string]: ChatTab } = {};

tabs.tabStrip.on("closeTab", onCloseTab);

export function start() {
  if (settings.presence !== "offline") {
    connect();
    for (const roomName of settings.savedChatrooms) {
      join(roomName, false);
      channelChatTabs[roomName].addInfo("Connecting...");
    }
  }
}

export function openStatusTab() {
  statusChatTab.showTab(true);
}

export function onPresenceUpdated() {
  if (settings.presence !== "offline") {
    if (socket == null) connect();
    else {
      // TODO: Use this once https://github.com/slate/slate-irc/pull/38 is merged
      // irc.away(settings.presence === "away" ? "Away" : "");
      irc.write(`AWAY :${settings.presence === "away" ? "Away" : ""}`);
    }
  } else {
    disconnect();
  }
}

export function onNicknameUpdated() {
  if (socket == null) return;

  if (irc.me !== settings.nickname) {
    irc.nick(settings.nickname);
  }
}

function onCloseTab(tabElement: HTMLLIElement) {
  const name = tabElement.dataset["chatTarget"];
  if (name == null) return;

  const chatTab = channelChatTabs[name];
  if (chatTab != null) {
    if (irc != null) irc.part(name);
    delete channelChatTabs[name];
    settings.savedChatrooms.splice(settings.savedChatrooms.indexOf(name), 1);
    return;
  }

  const privateChatTab = privateChatTabs[name];
  if (privateChatTab != null) {
    delete privateChatTabs[name];
  }
}

function connect() {
  if (socket != null) return;

  statusChatTab.addInfo(`Connecting to ${ircNetwork.host}:${ircNetwork.port}...`);
  for (const name in channelChatTabs) channelChatTabs[name].addInfo("Connecting...");
  for (const name in privateChatTabs) privateChatTabs[name].addInfo("Connecting...");

  socket = tls.connect({ host: ircNetwork.host, port: ircNetwork.port, rejectUnauthorized: false }) as any as net.Socket;
  socket.on("error", onSocketError);

  irc = SlateIRC(socket);
  irc.on("welcome", onWelcome);
  irc.on("motd", onMOTD);
  irc.on("topic", onTopic);
  irc.on("join", onJoin);
  irc.on("part", onPart);
  irc.on("nick", onNick);
  irc.on("away", onAway);
  irc.on("quit", onQuit);
  irc.on("data", onData);
  irc.on("message", onMessage);
  irc.on("notice", onNotice);
  irc.on("disconnect", onDisconnect);

  irc.nick(settings.nickname);
  irc.user(settings.nickname, settings.nickname);
}

export function disconnect() { cleanUp(null); }

function onSocketError(err: Error) { cleanUp(err.message); }

function setupMentionRegex() {
  mentionRegex = new RegExp(`(.*\\s)?${irc.me}([^\\w]*)`, "g");
}

function onWelcome(name: string) {
  statusChatTab.addInfo(`Connected as ${irc.me}.`);
  setupMentionRegex();

  if (settings.presence === "away") {
    // TODO: Use this once https://github.com/slate/slate-irc/pull/38 is merged
    // irc.away("Away");
    irc.write(`AWAY :Away`);
  }

  for (const name in channelChatTabs) channelChatTabs[name].join();

  return;
}

function onMOTD(event: SlateIRC.MOTDEvent) {
  for (const line of event.motd) statusChatTab.addInfo(line);
}

export function send(target: string, message: string) {
  irc.send(target, message);

  let chatTab: ChatTab;

  if (target[0] === "#") {
    chatTab = channelChatTabs[target];
    if (chatTab == null) return false;
  } else {
    chatTab = privateChatTabs[target];
    if (chatTab == null) {
      chatTab = new ChatTab(target);
      privateChatTabs[target] = chatTab;
    }
  }

  chatTab.addMessage(irc.me, message, "me");
  return true;
}

export function join(channelName: string, focus?: boolean) {
  channelName = channelName.toLowerCase();
  let chatTab = channelChatTabs[channelName];
  if (chatTab == null) {
    chatTab = new ChatTab(channelName, { isChannel: true });
    channelChatTabs[chatTab.target] = chatTab;
    if (settings.savedChatrooms.indexOf(channelName) === -1) settings.savedChatrooms.push(channelName);
  }

  if (settings.presence === "offline") {
    settings.presence = "online";
    sidebarMe.updatePresenceFromSettings();
    connect();
  }

  settings.scheduleSave();

  chatTab.showTab(focus === true);
}

function onTopic(event: SlateIRC.TopicEvent) {
  const chatTab = channelChatTabs[event.channel];
  if (chatTab != null) chatTab.onTopic(event);
}

function onJoin(event: SlateIRC.JoinEvent) {
  const chatTab = channelChatTabs[event.channel];
  if (chatTab != null) chatTab.onJoin(event);
}

function onPart(event: SlateIRC.PartEvent) {
  for (const channel of event.channels) {
    const chatTab = channelChatTabs[channel];
    if (chatTab != null) chatTab.onPart(event);
  }
}

function onNick(event: SlateIRC.NickEvent) {
  if (irc.me === event.new) setupMentionRegex();

  for (const name in channelChatTabs) {
    const chatTab = channelChatTabs[name];
    if (chatTab.hasUser(event.nick)) chatTab.onNick(event);
  }

  const privateChatTab = privateChatTabs[event.nick];
  if (privateChatTab != null) {
    delete privateChatTabs[event.nick];
    privateChatTabs[event.new] = privateChatTab;
    privateChatTab.updateTarget(event.new);
  }
}

function onAway(event: SlateIRC.AwayEvent) {
  for (const name in channelChatTabs) {
    const chatTab = channelChatTabs[name];
    if (chatTab.hasUser(event.nick)) chatTab.onAway(event);
  }

  const privateChatTab = privateChatTabs[event.nick];
  if (privateChatTab != null) privateChatTab.onAway(event);
}

function onQuit(event: SlateIRC.QuitEvent) {
  for (const name in channelChatTabs) {
    const chatTab = channelChatTabs[name];
    if (chatTab.hasUser(event.nick)) chatTab.onQuit(event);
  }

  const privateChatTab = privateChatTabs[event.nick];
  if (privateChatTab != null) privateChatTab.onQuit(event);
}

const ignoredCommands = [
  "NICK", "PRIVMSG", "NOTICE",
  "JOIN", "PART", "QUIT",
  "PING"
];
function onData(event: SlateIRC.DataEvent) {
  if (ignoredCommands.indexOf(event.command) !== -1 || event.command.slice(0, 4) === "RPL_") {
    console.log(`Data: ${event.string}`);
    return;
  }

  statusChatTab.addInfo(`== ${event.string}`);
}

function onMessage(event: SlateIRC.MessageEvent) {
  if (event.to === irc.me) {
    let privateChatTab = privateChatTabs[event.from];
    if (privateChatTab == null) {
      privateChatTab = new ChatTab(event.from);
      privateChatTabs[event.from] = privateChatTab;
    }

    privateChatTab.addMessage(event.from, event.message, "private");
    notify(`Private message from ${event.from}`, event.message, () => { privateChatTab.showTab(true); });
  } else {
    const chatTab = channelChatTabs[event.to];
    if (chatTab == null) return;

    if (mentionRegex != null && mentionRegex.test(event.message)) {
      notify(`Mentioned by ${event.from} in ${event.to}`, event.message, () => { chatTab.showTab(true); });
    }

    chatTab.addMessage(event.from, event.message, null);
  }
}

function notify(title: string, body: string, callback: Function) {
  const notification = new (window as any).Notification(title, { icon: "/images/icon.png", body: body });
  const closeTimeoutId = setTimeout(() => { notification.close(); }, 5000);

  notification.addEventListener("click", () => {
    window.focus();
    clearTimeout(closeTimeoutId);
    notification.close();
    callback();
  });
}

function onNotice(event: SlateIRC.MessageEvent) {
  if (event.to === "*") {
    statusChatTab.addMessage(event.from, event.message, "private notice");
    return;
  }

  if (event.to === irc.me) {
    let privateChatTab = privateChatTabs[event.from];
    if (privateChatTab == null) {
      privateChatTab = new ChatTab(event.from);
      privateChatTabs[event.from] = privateChatTab;
    }

    privateChatTab.addMessage(event.from, event.message, "notice");
    notify(`Private notice from ${event.from}`, event.message, () => { privateChatTab.showTab(true); });
  } else {
    const chatTab = channelChatTabs[event.to];
    if (chatTab == null) return;

    if (mentionRegex != null && mentionRegex.test(event.message)) {
      notify(`Mentioned by ${event.from} in ${event.to}`, event.message, () => {
        chatTab.showTab(true);
      });
    }

    chatTab.addMessage(event.from, event.message, "notice");
  }
}

function onDisconnect() {
  cleanUp();
}

function cleanUp(reason?: string) {
  if (socket != null) {
    socket.destroy();
    socket = null;
  }
  irc = null;

  for (const name in channelChatTabs) channelChatTabs[name].onDisconnect(reason);
  statusChatTab.onDisconnect(reason);
}
