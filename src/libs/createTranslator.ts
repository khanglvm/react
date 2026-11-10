/**
 * Typed translations: dictionaries whose leaves hold every language, a plain
 * translator function, and hooks that follow the app's current language.
 *
 * This module has no client directive, so server components can import
 * `createTranslator` and `defineLocale` and use the `assertTranslation` it
 * returns. Only the hooks returned by `createTranslatorHook` need a client component.
 * Guide: https://github.com/khanglvm/react/blob/master/docs/translation.md
 */

import type { TDeepReadonly } from '../helpers/index.js'
import {useCallback} from "react";

/**
 * Generic translation item type that accepts any language enum/union
 * @template Languages - Language type (enum or union of strings)
 */
export type LocalizedString<Languages extends string> = {
  [Language in Languages]: string;
};

/**
 * Generic translation definition type that supports nested namespaces
 * @template Languages - Language type (enum or union of strings)
 */
export type TranslationNamespace<Languages extends string> = {
  [key: string]: LocalizedString<Languages> | TranslationNamespace<Languages>;
};

/**
 * Creates a translation function for one language.
 *
 * The returned `t(entry, replacements?)`:
 * - returns `entry[language]`, or `''` when that language is missing at run time;
 * - replaces each key of `replacements` with its value. A key is the literal
 *   text to find, matched case-insensitively everywhere in the string, longest
 *   key first. There is no placeholder syntax: include braces in the key
 *   (`{ '{name}': 'Khang' }`). Any characters are allowed in keys.
 *
 * @template Language - The language type (string literal or union)
 * @param currentLanguage - The language to translate to
 * @returns Translation function that processes LocalizedString objects
 *
 * @example
 * ```typescript
 * // Basic usage
 * const t = createTranslator('en')
 * const greeting = t({ en: "Hello", vi: "Xin chào" })
 * // Returns: "Hello"
 *
 * // With replacements: include the braces in each key
 * const personalGreeting = t(
 *   { en: "Hello {name}, you have {count} messages", vi: "Xin chào {name}, bạn có {count} tin nhắn" },
 *   { '{name}': "John", '{count}': 5 }
 * )
 * // Returns: "Hello John, you have 5 messages"
 *
 * // Fallback behavior
 * const t2 = createTranslator('fr')
 * const text = t2({ en: "Hello", vi: "Xin chào" })
 * // Returns: "" (empty string fallback)
 * ```
 */
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const createTranslator = <Language extends string>(currentLanguage: Language) => {
  return <Translation extends LocalizedString<Language>>(
    translation: Translation,
    replace?: Record<string, string | number>
  ) => {
    // Get text for current language, fallback to empty string
    const matchedText = translation[currentLanguage] || ''
    
    // Return as-is if no replacements needed
    if (!replace) {
      return matchedText
    }
    
    // Longest keys first, so `{name_full}` wins over `{name}` at the same position.
    const replaceKeys = Object.keys(replace)
      .filter(key => key.length > 0)
      .sort((a, b) => b.length - a.length)
    if (replaceKeys.length === 0) {
      return matchedText
    }
    
    // Create a case-insensitive lookup map for replacement values
    const caseInsensitiveReplace = Object.fromEntries(
      replaceKeys.map(key => [key.toLowerCase(), replace[key]])
    )
    
    // Keys are literal text: escape RegExp syntax so `{0}` or `$total` match as written.
    const regex = new RegExp(replaceKeys.map(escapeRegExp).join('|'), 'gi')
    return matchedText.replace(regex, (matched) => {
      const value = caseInsensitiveReplace[matched.toLowerCase()]
      return value !== undefined ? value.toString() : matched
    })
  }
}

/**
 * Creates a locale-specific translation factory with type safety
 *
 * This function returns a set of utilities for working with translations in a specific
 * set of languages. It provides type-safe translation definitions, hooks, and functions
 * that are bound to your language configuration.
 *
 * @template Languages - Union type of supported language strings
 * @returns Object containing translation utilities for the specified languages
 *
 * @example
 * ```typescript
 * // Define your supported languages
 * type AppLanguages = 'en' | 'vi' | 'fr'
 *
 * // Create locale-specific utilities
 * const { assertTranslation, createTranslatorHook, createTranslator } = defineLocale<AppLanguages>()
 *
 * // Use assertTranslation for type-safe translation definitions
 * const translations = assertTranslation({
 *   welcome: { en: "Welcome", vi: "Chào mừng", fr: "Bienvenue" },
 *   goodbye: { en: "Goodbye", vi: "Tạm biệt", fr: "Au revoir" }
 * })
 *
 * // Create a translator for a specific language
 * const t = createTranslator('en')
 * console.log(t(translations.welcome)) // "Welcome"
 * ```
 */
export const defineLocale = <Languages extends string>() => {
  
  /**
   * Type assertion helper for translation definitions with compile-time validation
   *
   * This function ensures that translation objects:
   * - Have all required language keys
   * - Are treated as deeply readonly for immutability
   * - Maintain proper type inference throughout the application
   * - Provide IDE autocompletion and error checking
   *
   * @template T - Translation namespace type, inferred from the argument
   * @param translation - Translation definition object with nested namespaces
   * @returns Deeply readonly version of the translation for safe usage
   *
   * @example
   * ```typescript
   * type Languages = 'en' | 'es'
   * const { assertTranslation } = defineLocale<Languages>()
   *
   * const translations = assertTranslation({
   *   auth: {
   *     login: { en: "Login", es: "Iniciar sesión" },
   *     logout: { en: "Logout", es: "Cerrar sesión" }
   *   },
   *   navigation: {
   *     home: { en: "Home", es: "Inicio" },
   *     about: { en: "About", es: "Acerca de" }
   *   }
   * })
   *
   * // translations is now deeply readonly and type-safe
   * // translations.auth.login.en // ✅ "Login"
   * // translations.auth.login.fr // ❌ TypeScript error
   * ```
   */
  function assertTranslation<T extends Record<string, LocalizedString<Languages> | TranslationNamespace<Languages>>>(translation: T): TDeepReadonly<T> {
    return translation as TDeepReadonly<T>
  }
  
  /**
   * Creates translator hooks bound to a dictionary and the app's language hook.
   *
   * `useTranslator(selection?)` returns `{ t, d, language }`, where `d` is the
   * whole dictionary, one namespace (`'ns'`), several namespaces (`'a', 'b'` or
   * `['a', 'b']`), or a selector's result. Selection only narrows `d`; every
   * language and namespace stays in the bundle. A string returns the namespace
   * itself; an array, even with one item, returns an object keyed by namespace.
   * When `usePreferredLanguage` returns a new language, components using these
   * hooks rerender in it. `t` is recreated on each render.
   *
   * @param options - Configuration object for the translator hook
   * @param options.translation - Complete translation definition with all namespaces
   * @param options.usePreferredLanguage - React hook that returns the current language
   * @returns Object with useTranslator hook and helper functions
   *
   * @example
   * ```typescript
   * type Languages = 'en' | 'vi'
   * const { createTranslatorHook } = defineLocale<Languages>()
   *
   * const translations = {
   *   auth: {
   *     login: { en: "Login", vi: "Đăng nhập" },
   *     register: { en: "Register", vi: "Đăng ký" }
   *   },
   *   common: {
   *     save: { en: "Save", vi: "Lưu" },
   *     cancel: { en: "Cancel", vi: "Hủy" }
   *   }
   * }
   *
   * // Hook that returns current language
   * const useCurrentLanguage = () => {
   *   const [lang] = useState<Languages>('en')
   *   return lang
   * }
   *
   * const { useTranslator } = createTranslatorHook({
   *   translation: translations,
   *   usePreferredLanguage: useCurrentLanguage
   * })
   *
   * // Usage in components:
   * function LoginForm() {
   *   // Load only auth namespace
   *   const { t, d } = useTranslator('auth')
   *   return <button>{t(d.login)}</button>
   * }
   *
   * function ModalButtons() {
   *   // Load multiple namespaces
   *   const { t, d } = useTranslator(['auth', 'common'])
   *   return (
   *     <div>
   *       <button>{t(d.auth.login)}</button>
   *       <button>{t(d.common.save)}</button>
   *     </div>
   *   )
   * }
   *
   * function CustomSelector() {
   *   // Use custom transformation
   *   const { t, d } = useTranslator(trans => ({
   *     buttons: { login: trans.auth.login, save: trans.common.save }
   *   }))
   *   return <button>{t(d.buttons.login)}</button>
   * }
   * ```
   */
  function createTranslatorHook<R extends Record<string, LocalizedString<Languages> | TranslationNamespace<Languages>>>({
                                                                                                                          translation,
                                                                                                                          usePreferredLanguage
                                                                                                                        }: {
    translation: R
    usePreferredLanguage: () => Languages
  }) {
    
    // Overload: No arguments - returns whole translation dictionary
    function useTranslator(): {
      t: ReturnType<typeof createTranslator>
      d: TDeepReadonly<R>
      language: Languages
    }
    
    // Overload: Function selector - custom transformation of dictionary
    function useTranslator<S>(selector: (dict: TDeepReadonly<R>) => S): {
      t: ReturnType<typeof createTranslator>
      d: TDeepReadonly<S>
      language: Languages
    }
    
    // Overload: Single key - returns translation for specific namespace
    function useTranslator<K extends keyof R>(
      key: K
    ): {
      t: ReturnType<typeof createTranslator>
      d: TDeepReadonly<R[K]>
      language: Languages
    }
    
    // Overload: Array of keys - returns translations for multiple namespaces
    function useTranslator<K extends keyof R>(
      selector: ReadonlyArray<K>
    ): {
      t: ReturnType<typeof createTranslator>
      d: { [P in K]: TDeepReadonly<R[P]> }
      language: Languages
    }
    
    // Overload: Multiple key arguments - returns translations for specified namespaces
    function useTranslator<K extends keyof R>(
      firstKey: K,
      ...restKeys: K[]
    ): {
      t: ReturnType<typeof createTranslator>
      d: { [P in K]: TDeepReadonly<R[P]> }
      language: Languages
    }
    
    // Main implementation - handles all overload cases
    function useTranslator<S, K extends keyof R>(
      selectorOrFirstKey?: ((dict: TDeepReadonly<R>) => S) | ReadonlyArray<K> | K,
      ...restKeys: K[]
    ) {
      const currentLanguage = usePreferredLanguage()
      const translateFnc = useCallback(() => createTranslator(currentLanguage), [currentLanguage])
      const fullDict = translation as TDeepReadonly<R>
      
      // Case 1: No arguments - return full dictionary
      if (selectorOrFirstKey === undefined) {
        return {
          t: translateFnc(),
          d: fullDict,
          language: currentLanguage
        }
      }
      
      if (typeof selectorOrFirstKey === 'function') {
        // Case 2: Function selector - apply custom transformation
        const selectedDict = selectorOrFirstKey(fullDict)
        return {
          t: translateFnc(),
          d: selectedDict as TDeepReadonly<S>,
          language: currentLanguage
        }
      } else {
        // Case 3 & 4: Key-based selection
        const keys = Array.isArray(selectorOrFirstKey) ? selectorOrFirstKey : [selectorOrFirstKey, ...restKeys]
        
        // One key passed as a string returns the namespace itself. An array always
        // returns an object keyed by namespace, matching its declared type.
        if (!Array.isArray(selectorOrFirstKey) && keys.length === 1) {
          const key: string = keys[0]
          return {
            t: translateFnc(),
            d: fullDict[key as keyof typeof fullDict] as TDeepReadonly<R[K]>,
            language: currentLanguage
          }
        }
        
        // Multiple keys - build subset dictionary
        const selectedDict: { [P in K]: TDeepReadonly<R[P]> } = {} as { [P in K]: TDeepReadonly<R[P]> }
        keys.forEach((key: keyof typeof fullDict) => {
          selectedDict[key as K] = fullDict[key as keyof typeof fullDict] as TDeepReadonly<R[K]>
        })
        
        return {
          t: translateFnc(),
          d: selectedDict as { [P in K]: TDeepReadonly<R[P]> },
          language: currentLanguage
        }
      }
    }
    
    /**
     * Creates a React hook bound to a specific translation namespace
     *
     * The returned hook takes no arguments and returns `{ t, d, language }` with
     * `d` set to that namespace, so a feature's components autocomplete only
     * the feature's keys.
     *
     * @template K - Key type from the translation namespace
     * @param namespace - The specific namespace key to bind to
     * @returns React hook function that provides translator for the namespace
     *
     * @example
     * ```typescript
     * const { createTranslatorHook } = defineLocale<'en' | 'vi'>()
     *
     * const translations = {
     *   auth: {
     *     login: { en: "Login", vi: "Đăng nhập" },
     *     logout: { en: "Logout", vi: "Đăng xuất" }
     *   },
     *   profile: {
     *     edit: { en: "Edit Profile", vi: "Sửa hồ sơ" },
     *     save: { en: "Save Changes", vi: "Lưu thay đổi" }
     *   }
     * }
     *
     * const { createNamespacedTranslatorHook } = createTranslatorHook({
     *   translation: translations,
     *   usePreferredLanguage: useAppLanguage
     * })
     *
     * // Create specialized hooks for different features
     * export const useAuthTranslator = createNamespacedTranslatorHook('auth')
     * export const useProfileTranslator = createNamespacedTranslatorHook('profile')
     *
     * // Usage in components:
     * function LoginButton() {
     *   const { t, d, language } = useAuthTranslator()
     *   return (
     *     <button data-lang={language}>
     *       {t(d.login)}
     *     </button>
     *   )
     * }
     *
     * function ProfileForm() {
     *   const { t, d } = useProfileTranslator()
     *   return (
     *     <form>
     *       <button type="submit">{t(d.save)}</button>
     *     </form>
     *   )
     * }
     * ```
     */
    const createNamespacedTranslatorHook = <K extends keyof R>(namespace: K) => {
      return () => {
        const currentLanguage = usePreferredLanguage()
        const translateFnc = useCallback(() => createTranslator(currentLanguage), [currentLanguage])
        
        return {
          t: translateFnc(),
          d: translation[namespace] as TDeepReadonly<R[K]>,
          language: currentLanguage
        }
      }
    }
    
    return { useTranslator, createNamespacedTranslatorHook }
  }
  
  return {
    assertTranslation,
    createTranslatorHook,
    createTranslator: createTranslator<Languages>,
  }
}
