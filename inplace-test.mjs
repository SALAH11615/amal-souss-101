/* E2E: on-page text editing (admin logged in -> pill toggle -> click headline -> save -> verify -> reset) */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = "http://localhost:4299";

async function main() {
  await rm("data", { recursive: true, force: true });
  const server = spawn("node", ["server.mjs"], { cwd: process.cwd(), env: { ...process.env, PORT: "4299" } });
  server.unref();
  await wait(1200);

  let failed = false;
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // login
    await page.goto(`${URL}/admin`, { waitUntil: "networkidle2" });
    await page.type('input[type="password"]', "admin123");
    await page.click('button[type="submit"]');
    await wait(1000);

    // back to home with admin session
    await page.goto(`${URL}/`, { waitUntil: "networkidle2" });
    await wait(1500);

    // 1) pill toggle appears and activates editing mode
    const pillClicked = await page.evaluate(() => {
      const pill = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Edit text on this page"));
      if (!pill) return false;
      pill.click();
      return true;
    });
    await wait(2500);
    const marked = await page.evaluate(() => document.querySelectorAll(".as-edit-target").length);
    console.log(`PILL TOGGLE: ${pillClicked ? "OK" : "FAIL"} | EDITABLE TEXTS MARKED: ${marked > 40 ? "OK" : "FAIL"} (${marked})`);

    // 2) click the hero headline -> popover opens
    const headlineOld = await page.evaluate(() => document.querySelector("h1")?.textContent.trim());
    await page.evaluate(() => {
      const h1 = document.querySelector("h1.as-edit-target") || document.querySelector("h1");
      const r = h1.getBoundingClientRect();
      const ev = new MouseEvent("click", { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
      h1.dispatchEvent(ev);
    });
    await wait(600);
    const popoverOpen = await page.evaluate(() => !!document.querySelector("textarea")?.closest("div[class*='z-[9999]'], div.fixed"));
    console.log(`POPOVER OPENS ON CLICK: ${popoverOpen ? "OK" : "FAIL"}`);

    // 3) edit + save
    const newHeadline = "EDIT ON PAGE " + Date.now();
    await page.evaluate((t) => {
      const ta = [...document.querySelectorAll("div.fixed textarea")].pop();
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(ta, t);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }, newHeadline);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Save (Ctrl"));
      btn.click();
    });
    await wait(2500); // auto reload
    const applied = await page.evaluate((t) => document.body.innerText.includes(t), newHeadline);
    const savedFile = await page.evaluate(() => fetch("/api/content/ar").then((r) => r.status));
    console.log(`EDIT APPLIED ON SITE: ${applied ? "OK" : "FAIL"} | OVERRIDE SAVED (${savedFile}): ${savedFile === 200 ? "OK" : "FAIL"}`);

    // 4) done -> editing mode off
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Done"));
      if (btn) btn.click();
    });
    await wait(500);
    const cleared = await page.evaluate(() => document.querySelectorAll(".as-edit-target").length === 0);
    console.log(`DONE BUTTON LEAVES EDIT MODE: ${cleared ? "OK" : "FAIL"}`);

    // 5) reset override
    await page.evaluate(() => fetch("/api/content/ar", { method: "DELETE" }));
    await wait(300);

    failed = errors.length > 0 || applied === false || popoverOpen === false || !pillClicked;
    if (errors.length) console.log("PAGE ERRORS:", errors.join(" | "));
  } catch (e) {
    failed = true;
    console.error("TEST ERROR:", e);
  } finally {
    await browser.close();
    server.kill();
    await rm("data", { recursive: true, force: true });
    process.exit(failed ? 1 : 0);
  }
}

main();
