import matchesData from '../data/matches.json'
import teamsData from '../data/teams.json'
import stadiumsData from '../data/stadiums.json'
import sourceMetadataData from '../data/source-metadata.json'
import type { Match, SourceMetadata, Stadium, Team } from '../types'

export const teams = teamsData as Team[]
const stageOrder: Record<string, number> = { group: 1, r32: 2, r16: 3, qf: 4, sf: 5, third: 6, final: 7 }

export const matches = (matchesData as Match[]).sort((a, b) => {
  if (stageOrder[a.stage] !== stageOrder[b.stage]) {
    return stageOrder[a.stage] - stageOrder[b.stage]
  }
  if (a.stage === 'group' && a.group !== b.group) {
    return a.group.localeCompare(b.group)
  }
  return Number(a.id) - Number(b.id)
})
export const stadiums = stadiumsData as Stadium[]
export const sourceMetadata = sourceMetadataData as SourceMetadata

export const teamById = new Map(teams.map((team) => [team.id, team]))
export const matchById = new Map(matches.map((m) => [m.id, m]))
export const stadiumById = new Map(stadiums.map((stadium) => [stadium.id, stadium]))

export const groupMatches = matches.filter((m) => m.stage === 'group')
export const matchesByGroup = new Map<string, Match[]>()
for (const m of groupMatches) {
  const arr = matchesByGroup.get(m.group) ?? []
  arr.push(m)
  matchesByGroup.set(m.group, arr)
}

export const matchesByStage = new Map<string, Match[]>()
for (const m of matches) {
  const arr = matchesByStage.get(m.stage) ?? []
  arr.push(m)
  matchesByStage.set(m.stage, arr)
}

export const teamMatchesInGroup = new Map<string, Match[]>()
for (const m of groupMatches) {
  if (m.homeTeamId) {
    const key = `${m.homeTeamId}:${m.group}`
    const arr = teamMatchesInGroup.get(key) ?? []
    arr.push(m)
    teamMatchesInGroup.set(key, arr)
  }
  if (m.awayTeamId) {
    const key = `${m.awayTeamId}:${m.group}`
    const arr = teamMatchesInGroup.get(key) ?? []
    arr.push(m)
    teamMatchesInGroup.set(key, arr)
  }
}
