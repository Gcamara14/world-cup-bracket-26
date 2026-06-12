import { useState, type FormEvent } from 'react'
import type { Profile } from '../types'

interface ProfileStepProps {
  initialProfile: Profile
  onContinue: (profile: Profile) => void
}

export function ProfileStep({ initialProfile, onContinue }: ProfileStepProps) {
  const [name, setName] = useState(initialProfile.name)
  const [email, setEmail] = useState(initialProfile.email)
  const [error, setError] = useState('')

  const doSubmit = () => {
    if (!name.trim()) { setError('Please enter your name.'); return }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) { setError('Please enter a valid email.'); return }
    setError('')
    onContinue({ name: name.trim(), email: email.trim() })
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    doSubmit()
  }

  return (
    <section className="card profile-card">
      <h1>World Cup 2026 Bracket Builder</h1>
      <p>Enter your details to start your wizard and save your picks locally.</p>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button type="button" className="primary-btn" onClick={doSubmit}>
          Start Wizard
        </button>
      </form>
    </section>
  )
}
