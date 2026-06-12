import { useMemo, useState, useEffect, memo } from 'react'
import { computeGroupTables, getGroupPointTies, getPlacements, resolveMatchSideTeam, isGroupComplete } from '../lib/bracket'
import { matches, matchesByGroup, matchesByStage, teamById, teamMatchesInGroup } from '../lib/data'
import type { AppState, GroupTableEntry, Match, MatchAnswer } from '../types'

interface BracketVisualizerProps {
  state: AppState
}

const bracketOrder: Record<string, string[]> = {
  r32: ['74', '77', '73', '75', '83', '84', '81', '82', '76', '78', '79', '80', '86', '88', '85', '87'],
  r16: ['89', '90', '93', '94', '91', '92', '95', '96'],
  qf: ['97', '98', '99', '100'],
  sf: ['101', '102'],
  final: ['104'],
}

const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
const roundMeta = [
  { id: 'r32', label: 'ROUND OF 32' },
  { id: 'r16', label: 'ROUND OF 16' },
  { id: 'qf', label: 'QUARTER-FINALS' },
  { id: 'sf', label: 'SEMI-FINALS' },
  { id: 'final', label: 'FINAL' },
]

const stageMatchesCache = new Map<string, Match[]>()
function getStageMatches(stage: string): Match[] {
  if (stageMatchesCache.has(stage)) return stageMatchesCache.get(stage)!
  const order = bracketOrder[stage]
  const result = (matchesByStage.get(stage) ?? []).slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
  stageMatchesCache.set(stage, result)
  return result
}

function getTeamResults(teamId: string, group: string, answersByMatchId: Record<string, MatchAnswer>): ('win' | 'loss' | 'draw' | 'none')[] {
  const teamMatches = teamMatchesInGroup.get(`${teamId}:${group}`)
  if (!teamMatches) return []
  return teamMatches.map((m) => {
    const answer = answersByMatchId[m.id]
    if (!answer?.pick) return 'none'
    const isHome = m.homeTeamId === teamId
    if (answer.pick === 'draw') return 'draw'
    if ((answer.pick === 'home' && isHome) || (answer.pick === 'away' && !isHome)) return 'win'
    return 'loss'
  })
}

const GroupStageTab = memo(function GroupStageTab({ state, tables, groupAdvancers, groupTiesByGroup, activeMatch }: {
  state: AppState
  tables: Record<string, GroupTableEntry[]>
  groupAdvancers: Set<string>
  groupTiesByGroup: Map<string, Set<string>>
  activeMatch: Match | undefined
}) {
  const sortedGroups = useMemo(() => {
    const activeGroup = activeMatch?.stage === 'group' ? activeMatch.group : null
    return [...groupLetters].sort((a, b) => {
      if (a === activeGroup && b !== activeGroup) return -1
      if (b === activeGroup && a !== activeGroup) return 1
      const aDone = isGroupComplete(a, state.answersByMatchId)
      const bDone = isGroupComplete(b, state.answersByMatchId)
      if (aDone !== bDone) return aDone ? 1 : -1
      return a.localeCompare(b)
    })
  }, [activeMatch, state.answersByMatchId])

  return (
    <div className="standings-full">
      {sortedGroups.map((group) => {
        const rows = tables[group] ?? []
        const gMatches = matchesByGroup.get(group) ?? []
        const allGroupMatchesPicked = isGroupComplete(group, state.answersByMatchId)
        const fallbackTeamIds = Array.from(
          new Set(gMatches.flatMap((match) => [match.homeTeamId, match.awayTeamId].filter(Boolean))),
        ) as string[]
        const teamIds = rows.length ? rows.map((row) => row.teamId) : fallbackTeamIds
        const isActiveGroup = activeMatch?.stage === 'group' && activeMatch.group === group
        const tiedTeamIds = groupTiesByGroup.get(group)
        const hasPointTie = !!tiedTeamIds?.size

        return (
          <section key={group} className={`standings-group-block ${isActiveGroup ? 'active' : ''} ${allGroupMatchesPicked ? 'completed' : ''} ${hasPointTie ? 'has-tie' : ''}`}>
            <h4>
              Group {group}
              {hasPointTie && <span className="tie-badge">Fix tie</span>}
            </h4>
            {hasPointTie && <p className="group-tie-note">Teams tied on points. Choose a tiebreaker before knockout.</p>}
            <div className="standings-table">
              <div className="standings-header-row">
                <span></span>
                <span>Team</span>
                <span>Pts</span>
                <span>Form</span>
              </div>
              {teamIds.map((teamId, index) => {
                const team = teamById.get(teamId)
                if (!team) return null
                const row = rows.find((entry) => entry.teamId === teamId)
                const hasTeamTie = !!tiedTeamIds?.has(teamId)
                const advances = allGroupMatchesPicked && !hasPointTie && groupAdvancers.has(teamId)
                const eliminated = allGroupMatchesPicked && !hasPointTie && !groupAdvancers.has(teamId)
                const results = getTeamResults(teamId, group, state.answersByMatchId)
                const placement = allGroupMatchesPicked
                  ? index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : '4th'
                  : null

                return (
                  <div key={team.id} className={`standings-team-row ${advances ? 'row-advances' : ''} ${eliminated ? 'row-eliminated' : ''} ${hasTeamTie ? 'row-tied' : ''}`}>
                    <span className="rank-num">{index + 1}</span>
                    <span className="team-cell">
                      <img src={team.flag} alt="" className="btn-flag" />
                      <strong className={eliminated ? 'strikethrough' : ''}>{team.name}</strong>
                      {advances && <span className="advance-badge">{placement}</span>}
                      {eliminated && <span className="elim-badge">Out</span>}
                      {hasTeamTie && <span className="tie-badge">Tie</span>}
                    </span>
                    <span className="pts-cell">{row?.points ?? 0}</span>
                    <span className="form-cell">
                      {results.map((r, i) => (
                        <span key={i} className={`form-dot form-${r}`}>
                          {r === 'win' && '✓'}
                          {r === 'loss' && '✗'}
                          {r === 'draw' && '−'}
                        </span>
                      ))}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
})

const KnockoutTab = memo(function KnockoutTab({ state, placements, hasAnyKnockoutPick, activeMatch }: {
  state: AppState
  placements: ReturnType<typeof getPlacements>
  hasAnyKnockoutPick: boolean
  activeMatch: Match | undefined
}) {
  return (
    <div className={`google-bracket-scroll ${hasAnyKnockoutPick ? 'bracket-revealed' : ''}`}>
      <div className="google-bracket-grid">
        {roundMeta.map((round, roundIndex) => (
          <section key={round.id} className="google-round" style={{ gridColumn: roundIndex + 1 }}>
            <h3>{round.label}</h3>
            <div className="round-matches">
              {getStageMatches(round.id).map((match) => {
                const homeId = resolveMatchSideTeam(match, 'home', state.answersByMatchId, placements)
                const awayId = resolveMatchSideTeam(match, 'away', state.answersByMatchId, placements)
                const home = homeId ? teamById.get(homeId) : null
                const away = awayId ? teamById.get(awayId) : null
                const answer = state.answersByMatchId[match.id]
                const isActive = activeMatch?.id === match.id
                const hasPick = !!answer?.pick
                const homePicked = answer?.pick === 'home'
                const awayPicked = answer?.pick === 'away'

                return (
                  <article
                    key={match.id}
                    className={`google-match-card ${isActive ? 'active' : ''} ${hasPick ? 'decided' : ''}`}
                  >
                    <span className="match-time">{match.localDate}</span>
                    <div className={`google-team-row ${homePicked ? 'picked' : ''} ${hasPick && !homePicked ? 'not-picked' : ''}`}>
                      <span className={`result-dot ${homePicked ? 'dot-picked' : ''} ${hasPick && !homePicked ? 'dot-out' : ''}`} />
                      {home ? <img src={home.flag} alt="" className="btn-flag" /> : <span className="shield-placeholder" />}
                      <span className="team-name">{home?.fifaCode ?? match.homeTeamLabel ?? 'TBD'}</span>
                    </div>
                    <div className={`google-team-row ${awayPicked ? 'picked' : ''} ${hasPick && !awayPicked ? 'not-picked' : ''}`}>
                      <span className={`result-dot ${awayPicked ? 'dot-picked' : ''} ${hasPick && !awayPicked ? 'dot-out' : ''}`} />
                      {away ? <img src={away.flag} alt="" className="btn-flag" /> : <span className="shield-placeholder" />}
                      <span className="team-name">{away?.fifaCode ?? match.awayTeamLabel ?? 'TBD'}</span>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
})

export function BracketVisualizer({ state }: BracketVisualizerProps) {
  const tables = useMemo(
    () => computeGroupTables(state.answersByMatchId, state.groupTieBreakers),
    [state.answersByMatchId, state.groupTieBreakers],
  )
  const placements = useMemo(() => getPlacements(tables, state.thirdPlaceTieBreakers), [state.thirdPlaceTieBreakers, tables])
  const activeMatch = matches[state.activeStep]

  const hasAnyKnockoutPick = useMemo(() => {
    return matches.some(
      (m) => m.stage !== 'group' && state.answersByMatchId[m.id]?.pick,
    )
  }, [state.answersByMatchId])

  const [activeTab, setActiveTab] = useState<'groups' | 'knockout'>(hasAnyKnockoutPick ? 'knockout' : 'groups')

  useEffect(() => {
    if (hasAnyKnockoutPick) {
      setActiveTab('knockout')
    }
  }, [hasAnyKnockoutPick])

  const groupAdvancers = useMemo(() => {
    const advancers = new Set<string>()
    for (const rows of Object.values(tables)) {
      if (rows[0]) advancers.add(rows[0].teamId)
      if (rows[1]) advancers.add(rows[1].teamId)
    }
    return advancers
  }, [tables])

  const groupTiesByGroup = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const tie of getGroupPointTies(tables, state.answersByMatchId, state.groupTieBreakers)) {
      const teamIds = map.get(tie.group) ?? new Set<string>()
      tie.teamIds.forEach((teamId) => teamIds.add(teamId))
      map.set(tie.group, teamIds)
    }
    return map
  }, [state.answersByMatchId, state.groupTieBreakers, tables])

  return (
    <section className="google-bracket-shell card">
      <div className="google-bracket-header">
        <div>
          <h2>Standings</h2>
          <p>Pick through groups, then follow the knockout path to the champion.</p>
        </div>
        <span className="season-pill">World Cup 2026</span>
      </div>

      <div className="bracket-tabs">
        <button
          className={`bracket-tab ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          Group Stage
        </button>
        <button
          className={`bracket-tab ${activeTab === 'knockout' ? 'active' : ''}`}
          onClick={() => setActiveTab('knockout')}
        >
          Knockout Stage
        </button>
      </div>

      {activeTab === 'groups' && (
        <GroupStageTab
          state={state}
          tables={tables}
          groupAdvancers={groupAdvancers}
          groupTiesByGroup={groupTiesByGroup}
          activeMatch={activeMatch}
        />
      )}

      {activeTab === 'knockout' && (
        <KnockoutTab
          state={state}
          placements={placements}
          hasAnyKnockoutPick={hasAnyKnockoutPick}
          activeMatch={activeMatch}
        />
      )}
    </section>
  )
}
