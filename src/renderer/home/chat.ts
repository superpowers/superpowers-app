import * as net from "net";
import * as tls from "tls";
import * as SlateIRC from "slate-irc";
import * as TabStrip from "tab-strip";
import * as ResizeHandle from "resize-handle";
import * as TreeView from "dnd-tree-view";
import * as i18n from "../../shared/i18n";

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

const commandRegex = /^\/([^\s]*)(?:\s(.*))?$/;

class ChatTab {
  tabElt: HTMLLIElement;
  paneElt: HTMLDivElement;

  logElt: HTMLDivElement;
  textAreaElt: HTMLTextAreaElement;

  usersTreeView: TreeView;
  users: string[] = [];

  constructor(public target: string, join: boolean) {
    this.tabElt = document.createElement("li");
    this.tabElt.dataset["target"] = target;
    tabStrip.tabsRoot.appendChild(this.tabElt);

    const labelElt = document.createElement("div");
    this.tabElt.appendChild(labelElt);
    labelElt.className = "label";
    labelElt.textContent = target;

    this.paneElt = document.createElement("div");
    this.paneElt.hidden = true;
    panesElt.appendChild(this.paneElt);
    this.paneElt.appendChild(document.importNode(tabTemplate.content, true));
    new ResizeHandle(this.paneElt.querySelector(".sidebar") as HTMLDivElement, "right");

    this.logElt = this.paneElt.querySelector(".log") as HTMLDivElement;
    this.textAreaElt = this.paneElt.querySelector("textarea") as HTMLTextAreaElement;
    this.usersTreeView = new TreeView(this.paneElt.querySelector(".users-tree-view") as HTMLElement);

    this.textAreaElt.addEventListener("keypress", this.onTextAreaKeyPress);

    if (join) {
      this.addInfo(`Joining ${this.target}...`);
      irc.join(this.target);
    }
  }

  addInfo(text: string) {
    const elt = document.createElement("div");
    elt.className = "info";
    elt.textContent = text;
    this.logElt.appendChild(elt);
    this.logElt.scrollTop = 9e9;
  }

  addMessage(from: string, text: string) {
    const elt = document.createElement("div");
    elt.className = "message";

    const fromElt = document.createElement("span");
    fromElt.className = "from";
    fromElt.textContent = from;
    elt.appendChild(fromElt);

    const textElt = document.createElement("span");
    textElt.className = "text";
    textElt.textContent = text;
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
      this.addMessage(irc.me, msg);
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
        case "msg":
          const index = params.indexOf(" ");
          if (index === -1) {
            this.addInfo("Please enter a message.");
            return;
          }

          const target = params.slice(0, index);
          const message = params.slice(index + 1);
          irc.send(target, message);
          break;
        case "join":
          // TODO
          break;
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

  private onTextAreaKeyPress = (event: KeyboardEvent) => {
    if (event.keyCode === 13) {
      event.preventDefault();
      this.send(this.textAreaElt.value);
      this.textAreaElt.value = "";
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

const statusChatTab = new ChatTab("status", false);
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
  irc.on("join", onJoin);
  irc.on("part", onPart);
  irc.on("nick", onNick);
  irc.on("quit", onQuit);
  irc.on("data", onData);
  irc.on("message", onMessage);
  irc.on("disconnect", onDisconnect);

  // TODO: Read from settings and ask on first launch
  const myInitialNick = `sup${10000 + Math.floor(Math.random() * 89999)}`;
  irc.nick(myInitialNick);
  irc.user(myInitialNick, myInitialNick);
}

function disconnect() { cleanUp(null); }
function onSocketError(err: Error) { cleanUp(err.message); }

function onWelcome(name: string) {
  statusChatTab.addInfo(`Connected as ${irc.me}.`);

  let defaultChannelName = "#superpowers-html5";
  if (i18n.languageCode !== "en") defaultChannelName = `#superpowers-html5-${i18n.languageCode}`;
  join(defaultChannelName);

  return;
}

function join(channelName: string) {
  const chatTab = new ChatTab(channelName, true);
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

function onData(event: SlateIRC.DataEvent) {
  console.log(`Data: ${event.string}`);
}

function onMessage(event: SlateIRC.MessageEvent) {
  if (event.to === irc.me) {
    // TODO: Open private chat tab
    // addMessage(`(whisper) ${event.from}`, event.message);
  } else {
    const chatTab = channelChatTabs[event.to];
    if (chatTab != null) chatTab.addMessage(event.from, event.message);
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
