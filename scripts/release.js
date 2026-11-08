const path = require('node:path')
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const { organizeRelease } = require('./organize-release')

// Automatically load environment variables from .env
const envPath = path.join(__dirname, '..', '.env')
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath)
  } catch (err) {
    console.error('⚠️ Could not load .env file:', err.message)
  }
}

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN

if (!token) {
  console.error('\n❌ Error: GH_TOKEN was not found!')
  console.error('Please add your GitHub Personal Access Token to your .env file like this:')
  console.error('GH_TOKEN=ghp_your_personal_access_token_here\n')
  process.exit(1)
}

// Pass GH_TOKEN to child process environment
const env = { ...process.env, GH_TOKEN: token, GITHUB_TOKEN: token }

console.log('🚀 Building and publishing new release to GitHub Releases...\n')

const builderCli = path.join(__dirname, '..', 'node_modules', 'electron-builder', 'cli.js')
const builder = spawn(process.execPath, [builderCli, '--win', 'nsis', '--publish', 'always'], {
  stdio: 'inherit',
  env
})

builder.on('close', code => {
  if (code === 0) {
    console.log('\n✅ New release built and published successfully to GitHub!')
    try {
      organizeRelease()
    } catch (e) {
      console.error('⚠️ Could not organize release files:', e.message)
    }
  } else {
    console.error(`\n❌ Publishing failed with exit code: ${code}`)
  }
  process.exit(code)
})

