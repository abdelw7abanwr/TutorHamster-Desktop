const path = require('node:path')
const fs = require('node:fs')
const { spawn } = require('node:child_process')

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
  console.error('\n❌ خطأ: لم يتم العثور على GH_TOKEN!')
  console.error('يرجى إضافة رمز الوصول إلى ملف .env بهذا الشكل:')
  console.error('GH_TOKEN=ghp_your_personal_access_token_here\n')
  process.exit(1)
}

// Pass GH_TOKEN to child process environment
const env = { ...process.env, GH_TOKEN: token, GITHUB_TOKEN: token }

console.log('🚀 جاري بدء بناء ورفع الإصدار الجديد إلى GitHub Releases تلقائياً...\n')

const builder = spawn('npx', ['electron-builder', '--win', '--publish', 'always'], {
  stdio: 'inherit',
  shell: true,
  env
})

builder.on('close', code => {
  if (code === 0) {
    console.log('\n✅ تم بناء الإصدار الجديد ونشره بنجاح على GitHub!')
  } else {
    console.error(`\n❌ فشلت عملية الرفع مع كود الخطأ: ${code}`)
  }
  process.exit(code)
})
