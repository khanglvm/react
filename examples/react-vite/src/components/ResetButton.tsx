import { emitProfileEvent } from '../profile/events'
import { useProfileValue, useSetProfile } from '../profile/profile-store'
import { useProfileText } from '../i18n/translator'

export function ResetButton() {
  const { t, d } = useProfileText()
  const savedName = useProfileValue(state => state.profile.name)
  const setState = useSetProfile(false)

  async function reset() {
    // Ask every mounted listener first. No listener means no objection.
    const answers = await emitProfileEvent('profile:before-reset', { source: 'reset-button' })
    if (answers.some(answer => answer?.allow === false)) return
    setState({ draftName: savedName, status: 'idle' })
    await emitProfileEvent('profile:reset', { by: 'reset-button' })
  }

  return <button onClick={reset}>{t(d.reset)}</button>
}
