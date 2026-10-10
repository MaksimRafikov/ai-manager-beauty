/**
 * Stage 3: capture KP visuals (V1–V4) from demo dashboard + YClients card mock.
 * Usage: npm run build && node scripts/kp-visuals.mjs
 */
import { spawn } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs", "kp", "visuals");
const mockHtml = path.join(__dirname, "yclients-card-mock.html");
const PREVIEW_PORT = 4173;
const BASE = `http://localhost:${PREVIEW_PORT}`;

function waitForPreview(ms = 120_000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = async () => {
      try {
        const res = await fetch(BASE);
        if (res.ok) return resolve();
      } catch {
        /* retry */
      }
      if (Date.now() - start > ms) reject(new Error("Preview did not start"));
      else setTimeout(tick, 400);
    };
    tick();
  });
}

function startPreview() {
  const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
  return spawn(process.execPath, [viteBin, "preview", "--port", String(PREVIEW_PORT), "--strictPort", "--host"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function dismissTourInvite(page) {
  const skip = page.locator("#tour-invite-skip");
  if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(300);
  }
}

async function hidePageChrome(page) {
  await page.addStyleTag({
    content: `
      .site-header,
      .tour-invite,
      .hero-section,
      .labels-promo,
      .method-section,
      .data-section,
      .form-section,
      .site-footer { display: none !important; }
      .dashboard-section { padding-top: 0 !important; margin-top: 0 !important; }
    `,
  });
}

async function waitDashboard(page) {
  await page.goto(`${BASE}/#dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#demo-app", { timeout: 30_000 });
  await dismissTourInvite(page);
  await hidePageChrome(page);
  await page.locator("#dashboard").scrollIntoViewIfNeeded();
  await page.locator("#summary-panel").waitFor({ timeout: 30_000 });
  await page.locator("#chart-clients canvas").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600);
}

async function previewAlreadyUp() {
  try {
    const res = await fetch(BASE);
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });

  let preview = null;
  if (!(await previewAlreadyUp())) {
    preview = startPreview();
    preview.stderr?.on("data", (d) => process.stderr.write(d));
    preview.on("error", (e) => console.error(e));
    await waitForPreview();
  } else {
    console.log(`Using preview at ${BASE}`);
  }

  try {

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1200, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    await waitDashboard(page);

    // V1: только сводка — без сайдбара, навигации и «на неделе»; круги ниже, чтобы кадр был шире, чем выше.
    await page.addStyleTag({
      content: `
        .demo-sidebar,
        .demo-nav,
        .subtabs,
        .week-box,
        .segment-hint,
        .segment-cards,
        .segment-note { display: none !important; }
        .demo-shell { display: block !important; }
        .demo-main { width: 100% !important; max-width: none !important; }
        .chart { height: 150px !important; }
        .chart-card { padding: 0.5rem 0.7rem !important; }
        .chart-card h3 { margin-bottom: 0.3rem !important; }
        .kpi-row { margin-bottom: 0.5rem !important; }
        .data-table th, .data-table td { padding: 0.35rem 0.4rem !important; }
      `,
    });
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await page.waitForTimeout(500);
    await page.locator("#summary-panel").screenshot({
      path: path.join(outDir, "v1-summary.png"),
    });

    await page.locator('.segment-row[data-segment="Уходят"]').first().click();
    const listBlock = page.locator("#list-ukhodyat");
    await listBlock.waitFor({ timeout: 15_000 });
    await listBlock.scrollIntoViewIfNeeded();
    await page.locator("#list-ukhodyat .card-list").evaluate((el) => el.remove()).catch(() => {});
    await page.locator("#list-ukhodyat tbody tr:nth-child(n+9)").evaluateAll((rows) => {
      rows.forEach((row) => row.remove());
    });
    await page.waitForTimeout(400);
    await listBlock.screenshot({
      path: path.join(outDir, "v2-call-list.png"),
    });

    const listHead = page.locator("#list-ukhodyat .list-head");
    await listHead.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await listHead.screenshot({
      path: path.join(outDir, "v4-excel.png"),
    });

    const mockPage = await context.newPage();
    await mockPage.setViewportSize({ width: 500, height: 420 });
    await mockPage.goto(`file:///${mockHtml.replace(/\\/g, "/")}`, { waitUntil: "load" });
    await mockPage.locator(".frame").screenshot({
      path: path.join(outDir, "v3-yclients-label.png"),
    });

    const publicDir = path.join(root, "public", "offer", "visuals");
    await mkdir(publicDir, { recursive: true });
    for (const name of ["v1-summary.png", "v2-call-list.png", "v3-yclients-label.png", "v4-excel.png"]) {
      await copyFile(path.join(outDir, name), path.join(publicDir, name));
    }

    await browser.close();
    console.log("Saved 4 PNGs to docs/kp/visuals/ and public/offer/visuals/");
  } finally {
    preview?.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
