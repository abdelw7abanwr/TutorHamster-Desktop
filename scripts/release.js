const path = require('node:path')
const fs = require('node:fs')
const https = require('node:https')
const { spawn } = require('node:child_process')
const readline = require('node:readline')
const { organizeRelease } = require('./organize-release')

// Interactive terminal spinner for long-running operations
class TerminalSpinner {
  constructor (initialText = 'Processing...') {
    this.text = initialText
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    this.frameIndex = 0
    this.timer = null
    this.startTime = Date.now()
    this.isSpinning = false
    this.isInteractive = Boolean(process.stdout.isTTY)
  }

  start (text) {
    if (text) this.text = text
    if (this.isSpinning) return
    this.isSpinning = true
    this.startTime = Date.now()

    if (this.isInteractive) {
      process.stdout.write('\x1b[?25l') // Hide terminal cursor
      this.timer = setInterval(() => this.render(), 80)
    } else {
      console.log(`⏳ ${this.text}`)
    }
  }

  setText (newText) {
    if (newText === this.text) return
    this.text = newText
    this.startTime = Date.now() // Reset elapsed timer for new sub-task
    if (!this.isInteractive) {
      console.log(`⏳ ${this.text}`)
    }
  }

  render () {
    if (!this.isSpinning || !this.isInteractive) return
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000)
    const frame = this.frames[this.frameIndex % this.frames.length]
    this.frameIndex++

    const timeStr = elapsed > 0 ? ` \x1b[90m(${elapsed}s)\x1b[0m` : ''
    const line = `\x1b[36m${frame}\x1b[0m \x1b[1m\x1b[37m${this.text}\x1b[0m${timeStr}`

    readline.clearLine(process.stdout, 0)
    readline.cursorTo(process.stdout, 0)
    process.stdout.write(line)
  }

  clear () {
    if (this.isInteractive) {
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
    }
  }

  stop (finalMessage, isSuccess = true) {
    if (!this.isSpinning) return
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.isSpinning = false

    if (this.isInteractive) {
      this.clear()
      process.stdout.write('\x1b[?25h') // Restore terminal cursor
    }

    if (finalMessage) {
      const icon = isSuccess ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m'
      console.log(`${icon} ${finalMessage}`)
    }
  }
}

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

// Pass GH_TOKEN and color settings to child process environment
const env = {
  ...process.env,
  GH_TOKEN: token,
  GITHUB_TOKEN: token,
  FORCE_COLOR: '1'
}

console.log('🚀 Building and publishing new release to GitHub Releases...\n')

const spinner = new TerminalSpinner('Initializing release build...')
spinner.start()

// Ensure terminal cursor is restored on abrupt interruption (Ctrl+C)
process.on('SIGINT', () => {
  spinner.stop('Release build cancelled by user.', false)
  process.exit(130)
})

process.on('uncaughtException', err => {
  spinner.stop('Unexpected error: ' + err.message, false)
  console.error(err)
  process.exit(1)
})

const builderCli = path.join(__dirname, '..', 'node_modules', 'electron-builder', 'cli.js')
const builder = spawn(process.execPath, [builderCli, '--win', 'nsis', '--publish', 'always'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env
})

builder.stdout.on('data', chunk => {
  const str = chunk.toString()
  spinner.clear()
  process.stdout.write(str)

  // Dynamically detect build phase to give accurate progress context
  if (str.includes('installing native dependencies') || str.includes('executing @electron/rebuild')) {
    spinner.setText('Rebuilding native dependencies for Electron...')
  } else if (str.includes('packaging')) {
    spinner.setText('Packaging application resources (win32-x64)...')
  } else if (str.includes('downloading')) {
    spinner.setText('Downloading Electron runtime binaries...')
  } else if (str.includes('building') && str.includes('nsis')) {
    spinner.setText('Compiling NSIS Setup installer (compressing files, please wait)...')
  } else if (str.includes('building block map')) {
    spinner.setText('Generating block map for delta auto-updates...')
  } else if (str.includes('uploading')) {
    spinner.setText('Uploading installer and assets to GitHub Releases...')
  } else if (str.includes('creating GitHub release')) {
    spinner.setText('Publishing GitHub Release tag and metadata...')
  }

  if (str.endsWith('\n') || str.endsWith('\r\n')) {
    spinner.render()
  }
})

builder.stderr.on('data', chunk => {
  spinner.clear()
  process.stderr.write(chunk)
  spinner.render()
})

// Helper to verify and ensure GitHub release draft is published publicly
function ensureReleasePublished (targetVersion) {
  return new Promise((resolve) => {
    if (!token) return resolve()
    const options = {
      hostname: 'api.github.com',
      path: '/repos/abdelw7abanwr/TutorHamster-Desktop/releases',
      headers: {
        'User-Agent': 'TutorHamster-Release-Publisher',
        'Authorization': 'Bearer ' + token
      }
    }
    https.get(options, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const releases = JSON.parse(data)
          if (Array.isArray(releases)) {
            const target = releases.find(r => r.tag_name === `v${targetVersion}` || r.tag_name === targetVersion)
            if (target && target.draft) {
              const patchData = JSON.stringify({ draft: false })
              const patchReq = https.request({
                hostname: 'api.github.com',
                path: `/repos/abdelw7abanwr/TutorHamster-Desktop/releases/${target.id}`,
                method: 'PATCH',
                headers: {
                  'User-Agent': 'TutorHamster-Release-Publisher',
                  'Authorization': 'Bearer ' + token,
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(patchData)
                }
              }, () => resolve())
              patchReq.on('error', () => resolve())
              patchReq.write(patchData)
              patchReq.end()
              return
            }
          }
        } catch (e) {}
        resolve()
      })
    }).on('error', () => resolve())
  })
}

builder.on('close', async code => {
  if (code === 0) {
    spinner.setText('Ensuring GitHub release is published and visible to users...')
    spinner.render()

    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
    await ensureReleasePublished(pkg.version)

    spinner.setText('Organizing release files into structured version folders...')
    spinner.render()

    try {
      organizeRelease()
      spinner.stop(`Release v${pkg.version} built, published, and organized successfully! 🎉`, true)
    } catch (e) {
      spinner.stop('Release published, but could not organize local files: ' + e.message, false)
    }
  } else {
    spinner.stop(`Publishing failed with exit code: ${code}`, false)
  }
  process.exit(code)
})
