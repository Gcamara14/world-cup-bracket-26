import thirdPlaceAnnexC from '../data/third-place-annex-c.json'
import { groupMatches, matchById, matchesByGroup, teamById } from './data'
import type { GroupTableEntry, Match, MatchAnswer } from '../types'

export type GroupTieBreakers = Record<string, string[]>

export interface GroupPointTie {
  group: string
  points: number
  teamIds: string[]
}

export interface ThirdPlacePointTie {
  points: number
  teamIds: string[]
}

const thirdPlaceLabelToSlot: Record<string, string> = {
  'A/B/C/D/F': '1E',
  'C/D/F/G/H': '1I',
  'C/E/F/H/I': '1A',
  'E/H/I/J/K': '1L',
  'B/E/F/I/J': '1D',
  'A/E/H/I/J': '1G',
  'E/F/G/I/J': '1B',
  'D/E/I/J/L': '1K',
}

function scoreFromAnswer(answer: MatchAnswer | undefined, side: 'home' | 'away'): number {
  if (!answer) return 0
  if (answer.pick === 'draw') return 1
  if (answer.pick === side) return 2
  return 0
}

function pointsFor(teamGoals: number, opponentGoals: number): number {
  if (teamGoals > opponentGoals) return 3
  if (teamGoals === opponentGoals) return 1
  return 0
}

export function computeGroupTables(
  answersByMatchId: Record<string, MatchAnswer>,
  groupTieBreakers: GroupTieBreakers = {},
): Record<string, GroupTableEntry[]> {
  const tables: Record<string, GroupTableEntry[]> = {}

  for (const match of groupMatches) {
    if (!match.homeTeamId || !match.awayTeamId) continue

    const answer = answersByMatchId[match.id]
    const homeGoals = scoreFromAnswer(answer, 'home')
    const awayGoals = scoreFromAnswer(answer, 'away')
    const group = match.group
    if (!tables[group]) tables[group] = []

    let homeRow = tables[group].find((row) => row.teamId === match.homeTeamId)
    if (!homeRow) {
      homeRow = { teamId: match.homeTeamId, points: 0, goalDiff: 0, goalsFor: 0, wins: 0, draws: 0, losses: 0 }
      tables[group].push(homeRow)
    }
    let awayRow = tables[group].find((row) => row.teamId === match.awayTeamId)
    if (!awayRow) {
      awayRow = { teamId: match.awayTeamId, points: 0, goalDiff: 0, goalsFor: 0, wins: 0, draws: 0, losses: 0 }
      tables[group].push(awayRow)
    }

    if (answer?.pick) {
      homeRow.points += pointsFor(homeGoals, awayGoals)
      awayRow.points += pointsFor(awayGoals, homeGoals)
      homeRow.goalDiff += homeGoals - awayGoals
      awayRow.goalDiff += awayGoals - homeGoals
      homeRow.goalsFor += homeGoals
      awayRow.goalsFor += awayGoals
      if (homeGoals > awayGoals) {
        homeRow.wins += 1
        awayRow.losses += 1
      } else if (homeGoals < awayGoals) {
        awayRow.wins += 1
        homeRow.losses += 1
      } else {
        homeRow.draws += 1
        awayRow.draws += 1
      }
    }
  }

  for (const group of Object.keys(tables)) {
    const tieBreakerOrder = groupTieBreakers[group] ?? []
    tables[group].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      const aTieRank = tieBreakerOrder.indexOf(a.teamId)
      const bTieRank = tieBreakerOrder.indexOf(b.teamId)
      if (aTieRank !== -1 || bTieRank !== -1) {
        return (aTieRank === -1 ? Number.MAX_SAFE_INTEGER : aTieRank) - (bTieRank === -1 ? Number.MAX_SAFE_INTEGER : bTieRank)
      }
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
      const aCode = teamById.get(a.teamId)?.fifaCode ?? a.teamId
      const bCode = teamById.get(b.teamId)?.fifaCode ?? b.teamId
      return aCode.localeCompare(bCode)
    })
  }

  return tables
}

interface PlacementMap {
  winnerByGroup: Record<string, string | undefined>
  runnerUpByGroup: Record<string, string | undefined>
  thirdByGroup: Record<string, string | undefined>
  bestThirdTeams: string[]
  thirdPlaceTeamBySlot: Record<string, string | undefined>
}

export function getPlacements(
  tables: Record<string, GroupTableEntry[]>,
  thirdPlaceTieBreakers: string[] = [],
): PlacementMap {
  const winnerByGroup: Record<string, string | undefined> = {}
  const runnerUpByGroup: Record<string, string | undefined> = {}
  const thirdByGroup: Record<string, string | undefined> = {}
  const thirdRows: GroupTableEntry[] = []

  for (const [group, rows] of Object.entries(tables)) {
    winnerByGroup[group] = rows[0]?.teamId
    runnerUpByGroup[group] = rows[1]?.teamId
    thirdByGroup[group] = rows[2]?.teamId
    if (rows[2]) thirdRows.push(rows[2])
  }

  thirdRows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const aTieRank = thirdPlaceTieBreakers.indexOf(a.teamId)
    const bTieRank = thirdPlaceTieBreakers.indexOf(b.teamId)
    if (aTieRank !== -1 || bTieRank !== -1) {
      return (aTieRank === -1 ? Number.MAX_SAFE_INTEGER : aTieRank) - (bTieRank === -1 ? Number.MAX_SAFE_INTEGER : bTieRank)
    }
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
    return b.goalsFor - a.goalsFor
  })

  const thirdPlaceGroups = thirdRows
    .slice(0, 8)
    .map((row) => teamById.get(row.teamId)?.group)
    .filter(Boolean)
    .sort()
    .join('')
  const annexMapping = (thirdPlaceAnnexC as Record<string, Record<string, string>>)[thirdPlaceGroups]
  const thirdPlaceTeamBySlot: Record<string, string | undefined> = {}
  if (annexMapping) {
    for (const [slot, group] of Object.entries(annexMapping)) {
      thirdPlaceTeamBySlot[slot] = thirdByGroup[group]
    }
  }

  return {
    winnerByGroup,
    runnerUpByGroup,
    thirdByGroup,
    bestThirdTeams: thirdRows.map((row) => row.teamId),
    thirdPlaceTeamBySlot,
  }
}

function resolveFromLabel(
  label: string | undefined,
  answersByMatchId: Record<string, MatchAnswer>,
  placements: PlacementMap,
  currentMatchAnswer?: MatchAnswer,
): string | null {
  if (!label) return null

  const winnerGroup = label.match(/^Winner Group ([A-L])$/i)
  if (winnerGroup) {
    return placements.winnerByGroup[winnerGroup[1].toUpperCase()] ?? null
  }

  const runnerUpGroup = label.match(/^Runner-up Group ([A-L])$/i)
  if (runnerUpGroup) {
    return placements.runnerUpByGroup[runnerUpGroup[1].toUpperCase()] ?? null
  }

  const thirdGroup = label.match(/^3rd Group ([A-L](?:\/[A-L])*)$/i)
  if (thirdGroup) {
    if (currentMatchAnswer?.thirdPlaceTeamId) return currentMatchAnswer.thirdPlaceTeamId
    const slot = thirdPlaceLabelToSlot[thirdGroup[1].toUpperCase()]
    if (slot && placements.thirdPlaceTeamBySlot[slot]) return placements.thirdPlaceTeamBySlot[slot] ?? null
    const allowedGroups = thirdGroup[1].split('/')
    const eligible = placements.bestThirdTeams.find((teamId) => {
      const team = teamById.get(teamId)
      return team ? allowedGroups.includes(team.group) : false
    })
    return eligible ?? null
  }

  const winnerMatch = label.match(/^Winner Match (\d+)$/i)
  if (winnerMatch) return getPredictedWinner(winnerMatch[1], answersByMatchId, placements)

  const loserMatch = label.match(/^Loser Match (\d+)$/i)
  if (loserMatch) return getPredictedLoser(loserMatch[1], answersByMatchId, placements)

  return null
}

export function resolveMatchSideTeam(
  match: Match,
  side: 'home' | 'away',
  answersByMatchId: Record<string, MatchAnswer>,
  placements?: PlacementMap,
): string | null {
  const directTeamId = side === 'home' ? match.homeTeamId : match.awayTeamId
  if (directTeamId) return directTeamId

  const label = side === 'home' ? match.homeTeamLabel : match.awayTeamLabel
  if (!label) return null

  const p = placements ?? getPlacements(computeGroupTables(answersByMatchId))
  const answer = answersByMatchId[match.id]
  return resolveFromLabel(label, answersByMatchId, p, answer)
}

export function getPredictedWinner(matchId: string, answersByMatchId: Record<string, MatchAnswer>, placements?: PlacementMap): string | null {
  const match = matchById.get(matchId)
  if (!match) return null
  const answer = answersByMatchId[match.id]
  if (!answer?.pick) return null
  const p = placements ?? getPlacements(computeGroupTables(answersByMatchId))
  const home = resolveMatchSideTeam(match, 'home', answersByMatchId, p)
  const away = resolveMatchSideTeam(match, 'away', answersByMatchId, p)
  if (answer.pick === 'home') return home
  if (answer.pick === 'away') return away
  return null
}

export function getPredictedLoser(matchId: string, answersByMatchId: Record<string, MatchAnswer>, placements?: PlacementMap): string | null {
  const match = matchById.get(matchId)
  if (!match) return null
  const answer = answersByMatchId[match.id]
  if (!answer?.pick) return null
  const p = placements ?? getPlacements(computeGroupTables(answersByMatchId))
  const home = resolveMatchSideTeam(match, 'home', answersByMatchId, p)
  const away = resolveMatchSideTeam(match, 'away', answersByMatchId, p)
  if (answer.pick === 'home') return away
  if (answer.pick === 'away') return home
  return null
}

export function isGroupComplete(group: string, answersByMatchId: Record<string, MatchAnswer>): boolean {
  const gm = matchesByGroup.get(group)
  if (!gm) return false
  return gm.every((m) => answersByMatchId[m.id]?.pick)
}

export function getGroupPointTies(
  tables: Record<string, GroupTableEntry[]>,
  answersByMatchId: Record<string, MatchAnswer>,
  groupTieBreakers: GroupTieBreakers = {},
): GroupPointTie[] {
  const ties: GroupPointTie[] = []

  for (const [group, rows] of Object.entries(tables)) {
    if (!isGroupComplete(group, answersByMatchId)) continue

    const rowsByPoints = new Map<number, string[]>()
    for (const row of rows) {
      const teamIds = rowsByPoints.get(row.points) ?? []
      teamIds.push(row.teamId)
      rowsByPoints.set(row.points, teamIds)
    }

    for (const [points, teamIds] of rowsByPoints) {
      const tieBreakerOrder = groupTieBreakers[group] ?? []
      const unresolvedTeamIds = teamIds.filter((teamId) => !tieBreakerOrder.includes(teamId))
      if (teamIds.length > 1 && unresolvedTeamIds.length > 1) {
        ties.push({ group, points, teamIds: unresolvedTeamIds })
      }
    }
  }

  return ties.sort((a, b) => a.group.localeCompare(b.group) || b.points - a.points)
}

export function getThirdPlacePointTies(
  tables: Record<string, GroupTableEntry[]>,
  answersByMatchId: Record<string, MatchAnswer>,
  thirdPlaceTieBreakers: string[] = [],
): ThirdPlacePointTie[] {
  const allGroupsComplete = Object.keys(tables).every((group) => isGroupComplete(group, answersByMatchId))
  if (!allGroupsComplete) return []

  const thirdRows = Object.values(tables)
    .map((rows) => rows[2])
    .filter(Boolean)

  const rowsByPoints = new Map<number, string[]>()
  for (const row of thirdRows) {
    const teamIds = rowsByPoints.get(row.points) ?? []
    teamIds.push(row.teamId)
    rowsByPoints.set(row.points, teamIds)
  }

  // Return ALL unresolved pairs at once so the user can see the full picture.
  // Each pair is a separate ThirdPlacePointTie entry.
  const sortedPointGroups = [...rowsByPoints.entries()].sort((a, b) => b[0] - a[0])
  const allPairs: ThirdPlacePointTie[] = []
  for (const [points, teamIds] of sortedPointGroups) {
    if (teamIds.length < 2) continue
    const unresolved = teamIds.filter((teamId) => !thirdPlaceTieBreakers.includes(teamId))
    if (unresolved.length >= 2) {
      // Emit successive pairs: (0,1), (1,2), ... so each choice feeds into the next
      for (let i = 0; i < unresolved.length - 1; i++) {
        allPairs.push({ points, teamIds: [unresolved[i], unresolved[i + 1]] })
      }
    }
  }
  return allPairs
}
