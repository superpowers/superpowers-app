export interface FetchError extends Error {
  status: number;
}

export default function fetch(url: string, options: { type: XMLHttpRequestResponseType; httpAuth?: { username: string; password: string; } }, callback: (err: FetchError, data?: any) => any) {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  if (options.httpAuth != null) xhr.setRequestHeader("Authorization", "Basic " + window.btoa(`${options.httpAuth.username}:${options.httpAuth.password}`));
  xhr.responseType = options.type;

  xhr.onload = (event) => {
    if (xhr.status !== 200 && xhr.status !== 0) {
      const error = new Error(`HTTP ${xhr.status}: ${xhr.statusText}`) as FetchError;
      error.status = xhr.status;
      callback(error);
      return;
    }

    callback(null, xhr.response);
  };

  xhr.onerror = (event) => {
    console.log(event);
    const error = new Error(`HTTP ${xhr.status}: ${xhr.statusText}`) as FetchError;
    error.status = xhr.status;
    callback(error);
  };

  xhr.send();
}
