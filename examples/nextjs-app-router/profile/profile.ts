// Plain module: server components can import these, unlike exports of a 'use client' file.
export type Profile = { id: string; name: string }

export type ProfileState = {
  profile: Profile
  draftName: string
  status: 'idle' | 'saving' | 'saved' | 'failed'
}

export function profileStateFrom(profile: Profile): ProfileState {
  return { profile, draftName: profile.name, status: 'idle' }
}
