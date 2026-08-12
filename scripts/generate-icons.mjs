// Generates the PWA icon set from an inline SVG (teal tile + progress-bar motif).
// Run: npm run icons
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const icon = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#0F766E"/>
  <g fill="#FFFFFF">
    <rect x="116" y="148" width="280" height="44" rx="22" opacity="0.95"/>
    <rect x="116" y="234" width="280" height="44" rx="22" opacity="0.35"/>
    <rect x="116" y="234" width="186" height="44" rx="22" opacity="0.95"/>
    <rect x="116" y="320" width="280" height="44" rx="22" opacity="0.35"/>
    <rect x="116" y="320" width="96" height="44" rx="22" opacity="0.95"/>
  </g>
</svg>`

mkdirSync('public/icons', { recursive: true })
const flat = Buffer.from(icon(false))
const maskable = Buffer.from(icon(true))

await sharp(flat).resize(192, 192).png().toFile('public/icons/icon-192.png')
await sharp(flat).resize(512, 512).png().toFile('public/icons/icon-512.png')
await sharp(maskable).resize(512, 512).png().toFile('public/icons/maskable-512.png')
await sharp(maskable).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png')
console.log('icons written to public/icons/')
