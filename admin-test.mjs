/* E2E admin test: login, edit content, save via API, verify site shows the edit, then reset. */
import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = "http://localhost:4299";

async function main() {
  // fresh override state
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

    // 1) wrong password rejected
    await page.goto(`${URL}/admin`, { waitUntil: "networkidle2" });
    await page.type('input[type="password"]', "wrongpass");
    await page.click('button[type="submit"]');
    await wait(500);
    const rejected = await page.evaluate(() => document.body.innerText.includes("Wrong password"));
    console.log(`WRONG PASSWORD REJECTED: ${rejected ? "OK" : "FAIL"}`);

    // 2) correct password opens editor (English tab)
    await page.evaluate(() => (document.querySelector('input[type="password"]').value = ""));
    await page.type('input[type="password"]', "admin123");
    await page.click('button[type="submit"]');
    await wait(800);
    const hasEditor = await page.evaluate(() => document.body.innerText.includes("Looking at"));
    console.log(`LOGIN OK + EDITOR SHOWN: ${hasEditor ? "OK" : "FAIL"}`);
    // 3) switch to English tab, open the "SEO & page titles" section, edit meta.title
    await page.evaluate(() => {
      const tab = [...document.querySelectorAll("header button")].find((b) => b.textContent.trim() === "en");
      tab.click();
    });
    await wait(800);
    await page.evaluate(() => {
      const card = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("SEO & page titles"));
      card.click();
    });
    await wait(600);
    await page.evaluate(() => {
      const summaries = [...document.querySelectorAll("summary")];
      const s = summaries.find((x) => x.textContent.includes("meta"));
      if (s) s.click();
    });
    await wait(400);
    // The meta.title label's next sibling is the textarea
    const newTitle = "E2E EDIT " + Date.now();
    await page.evaluate((t) => {
      const details = [...document.querySelectorAll("details")];
      const meta = details.find((d) => d.querySelector("summary")?.textContent.includes("meta"));
      meta.setAttribute("open", "");
      const label = [...meta.querySelectorAll("span")].find((x) => x.textContent === "title");
      const ta = label.nextElementSibling;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(ta, t);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }, newTitle);
    await page.click("header button.bg-brand");
    await wait(1500);

    // 4) server has written the override
    const saved = JSON.parse(await readFile("data/en.json", "utf8"));
    console.log(`OVERRIDE SAVED ON SERVER: ${saved.meta?.title === newTitle ? "OK" : "FAIL"}`);

    // 5) site loads override (English home)
    await page.goto(`${URL}/en`.replace("/en", "/"), { waitUntil: "networkidle2" });
    await page.evaluate(() => localStorage.setItem("as-lang", "en"));
    await page.reload({ waitUntil: "networkidle2" });
    await wait(1200);
    const applied = await page.evaluate(() => document.title.includes("E2E EDIT"));
    console.log(`SITE SHOWS EDITED TITLE: ${applied ? "OK" : "FAIL"}`);

    // 6) reset override -> falls back to bundled content
    await page.evaluate(() => fetch("/api/content/en", { method: "DELETE" }));
    await page.reload({ waitUntil: "networkidle2" });
    await wait(1200);
    const fallback = await page.evaluate(() => document.title.includes("Amal Souss Sportive"));
    console.log(`RESET FALLS BACK TO BUNDLED: ${fallback ? "OK" : "FAIL"}`);

    failed = errors.length > 0;
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
