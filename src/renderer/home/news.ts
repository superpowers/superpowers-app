import fetch from "../../shared/fetch";
import * as i18n from "../../shared/i18n";

export function start() {
  let languageCode = i18n.languageCode;

  function fetchNews(callback: (err: Error, data: any) => void) {
    fetch(`http://superpowers-html5.com/news.${languageCode}.html`, { type: "text" }, callback);
  }

  fetchNews((err, data) => {
    if (data != null) { setupNews(data); return; }

    if (languageCode.indexOf("-") !== -1) languageCode = languageCode.split("-")[0];
    else languageCode = "en";

    fetchNews((err, data) => {
      languageCode = "en";
      fetchNews((err, data) => {
        setupNews(data);
      });
    });
  });
}

function setupNews(html: string) {
  const newsElt = document.querySelector(".home .news") as HTMLDivElement;

  if (html == null) newsElt.textContent = i18n.t("home:news.couldNotFetch");
  else newsElt.innerHTML = html;
}
