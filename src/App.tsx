import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ProfileStep } from './components/ProfileStep'
import { ReviewExport } from './components/ReviewExport'
import { Wizard } from './components/Wizard'
import { BracketVisualizer } from './components/BracketVisualizer'
import { matches } from './lib/data'
import { computeGroupTables, getGroupPointTies, getThirdPlacePointTies } from './lib/bracket'
import { clearState, loadState, saveState } from './lib/storage'
import type { AppState, Profile } from './types'

function App() {
  const [state, setState] = useState<AppState>(() => {
    return (
      loadState() ?? {
        profile: { name: '', email: '' },
        answersByMatchId: {},
        groupTieBreakers: {},
        thirdPlaceTieBreakers: [],
        activeStep: 0,
      }
    )
  })
  const [started, setStarted] = useState(Boolean(state.profile.name))
  const [showReview, setShowReview] = useState(Boolean(state.completedAt))
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    saveState(state)
  }, [state])

  const completion = useMemo(() => {
    const picked = Object.values(state.answersByMatchId).filter((entry) => entry.pick).length
    return { picked, total: matches.length }
  }, [state.answersByMatchId])

  const handleProfileContinue = (profile: Profile) => {
    setState((prev) => ({ ...prev, profile }))
    setStarted(true)
  }

  const handleFinish = () => {
    setState((prev) => {
      const allPicked = Object.values(prev.answersByMatchId).filter((e) => e.pick).length >= matches.length
      if (!allPicked) return prev

      const tables = computeGroupTables(prev.answersByMatchId, prev.groupTieBreakers)
      const ties = getGroupPointTies(
        tables,
        prev.answersByMatchId,
        prev.groupTieBreakers,
      )
      const thirdPlaceTies = getThirdPlacePointTies(
        tables,
        prev.answersByMatchId,
        prev.thirdPlaceTieBreakers,
      )
      if (ties.length || thirdPlaceTies.length) return prev

      setTimeout(() => setShowReview(true), 0)
      return { ...prev, completedAt: new Date().toISOString() }
    })
  }

  const confirmReset = () => {
    clearState()
    setState({
      profile: { name: '', email: '' },
      answersByMatchId: {},
      groupTieBreakers: {},
      thirdPlaceTieBreakers: [],
      activeStep: 0,
    })
    setStarted(false)
    setShowReview(false)
    setShowConfirm(false)
  }

  return (
    <main className="app-shell">
      <p className="topline">
        {completion.picked}/{completion.total} picks saved locally
      </p>
      {!started ? (
        <ProfileStep initialProfile={state.profile} onContinue={handleProfileContinue} />
      ) : showReview ? (
        <ReviewExport
          state={state}
          onEdit={() => setShowReview(false)}
          onResetRequest={() => setShowConfirm(true)}
        />
      ) : (
        <div className="split-view">
          <Wizard
            state={state}
            onStateChange={setState}
            onFinish={handleFinish}
            onResetRequest={() => setShowConfirm(true)}
          />
          <BracketVisualizer state={state} />
        </div>
      )}
      <ConfirmDialog
        open={showConfirm}
        title="Reset your bracket?"
        description="This is destructive and cannot be undone. Your saved local picks will be erased."
        onCancel={() => setShowConfirm(false)}
        onConfirm={confirmReset}
      />
    </main>
  )
}

export default App
