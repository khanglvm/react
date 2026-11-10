'use client'

import { createContextState } from '@khanglvm/react'
import type { ProfileState } from './profile'

export const {
  Provider: ProfileProvider,
  useContextState: useProfileState,
  useContextStateValue: useProfileValue,
  useSetContextState: useSetProfile,
  useStateSnapshotGetter: useProfileSnapshot,
} = createContextState<ProfileState>('example-profile')
