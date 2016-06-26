import * as SlateIRC from "slate-irc";
import * as ResizeHandle from "resize-handle";
import * as TreeView from "dnd-tree-view";
import { tabStrip, panesElt } from "../tabs";
import * as chat from "./index";
import * as tabs from  "../tabs";

import * as escapeHTML from "escape-html";

const tabTemplate = document.querySelector("template.chat-tab") as HTMLTemplateElement;
const commandRegex = /^\/([^\s]*)(?:\s(.*))?$/;

export default class ChatTab {
  tabElt: HTMLLIElement;
  paneElt: HTMLDivElement;
  private label: string;

  logElt: HTMLDivElement;
  textAreaElt: HTMLTextAreaElement;
  previousMessage: string;

  usersTreeView: TreeView;
  users: string[] = [];

  constructor(public target: string, options?: { label?: string; isChannel?: boolean; showTab?: boolean; }) {
    if (options == null) options = {};
    this.label = (options.label != null) ? options.label : target;
    if (options.showTab !== false) this.showTab(false);

    this.paneElt = document.createElement("div");
    this.paneElt.hidden = true;
    this.paneElt.dataset["name"] = `chat-${target}`;
    this.paneElt.className = "chat-tab";
    panesElt.appendChild(this.paneElt);
    this.paneElt.appendChild(document.importNode(tabTemplate.content, true));

    this.logElt = this.paneElt.querySelector(".log") as HTMLDivElement;
    this.textAreaElt = this.paneElt.querySelector("textarea") as HTMLTextAreaElement;

    this.textAreaElt.addEventListener("keydown", this.onTextAreaKeyDown);
    this.textAreaElt.addEventListener("keypress", this.onTextAreaKeyPress);

    const sidebarElt = this.paneElt.querySelector(".sidebar") as HTMLDivElement;

    if (options.isChannel) {
      new ResizeHandle(sidebarElt, "right");
      this.usersTreeView = new TreeView(this.paneElt.querySelector(".users-tree-view") as HTMLElement);

      if (chat.irc != null && chat.irc.me != null) this.join();
    } else {
      sidebarElt.parentElement.removeChild(sidebarElt.previousElementSibling); // Resize handle
      sidebarElt.parentElement.removeChild(sidebarElt);
    }
  }

  updateTarget(target: string) {
    this.target = target;
    this.paneElt.dataset["name"] = `chat-${target}`;

    this.label = target;

    if (this.tabElt != null) {
      this.tabElt.dataset["name"] = `chat-${this.target}`;
      this.tabElt.dataset["chatTarget"] = this.target;
      this.tabElt.querySelector(".label").textContent = this.label;
    }
  }

  showTab(focus: boolean) {
    if (this.tabElt == null) {
      this.tabElt = document.createElement("li");
      this.tabElt.dataset["name"] = `chat-${this.target}`;
      this.tabElt.dataset["chatTarget"] = this.target;

      const iconElt = document.createElement("img");
      iconElt.className = "icon";
      iconElt.src = "images/tabs/chat.svg";
      this.tabElt.appendChild(iconElt);

      const labelElt = document.createElement("div");
      this.tabElt.appendChild(labelElt);
      labelElt.className = "label";
      labelElt.textContent = this.label;

      const closeButton = document.createElement("button");
      closeButton.className = "close";
      this.tabElt.appendChild(closeButton);
    }

    if (this.tabElt.parentElement == null) tabStrip.tabsRoot.appendChild(this.tabElt);
    if (focus) tabs.onActivateTab(this.tabElt);
  }

  join() {
    this.addInfo(`Joining ${this.target}...`);
    chat.irc.join(this.target);
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

  private addUser(name: string) {
    if (this.users.indexOf(name) !== -1) return;
    this.users.push(name);

    const userElt = document.createElement("li");
    userElt.dataset["nickname"] = name;

    const nicknameElt = document.createElement("div");
    nicknameElt.className = "nickname";
    nicknameElt.textContent = name;
    userElt.appendChild(nicknameElt);

    this.usersTreeView.append(userElt, "item");
  }

  private removeUser(name: string) {
    if (this.users.indexOf(name) === -1) return;
    this.users.splice(this.users.indexOf(name), 1);

    const userElt = this.usersTreeView.treeRoot.querySelector(`li[data-nickname="${name}"]`) as HTMLLIElement;
    this.usersTreeView.remove(userElt);
  }

  send(message: string) {
    const result = commandRegex.exec(message);
    if (result != null) {
      this.handleCommand(result[1].toLocaleLowerCase(), result[2]);
      return;
    }

    if (chat.irc == null) this.addInfo("You are not connected.");
    else chat.send(this.target, message);
  }

  handleCommand(command: string, params: string) {
    if (chat.irc != null) {
      switch (command) {
        case "nick":
          chat.irc.nick(params);
          break;
        case "msg": {
          const index = params.indexOf(" ");
          if (index === -1) {
            this.addInfo("/msg: Please enter a message.");
            return;
          }

          const target = params.slice(0, index);
          const message = params.slice(index + 1);
          if (!chat.send(target, message)) {
            this.addInfo(`/msg: Can't send message to ${target}.`);
            return;
          }
        } break;
        case "join": {
          if (params.length === 0 || params[0] !== "#" || params.indexOf(" ") !== -1) {
            this.addInfo("/join: Please enter a channel name.");
            return;
          }

          chat.join(params);
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

    if (this.usersTreeView != null) {
      this.usersTreeView.clearSelection();
      this.usersTreeView.treeRoot.innerHTML = "";
      this.users.length = 0;
    }
  }

  onJoin(event: SlateIRC.JoinEvent) {
    this.addInfo(`${event.nick} has joined ${event.channel}.`);

    if (event.nick === chat.irc.me) {
      // this.hasJoinedChannel = true;
      chat.irc.names(this.target, this.onChannelNamesReceived);
    } else {
      this.addUser(event.nick);
    }
  }

  onPart(event: SlateIRC.PartEvent) {
    this.addInfo(`${event.nick} has parted ${event.channels[0]}.`);
    this.removeUser(event.nick);
  }

  onNick(event: SlateIRC.NickEvent) {
    this.addInfo(`${event.nick} has changed nick to ${event.new}.`);

    this.removeUser(event.nick);
    this.addUser(event.new);
  }

  onAway(event: SlateIRC.AwayEvent) {
    if (event.message.length > 0) this.addInfo(`${event.nick} is now away: ${event.message}.`);
    else this.addInfo(`${event.nick} is now back: ${event.message}.`);
  }

  onQuit(event: SlateIRC.QuitEvent) {
    this.addInfo(`${event.nick} has quit (${event.message}).`);
    this.removeUser(event.nick);
  }

  private onTextAreaKeyDown = (event: KeyboardEvent) => {
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

    if (event.keyCode === 38 /* Up */) {
      if (this.previousMessage == null) return;
      if (this.textAreaElt.value.length > 0) return;
      event.preventDefault();
      this.textAreaElt.value = this.previousMessage;
    } else if(event.keyCode === 9 /* Tab */) {
      event.preventDefault();
      this.doNicknameAutocomplete();
    }
  };

  private doNicknameAutocomplete() {
    const stubStartIndex = this.textAreaElt.value.lastIndexOf(" ", this.textAreaElt.selectionStart - 1) + 1;
    const stubEndIndex =  this.textAreaElt.selectionStart;
    const stub = this.textAreaElt.value.slice(stubStartIndex, stubEndIndex).toLowerCase();
    if (stub.length === 0) return;

    const matches: string[] = [];
    for (const user of this.users) {
      if (user.toLowerCase().indexOf(stub) === 0) matches.push(user);
    }

    if (matches.length === 1) {
      this.textAreaElt.value = `${this.textAreaElt.value.slice(0, stubStartIndex)}${matches[0]} `;
    } else if (matches.length > 1) {
      this.addInfo(`Matching users: ${matches.join(", ")}.`);
    }
  }

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

    this.users.length = 0;
    this.usersTreeView.treeRoot.innerHTML = "";
    names.sort((a, b) => a.name.localeCompare(b.name));
    for (const name of names) this.addUser(name.name);
  };
}
