import * as updateManager from "./updateManager";

const loadingElt = document.querySelector(".loading") as HTMLDivElement;
const appVersionElt = loadingElt.querySelector(".version") as HTMLDivElement;
appVersionElt.textContent = updateManager.appVersion;

const splashElt = loadingElt.querySelector(".splash") as HTMLImageElement;
const statusElt = loadingElt.querySelector(".status") as HTMLDivElement;
const progressElt = loadingElt.querySelector(".progress") as HTMLDivElement;
const progressBarElt = progressElt.querySelector("progress") as HTMLProgressElement;
splashElt.hidden = false;

let onAppReady: Function;

let splashInAnim = (splashElt as any).animate([
  { opacity: "0", transform: "translateY(-50vh)" },
  { opacity: "1", transform: "translateY(0)" }
], { duration: 500, easing: "ease-out" });

splashInAnim.addEventListener("finish", () => {
  splashInAnim = null;
  if (onAppReady != null) onAppReady();
});

export function setStatus(text: string) {
  statusElt.textContent = text;
}

export function setProgressVisible(visible: boolean) {
  progressElt.hidden = !visible;
}

export function setProgressValue(value: number) {
  progressBarElt.value = value;
}

export function setProgressMax(max: number) {
  progressBarElt.max = max;
}

let fadeOutCallback: Function;
export function fadeOut(callback: Function) {
  fadeOutCallback = callback;

  if (splashInAnim != null) onAppReady = playOutAnimation;
  else playOutAnimation();
}

function playOutAnimation() {
  const statusOutAnim = (statusElt as any).animate([ { opacity: "1" }, { opacity: "0" } ], { duration: 300, easing: "ease-in" });
  statusOutAnim.addEventListener("finish", () => {
    statusElt.style.opacity = "0";

    const loadingOutAnim = (loadingElt as any).animate([
      { opacity: "1" },
      { opacity: "0" }
    ], { duration: 300, easing: "ease-in" });

    /* const splashOutAnim = */ (splashElt as any).animate([
      { transform: "scale(1, 1)" },
      { transform: "scale(5, 5)" }
    ], { duration: 300, easing: "ease-in" });

    loadingOutAnim.addEventListener("finish", () => {
      loadingElt.parentElement.removeChild(loadingElt);
      fadeOutCallback();
    });
  });
}
