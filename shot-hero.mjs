import puppeteer from "puppeteer-core";
import { setTimeout as wait } from "node:timers/promises";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 0.6 });
await page.goto("http://localhost:5173/", { waitUntil: "networkidle2", timeout: 60000 });
await wait(3000);
await page.screenshot({ path: "C:\\Users\\PC\\AppData\\Local\\Temp\\opencode\\figma\\hero-stable.png" });
await browser.close();
console.log("saved");
