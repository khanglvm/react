import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ProfileCard } from '@/components/ProfileCard'
import { ResetButton } from '@/components/ResetButton'
import { getServerTranslator } from '@/i18n/server'
import { getProfile } from '@/profile/api'
import { profileStateFrom } from '@/profile/profile'
import { ProfileProvider } from '@/profile/profile-store'

export default async function Page() {
  const { t, d } = await getServerTranslator()
  const profile = await getProfile()

  return (
    <main>
      <h1>{t(d.common.appName)}</h1>
      <p data-testid="server-line">{t(d.common.renderedOnServer)}</p>
      <LanguageSwitcher />
      {/* Server data seeds the store once. Later edits live in the store. */}
      <ProfileProvider initialState={profileStateFrom(profile)}>
        <ProfileCard />
        <ResetButton />
      </ProfileProvider>
    </main>
  )
}
