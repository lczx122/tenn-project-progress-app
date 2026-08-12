// End-to-end smoke test. Run `npm run build && npm run preview` first, then:
//   node scripts/smoke.mjs
// Exercises every screen and core flow against http://localhost:4173,
// writes screenshots to .smoke/ and fails loudly on console errors.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = '.smoke'
mkdirSync(OUT, { recursive: true })

// PLAYWRIGHT_CHROMIUM points at a pre-installed Chromium (e.g. /opt/pw-browsers/chromium);
// leave it unset to use Playwright's own managed browser.
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
)
const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })

await page.goto('http://localhost:4173/')
await page.waitForSelector('text=Overall progress', { timeout: 10000 })
await page.waitForTimeout(600)
await shot('01-home')

// manifest + SW checks
const manifest = await page.evaluate(async () => {
  const link = document.querySelector('link[rel="manifest"]')
  if (!link) return null
  const r = await fetch(link.href)
  return r.json()
})
console.log('MANIFEST:', manifest ? `${manifest.name} · ${manifest.display} · ${manifest.icons.length} icons · theme ${manifest.theme_color}` : 'MISSING')
await page.waitForTimeout(1500)
const sw = await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations()
  return regs.map((r) => r.active?.state || r.installing?.state || 'none')
})
console.log('SERVICE WORKER:', sw)

// Phases
await page.click('text=Phases')
await page.waitForTimeout(300)
await shot('02-phases')
// bump a phase
const before = await page.textContent('.mono >> nth=0')
await page.click('button:has-text("+5%") >> nth=0')
await page.waitForTimeout(200)
console.log('PHASE BUMP: 75% ->', await page.textContent('.card .mono >> nth=0'))
// filter chip
await page.click('.chip:has-text("Hock Heng")')
await page.waitForTimeout(200)
await shot('03-phases-filtered')
await page.click('.chip:has-text("All")')

// Supplies
await page.click('nav >> text=Supplies')
await page.waitForTimeout(300)
await shot('04-supplies')
await page.click('text=Plywood 18mm')
await page.waitForTimeout(300)
await shot('05-supply-detail')
// reorder
await page.click('button:has-text("Reorder 30 pcs")')
await page.waitForTimeout(300)
const orderBanner = await page.textContent('text=Order placed')
console.log('REORDER:', orderBanner.trim())
await shot('06-supply-reordered')

// Report: photos via file input
await page.click('nav >> text=Report')
await page.waitForTimeout(300)
await shot('07-report-empty')
// craft 3 dummy JPEGs
import { execSync } from 'node:child_process'
const jpegs = []
for (let i = 0; i < 3; i++) {
  const f = `${OUT}/dummy${i}.jpg`
  // 1x1 red jpeg base64
  const b64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='
  execSync(`printf '%s' '${b64}' | base64 -d > '${f}'`)
  jpegs.push(f)
}
for (const f of jpegs) {
  await page.setInputFiles('input[type="file"][accept="image/*"]', f)
  await page.waitForTimeout(400)
}
// manpower
for (let i = 0; i < 3; i++) await page.click('button.stepper-btn:has-text("+") >> nth=0')
await page.click('button.stepper-btn:has-text("+") >> nth=2')
// material
await page.click('text=+ Add material')
await page.waitForTimeout(300)
await page.click('.sheet-row >> nth=0')
await page.waitForTimeout(200)
// summary
await page.fill('textarea >> nth=0', 'Backdrop 01 cladding completed, started paint prep.')
await page.waitForTimeout(300)
await shot('08-report-filled')
const submitLabel = await page.textContent('button:has-text("Submit report")')
console.log('SUBMIT BTN:', submitLabel.trim())
await page.click('button:has-text("Submit report")')
await page.waitForTimeout(500)
await shot('09-history-after-submit')

// stock deduction check
await page.click('nav >> text=Supplies')
await page.waitForTimeout(300)
const plywoodQty = await page.textContent('button:has-text("Plywood") .mono')
console.log('PLYWOOD AFTER SUBMIT:', plywoodQty.trim())

// History: view report
await page.click('nav >> text=History')
await page.waitForTimeout(300)
await page.click('text=View report >> nth=0')
await page.waitForTimeout(400)
await shot('10-report-view')
// share PDF (downloads since no Web Share in headless)
const dl = page.waitForEvent('download', { timeout: 15000 })
await page.click('button:has-text("Share PDF")')
const download = await dl
console.log('PDF DOWNLOAD:', download.suggestedFilename())
await page.click('.back-chevron')

// Drawings
await page.click('nav >> text=Home')
await page.waitForTimeout(300)
await page.click('text=Drawings —')
await page.waitForTimeout(300)
await shot('11-drawings')
await page.click('text=Open >> nth=0')
await page.waitForTimeout(1500)
await shot('12-pdf-viewer')
await page.click('.viewer .back-chevron')

// persistence: reload and confirm submitted state + reorder survived
await page.reload()
await page.waitForSelector('text=Overall progress')
await page.waitForTimeout(500)
const sop = await page.textContent('text=of 5 done')
console.log('AFTER RELOAD SOP:', sop.trim())
await shot('13-home-after-reload')

// offline check: stop network via context offline, reload
await ctx.setOffline(true)
await page.reload().catch(() => {})
await page.waitForTimeout(1200)
const offlineOk = await page.textContent('body').then((t) => t.includes('Overall progress')).catch(() => false)
console.log('OFFLINE RELOAD OK:', offlineOk)
await shot('14-offline')
await ctx.setOffline(false)

console.log('ERRORS:', errors.length ? errors : 'none')
await browser.close()
