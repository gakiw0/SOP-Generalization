import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ja from './locales/ja.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'

export const LOCALE_STORAGE_KEY = 'ui_locale'
export const SUPPORTED_LOCALES = ['ja', 'en', 'zh-CN', 'zh-TW'] as const
export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]

const isBrowser = typeof window !== 'undefined'

export const normalizeLocale = (value: string | null | undefined): LocaleCode | null => {
  if (!value) return null
  const lower = value.toLowerCase()

  if (lower.startsWith('ja')) return 'ja'
  if (lower.startsWith('en')) return 'en'

  if (
    lower.startsWith('zh-cn') ||
    lower.startsWith('zh-sg') ||
    lower.startsWith('zh-hans')
  ) {
    return 'zh-CN'
  }

  if (
    lower.startsWith('zh-tw') ||
    lower.startsWith('zh-hk') ||
    lower.startsWith('zh-mo') ||
    lower.startsWith('zh-hant')
  ) {
    return 'zh-TW'
  }

  return null
}

const detectInitialLocale = (): LocaleCode => {
  const fromSession = normalizeLocale(
    isBrowser ? window.sessionStorage.getItem(LOCALE_STORAGE_KEY) : null
  )
  if (fromSession) return fromSession

  const fromBrowser = normalizeLocale(isBrowser ? window.navigator.language : null)
  if (fromBrowser) return fromBrowser

  return 'en'
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ja: { translation: ja },
      'zh-CN': { translation: zhCN },
      'zh-TW': { translation: zhTW },
    },
    lng: detectInitialLocale(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  })

  i18n.on('languageChanged', (lng) => {
    if (!isBrowser) return
    const normalized = normalizeLocale(lng)
    if (normalized) {
      window.sessionStorage.setItem(LOCALE_STORAGE_KEY, normalized)
    }
  })
}

export default i18n
