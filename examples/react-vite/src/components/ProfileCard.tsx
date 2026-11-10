import { saveProfileName } from '../profile/api'
import { useProfileEvent } from '../profile/events'
import { useProfileSnapshot, useProfileState, useProfileValue } from '../profile/profile-store'
import { useProfileText } from '../i18n/translator'

function Greeting() {
  const { t, d } = useProfileText()
  // Rerenders only when the saved name changes, not on every keystroke.
  const name = useProfileValue(state => state.profile.name)
  return <h2>{t(d.greeting, { '{name}': name })}</h2>
}

function StatusLine() {
  const { t, d } = useProfileText()
  const status = useProfileValue(state => state.status)
  if (status === 'idle') return null
  const text = { saving: d.saving, saved: d.saved, failed: d.saveFailed }[status]
  return <p role="status">{t(text)}</p>
}

export function ProfileCard() {
  const { t, d } = useProfileText()
  const [draftName, setState] = useProfileState(state => state.draftName)
  const getSnapshot = useProfileSnapshot()

  // Another component may ask before it resets the profile. Answer from the latest state.
  useProfileEvent('profile:before-reset', () => {
    const { draftName: draft, profile } = getSnapshot()
    return { allow: draft === profile.name || window.confirm(t(d.confirmDiscard)) }
  })

  async function save() {
    const { profile, draftName: name } = getSnapshot()
    // Optimistic update: show the new name now and keep the function that undoes it.
    const revert = setState(draft => {
      draft.profile.name = name
      draft.status = 'saving'
    })
    try {
      await saveProfileName(profile.id, name)
      setState({ status: 'saved' })
    } catch {
      revert()
      setState(draft => {
        draft.draftName = draft.profile.name
        draft.status = 'failed'
      })
    }
  }

  return (
    <section>
      <Greeting />
      <label>
        {t(d.nameLabel)}{' '}
        <input value={draftName} onChange={event => setState({ draftName: event.target.value, status: 'idle' })} />
      </label>{' '}
      <button onClick={save}>{t(d.save)}</button>
      <StatusLine />
    </section>
  )
}
