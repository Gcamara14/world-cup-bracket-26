import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const SOURCE_REPO = 'https://github.com/rezarahiminia/worldcup2026'
const RAW_BASE = 'https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main'
const COMMIT_API = 'https://api.github.com/repos/rezarahiminia/worldcup2026/commits/main'

const outputDir = join(process.cwd(), 'src', 'data')

async function getJson(url, attempts = 5) {
  let lastError = null
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`)
      }
      return response.json()
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 1000 * (index + 1)))
    }
  }
  throw lastError ?? new Error(`Failed to fetch ${url}`)
}

function normalizeTeam(team) {
  // Fix Scotland and England flags which use different ISO codes in flagcdn
  let iso2 = team.iso2.toLowerCase()
  if (iso2 === 'sco') iso2 = 'gb-sct'
  if (iso2 === 'eng') iso2 = 'gb-eng'

  return {
    id: String(team.id),
    name: team.name_en,
    fifaCode: team.fifa_code,
    iso2: team.iso2,
    flag: `https://flagcdn.com/${iso2}.svg`,
    group: team.groups,
  }
}

function normalizeStadium(stadium) {
  return {
    id: String(stadium.id),
    fifaName: stadium.fifa_name,
    city: stadium.city_en,
    country: stadium.country_en,
  }
}

function normalizeMatch(match) {
  return {
    id: String(match.id),
    group: String(match.group),
    matchday: Number(match.matchday),
    localDate: String(match.local_date),
    stage: String(match.type),
    homeTeamId: match.home_team_id !== '0' ? String(match.home_team_id) : null,
    awayTeamId: match.away_team_id !== '0' ? String(match.away_team_id) : null,
    homeTeamLabel: match.home_team_label || undefined,
    awayTeamLabel: match.away_team_label || undefined,
    stadiumId: String(match.stadium_id),
  }
}

async function main() {
  const [rawMatches, rawTeams, rawStadiums, commit] = await Promise.all([
    getJson(`${RAW_BASE}/football.matches.json`),
    getJson(`${RAW_BASE}/football.teams.json`),
    getJson(`${RAW_BASE}/football.stadiums.json`),
    getJson(COMMIT_API),
  ])

  const matches = rawMatches.map(normalizeMatch)
  const teams = rawTeams.map(normalizeTeam)
  const stadiums = rawStadiums.map(normalizeStadium)
  const sourceMetadata = {
    sourceRepo: SOURCE_REPO,
    sourceCommit: commit.sha,
    sourceDate: commit.commit?.author?.date ?? '',
    refreshedAt: new Date().toISOString(),
    matchCount: matches.length,
  }

  await mkdir(outputDir, { recursive: true })
  await Promise.all([
    writeFile(join(outputDir, 'matches.json'), JSON.stringify(matches, null, 2)),
    writeFile(join(outputDir, 'teams.json'), JSON.stringify(teams, null, 2)),
    writeFile(join(outputDir, 'stadiums.json'), JSON.stringify(stadiums, null, 2)),
    writeFile(join(outputDir, 'source-metadata.json'), JSON.stringify(sourceMetadata, null, 2)),
  ])

  console.log(`Updated data snapshot: ${matches.length} matches`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
