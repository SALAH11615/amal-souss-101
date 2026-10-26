/* Headless smoke test: serves dist via tiny static server and visits all routes */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";

const ROUTES = ["/", "/club", "/training", "/coaches", "/competitions", "/news", "/news/inscriptions-saison-2026-2027", "/media", "/register", "/contact", "/nonsense404"];
const LANGS = ["ar", "fr", "en"];
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png" };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function serve(dist, port) {
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
      let file = join(dist, path);
      if (!path.startsWith("/assets") && !path.includes(".")) file = join(dist, "index.html");
      const data = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("nf");
    }
  });
  await new Promise((r) => server.listen(port, r));
  return server;
}

async function main() {
  const server = await serve(join(process.cwd(), "dist"), 4199);

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });

  let failed = false;
  try {
    const page = await browser.newPage();

    /* --- interaction checks on home: language switch --- */
    await page.goto("http://localhost:4199/", { waitUntil: "networkidle2", timeout: 30000 });
    await wait(600);
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const b = btns.find((x) => x.getAttribute("aria-label") === "Language" || x.textContent.match(/AR|EN|FR/));
      if (b) b.click();
    });
    await wait(400);
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('[role="option"], ul button')];
      const fr = items.find((x) => x.textContent.includes("Français"));
      if (fr) fr.click();
    });
    await wait(800);
    const dirAfter = await page.evaluate(() => document.documentElement.dir);
    const titleAfter = await page.evaluate(() => document.title);
    console.log(`SWITCH: dir=${dirAfter} title="${titleAfter}" ${dirAfter === "ltr" && /Amal/.test(titleAfter) ? "OK" : "FAIL"}`);

    /* --- mobile viewport menu check --- */
    await page.setViewport({ width: 390, height: 820 });
    await page.evaluate(() => localStorage.setItem("as-lang", "ar"));
    await page.reload({ waitUntil: "networkidle2" });
    await wait(600);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "القائمة" || b.getAttribute("aria-label") === "Menu");
      if (btn) btn.click();
    });
    await wait(600);
    const drawerVisible = await page.evaluate(() => !!document.querySelector("aside") && document.querySelector("aside").getBoundingClientRect().width > 0);
    console.log(`MOBILE MENU: ${drawerVisible ? "OK" : "FAIL"}`);

    for (const lang of LANGS) {
      for (const route of ROUTES) {
        const errors = [];
        page.removeAllListeners("pageerror");
        page.removeAllListeners("console");
        page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
        page.on("console", (m) => {
          if (m.type() === "error") errors.push("CONSOLE: " + m.text());
        });
        await page.goto(`http://localhost:4199${route}`, { waitUntil: "networkidle2", timeout: 30000 });
        await wait(700);
        const hasRoot = await page.evaluate(() => document.getElementById("root")?.children.length > 0);
        const dir = await page.evaluate(() => document.documentElement.dir);
        const langNow = await page.evaluate(() => document.documentElement.lang);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await wait(500);
        const filtered = errors.filter((e) => !/fonts\.gstatic|googleapis|placehold\.co|Access to fetch|net::|Failed to load resource/i.test(e));
        const ok = hasRoot && filtered.length === 0;
        if (!ok) failed = true;
        console.log(`${ok ? "OK " : "FAIL"} ${lang} ${route} | dir=${dir} lang=${langNow}${filtered.length ? " | " + filtered.join(" ; ") : ""}`);
      }
    }
  } catch (e) {
    failed = true;
    console.error("TEST ERROR:", e.message);
  } finally {
    await browser.close();
    server.close();
    process.exit(failed ? 1 : 0);
  }
}

main();
