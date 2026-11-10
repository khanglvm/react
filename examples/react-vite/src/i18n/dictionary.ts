import { assertTranslation } from './locale'

// Each leaf keeps every language side by side. A missing language is a type error.
export const translation = assertTranslation({
  common: {
    appName: { en: 'Team settings', vi: 'Cài đặt nhóm' },
    language: { en: 'Language', vi: 'Ngôn ngữ' },
  },
  profile: {
    greeting: { en: 'Hello, {name}!', vi: 'Xin chào, {name}!' },
    nameLabel: { en: 'Display name', vi: 'Tên hiển thị' },
    save: { en: 'Save', vi: 'Lưu' },
    saving: { en: 'Saving…', vi: 'Đang lưu…' },
    saved: { en: 'Saved', vi: 'Đã lưu' },
    saveFailed: {
      en: 'Could not save, so the previous name is back.',
      vi: 'Không lưu được nên đã trả lại tên cũ.',
    },
    reset: { en: 'Reset', vi: 'Đặt lại' },
    confirmDiscard: {
      en: 'Discard your unsaved name?',
      vi: 'Bỏ thay đổi tên chưa lưu?',
    },
  },
})
