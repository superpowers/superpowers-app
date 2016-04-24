import * as ResizeHandle from "resize-handle";

new ResizeHandle(document.querySelector(".server-log") as HTMLDivElement, "bottom");

const settingsElt = document.querySelector(".server-settings") as HTMLDivElement;
const logTextarea = settingsElt.querySelector(".server-log textarea") as HTMLTextAreaElement;
const clearServerLogButton = settingsElt.querySelector(".server-log button.clear") as HTMLButtonElement;
clearServerLogButton.addEventListener("click", onClearLogButtonClick);

export function append(text: string) {
  logTextarea.value += text;
  setTimeout(() => { logTextarea.scrollTop = logTextarea.scrollHeight; }, 0);
}

function onClearLogButtonClick(event: MouseEvent) {
  event.preventDefault();

  logTextarea.value = "";
}
