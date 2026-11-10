import { useEffect, useState } from 'react'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { ProfileCard } from './components/ProfileCard'
import { ResetButton } from './components/ResetButton'
import { useCommonText } from './i18n/translator'
import { getProfile } from './profile/api'
import { profileStateFrom, type Profile } from './profile/profile'
import { ProfileProvider } from './profile/profile-store'

function Title() {
  const { t, d } = useCommonText()
  useEffect(() => {
    document.title = t(d.appName)
  })
  return <h1>{t(d.appName)}</h1>
}

export function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  useEffect(() => {
    getProfile().then(setProfile)
  }, [])

  return (
    <main>
      <Title />
      <LanguageSwitcher />
      {/* Mount the Provider once the data exists: initialState is read only on mount. */}
      {profile && (
        <ProfileProvider initialState={profileStateFrom(profile)}>
          <ProfileCard />
          <ResetButton />
        </ProfileProvider>
      )}
    </main>
  )
}
