/**
 * Translation utilities for creating type-safe, multi-language React hooks
 *
 * This module provides utilities to create internationalization (i18n) hooks that:
 * - Support multiple languages with type safety
 * - Allow text interpolation with variables
 * - Provide namespace-based translation access
 * - Work seamlessly with React hooks pattern
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
 * Creates a translation function for a specific language with interpolation support
 *
 * This function creates a translator that:
 * - Selects text for the specified language
 * - Handles placeholder replacement using {key} syntax
 * - Supports string and number interpolation
 * - Falls back to empty string if language not found
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
 * // With interpolation
 * const personalGreeting = t(
 *   { en: "Hello {name}, you have {count} messages", vi: "Xin chào {name}, bạn có {count} tin nhắn" },
 *   { name: "John", count: 5 }
 * )
 * // Returns: "Hello John, you have 5 messages"
 *
 * // Fallback behavior
 * const t2 = createTranslator('fr')
 * const text = t2({ en: "Hello", vi: "Xin chào" })
 * // Returns: "" (empty string fallback)
 * ```
 */
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
    
    const replaceKeys = Object.keys(replace)
    if (replaceKeys.length === 0) {
      return matchedText
    }
    
    // Create a case-insensitive lookup map for replacement values
    const caseInsensitiveReplace = Object.fromEntries(
      replaceKeys.map(key => [key.toLowerCase(), replace[key]])
    )
    
    // Create regex to match all replacement keys and substitute values
    const regex = new RegExp(replaceKeys.join('|'), 'gi')
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
   * Creates advanced React hooks for translation management with namespace selection
   *
   * This factory function creates a powerful translation hook system that supports:
   * - Multiple namespace selection strategies
   * - Performance optimization through selective loading
   * - Custom transformation functions
   * - Automatic language switching
   * - Type-safe translation access
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
        
        // Single key optimization - return namespace directly
        if (keys.length === 1) {
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
     * This function creates a specialized hook that always returns translations
     * for a specific namespace, providing better performance and cleaner code
     * for components that only need access to a particular feature area.
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
