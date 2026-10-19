import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const profile = new URL("./profile/", import.meta.url).pathname;
const port = 9333;
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--window-size=1440,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let ws;
try {
  let list;
  for (let i = 0; i < 30; i += 1) {
    try {
      list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
      if (list?.[0]?.webSocketDebuggerUrl) break;
    } catch {
      await delay(200);
    }
  }
  ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      const timer = setTimeout(() => {
        pending.delete(msgId);
        reject(new Error(`timeout ${method}`));
      }, 5000);
      pending.set(msgId, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const go = async (url) => {
    await send("Page.navigate", { url });
    await delay(1200);
  };
  const text = async () => {
    const result = await send("Runtime.evaluate", {
      expression: "document.body.innerText",
      returnByValue: true,
    });
    return result.result?.result?.value || "";
  };
  const metrics = async () => {
    const result = await send("Runtime.evaluate", {
      expression: `(() => {
        const cards = [...document.querySelectorAll('.dash-panel,.dash-map-panel')];
        const shell = document.querySelector('.dash-shell');
        return JSON.stringify({
          shell: shell ? { h: shell.clientHeight, scroll: shell.scrollHeight, overflow: getComputedStyle(shell).overflow } : null,
          cards: cards.map((card) => ({
            cls: card.className,
            h: Math.round(card.getBoundingClientRect().height),
            top: Math.round(card.getBoundingClientRect().top),
            bottom: Math.round(card.getBoundingClientRect().bottom),
            overflow: getComputedStyle(card).overflow,
          })),
          pageScroll: document.documentElement.scrollHeight,
          viewport: window.innerHeight,
        });
      })()`,
      returnByValue: true,
    });
    return result.result?.result?.value;
  };

  await go("http://localhost:5173/#data");
  const dataText = await text();
  console.log("DATA TEXT:\n" + dataText.slice(0, 800));

  await go("http://localhost:5173/#dashboard");
  const dashText = await text();
  console.log("DASH TEXT:\n" + dashText.slice(0, 900));
  console.log("METRICS " + (await metrics()));

  const click = async (selector) => {
    const result = await send("Runtime.evaluate", {
      expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return 'missing'; el.click(); return 'clicked'; })()`,
      returnByValue: true,
    });
    return result.result?.result?.value;
  };

  const clickText = async (label) => {
    const result = await send("Runtime.evaluate", {
      expression: `(() => { const el = [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === ${JSON.stringify(label)}); if (!el) return 'missing'; el.click(); return 'clicked'; })()`,
      returnByValue: true,
    });
    return result.result?.result?.value;
  };
  console.log("CLEAR", await clickText("Clear"));
  await delay(300);
  console.log("MODAL\n" + (await text()).slice(0, 500));

  await go("http://localhost:5173/#maps");
  await delay(400);
  console.log("ADD", await click(".add-button"));
  await delay(300);
  console.log("DELETE", await click("button.delete"));
  await delay(300);
  const mapText = await text();
  console.log("MAP MODAL\n" + mapText.slice(0, 700));
} finally {
  ws?.close();
  chrome.kill();
}
