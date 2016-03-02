import * as net from "net";
import * as tls from "tls";
import * as SlateIRC from "slate-irc";
import * as TabStrip from "tab-strip";
import * as ResizeHandle from "resize-handle";
import * as TreeView from "dnd-tree-view";
import * as i18n from "../../shared/i18n";

/* tslint:disable */
const escapeHTML: (html: string) => string = require("escape-html");
/* tslint:enable */

const chatElt = document.querySelector(".home .chat");

const tabsBarElt = chatElt.querySelector(".tabs-bar") as HTMLElement;
const panesElt = chatElt.querySelector(".panes");
const tabStrip = new TabStrip(tabsBarElt);

tabStrip.on("activateTab", onTabActivate);
/*tabStrip.on("closeTab", onTabClose);
tabStrip.tabsRoot.addEventListener("click", onTabStripClick);*/

// TODO: Remove this when TypeScript supports HTMLTemplateElement
interface HTMLTemplateElement extends HTMLElement { content: Node; }
const tabTemplate = document.querySelector(".chat template") as HTMLTemplateElement;

let socket: net.Socket;
let irc: SlateIRC.Client;
const ircNetwork = { host: "irc.freenode.net", port: 6697 };
let mentionRegex: RegExp;

const commandRegex = /^\/([^\s]*)(?:\s(.*))?$/;

class ChatTab {
  tabElt: HTMLLIElement;
  paneElt: HTMLDivElement;

  logElt: HTMLDivElement;
  textAreaElt: HTMLTextAreaElement;
  previousMessage: string;

  usersTreeView: TreeView;
  users: string[] = [];

  constructor(public target: string, options?: { label?: string; isChannel?: boolean; }) {
    if (options == null) options = {};
    if (options.label == null) options.label = target;

    this.tabElt = document.createElement("li");
    this.tabElt.dataset["target"] = target;
    tabStrip.tabsRoot.appendChild(this.tabElt);

    const labelElt = document.createElement("div");
    this.tabElt.appendChild(labelElt);
    labelElt.className = "label";
    labelElt.textContent = options.label;

    this.paneElt = document.createElement("div");
    this.paneElt.hidden = true;
    panesElt.appendChild(this.paneElt);
    this.paneElt.appendChild(document.importNode(tabTemplate.content, true));

    this.logElt = this.paneElt.querySelector(".log") as HTMLDivElement;
    this.textAreaElt = this.paneElt.querySelector("textarea") as HTMLTextAreaElement;

    this.textAreaElt.addEventListener("keydown", this.onTextAreaKeyDown);
    this.textAreaElt.addEventListener("keypress", this.onTextAreaKeyPress);

    const sidebarElt = this.paneElt.querySelector(".sidebar") as HTMLDivElement;

    if (options.isChannel) {
      this.addInfo(`Joining ${this.target}...`);
      irc.join(this.target);

      /* tslint:disable:no-unused-expression */
      new ResizeHandle(sidebarElt, "right");
      /* tslint:enable:no-unused-expression */
      this.usersTreeView = new TreeView(this.paneElt.querySelector(".users-tree-view") as HTMLElement);
    } else {
      sidebarElt.parentElement.removeChild(sidebarElt.previousElementSibling); // resize handle
      sidebarElt.parentElement.removeChild(sidebarElt);
    }
  }

  private linkify(text: string) {
    text = escapeHTML(text);

    const channelRegex = /^(.*\s)?#([#A-Za-z0-9_-]+)/g;
    text = text.replace(channelRegex, "$1<a href=\"#\">#$2</a>");

    const linkRegex = /^(.*\s)?(http|https):\/\/([^\s]+)/g;
    text = text.replace(linkRegex, "$1<a href=\"$2://$3\">$2://$3</a>");

    return text;
  }

  addInfo(text: string) {
    const elt = document.createElement("div");
    elt.className = "info";
    elt.innerHTML = this.linkify(text);

    this.logElt.appendChild(elt);
    this.logElt.scrollTop = 9e9;
  }

  addMessage(from: string, text: string, style: string) {
    const elt = document.createElement("div");
    elt.className = "message";
    if (style != null) elt.classList.add(style);

    const fromElt = document.createElement("span");
    fromElt.className = "from";
    fromElt.textContent = `${from}: `;
    elt.appendChild(fromElt);

    const textElt = document.createElement("span");
    textElt.className = "text";
    textElt.innerHTML = this.linkify(text);
    elt.appendChild(textElt);

    this.logElt.appendChild(elt);
    this.logElt.scrollTop = 9e9;
  }

  hasUser(name: string) {
    return this.users.indexOf(name) !== -1;
  }

  addUserToList(name: string) {
    if (this.usersTreeView.treeRoot.querySelector(`li[data-nickname="${name}"]`) != null) return;

    const userElt = document.createElement("li");
    userElt.dataset["nickname"] = name;

    const nicknameElt = document.createElement("div");
    nicknameElt.className = "nickname";
    nicknameElt.textContent = name;
    userElt.appendChild(nicknameElt);

    this.usersTreeView.append(userElt, "item");
  }

  removeUserFromList(name: string) {
    const userElt = this.usersTreeView.treeRoot.querySelector(`li[data-nickname="${name}"]`) as HTMLLIElement;
    if (userElt == null) return;

    this.usersTreeView.remove(userElt);
  }

  send(msg: string) {
    const result = commandRegex.exec(msg);
    if (result != null) {
      this.handleCommand(result[1].toLocaleLowerCase(), result[2]);
      return;
    }

    if (irc == null) {
      this.addInfo("You are not connected.");
    } else {
      irc.send(this.target, msg);
      this.addMessage(irc.me, msg, "me");
    }
  }

  handleCommand(command: string, params: string) {
    switch (command) {
      case "disconnect": disconnect(); return;
      case "connect": connect(); return;
    }

    if (irc != null) {
      switch (command) {
        case "nick":
          irc.nick(params);
          break;
        case "msg": {
          const index = params.indexOf(" ");
          if (index === -1) {
            this.addInfo("/msg: Please enter a message.");
            return;
          }

          const target = params.slice(0, index);
          const message = params.slice(index + 1);
          irc.send(target, message);
        } break;
        case "join": {
          if (params.length === 0 || params[0] !== "#" || params.indexOf(" ") !== -1) {
            this.addInfo("/join: Please enter a channel name.");
            return;
          }

          join(params);
        } break;
        default:
          this.addInfo(`Unsupported command: ${command}`);
      }
    } else {
      this.addInfo("You are not connected.");
    }
  }

  onDisconnect(reason: string) {
    this.addInfo(reason != null ? `Disconnected: ${reason}.` : "Disconnected.");
    this.usersTreeView.clearSelection();
    this.usersTreeView.treeRoot.innerHTML = "";
    this.users.length = 0;
  }

  onJoin(event: SlateIRC.JoinEvent) {
    this.addInfo(`${event.nick} has joined ${event.channel}.`);
    this.users.push(event.nick);

    if (event.nick === irc.me) {
      // this.hasJoinedChannel = true;
      irc.names(this.target, this.onChannelNamesReceived);
    } else this.addUserToList(event.nick);
  }

  onPart(event: SlateIRC.PartEvent) {
    this.addInfo(`${event.nick} has parted ${event.channels[0]}.`);
    this.removeUserFromList(event.nick);
    this.users.splice(this.users.indexOf(event.nick), 1);
  }

  onNick(event: SlateIRC.NickEvent) {
    this.addInfo(`${event.nick} has changed nick to ${event.new}.`);
    this.removeUserFromList(event.nick);
    this.addUserToList(event.new);
  }

  onQuit(event: SlateIRC.QuitEvent) {
    this.addInfo(`${event.nick} has quit (${event.message}).`);
    this.removeUserFromList(event.nick);
  }

  private onTextAreaKeyDown = (event: KeyboardEvent) => {
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

    if (event.keyCode === 38 /* Up */) {
      if (this.previousMessage == null) return;
      if (this.textAreaElt.value.length > 0) return;
      this.textAreaElt.value = this.previousMessage;
      event.preventDefault();
    }
  };

  private onTextAreaKeyPress = (event: KeyboardEvent) => {
    if (event.keyCode === 13) {
      event.preventDefault();

      if (this.textAreaElt.value.length > 0) {
        this.send(this.textAreaElt.value);
        this.previousMessage = this.textAreaElt.value;
        this.textAreaElt.value = "";
      }
    }
  };

  private onChannelNamesReceived = (error: Error, names: { name: string; mode: string; }[]) => {
    if (error != null) {
      this.addInfo(`Channel names error: ${error.message}`);
      return;
    }

    this.usersTreeView.treeRoot.innerHTML = "";
    names.sort((a, b) => a.name.localeCompare(b.name));
    for (const name of names) this.addUserToList(name.name);
  };
}

const statusChatTab = new ChatTab("status", { label: ircNetwork.host });
statusChatTab.tabElt.classList.add("active");
statusChatTab.paneElt.hidden = false;

const channelChatTabs: { [name: string]: ChatTab } = {};
// const privateChatTabs: { [name: string]: ChatTab } = {};

let activeChatTab: ChatTab = statusChatTab;

function onTabActivate(tabElt: HTMLLIElement) {
  clearActiveTab();

  tabElt.classList.add("active");
  const target = tabElt.dataset["target"];

  if (target === "status") {
    activeChatTab = statusChatTab;
  } else {
    activeChatTab = channelChatTabs[target];
  }

  activeChatTab.paneElt.hidden = false;
}

function clearActiveTab() {
  activeChatTab.tabElt.classList.remove("active");
  activeChatTab.paneElt.hidden = true;
  activeChatTab = null;
}

export function start() {
  statusChatTab.addInfo(`Type /connect to join chat.`);
  // connect();
}

function connect() {
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

function disconnect() { cleanUp(null); }
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

function join(channelName: string) {
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
      onTabActivate(statusChatTab.tabElt);
    });
  } else {
    const chatTab = channelChatTabs[event.to];
    if (chatTab == null) return;

    if (mentionRegex != null && mentionRegex.test(event.message)) {
      notify(`Mentioned by ${event.from} in ${event.to}`, event.message, () => {
        onTabActivate(chatTab.tabElt);
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
      onTabActivate(statusChatTab.tabElt);
    });
  } else {
    const chatTab = channelChatTabs[event.to];
    if (chatTab == null) return;

    if (mentionRegex != null && mentionRegex.test(event.message)) {
      notify(`Mentioned by ${event.from} in ${event.to}`, event.message, () => {
        onTabActivate(chatTab.tabElt);
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
