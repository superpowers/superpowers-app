import * as net from "net";
import * as tls from "tls";
import * as SlateIRC from "slate-irc";
import * as ResizeHandle from "resize-handle";
import * as TreeView from "dnd-tree-view";
import * as i18n from "../../shared/i18n";

new ResizeHandle(document.querySelector(".chat .sidebar") as HTMLDivElement, "right");

const logElt = document.querySelector(".chat .log") as HTMLDivElement;
const textAreaElt = document.querySelector(".chat textarea") as HTMLTextAreaElement;
const usersTreeView = new TreeView(document.querySelector(".chat .users-tree-view") as HTMLElement);

let socket: net.Socket;
let irc: SlateIRC.Client;
const ircNetwork = { host: "irc.freenode.net", port: 6697 };
let channelName = "#superpowers-html5";
let hasJoinedChannel = false;

export function start() {
  // connect();
  addInfo(`Type /connect to join chat.`);
}

function connect() {
  if (socket != null) return;

  addInfo(`Connecting to ${ircNetwork.host}:${ircNetwork.port}...`);

  // TODO: Support multiple channels
  if (i18n.languageCode !== "en") channelName = `#superpowers-html5-${i18n.languageCode}`;

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

  const myInitialNick = `sup${10000 + Math.floor(Math.random() * 89999)}`;
  irc.nick(myInitialNick);
  irc.user(myInitialNick, myInitialNick);
}

function disconnect() {
  addInfo(`Disconnected.`);
  cleanUp();
}

function onSocketError(err: Error) {
  addInfo(`Disconnected. Error: ${err.message}`);
  cleanUp();
}

function onWelcome(name: string) {
  addInfo(`Connected as ${irc.me}.`);

  addInfo(`Joining ${channelName}...`);
  irc.join(channelName);
  return;
}

function onJoin(event: SlateIRC.JoinEvent) {
  if (event.channel !== channelName) return;

  addInfo(`${event.nick} has joined ${event.channel}.`);
  if (event.nick === irc.me) {
    hasJoinedChannel = true;
    irc.names(channelName, onChannelNamesReceived);
  } else addUserToList(event.nick);
}

function onPart(event: SlateIRC.PartEvent) {
  addInfo(`${event.nick} has parted ${event.channels[0]}.`);
  removeUserFromList(event.nick);
}

function onNick(event: SlateIRC.NickEvent) {
  addInfo(`${event.nick} has changed nick to ${event.new}.`);
  removeUserFromList(event.nick);
  addUserToList(event.new);
}

function onQuit(event: SlateIRC.QuitEvent) {
  addInfo(`${event.nick} has quit (${event.message}).`);
  removeUserFromList(event.nick);
}

function onData(event: SlateIRC.DataEvent) {
  console.log(`Data: ${event.string}`);
}

function onMessage(event: SlateIRC.MessageEvent) {
  if (event.to === irc.me) {
    addMessage(`(whisper) ${event.from}`, event.message);
  } else if (event.to === channelName) {
    addMessage(event.from, event.message);
  }
}

function onDisconnect() {
  addInfo("Disconnected.");
  cleanUp();
}

function cleanUp() {
  if (socket != null) {
    socket.destroy();
    socket = null;
  }
  irc = null;
  hasJoinedChannel = false;

  usersTreeView.clearSelection();
  usersTreeView.treeRoot.innerHTML = "";
}

function addUserToList(name: string) {
  if (usersTreeView.treeRoot.querySelector(`li[data-nickname="${name}"]`) != null) return;

  const userElt = document.createElement("li");
  userElt.dataset["nickname"] = name;

  const nicknameElt = document.createElement("div");
  nicknameElt.className = "nickname";
  nicknameElt.textContent = name;
  userElt.appendChild(nicknameElt);

  usersTreeView.append(userElt, "item");
}

function removeUserFromList(name: string) {
  const userElt = usersTreeView.treeRoot.querySelector(`li[data-nickname="${name}"]`) as HTMLLIElement;
  if (userElt == null) return;

  usersTreeView.remove(userElt);
}

function onChannelNamesReceived(error: Error, names: { name: string; mode: string; }[]) {
  if (error != null) {
    addInfo(`Channel names error: ${error.message}`);
    return;
  }

  usersTreeView.treeRoot.innerHTML = "";
  names.sort((a, b) => a.name.localeCompare(b.name));
  for (const name of names) addUserToList(name.name);
}

textAreaElt.addEventListener("keypress", onTextAreaKeyPress);

function onTextAreaKeyPress(event: KeyboardEvent) {
  if (event.keyCode === 13) {
    event.preventDefault();
    send(textAreaElt.value);
    textAreaElt.value = "";
  }
}

const commandRegex = /^\/([^\s]*)(?:\s(.*))?$/;
function send(msg: string) {
  const result = commandRegex.exec(msg);
  if (result != null) {
    handleCommand(result[1].toLocaleLowerCase(), result[2]);
    return;
  }

  if (irc == null) {
    addInfo("You are not connected.");
  } else if (!hasJoinedChannel) {
    addInfo("You have not yet joined a channel.");
  } else {
    irc.send(channelName, msg);
    addMessage(irc.me, msg);
  }
}

function handleCommand(command: string, params: string) {
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
        const [ target, message ] = params.split(" ", 2);
        irc.send(target, message);
        break;
      default:
        addInfo(`Unsupported command: ${command}`);
    }
  } else {
    addInfo("You are not connected.");
  }
}

function addInfo(text: string) {
  const elt = document.createElement("div");
  elt.className = "info";
  elt.textContent = text;
  logElt.appendChild(elt);
  logElt.scrollTop = 9e9;
}

function addMessage(from: string, text: string) {
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

  logElt.appendChild(elt);
  logElt.scrollTop = 9e9;
}
