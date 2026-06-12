import { useState, type FormEvent } from 'react'
import type { Profile } from '../types'

interface ProfileStepProps {
  initialProfile: Profile
  onContinue: (profile: Profile) => void
}

export function ProfileStep({ initialProfile, onContinue }: ProfileStepProps) {
  const [name, setName] = useState(initialProfile.name)
  const [error, setError] = useState('')

  const doSubmit = () => {
    if (!name.trim()) { setError('Please enter your name.'); return }
    setError('')
    onContinue({ name: name.trim() })
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    doSubmit()
  }

  return (
    <section className="card profile-card">
      <h1>World Cup 2026 Bracket Builder</h1>
      <p>Enter your name to start building your bracket — picks are saved locally.</p>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button type="button" className="primary-btn" onClick={doSubmit}>
          Start Building Your Bracket
        </button>
      </form>
    </section>
  )
}
