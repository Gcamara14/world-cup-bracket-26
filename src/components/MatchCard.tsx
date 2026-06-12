import { useState } from 'react'
import type { Match, MatchAnswer, Team } from '../types'

interface MatchCardProps {
  match: Match
  homeTeam: Team | null
  awayTeam: Team | null
  answer: MatchAnswer
  canDraw: boolean
  disabled?: boolean
  onPick: (pick: 'home' | 'away' | 'draw') => void
}

export function MatchCard({ match, homeTeam, awayTeam, answer, canDraw, disabled = false, onPick }: MatchCardProps) {
  const homeLabel = homeTeam?.name ?? match.homeTeamLabel ?? 'TBD'
  const awayLabel = awayTeam?.name ?? match.awayTeamLabel ?? 'TBD'
  const homeSource = match.homeTeamLabel && homeTeam ? match.homeTeamLabel : null
  const awaySource = match.awayTeamLabel && awayTeam ? match.awayTeamLabel : null

  const [lastPick, setLastPick] = useState<'home' | 'away' | 'draw' | null>(null)

  const handlePick = (pick: 'home' | 'away' | 'draw') => {
    if (disabled) return
    console.log(`%c[BUTTON CLICK] Picking ${pick} for Match ${match.id}`, 'color: #d97706; font-weight: bold')
    setLastPick(pick)
    onPick(pick)
    setTimeout(() => setLastPick(null), 500)
  }

  const homeWon = lastPick === 'home' || (answer.pick === 'home' && !lastPick)
  const awayWon = lastPick === 'away' || (answer.pick === 'away' && !lastPick)

  return (
    <article className="card match-card-compact">
      <div className="match-meta">
        <span>Match {match.id}</span>
        <span>{match.stage.toUpperCase()}</span>
        <span>{match.localDate}</span>
      </div>
      <div className="match-title-compact">
        <span className={`team-side ${homeWon ? 'team-picked' : ''} ${awayWon ? 'team-out' : ''}`}>
          {homeWon && <span className="trophy-pop">🏆</span>}
          {homeTeam && <img src={homeTeam.flag} alt={homeTeam.name} className="team-flag" />}
          <span className="team-text">
            <strong className={awayWon ? '' : ''}>{homeLabel}</strong>
            {homeSource && <small className="source-label">{homeSource}</small>}
          </span>
        </span>
        <span className="vs">vs</span>
        <span className={`team-side ${awayWon ? 'team-picked' : ''} ${homeWon ? 'team-out' : ''}`}>
          {awayWon && <span className="trophy-pop">🏆</span>}
          {awayTeam && <img src={awayTeam.flag} alt={awayTeam.name} className="team-flag" />}
          <span className="team-text">
            <strong>{awayLabel}</strong>
            {awaySource && <small className="source-label">{awaySource}</small>}
          </span>
        </span>
      </div>
      <div className="pick-row">
        <button
          type="button"
          className={`pick-chip ${answer.pick === 'home' ? 'active' : ''}`}
          onClick={() => handlePick('home')}
          disabled={disabled}
        >
          {homeTeam && <img src={homeTeam.flag} alt="" className="btn-flag" />}
          {homeTeam?.fifaCode ?? 'HOME'}
          <kbd>A</kbd>
        </button>
        {canDraw && (
          <button
            type="button"
            className={`pick-chip ${answer.pick === 'draw' ? 'active' : ''}`}
            onClick={() => handlePick('draw')}
            disabled={disabled}
          >
            Draw
            <kbd>S</kbd>
          </button>
        )}
        <button
          type="button"
          className={`pick-chip ${answer.pick === 'away' ? 'active' : ''}`}
          onClick={() => handlePick('away')}
          disabled={disabled}
        >
          {awayTeam && <img src={awayTeam.flag} alt="" className="btn-flag" />}
          {awayTeam?.fifaCode ?? 'AWAY'}
          <kbd>D</kbd>
        </button>
      </div>
    </article>
  )
}
