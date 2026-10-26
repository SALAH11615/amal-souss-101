import puppeteer from "puppeteer-core";
import { setTimeout as wait } from "node:timers/promises";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUT = process.argv[2] || "home-shot.png";
const WIDTH = Number(process.argv[3] || 1440);

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: WIDTH, height: 1000, deviceScaleFactor: 0.5 });
await page.goto("http://localhost:5173/", { waitUntil: "networkidle2", timeout: 60000 });
await wait(1500);
await page.evaluate(async () => {
  const step = Math.round(window.innerHeight * 0.8);
  for (let y = 0; y <= document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 250));
  }
  window.scrollTo(0, 0);
});
await wait(1200);
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log("saved", OUT);
