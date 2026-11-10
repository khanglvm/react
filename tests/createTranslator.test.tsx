import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as React from 'react'
import { renderToString } from 'react-dom/server'
import { createTranslator, defineLocale } from '../src/libs/createTranslator'

const t = createTranslator<'en' | 'vi'>('en')
const entry = (en: string) => ({ en, vi: '' })

test('replacement keys are literal text, including RegExp characters', () => {
  assert.equal(t(entry('Item {0} of {1}'), { '{0}': 2, '{1}': 5 }), 'Item 2 of 5')
  assert.equal(t(entry('Total: $total.'), { '$total': '9' }), 'Total: 9.')
  assert.equal(t(entry('a.b and axb'), { 'a.b': 'X' }), 'X and axb')
  assert.equal(t(entry('(x) [y] a|b c\\d'), { '(x)': '1', '[y]': '2', 'a|b': '3', 'c\\d': '4' }), '1 2 3 4')
})

test('the longest key wins where keys overlap, and matching ignores case', () => {
  assert.equal(t(entry('{name} / {name_full}'), { '{name}': 'K', '{name_full}': 'Khang Le' }), 'K / Khang Le')
  assert.equal(t(entry('name / name_full'), { name: 'K', name_full: 'Khang Le' }), 'K / Khang Le')
  assert.equal(t(entry('Hello {NAME}'), { '{name}': 'Khang' }), 'Hello Khang')
})

test('empty keys are ignored instead of matching everywhere', () => {
  assert.equal(t(entry('Hello'), { '': 'x' }), 'Hello')
  assert.equal(t(entry('Hello {name}'), { '': 'x', '{name}': 'Khang' }), 'Hello Khang')
})

test('a namespace array always returns an object keyed by namespace', () => {
  const locale = defineLocale<'en' | 'vi'>()
  const translation = locale.assertTranslation({
    common: { save: { en: 'Save', vi: 'Lưu' } },
    profile: { title: { en: 'Profile', vi: 'Hồ sơ' } },
  })
  const { useTranslator } = locale.createTranslatorHook({ translation, usePreferredLanguage: () => 'vi' })
  let results: unknown[] = []
  function Probe() {
    const one = useTranslator(['common'])
    const single = useTranslator('common')
    const both = useTranslator('common', 'profile')
    results = [one.d, single.d, both.d, one.t(one.d.common.save)]
    return null
  }
  renderToString(<Probe />)
  assert.deepEqual(results[0], { common: translation.common })
  assert.equal(results[1], translation.common)
  assert.deepEqual(results[2], { common: translation.common, profile: translation.profile })
  assert.equal(results[3], 'Lưu')
})
