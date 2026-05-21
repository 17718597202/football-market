/**
 * football-data.org 客户端
 * 免费档：10 req/min，覆盖 12 大主流联赛
 */

const BASE = process.env.FOOTBALL_DATA_BASE_URL || 'https://api.football-data.org/v4';

function headers() {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) throw new Error('FOOTBALL_DATA_API_KEY 未配置');
  return { 'X-Auth-Token': key };
}

/** 主流联赛代码 */
export const COMPETITIONS = {
  PL: 'Premier League',
  PD: 'La Liga',
  BL1: 'Bundesliga',
  SA: 'Serie A',
  FL1: 'Ligue 1',
  CL: 'Champions League',
  EL: 'Europa League',
  EC: 'European Championship',
  WC: 'World Cup',
} as const;

export type CompetitionCode = keyof typeof COMPETITIONS;

export type FdMatch = {
  id: number;
  utcDate: string;
  status: string; // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | POSTPONED | CANCELLED
  competition: { code: string; name: string };
  homeTeam: { id: number; name: string; shortName?: string; crest?: string };
  awayTeam: { id: number; name: string; shortName?: string; crest?: string };
  score: {
    fullTime: { home: number | null; away: number | null };
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
  };
};

/** 拉取指定联赛某日期范围的比赛 */
export async function listMatches(
  competition: CompetitionCode,
  options: { dateFrom?: string; dateTo?: string } = {}
): Promise<FdMatch[]> {
  const params = new URLSearchParams();
  if (options.dateFrom) params.set('dateFrom', options.dateFrom);
  if (options.dateTo) params.set('dateTo', options.dateTo);

  const url = `${BASE}/competitions/${competition}/matches${
    params.toString() ? '?' + params.toString() : ''
  }`;
  const res = await fetch(url, { headers: headers(), next: { revalidate: 60 } });
  if (!res.ok) {
    throw new Error(`football-data ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { matches: FdMatch[] };
  return json.matches || [];
}

/** 拉取单场比赛详情 */
export async function getMatch(id: number | string): Promise<FdMatch | null> {
  const url = `${BASE}/matches/${id}`;
  const res = await fetch(url, { headers: headers(), next: { revalidate: 30 } });
  if (!res.ok) return null;
  return (await res.json()) as FdMatch;
}

/** 把 FD 状态映射成我们的状态 */
export function mapStatus(fdStatus: string): string {
  switch (fdStatus) {
    case 'SCHEDULED':
    case 'TIMED':
      return 'SCHEDULED';
    case 'IN_PLAY':
    case 'PAUSED':
      return 'LIVE';
    case 'FINISHED':
      return 'FINISHED';
    case 'POSTPONED':
      return 'POSTPONED';
    case 'CANCELLED':
    case 'SUSPENDED':
      return 'CANCELLED';
    default:
      return 'SCHEDULED';
  }
}

/** 把 FD 比分结果映射成市场胜出 key */
export function winnerToKey(winner: string | null): string | null {
  if (winner === 'HOME_TEAM') return 'HOME';
  if (winner === 'AWAY_TEAM') return 'AWAY';
  if (winner === 'DRAW') return 'DRAW';
  return null;
}
