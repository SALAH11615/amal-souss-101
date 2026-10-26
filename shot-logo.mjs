import puppeteer from "puppeteer-core";
import { setTimeout as wait } from "node:timers/promises";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto("http://localhost:5173/", { waitUntil: "networkidle2", timeout: 60000 });
await wait(1200);
// navbar (RTL → logo is at right side)
await page.screenshot({ path: "C:\\Users\\PC\\AppData\\Local\\Temp\\opencode\\figma\\nav-logo.png", clip: { x: 990, y: 0, width: 450, height: 90 } });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await wait(1500);
await page.screenshot({ path: "C:\\Users\\PC\\AppData\\Local\\Temp\\opencode\\figma\\footer-logo.png", clip: { x: 990, y: 620, width: 450, height: 200 } });
await browser.close();
console.log("done");
