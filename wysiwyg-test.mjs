/* E2E: WYSIWYG — photos clickable + schedule cells mapped by row + admin Live-edit iframe */
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

    // --- PHOTO editing on home ---
    await page.goto(`${URL}/`, { waitUntil: "networkidle2" });
    await wait(2000);
    await page.evaluate(() => sessionStorage.setItem("as-editmode", "1"));
    await page.reload({ waitUntil: "networkidle2" });
    await wait(2500);
    const imgs = await page.evaluate(() => document.querySelectorAll("img.as-edit-img").length);
    console.log(`PHOTOS MARKED AS EDITABLE: ${imgs > 0 ? "OK" : "FAIL"} (${imgs})`);

    // click the first marked photo (hero slide 1) and replace with a URL
    await page.evaluate(() => {
      const img = document.querySelector("img.as-edit-img");
      img.scrollIntoView({ block: "center" });
      const r = img.getBoundingClientRect();
      img.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })
      );
    });
    await wait(1500);
    const photoPopover = await page.evaluate(
      () => document.body.innerText.toLowerCase().includes("choose a new photo") && !!document.querySelector("input[type=file]")
    );
    console.log(`PHOTO POPOVER OPENS (upload+URL): ${photoPopover ? "OK" : "FAIL"}`);

    const newPhoto = "https://placehold.co/1920x1080/0C9447/ffffff?text=NEW-PHOTO";
    await page.evaluate((url) => {
      const inp = [...document.querySelectorAll("div.fixed input")].pop();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(inp, url);
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    }, newPhoto);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Save photo"));
      btn.click();
    });
    await wait(3500);
    const photoSaved = await page.evaluate(() => fetch("/api/content/ar").then((r) => r.json()).then((d) => d.home?.slides?.[0]?.image));
    console.log(`PHOTO SAVED AT home.slides[0].image: ${photoSaved === newPhoto ? "OK" : "FAIL"}`);

    // --- SCHEDULE cell editing on /training ---
    await page.goto(`${URL}/training`, { waitUntil: "networkidle2" });
    await wait(2500);
    // edit mode already on; open a schedule cell of the 2nd row (venue repeated 7 times)
    const cellPath = await page.evaluate(() => {
      const cells = [...document.querySelectorAll(".as-edit-target")].filter(
        (el) => el.getAttribute("data-as-text") === "القاعة الرئيسية"
      );
      const cell = cells[1]; // second row
      cell.scrollIntoView({ block: "center" });
      const r = cell.getBoundingClientRect();
      cell.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })
      );
      return cells.length;
    });
    await wait(700);
    const row2Path = await page.evaluate(() => document.querySelector("div.fixed span.truncate")?.textContent);
    console.log(`SCHEDULE ROWS MAPPED SEPARATELY (${cellPath} venue cells, clicked #2): ${row2Path === "training.scheduleRows[1].venue" ? "OK" : "FAIL"} -> ${row2Path}`);

    const newVenue = "Salle B (test)";
    await page.evaluate((t) => {
      const ta = document.querySelector("[data-as-ta]");
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(ta, t);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Save (Ctrl"));
      btn.click();
    }, newVenue);
    await wait(2600);
    const venueSaved = await page.evaluate(() => fetch("/api/content/ar").then((r) => r.json()).then((d) => d.training?.scheduleRows?.[1]?.venue));
    console.log(`SCHEDULE CELL SAVED AT training.scheduleRows[1].venue: ${venueSaved === newVenue ? "OK" : "FAIL"}`);

    // --- Admin LIVE EDIT preview (iframe) ---
    await page.goto(`${URL}/admin`, { waitUntil: "networkidle2" });
    await wait(800);
    const liveOk = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Live edit"));
      if (!b) return null;
      b.click();
      return true;
    });
    await wait(3000);
    const iframe = page.frames().find((f) => f.url().replace(/\/$/, "") === URL);
    const iframeEdit = iframe ? await iframe.evaluate(() => document.documentElement.classList.contains("as-edit-on")) : false;
    console.log(`LIVE-EDIT IFRAME PREVIEW OPENS WITH EDIT MODE: ${liveOk && iframeEdit ? "OK" : "FAIL"}`);

    failed = !photoPopover || !iframeEdit || !liveOk || photoSaved !== newPhoto || venueSaved !== newVenue || row2Path !== "training.scheduleRows[1].venue";
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
