const path = require('node:path')
const fs = require('node:fs')

const SUPPORTED_LOCALES = ['ar', 'en', 'de', 'es', 'fr']
const DEFAULT_LOCALE = 'en'

/**
 * Load translation dictionary for a given locale
 * @param {string} localeCode - System locale e.g. 'ar', 'ar-EG', 'en-US'
 * @returns {object} Parsed JSON translation data
 */
function getLocale(localeCode) {
  const code = (localeCode || DEFAULT_LOCALE).toLowerCase().split('-')[0]
  const target = SUPPORTED_LOCALES.includes(code) ? code : DEFAULT_LOCALE
  const filePath = path.join(__dirname, `${target}.json`)
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch (err) {
    console.error(`Failed to load locale file for "${target}":`, err)
    return JSON.parse(fs.readFileSync(path.join(__dirname, `${DEFAULT_LOCALE}.json`), 'utf-8'))
  }
}

module.exports = {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  getLocale
}

