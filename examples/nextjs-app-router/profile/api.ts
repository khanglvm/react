import type { Profile } from './profile'

// Stand-in for a real request. Names containing "fail" are rejected so the demo can show rollback.
export async function saveProfileName(id: string, name: string): Promise<Profile> {
  await new Promise(resolve => setTimeout(resolve, 600))
  if (name.toLowerCase().includes('fail')) throw new Error('Rejected by the server')
  return { id, name }
}

export async function getProfile(): Promise<Profile> {
  return { id: 'user-1', name: 'Khang' }
}
