(function () {
  const STORAGE_KEY = 'asg.director.locale'
  const SUPPORTED = ['zh-CN', 'en-US']

  function normalizeLocale(raw) {
    if (!raw) return 'zh-CN'
    const lower = String(raw).toLowerCase()
    if (lower.startsWith('en')) return 'en-US'
    if (lower.startsWith('zh')) return 'zh-CN'
    return 'zh-CN'
  }

  function readSavedLocale() {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch (_) {
      return null
    }
  }

  function writeSavedLocale(locale) {
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch (_) {
      // ignore storage failures
    }
  }

  function interpolate(template, params) {
    if (!params) return template
    return String(template).replace(/\{(\w+)\}/g, (_, key) => {
      const value = params[key]
      return value === undefined || value === null ? '' : String(value)
    })
  }

  function buildAPI(pageMessages, initialLocale) {
    let locale = initialLocale

    function currentMessages() {
      return pageMessages[locale] || pageMessages['zh-CN'] || {}
    }

    function t(key, params) {
      const fallback = pageMessages['zh-CN'] || {}
      const raw = currentMessages()[key] ?? fallback[key] ?? key
      return interpolate(raw, params)
    }

    function apply(root = document) {
      root.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n')
        el.textContent = t(key)
      })
      root.querySelectorAll('[data-i18n-html]').forEach((el) => {
        const key = el.getAttribute('data-i18n-html')
        el.innerHTML = t(key)
      })
      root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder')
        el.setAttribute('placeholder', t(key))
      })
      root.querySelectorAll('[data-i18n-title]').forEach((el) => {
        const key = el.getAttribute('data-i18n-title')
        el.setAttribute('title', t(key))
      })
    }

    function setLocale(nextLocale, options = {}) {
      const normalized = normalizeLocale(nextLocale)
      if (!SUPPORTED.includes(normalized)) return
      locale = normalized
      document.documentElement.lang = normalized
      if (!options.skipPersist) {
        writeSavedLocale(normalized)
      }
      apply(document)
      document.dispatchEvent(new CustomEvent('asg-i18n-changed', { detail: { locale: normalized } }))
    }

    function bindSelector(selectorId) {
      const select = document.getElementById(selectorId)
      if (!select) return
      select.value = locale
      select.addEventListener('change', () => setLocale(select.value))
      document.addEventListener('asg-i18n-changed', (e) => {
        if (select.value !== e.detail.locale) {
          select.value = e.detail.locale
        }
      })
    }

    function formatDateTime(value) {
      try {
        return new Date(value).toLocaleString(locale === 'en-US' ? 'en-US' : 'zh-CN')
      } catch (_) {
        return String(value ?? '')
      }
    }

    function getLocale() {
      return locale
    }

    return { t, apply, setLocale, bindSelector, formatDateTime, getLocale }
  }

  function init(pageMessages, options = {}) {
    const savedRaw = readSavedLocale()
    const saved = savedRaw ? normalizeLocale(savedRaw) : null
    const browser = normalizeLocale(navigator.language || navigator.userLanguage)
    const locale = options.preferSaved === false ? browser : (saved || browser)
    const api = buildAPI(pageMessages, locale)
    document.documentElement.lang = locale
    api.apply(document)
    return api
  }

  window.ASGI18n = { init, normalizeLocale }
})()
