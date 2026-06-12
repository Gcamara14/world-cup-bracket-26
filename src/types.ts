export type MatchStage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'

export interface Team {
  id: string
  name: string
  fifaCode: string
  iso2: string
  flag: string
  group: string
}

export interface Stadium {
  id: string
  fifaName: string
  city: string
  country: string
}

export interface Match {
  id: string
  group: string
  matchday: number
  localDate: string
  stage: MatchStage
  homeTeamId: string | null
  awayTeamId: string | null
  homeTeamLabel?: string
  awayTeamLabel?: string
  stadiumId: string
}

export interface SourceMetadata {
  sourceRepo: string
  sourceCommit: string
  sourceDate: string
  refreshedAt: string
  matchCount: number
}

export interface Profile {
  name: string
  email?: string
}

export type MatchPick = 'home' | 'away' | 'draw'

export interface MatchAnswer {
  pick?: MatchPick
  thirdPlaceTeamId?: string
}

export interface AppState {
  profile: Profile
  answersByMatchId: Record<string, MatchAnswer>
  groupTieBreakers?: Record<string, string[]>
  thirdPlaceTieBreakers?: string[]
  activeStep: number
  completedAt?: string
}

export interface GroupTableEntry {
  teamId: string
  points: number
  goalDiff: number
  goalsFor: number
  wins: number
  draws: number
  losses: number
}
