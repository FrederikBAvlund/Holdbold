// Tager skærmbilleder til opsætningsguiden mod en lokal kørende app (npm run build && npm start).
// Brug: BASE_URL=http://localhost:3000 GUIDE_EMAIL=... GUIDE_PASSWORD=... npm run guide:screenshots
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const identifier = process.env.GUIDE_EMAIL ?? "spiller@holdbold.local";
const password = process.env.GUIDE_PASSWORD ?? process.env.SEED_DEV_PASSWORD ?? "Test1234!";
const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const outDir = new URL("../public/guide/", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "da-DK",
  colorScheme: "light"
});
const page = await context.newPage();

// Log ind via next-auth credentials.
const csrf = await (await context.request.get(`${baseURL}/api/auth/csrf`)).json();
await context.request.post(`${baseURL}/api/auth/callback/credentials`, {
  form: { csrfToken: csrf.csrfToken, identifier, password, json: "true" }
});

async function shoot(name, locator) {
  const png = await locator.screenshot();
  await sharp(png).resize({ width: 780 }).webp({ quality: 82 }).toFile(`${outDir}${name}.webp`);
  console.log("gemt", `${name}.webp`);
}

await page.goto(`${baseURL}/dashboard/profil`, { waitUntil: "networkidle" });
// Skjul den faste navigation, så den ikke dækker udsnittet.
await page.addStyleTag({ content: "nav, [data-bottom-nav] { display: none !important; }" });
const heading = page.getByRole("heading", { name: "Notifikationer" }).first();
const section = page.locator("section", { has: heading }).first();
await section.scrollIntoViewIfNeeded();
await shoot("push-settings", section);

await browser.close();
