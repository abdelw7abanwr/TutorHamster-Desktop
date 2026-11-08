const fs = require('node:fs')
const path = require('node:path')

function cleanDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    const items = fs.readdirSync(dirPath)
    for (const item of items) {
      const full = path.join(dirPath, item)
      if (fs.statSync(full).isFile()) {
        fs.unlinkSync(full)
      }
    }
  }
}

function organizeRelease() {
  const rootDir = path.join(__dirname, '..')
  const pkgPath = path.join(rootDir, 'package.json')
  const distDir = path.join(rootDir, 'dist')
  const releasesDir = path.join(rootDir, 'releases')

  if (!fs.existsSync(distDir)) {
    console.log('⚠️ dist/ folder not found. Skipping organization.')
    return
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const version = pkg.version || '1.0.0'

  // Define organized directories
  const versionDir = path.join(releasesDir, `v${version}`)
  const winVersionDir = path.join(versionDir, 'windows')
  const macVersionDir = path.join(versionDir, 'mac')

  const latestDir = path.join(releasesDir, 'latest')
  const winLatestDir = path.join(latestDir, 'windows')
  const macLatestDir = path.join(latestDir, 'mac')

  // Ensure directories exist
  fs.mkdirSync(winVersionDir, { recursive: true })
  fs.mkdirSync(macVersionDir, { recursive: true })
  fs.mkdirSync(winLatestDir, { recursive: true })
  fs.mkdirSync(macLatestDir, { recursive: true })

  // Clean latest directories so they only contain the newest release
  cleanDirectory(winLatestDir)
  cleanDirectory(macLatestDir)

  // Read files in dist/
  const files = fs.readdirSync(distDir)
  let winFilesCount = 0
  let macFilesCount = 0

  for (const file of files) {
    const fullPath = path.join(distDir, file)
    if (!fs.statSync(fullPath).isFile()) continue

    // Match files for current version or latest manifest
    const isCurrentVersion = file.includes(version) || file === 'latest.yml' || file === 'latest-mac.yml'
    if (!isCurrentVersion) continue

    // 1. Windows Artifacts (.exe, .blockmap, latest.yml)
    if (file.endsWith('.exe') || file.endsWith('.exe.blockmap') || file === 'latest.yml') {
      fs.copyFileSync(fullPath, path.join(winVersionDir, file))
      fs.copyFileSync(fullPath, path.join(winLatestDir, file))
      winFilesCount++
    }

    // 2. macOS Artifacts (.dmg, .pkg, .zip, latest-mac.yml)
    if (file.endsWith('.dmg') || file.endsWith('.pkg') || (file.endsWith('.zip') && file.toLowerCase().includes('mac')) || file === 'latest-mac.yml') {
      fs.copyFileSync(fullPath, path.join(macVersionDir, file))
      fs.copyFileSync(fullPath, path.join(macLatestDir, file))
      macFilesCount++
    }
  }

  console.log(`\n📁 Release assets organized successfully!`)
  console.log(`   📂 Specific Version: releases/v${version}/windows/ (${winFilesCount} files)`)
  if (macFilesCount > 0) {
    console.log(`   📂 Specific Version: releases/v${version}/mac/ (${macFilesCount} files)`)
  }
  console.log(`   🌟 Latest Windows  : releases/latest/windows/`)
  if (macFilesCount > 0) {
    console.log(`   🌟 Latest Mac      : releases/latest/mac/`)
  }
  console.log('')
}

if (require.main === module) {
  organizeRelease()
}

module.exports = { organizeRelease }
