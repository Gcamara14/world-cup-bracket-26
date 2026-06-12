import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { matches, teamById } from '../lib/data'
import { computeGroupTables, getGroupPointTies, getPlacements, getThirdPlacePointTies, resolveMatchSideTeam } from '../lib/bracket'
import type { GroupPointTie, ThirdPlacePointTie } from '../lib/bracket'
import type { AppState, MatchAnswer } from '../types'
import { MatchCard } from './MatchCard'
import { ProgressBar } from './ProgressBar'

interface WizardProps {
  state: AppState
  onStateChange: Dispatch<SetStateAction<AppState>>
  onFinish: () => void
  onResetRequest: () => void
}

const stageLabels: Record<string, { title: string; subtitle: string }> = {
  group: { title: 'Group Stage', subtitle: 'Pick a winner or draw for each group match' },
  r32: { title: 'Knockout: Round of 32', subtitle: 'No draws — pick who advances' },
  r16: { title: 'Knockout: Round of 16', subtitle: 'Pick who moves to the quarter-finals' },
  qf: { title: 'Quarter-finals', subtitle: 'Pick who reaches the semis' },
  sf: { title: 'Semi-finals', subtitle: 'Pick who reaches the final' },
  third: { title: 'Third Place Match', subtitle: 'Pick the third-place winner' },
  final: { title: 'Final', subtitle: 'Pick your World Cup champion' },
}

export function Wizard({ state, onStateChange, onFinish, onResetRequest }: WizardProps) {
  const total = matches.length
  const currentMatch = (matches[state.activeStep] ?? matches[0])!
  const answer = state.answersByMatchId[currentMatch.id] ?? ({} as MatchAnswer)
  const currentHasPick = !!answer.pick

  const completed = useMemo(
    () => Object.values(state.answersByMatchId).filter((entry) => entry.pick).length,
    [state.answersByMatchId],
  )

  const allPicked = completed === total

  const placements = useMemo(() => {
    if (currentMatch.stage === 'group') return undefined
    const tables = computeGroupTables(state.answersByMatchId, state.groupTieBreakers)
    return getPlacements(tables, state.thirdPlaceTieBreakers)
  }, [currentMatch.stage, state.answersByMatchId, state.groupTieBreakers, state.thirdPlaceTieBreakers])

  const homeTeamId = resolveMatchSideTeam(currentMatch, 'home', state.answersByMatchId, placements)
  const awayTeamId = resolveMatchSideTeam(currentMatch, 'away', state.answersByMatchId, placements)
  const homeTeam = homeTeamId ? teamById.get(homeTeamId) ?? null : null
  const awayTeam = awayTeamId ? teamById.get(awayTeamId) ?? null : null

  const canDraw = currentMatch.stage === 'group'
  const stageCopy = stageLabels[currentMatch.stage] ?? { title: currentMatch.stage.toUpperCase(), subtitle: 'Make your pick' }
  const [inputLocked, setInputLocked] = useState(false)
  const [tiePrompt, setTiePrompt] = useState<GroupPointTie[]>([])
  const [thirdPlaceTiePrompt, setThirdPlaceTiePrompt] = useState<ThirdPlacePointTie[]>([])
  const stateRef = useRef(state)
  const inputLockedRef = useRef(false)
  const dialogOpenRef = useRef(false)
  const advanceTimerRef = useRef<number | null>(null)
  const pressedKeysRef = useRef(new Set<string>())
  stateRef.current = state
  dialogOpenRef.current = tiePrompt.length > 0 || thirdPlaceTiePrompt.length > 0

  const setLocked = useCallback((locked: boolean) => {
    inputLockedRef.current = locked
    setInputLocked(locked)
  }, [])

  const clearPendingAdvance = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
    setLocked(false)
  }, [setLocked])

  const getTiePrompt = useCallback((
    answersByMatchId: Record<string, MatchAnswer>,
    groupTieBreakers = stateRef.current.groupTieBreakers,
    thirdPlaceTieBreakers = stateRef.current.thirdPlaceTieBreakers,
  ): { groupTies: GroupPointTie[]; thirdPlaceTies: ThirdPlacePointTie[] } => {
    const tables = computeGroupTables(answersByMatchId, groupTieBreakers)
    return {
      groupTies: getGroupPointTies(tables, answersByMatchId, groupTieBreakers),
      thirdPlaceTies: getThirdPlacePointTies(tables, answersByMatchId, thirdPlaceTieBreakers),
    }
  }, [])

  useEffect(() => {
    setLocked(false)
    return () => {
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current)
        advanceTimerRef.current = null
      }
    }
  }, [state.activeStep, setLocked])

  const scheduleAdvance = useCallback((stepAtPick: number) => {
    if (advanceTimerRef.current !== null) return

    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null
      onStateChange((prev) => {
        if (prev.activeStep !== stepAtPick) return prev
        const nextMatch = matches[stepAtPick + 1]
        if (nextMatch && nextMatch.stage !== 'group') {
          const ties = getTiePrompt(prev.answersByMatchId, prev.groupTieBreakers, prev.thirdPlaceTieBreakers)
          if (ties.groupTies.length || ties.thirdPlaceTies.length) {
            // TODO: ideally the tie dialog should animate in more gracefully rather
            // than flashing over the pick animation — delay it slightly for now.
            window.setTimeout(() => {
              setTiePrompt(ties.groupTies)
              setThirdPlaceTiePrompt(ties.thirdPlaceTies)
            }, 350)
            setLocked(false)
            return prev
          }
        }
        if (stepAtPick >= total - 1) {
          const allDone = Object.values(prev.answersByMatchId).filter((e) => e.pick).length >= total
          if (allDone) setTimeout(onFinish, 0)
          return prev
        }
        return { ...prev, activeStep: stepAtPick + 1 }
      })
    }, 400)
  }, [getTiePrompt, onFinish, onStateChange, setLocked, total])

  const doPick = useCallback((pick: 'home' | 'away' | 'draw') => {
    if (inputLockedRef.current) return

    const stepAtPick = stateRef.current.activeStep
    const m = matches[stepAtPick] ?? matches[0]
    if (pick === 'draw' && m.stage !== 'group') return

    setLocked(true)
    setTiePrompt([])
    setThirdPlaceTiePrompt([])
    onStateChange((prev) => {
      if (prev.activeStep !== stepAtPick) return prev
      console.log(
        `%c[PICK] Match ${m.id} (step ${stepAtPick}) | Stage: ${m.stage} | Pick: ${pick}`,
        'color: #0b65d8; font-weight: bold',
      )
      return {
        ...prev,
        answersByMatchId: {
          ...prev.answersByMatchId,
          [m.id]: { ...prev.answersByMatchId[m.id], pick },
        },
      }
    })
    scheduleAdvance(stepAtPick)
  }, [onStateChange, scheduleAdvance, setLocked])

  const goNext = useCallback(() => {
    if (inputLockedRef.current) return
    onStateChange((prev) => {
      const m = matches[prev.activeStep] ?? matches[0]
      if (!prev.answersByMatchId[m.id]?.pick) return prev
      const nextMatch = matches[prev.activeStep + 1]
      if (nextMatch && nextMatch.stage !== 'group') {
        const ties = getTiePrompt(prev.answersByMatchId, prev.groupTieBreakers, prev.thirdPlaceTieBreakers)
        if (ties.groupTies.length || ties.thirdPlaceTies.length) {
          setTiePrompt(ties.groupTies)
          setThirdPlaceTiePrompt(ties.thirdPlaceTies)
          return prev
        }
      }
      if (prev.activeStep >= total - 1) {
        const allDone = Object.values(prev.answersByMatchId).filter((e) => e.pick).length >= total
        if (allDone) setTimeout(onFinish, 0)
        return prev
      }
      return { ...prev, activeStep: prev.activeStep + 1 }
    })
  }, [getTiePrompt, onFinish, onStateChange, total])

  const goBack = useCallback(() => {
    clearPendingAdvance()
    onStateChange((prev) => ({ ...prev, activeStep: Math.max(0, prev.activeStep - 1) }))
  }, [clearPendingAdvance, onStateChange])

  useEffect(() => {
    const pressedKeys = pressedKeysRef.current
    const handleKeyDown = (e: KeyboardEvent) => {
      if (dialogOpenRef.current) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const key = e.key.toLowerCase()
      if (e.repeat || pressedKeys.has(key)) return
      pressedKeys.add(key)

      const cur = matches[stateRef.current.activeStep]
      const isGroup = cur?.stage === 'group'

      // Quick pick shortcuts: A=home, S=draw, D=away, W=back
      if (key === 'a' || key === '1') {
        e.preventDefault()
        doPick('home')
      } else if (key === 's' || key === '2') {
        if (isGroup) {
          e.preventDefault()
          doPick('draw')
        }
      } else if (key === 'd' || key === '3') {
        e.preventDefault()
        doPick('away')
      } else if (key === 'w' || key === 'arrowleft') {
        e.preventDefault()
        goBack()
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.delete(e.key.toLowerCase())
    }
    const handleBlur = () => {
      pressedKeys.clear()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      pressedKeys.clear()
    }
  }, [doPick, goBack])

  const touchRef = useRef<{ startX: number; startY: number } | null>(null)
  const wizardRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = wizardRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      touchRef.current = { startX: touch.clientX, startY: touch.clientY }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchRef.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchRef.current.startX
      const dy = touch.clientY - touchRef.current.startY
      touchRef.current = null

      if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return

      if (dx > 0) {
        goBack()
      } else {
        goNext()
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [goBack, goNext])

  const reviewFirstTie = useCallback(() => {
    const firstTie = tiePrompt[0]
    if (!firstTie) {
      setTiePrompt([])
      return
    }

    const groupStep = matches.findIndex((match) => match.stage === 'group' && match.group === firstTie.group)
    setTiePrompt([])
    if (groupStep >= 0) {
      clearPendingAdvance()
      onStateChange((prev) => ({ ...prev, activeStep: groupStep }))
    }
  }, [clearPendingAdvance, onStateChange, tiePrompt])

  const chooseTieBreaker = useCallback((tie: GroupPointTie, winnerTeamId: string) => {
    onStateChange((prev) => ({
      ...prev,
      groupTieBreakers: {
        ...prev.groupTieBreakers,
        [tie.group]: [
          ...(prev.groupTieBreakers?.[tie.group] ?? []).filter((teamId) => teamId !== winnerTeamId),
          winnerTeamId,
        ],
      },
    }))

    setTiePrompt((prev) => prev.filter((item) => item !== tie))
  }, [onStateChange])

  const chooseThirdPlaceTieBreaker = useCallback((_tie: ThirdPlacePointTie, winnerTeamId: string) => {
    onStateChange((prev) => {
      const newTieBreakers = [
        ...(prev.thirdPlaceTieBreakers ?? []).filter((teamId) => teamId !== winnerTeamId),
        winnerTeamId,
      ]
      const tables = computeGroupTables(prev.answersByMatchId, prev.groupTieBreakers)
      const nextThirdTies = getThirdPlacePointTies(tables, prev.answersByMatchId, newTieBreakers)
      setThirdPlaceTiePrompt(nextThirdTies)
      return { ...prev, thirdPlaceTieBreakers: newTieBreakers }
    })
  }, [onStateChange])

  return (
    <section className="wizard-shell" ref={wizardRef}>
      <div className="wizard-sticky-panel">
        <ProgressBar current={completed} total={total} label={`Stage: ${currentMatch.stage.toUpperCase()}`} />
        <div className={`stage-banner stage-${currentMatch.stage}`}>
          <span className="stage-eyebrow">Current Stage</span>
          <strong>{stageCopy.title}</strong>
          <span>{stageCopy.subtitle}</span>
        </div>
        <MatchCard
          match={currentMatch}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          answer={answer}
          canDraw={canDraw}
          disabled={inputLocked}
          onPick={doPick}
        />
        <div className="wizard-actions">
          <button type="button" className="ghost-btn" onClick={goBack} disabled={state.activeStep === 0}>
            Back
          </button>
          <button type="button" className="danger-btn" onClick={onResetRequest}>
            Reset
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={goNext}
            disabled={!currentHasPick}
          >
            {allPicked ? 'Finish' : 'Forward'}
          </button>
        </div>
        <p className="keybind-hint">
          <kbd>A</kbd> left &nbsp; <kbd>S</kbd> draw &nbsp; <kbd>D</kbd> right &nbsp; <kbd>W</kbd> back
        </p>
      </div>
      {(tiePrompt.length > 0 || thirdPlaceTiePrompt.length > 0) && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card tie-prompt" role="dialog" aria-modal="true" aria-label="Fix group ties">
            <h3>Break the tie</h3>
            <p>These teams are level on points. Pick who finishes higher.</p>
            <div className="tie-prompt-list">
              {tiePrompt.map((tie) => (
                <div key={`${tie.group}-${tie.points}-${tie.teamIds.join('-')}`} className="tie-choice-card">
                  <strong>Group {tie.group} · {tie.points} pts each</strong>
                  <div className="tie-choice-buttons">
                    {tie.teamIds.map((teamId) => {
                      const team = teamById.get(teamId)
                      return (
                        <button
                          key={teamId}
                          type="button"
                          className="tie-choice-btn"
                          onClick={() => chooseTieBreaker(tie, teamId)}
                        >
                          {team && <img src={team.flag} alt="" className="btn-flag" />}
                          {team?.name ?? teamId}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              {thirdPlaceTiePrompt.map((tie) => {
                const [teamAId, teamBId] = tie.teamIds
                const teamA = teamById.get(teamAId)
                const teamB = teamById.get(teamBId)
                return (
                  <div key={`third-${tie.points}-${tie.teamIds.join('-')}`} className="tie-choice-card">
                    <strong>Best 3rd place · {tie.points} pts each</strong>
                    <p className="tie-choice-desc">Who ranks higher?</p>
                    <div className="tie-choice-buttons">
                      <button
                        key={teamAId}
                        type="button"
                        className="tie-choice-btn"
                        onClick={() => chooseThirdPlaceTieBreaker(tie, teamAId)}
                      >
                        {teamA && <img src={teamA.flag} alt="" className="btn-flag" />}
                        {teamA?.name ?? teamAId}
                      </button>
                      <button
                        key={teamBId}
                        type="button"
                        className="tie-choice-btn"
                        onClick={() => chooseThirdPlaceTieBreaker(tie, teamBId)}
                      >
                        {teamB && <img src={teamB.flag} alt="" className="btn-flag" />}
                        {teamB?.name ?? teamBId}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={reviewFirstTie}>
                Go review group
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
