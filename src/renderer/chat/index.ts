import * as net from "net";
import * as tls from "tls";
import * as SlateIRC from "slate-irc";
import * as i18n from "../../shared/i18n";
import * as tabs from "../tabs";
import ChatTab from "./ChatTab";

export let irc: SlateIRC.Client;
let socket: net.Socket;
const ircNetwork = { host: "irc.freenode.net", port: 6697 };
let mentionRegex: RegExp;

const statusChatTab = new ChatTab("status", { label: ircNetwork.host });
const channelChatTabs: { [name: string]: ChatTab } = {};
// const privateChatTabs: { [name: string]: ChatTab } = {};

export function start() {
  statusChatTab.addInfo(`Type /connect to join chat.`);
  // connect();
}

export function connect() {
  if (socket != null) return;

  statusChatTab.addInfo(`Connecting to ${ircNetwork.host}:${ircNetwork.port}...`);

  socket = tls.connect({ host: ircNetwork.host, port: ircNetwork.port, rejectUnauthorized: false }) as any as net.Socket;
  socket.on("error", onSocketError);

  irc = SlateIRC(socket);
  irc.on("welcome", onWelcome);
  irc.on("motd", onMOTD);
  irc.on("join", onJoin);
  irc.on("part", onPart);
  irc.on("nick", onNick);
  irc.on("quit", onQuit);
  irc.on("data", onData);
  irc.on("message", onMessage);
  irc.on("notice", onNotice);
  irc.on("disconnect", onDisconnect);

  // TODO: Read from settings and ask on first launch
  const myInitialNick = `sup${10000 + Math.floor(Math.random() * 89999)}`;
  irc.nick(myInitialNick);
  irc.user(myInitialNick, myInitialNick);
}

export function disconnect() { cleanUp(null); }

function onSocketError(err: Error) { cleanUp(err.message); }

function setupMentionRegex() {
  mentionRegex = new RegExp(`(.*\\s)?${irc.me}([^\\w]*)`, "g");
}

function onWelcome(name: string) {
  statusChatTab.addInfo(`Connected as ${irc.me}.`);
  setupMentionRegex();

  let defaultChannelName = "#superpowers-html5";
  if (i18n.languageCode !== "en") defaultChannelName = `#superpowers-html5-${i18n.languageCode}`;
  join(defaultChannelName);

  return;
}

function onMOTD(event: SlateIRC.MOTDEvent) {
  for (const line of event.motd) statusChatTab.addInfo(line);
}

export function join(channelName: string) {
  const chatTab = new ChatTab(channelName, { isChannel: true });
  channelChatTabs[chatTab.target] = chatTab;
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
}

function onQuit(event: SlateIRC.QuitEvent) {
  for (const name in channelChatTabs) {
    const chatTab = channelChatTabs[name];
    if (chatTab.hasUser(event.nick)) chatTab.onQuit(event);
  }
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
    // TODO: Open private chat tab
    statusChatTab.addMessage(`(private) ${event.from}`, event.message, "private");
    notify(`Private message from ${event.from}`, event.message, () => {
      tabs.onTabActivate(statusChatTab.tabElt);
    });
  } else {
    const chatTab = channelChatTabs[event.to];
    if (chatTab == null) return;

    if (mentionRegex != null && mentionRegex.test(event.message)) {
      notify(`Mentioned by ${event.from} in ${event.to}`, event.message, () => {
        tabs.onTabActivate(chatTab.tabElt);
      });
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
  if (event.to === irc.me || event.to === "*") {
    // TODO: Open private chat tab
    statusChatTab.addMessage(`(private) ${event.from}`, event.message, "notice");
    notify(`Private notice from ${event.from}`, event.message, () => {
      tabs.onTabActivate(statusChatTab.tabElt);
    });
  } else {
    const chatTab = channelChatTabs[event.to];
    if (chatTab == null) return;

    if (mentionRegex != null && mentionRegex.test(event.message)) {
      notify(`Mentioned by ${event.from} in ${event.to}`, event.message, () => {
        tabs.onTabActivate(chatTab.tabElt);
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
}
