import { createEventMethod } from '@khanglvm/react'

type ProfileEvents = {
  // Request: every mounted listener answers. The data parameter also gives handlers the abort signal.
  'profile:before-reset': (data: { source: string }) => { allow: boolean }
  // Notification: listeners react, the caller expects no answer.
  'profile:reset': { by: string }
}

export const {
  useEventListener: useProfileEvent,
  emitEvent: emitProfileEvent,
} = createEventMethod<ProfileEvents>()
