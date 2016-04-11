import * as news from "./news";
import * as chat from "../chat";

const chatrooms = document.querySelector(".home .sidebar .chatrooms") as HTMLDivElement;
chatrooms.addEventListener("click", onChatroomClick);

export function start() {
  news.start();
}

function onChatroomClick(event: MouseEvent) {
  const target = event.target as HTMLAnchorElement;
  if (target.tagName !== "A") return;

  event.preventDefault();
  chat.join(target.dataset["channel"], true);
}
