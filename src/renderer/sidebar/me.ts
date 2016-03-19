import * as chat from "../chat";

const container = document.querySelector("body > .sidebar .me");
const showChatStatusButton = container.querySelector(".show-chat-status") as HTMLButtonElement;

showChatStatusButton.addEventListener("click", (event) => {
  event.preventDefault();

  chat.showStatus();
});
