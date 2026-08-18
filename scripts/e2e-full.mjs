// Full functional audit. Run `npm run build && npm run preview` first, then:
//   node scripts/e2e-full.mjs
// Covers everything scripts/smoke.mjs doesn't: master-data editing, drawings
// upload + linking, project lifecycle, gestures, and reset.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = '.smoke'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
)
const page = await browser.newPage({ viewport: { width: 402, height: 874 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

const results = []
const check = (name, ok) => { results.push([name, !!ok]); console.log(ok ? ' ✓' : ' ✗', name) }
const gone = async (sel) => (await page.locator(sel).count()) === 0

async function drag(x1, y1, x2, y2, steps = 12, delayMs = 10) {
  await page.mouse.move(x1, y1)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x1 + (x2 - x1) * (i / steps), y1 + (y2 - y1) * (i / steps))
    await page.waitForTimeout(delayMs)
  }
  await page.mouse.up()
}

await page.goto('http://localhost:4173/')
await page.waitForSelector('text=Overall progress')

// ---------- Phases: sections — add / edit / advance / delete / filter / start ----------
await page.click('nav >> text=Phases')
await page.click('text=+ Add phase')
await page.fill('input[placeholder="e.g. Backdrop 05"]', 'Audit Phase')
await page.fill('input[aria-label="Section 1 name"]', 'Sec A')
await page.click('.sheet .chip:has-text("Ah Kang")')
await page.click('.sheet .primary-btn')
await page.waitForTimeout(600)
check('phase: add with section', await page.isVisible('.card:has-text("Audit Phase")'))

// set section to Started via edit sheet → phase enters IN PROGRESS at 33%
await page.locator('button[aria-label="Edit Audit Phase"]').click()
await page.waitForTimeout(500)
await page.click('button[aria-label="Started for section 1"]')
await page.click('.sheet button:has-text("Save changes")')
await page.waitForTimeout(600)
check('phase: section Started → 33%', await page.isVisible('.card:has-text("Audit Phase") >> text=33%'))

// advance on the card: Started → Ongoing → 67%
await page.click('button[aria-label="Advance Sec A"]')
await page.waitForTimeout(300)
check('phase: advance section → 67%', await page.isVisible('.card:has-text("Audit Phase") >> text=67%'))

// add a second section in the edit sheet
await page.locator('button[aria-label="Edit Audit Phase"]').click()
await page.waitForTimeout(500)
await page.click('.sheet button:has-text("Add section")')
await page.fill('input[aria-label="Section 2 name"]', 'Sec B')
await page.click('.sheet button:has-text("Save changes")')
await page.waitForTimeout(600)
check('phase: add section', await page.isVisible('.card:has-text("Audit Phase") >> text=Sec B'))

// remove the second section again
await page.locator('button[aria-label="Edit Audit Phase"]').click()
await page.waitForTimeout(500)
await page.click('button[aria-label="Remove section 2"]')
await page.click('.sheet button:has-text("Save changes")')
await page.waitForTimeout(600)
check('phase: remove section', await gone('.card:has-text("Audit Phase") >> text=Sec B'))

// multi-trade phase: Pantry — Wiring (Ah Kang, Ongoing) + Cabinets (Classic Home, Started)
const pantry = page.locator('.card:has-text("Pantry")')
check(
  'phase: sections per subcon',
  (await pantry.locator('.tag:has-text("Ah Kang")').count()) === 1 &&
    (await pantry.locator('.tag:has-text("Classic Home")').count()) === 1 &&
    (await pantry.locator('button[aria-label="Advance Wiring first fix"]').count()) === 1,
)
// advancing one section leaves the other untouched (Ongoing→Finished; 50% → 67%)
await pantry.locator('button[aria-label="Advance Wiring first fix"]').click()
await page.waitForTimeout(300)
check(
  'phase: advance affects only its section',
  (await pantry.locator('text=Finished ✓').count()) === 1 &&
    (await pantry.locator('button[aria-label="Advance Pantry cabinets"]').count()) === 1 &&
    (await pantry.locator('text=67%').count()) === 1,
)

await page.locator('button[aria-label="Edit Audit Phase"]').click()
await page.waitForTimeout(500)
await page.click('.sheet button:has-text("Delete phase")')
await page.click('.sheet button:has-text("Tap again to confirm")')
await page.waitForTimeout(2600)
check('phase: delete', await gone('.card:has-text("Audit Phase")'))

await page.click('.chip:has-text("Hock Heng")')
await page.waitForTimeout(200)
check('phase: subcon filter', await gone('text=Backdrop 01') && (await page.isVisible('text=Advertising Board')))
await page.click('.chip:has-text("All")')
await page.click('.card:has-text("Backdrop 02") button:has-text("Start")')
await page.waitForTimeout(300)
check('phase: start → sections Started at 33%', await page.isVisible('.card:has-text("Backdrop 02") >> text=33%'))

// ---------- Supplies: add / search / edit stock / delete ----------
await page.click('nav >> text=Supplies')
await page.click('text=+ Add supply')
await page.fill('input[placeholder="e.g. Plywood 18mm"]', 'Audit Sealant')
const nums = page.locator('.sheet input[type="number"]')
await nums.nth(0).fill('12')
await nums.nth(1).fill('20')
await nums.nth(2).fill('4')
await page.click('.sheet button:has-text("Add supply")')
await page.waitForTimeout(600)
check('supply: add', await page.isVisible('text=Audit Sealant'))

await page.fill('input[placeholder="Search materials…"]', 'sealant')
await page.waitForTimeout(200)
check('supply: search filters', (await page.locator('.pressable:has-text("Plywood")').count()) === 0 && (await page.isVisible('text=Audit Sealant')))
await page.fill('input[placeholder="Search materials…"]', '')

await page.waitForTimeout(2400) // let the "added" toast expire (it contains the supply name)
await page.click('.chip:has-text("Low stock")')
await page.waitForTimeout(200)
check('supply: low-stock chip', await page.isVisible('text=Plywood 18mm') && (await gone('text=Audit Sealant')))
await page.click('.chip:has-text("All")')

await page.click('text=Audit Sealant')
await page.waitForTimeout(700)
await page.click('button[aria-label="Edit supply"]')
await page.waitForTimeout(500)
await page.locator('.sheet input[type="number"]').nth(0).fill('8')
await page.click('.sheet button:has-text("Save changes")')
await page.waitForTimeout(600)
check('supply: stock edit logs movement', await page.isVisible('text=Manual adjustment'))

await page.click('button[aria-label="Edit supply"]')
await page.waitForTimeout(500)
await page.click('.sheet button:has-text("Delete supply")')
await page.click('.sheet button:has-text("Tap again to confirm")')
await page.waitForTimeout(2600)
check('supply: delete pops back to list', await page.isVisible('input[placeholder="Search materials…"]') && (await gone('text=Audit Sealant')))

// ---------- Drawings: upload / link phase / open viewer ----------
await page.click('nav >> text=Home')
await page.click('text=Drawings —')
await page.waitForTimeout(700)
const pdfPath = `${OUT}/audit.pdf`
writeFileSync(pdfPath, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF')
await page.setInputFiles('input[accept="application/pdf,image/*"]', pdfPath)
await page.waitForTimeout(700)
check('drawing: upload', await page.isVisible('text=audit'))

await page.click('.card-hero:has-text("audit") >> text=Link to phase')
await page.waitForTimeout(500)
await page.click('.sheet-row:has-text("Pantry")')
await page.waitForTimeout(200)
await page.mouse.click(200, 60)
await page.waitForTimeout(500)
check('drawing: link to phase tag', await page.isVisible('.card-hero:has-text("audit") >> text=Pantry'))

await page.click('.card-hero:has-text("Sales Gallery") >> text=Open >> nth=0')
await page.waitForSelector('.viewer canvas', { timeout: 20000 })
await page.waitForFunction(() => {
  const c = document.querySelector('.viewer canvas')
  return c && c.width > 100
}, { timeout: 20000 })
check('drawing: PDF renders via pdf.js', true)
await page.click('.viewer .back-chevron')
await page.waitForTimeout(1200)
check('drawing: viewer dismisses', await gone('.viewer'))

// ---------- Projects: create blank / switch / settings / delete ----------
await page.click('nav >> text=Home')
await page.click('button:has-text("Faithview Gallery")')
await page.waitForTimeout(600)
await page.click('.sheet-row:has-text("New project")')
await page.fill('input[placeholder="Project name"]', 'Audit Project')
await page.click('.sheet button:has-text("Create project")')
await page.waitForTimeout(700)
check('project: create + switch', await page.isVisible('button:has-text("Audit Project")'))
check('project: new project starts blank', await page.isVisible('text=0 in progress · 0 of 0 done'))

await page.click('button:has-text("Audit Project")')
await page.waitForTimeout(600)
await page.click('button[aria-label="Project settings"]')
await page.waitForTimeout(500)
await page.click('.sheet button:has-text("Add subcontractor")')
await page.fill('.sheet input[placeholder="Name"]', 'Audit Sub')
await page.click('.sheet button:has-text("Add") >> nth=0')
await page.waitForTimeout(300)
check('project: add subcon', await page.isVisible('.sheet-row:has-text("Audit Sub")'))
await page.click('.sheet button:has-text("Delete this project")')
await page.click('.sheet button:has-text("Tap again to confirm")')
await page.waitForTimeout(800)
check('project: delete returns to remaining project', await page.isVisible('button:has-text("Faithview Gallery")'))

// ---------- Gestures: sheet flick-dismiss + edge-swipe back ----------
await page.click('button:has-text("Faithview Gallery")')
await page.waitForTimeout(700)
const grab = await page.locator('.sheet-grab').boundingBox()
await drag(grab.x + grab.width / 2, grab.y + 6, grab.x + grab.width / 2, grab.y + 280, 6, 5)
await page.waitForTimeout(900)
check('gesture: flick dismisses sheet', await gone('.sheet-grabber'))

await page.click('nav >> text=Supplies')
await page.click('text=Plywood 18mm')
await page.waitForTimeout(800)
await drag(8, 400, 300, 400, 14, 12)
await page.waitForTimeout(900)
check('gesture: edge-swipe pops detail', await gone('.pushed-layer'))

// ---------- History: delete a report ----------
await page.click('nav >> text=History')
await page.waitForTimeout(400)
const cardsBefore = await page.locator('.card:has-text("View report")').count()
await page.click('.card:has-text("View report") >> nth=0 >> text=Delete')
await page.click('.card:has-text("View report") >> nth=0 >> text=Tap to confirm')
await page.waitForTimeout(2600)
const cardsAfter = await page.locator('.card:has-text("View report")').count()
check('report: delete from history', cardsAfter === cardsBefore - 1)

// ---------- Reset restores demo ----------
await page.click('nav >> text=Home')
await page.click('button:has-text("Faithview Gallery")')
await page.waitForTimeout(600)
await page.click('button[aria-label="Project settings"]')
await page.waitForTimeout(500)
await page.click('.sheet button:has-text("Reset app data")')
await page.click('.sheet button:has-text("Tap again to confirm")')
await page.waitForTimeout(2500)
await page.waitForSelector('text=Overall progress')
check('reset: demo restored', await page.isVisible('text=Faithview Gallery') && (await gone('text=audit')))

console.log('\nRESULT:', results.filter(([, ok]) => ok).length, 'passed /', results.length)
console.log('ERRORS:', errors.length ? errors : 'none')
if (results.some(([, ok]) => !ok) || errors.length) process.exit(1)
await browser.close()
