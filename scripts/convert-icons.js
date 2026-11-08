const fs = require('node:fs')
const path = require('node:path')
const { Resvg } = require('@resvg/resvg-js')
const rawPngToIco = require('png-to-ico')
const pngToIco = rawPngToIco.default || rawPngToIco

const iconsDir = path.join(__dirname, '..', 'assets', 'icons')
const roundedSvgPath = path.join(iconsDir, 'logo-v1-drop-rounded.svg')
const squareSvgPath = path.join(iconsDir, 'logo-v1-drop-square.svg')

function renderSvg(svgPath, width) {
  const svg = fs.readFileSync(svgPath, 'utf8')
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: width
    }
  })
  const pngData = resvg.render()
  return pngData.asPng()
}

async function main() {
  console.log('Rendering SVGs...')
  
  // 1. Render rounded PNG (512x512, 256x256, 128x128)
  const rounded512 = renderSvg(roundedSvgPath, 512)
  const rounded256 = renderSvg(roundedSvgPath, 256)
  fs.writeFileSync(path.join(iconsDir, 'logo-v1-drop-rounded.png'), rounded512)
  fs.writeFileSync(path.join(iconsDir, 'notification-icon.png'), rounded256)
  
  // 2. Render square PNG (512x512, 256x256)
  const square512 = renderSvg(squareSvgPath, 512)
  const square256 = renderSvg(squareSvgPath, 256)
  const square64 = renderSvg(squareSvgPath, 64)
  const square32 = renderSvg(squareSvgPath, 32)
  const square16 = renderSvg(squareSvgPath, 16)
  
  fs.writeFileSync(path.join(iconsDir, 'logo-v1-drop-square.png'), square512)
  fs.writeFileSync(path.join(iconsDir, 'icon.png'), square512)
  fs.writeFileSync(path.join(iconsDir, 'app-icon.png'), rounded512)

  // 3. Generate icon.ico from multiple sizes for best Windows taskbar and desktop rendering
  console.log('Generating ICO file...')
  const icoBuffer = await pngToIco([
    path.join(iconsDir, 'logo-v1-drop-rounded.png')
  ])
  fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBuffer)
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.ico'), icoBuffer)
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.png'), rounded512)

  console.log('All icons generated successfully!')
}

main().catch(err => {
  console.error('Error generating icons:', err)
  process.exit(1)
})
