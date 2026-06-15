import { useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { matches, matchesByStage, sourceMetadata, teamById } from '../lib/data'
import { computeGroupTables, getPlacements, getPredictedWinner, resolveMatchSideTeam } from '../lib/bracket'
import { BracketVisualizer } from './BracketVisualizer'
import type { AppState } from '../types'

interface ReviewExportProps {
  state: AppState
  onEdit: () => void
  onResetRequest: () => void
}

const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
const knockoutStages = ['r32', 'r16', 'qf', 'sf', 'third', 'final'] as const
const stageLabels: Record<string, string> = { r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-Finals', sf: 'Semi-Finals', third: '3rd Place', final: 'Final' }

export function ReviewExport({ state, onEdit, onResetRequest }: ReviewExportProps) {
  const exportRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { tables, placements, championId, runnerUpId, thirdPlaceId } = useMemo(() => {
    const t = computeGroupTables(state.answersByMatchId, state.groupTieBreakers)
    const p = getPlacements(t, state.thirdPlaceTieBreakers)
    const finalMatch = matches.find((m) => m.stage === 'final')
    const thirdMatch = matches.find((m) => m.stage === 'third')
    const champ = finalMatch ? getPredictedWinner(finalMatch.id, state.answersByMatchId, p) : null
    let runner: string | null = null
    if (finalMatch) {
      const answer = state.answersByMatchId[finalMatch.id]
      if (answer?.pick) {
        const losingSide = answer.pick === 'home' ? 'away' : 'home'
        runner = resolveMatchSideTeam(finalMatch, losingSide, state.answersByMatchId, p)
      }
    }
    const third = thirdMatch ? getPredictedWinner(thirdMatch.id, state.answersByMatchId, p) : null
    return { tables: t, placements: p, championId: champ, runnerUpId: runner, thirdPlaceId: third }
  }, [state.answersByMatchId, state.groupTieBreakers, state.thirdPlaceTieBreakers])

  const champion = championId ? teamById.get(championId) : null
  const runnerUp = runnerUpId ? teamById.get(runnerUpId) : null
  const thirdPlace = thirdPlaceId ? teamById.get(thirdPlaceId) : null

  const captureExportSheet = async () => {
    if (!exportRef.current) return null
    setExporting(true)
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

    const node = exportRef.current
    const width = Math.ceil(Math.max(node.scrollWidth, node.offsetWidth))
    const height = Math.ceil(Math.max(node.scrollHeight, node.offsetHeight))

    return toPng(node, {
      pixelRatio: 2,
      width,
      height,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        maxWidth: 'none',
        overflow: 'visible',
      },
    })
  }

  const downloadScreenshot = async () => {
    if (!exportRef.current) return
    setBusy(true)
    try {
      const dataUrl = await captureExportSheet()
      if (!dataUrl) return
      const link = document.createElement('a')
      link.download = `world-cup-2026-${state.profile.name || 'bracket'}.png`
      link.href = dataUrl
      link.click()
    } finally {
      setExporting(false)
      setBusy(false)
    }
  }

  const downloadPdf = async () => {
    if (!exportRef.current) return
    setBusy(true)
    try {
      const dataUrl = await captureExportSheet()
      if (!dataUrl) return
      const pdf = new jsPDF('p', 'mm', 'a4')
      const width = pdf.internal.pageSize.getWidth()
      const height = pdf.internal.pageSize.getHeight()
      const image = new Image()
      image.src = dataUrl

      await new Promise<void>((resolve) => {
        image.onload = () => resolve()
      })

      const ratio = image.width / image.height
      const imageHeight = width / ratio
      let y = 0
      let page = 0
      while (y < imageHeight) {
        if (page > 0) pdf.addPage()
        pdf.addImage(dataUrl, 'PNG', 0, -y, width, imageHeight)
        y += height
        page += 1
      }

      pdf.save(`world-cup-2026-${state.profile.name || 'bracket'}.pdf`)
    } finally {
      setExporting(false)
      setBusy(false)
    }
  }

  return (
    <section className="wizard-shell">
      <div className="wizard-actions">
        <button type="button" className="ghost-btn" onClick={onEdit}>
          Back To Wizard
        </button>
        <button type="button" className="danger-btn" onClick={onResetRequest}>
          Reset
        </button>
        <button type="button" className="primary-btn" disabled={busy} onClick={downloadScreenshot}>
          Export Screenshot
        </button>
        <button type="button" className="primary-btn" disabled={busy} onClick={downloadPdf}>
          Export PDF
        </button>
      </div>

      <div className={`export-sheet${exporting ? ' is-exporting' : ''}`} ref={exportRef}>
        <div className="champion-section card">
          {champion ? (
            <>
              <div className="champion-trophy">🏆</div>
              <h1 className="champion-name">
                <img src={champion.flag} alt="" className="team-flag" />
                {champion.name}
              </h1>
              <p className="champion-subtitle">
                {state.profile.name}'s predicted World Cup 2026 Champion
              </p>
              {runnerUp && (
                <p className="runner-up-line">
                  Runner-up: <img src={runnerUp.flag} alt="" className="btn-flag" /> <strong>{runnerUp.name}</strong>
                </p>
              )}
            </>
          ) : (
            <>
              <div className="champion-trophy">⚽</div>
              <h1 className="champion-name">Predictions Incomplete</h1>
              <p className="champion-subtitle">Finish all picks to see your champion</p>
            </>
          )}
        </div>

        <div className="card export-method-summary">
          <h3>How This Bracket Was Built</h3>
          <p>
            {state.profile.name} picked all {matches.length} World Cup matches from the group stage through the final.
            Group standings were calculated from those picks, tied teams were resolved with tiebreakers, and each knockout
            round advanced the selected winners until the champion was crowned.
          </p>
        </div>

        <BracketVisualizer state={state} />

        <div className="card summary-narrative">
          <h3>Prediction Summary</h3>
          <p className="summary-meta">
            <strong>{state.profile.name}</strong> &middot; {' '}
            {Object.values(state.answersByMatchId).filter((a) => a.pick).length}/{matches.length} picks
          </p>

          {(champion || runnerUp || thirdPlace) && (
            <div className="summary-podium">
              {champion && (
                <div className="summary-podium-item summary-podium-item--1st">
                  <span className="summary-podium-medal">🏆</span>
                  <img src={champion.flag} alt="" className="btn-flag" />
                  <span className="summary-podium-name">{champion.fifaCode}</span>
                  <span className="summary-podium-label">Champion</span>
                </div>
              )}
              {runnerUp && (
                <div className="summary-podium-item summary-podium-item--2nd">
                  <span className="summary-podium-medal">🥈</span>
                  <img src={runnerUp.flag} alt="" className="btn-flag" />
                  <span className="summary-podium-name">{runnerUp.fifaCode}</span>
                  <span className="summary-podium-label">Runner-up</span>
                </div>
              )}
              {thirdPlace && (
                <div className="summary-podium-item summary-podium-item--3rd">
                  <span className="summary-podium-medal">🥉</span>
                  <img src={thirdPlace.flag} alt="" className="btn-flag" />
                  <span className="summary-podium-name">{thirdPlace.fifaCode}</span>
                  <span className="summary-podium-label">3rd Place</span>
                </div>
              )}
            </div>
          )}

          <div className="summary-sections">
            <div className="summary-block">
              <h4>Group Stage Qualifiers</h4>
              <div className="summary-group-grid">
                {groupLetters.map((group) => {
                  const rows = tables[group] ?? []
                  const top2 = rows.slice(0, 2)
                  return (
                    <div key={group} className="summary-group-item">
                      <span className="summary-group-label">Group {group}</span>
                      <span className="summary-qualifier-list">
                        {top2.map((row, idx) => {
                          const team = teamById.get(row.teamId)
                          return team ? (
                            <span key={team.id} className="summary-qualifier">
                              <span className={`summary-position summary-position--${idx === 0 ? '1st' : '2nd'}`}>
                                {idx === 0 ? '1st' : '2nd'}
                              </span>
                              <img src={team.flag} alt="" className="btn-flag" />
                              {team.fifaCode}
                            </span>
                          ) : null
                        })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="summary-block">
              <h4>Knockout Path</h4>
              <div className="knockout-path">
                {knockoutStages.map((stage) => {
                  const stageMatches = matchesByStage.get(stage) ?? []
                  const advancers = stageMatches
                    .map((m) => getPredictedWinner(m.id, state.answersByMatchId, placements))
                    .filter(Boolean)
                    .map((id) => teamById.get(id!))
                    .filter(Boolean)

                  if (!advancers.length) return null
                  return (
                    <div key={stage} className="knockout-stage-row">
                      <span className="knockout-stage-label">{stageLabels[stage]}</span>
                      <span className="knockout-advancers">
                        {advancers.map((team) => (
                          <span key={team!.id} className="summary-qualifier">
                            <img src={team!.flag} alt="" className="btn-flag" />
                            {team!.fifaCode}
                          </span>
                        ))}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <p className="summary-footer">
            Data: <code>{sourceMetadata.sourceCommit.slice(0, 10)}</code> &middot; Generated {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </section>
  )
}
