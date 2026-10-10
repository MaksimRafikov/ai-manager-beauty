/**
 * Stage 6: export salon KP page to A4 PDF via Playwright print.
 * Usage: npm run kp:pdf
 */
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "exports");
const pdfPath = path.join(outDir, "KP-AI-marketolog-salon.pdf");
const PREVIEW_PORT = 4173;
const BASE = `http://localhost:${PREVIEW_PORT}`;
const OFFER_URL = `${BASE}/offer/salon.html`;

function runNpmScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", script], {
      cwd: root,
      stdio: "inherit",
      shell: true,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm run ${script} exited with ${code}`));
    });
  });
}

function waitForPreview(ms = 120_000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = async () => {
      try {
        const res = await fetch(OFFER_URL);
        if (res.ok) return resolve();
      } catch {
        /* retry */
      }
      if (Date.now() - start > ms) reject(new Error("Preview did not serve offer page"));
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

async function previewAlreadyUp() {
  try {
    const res = await fetch(OFFER_URL);
    return res.ok;
  } catch {
    return false;
  }
}

/** Rough page count without extra dependencies */
function countPdfPages(buffer) {
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page\b/g);
  return matches?.length ?? 0;
}

async function waitForRender(page) {
  // Lazy images below the fold never fire onload unless we scroll (print still needs them).
  await page.evaluate(async () => {
    for (const img of document.images) {
      img.loading = "eager";
      img.scrollIntoView({ block: "center" });
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 12_000))]);
    await Promise.race([
      Promise.all(
        [...document.images].map(
          (img) =>
            img.complete ||
            new Promise((resolve) => {
              const done = () => resolve(true);
              img.onload = done;
              img.onerror = done;
            }),
        ),
      ),
      new Promise((r) => setTimeout(r, 15_000)),
    ]);
  });
}

async function main() {
  console.log("Building…");
  await runNpmScript("build");

  await mkdir(outDir, { recursive: true });

  let preview = null;
  const startedPreview = !(await previewAlreadyUp());
  if (startedPreview) {
    console.log(`Starting preview on port ${PREVIEW_PORT}…`);
    preview = startPreview();
    preview.stderr?.on("data", (d) => process.stderr.write(d));
    preview.on("error", (e) => console.error(e));
    await waitForPreview();
    console.log("Preview ready.");
  } else {
    console.log(`Using preview at ${BASE}`);
  }

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(OFFER_URL, { waitUntil: "load", timeout: 60_000 });
    await waitForRender(page);
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(800);

    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    await browser.close();

    const buf = await readFile(pdfPath);
    const pages = countPdfPages(buf);
    console.log(`Saved ${path.relative(root, pdfPath)} (${pages} page${pages === 1 ? "" : "s"}, ${(buf.length / 1024).toFixed(0)} KiB)`);
  } finally {
    if (startedPreview) preview?.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
