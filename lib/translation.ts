/**
 * 足球队名与联赛中文翻译字典
 */

const TEAM_MAP: Record<string, string> = {
  // ================= 英超 (Premier League) =================
  'Chelsea': '切尔西',
  'Chelsea FC': '切尔西',
  'Arsenal': '阿森纳',
  'Arsenal FC': '阿森纳',
  'Manchester City': '曼城',
  'Manchester City FC': '曼城',
  'Manchester United': '曼联',
  'Manchester United FC': '曼联',
  'Liverpool': '利物浦',
  'Liverpool FC': '利物浦',
  'Tottenham Hotspur': '热刺',
  'Tottenham Hotspur FC': '热刺',
  'Aston Villa': '阿斯顿维拉',
  'Aston Villa FC': '阿斯顿维拉',
  'Newcastle United': '纽卡斯尔联',
  'Newcastle United FC': '纽卡斯尔联',
  'West Ham United': '西汉姆联',
  'West Ham United FC': '西汉姆联',
  'Brighton & Hove Albion': '布莱顿',
  'Brighton & Hove Albion FC': '布莱顿',
  'Wolverhampton Wanderers': '狼队',
  'Wolverhampton Wanderers FC': '狼队',
  'Crystal Palace': '水晶宫',
  'Crystal Palace FC': '水晶宫',
  'Everton': '埃弗顿',
  'Everton FC': '埃弗顿',
  'Bournemouth': '伯恩茅斯',
  'AFC Bournemouth': '伯恩茅斯',
  'Brentford': '布伦特福德',
  'Brentford FC': '布伦特福德',
  'Fulham': '富勒姆',
  'Fulham FC': '富勒姆',
  'Nottingham Forest': '诺丁汉森林',
  'Nottingham Forest FC': '诺丁汉森林',
  'Leicester City': '莱斯特城',
  'Leicester City FC': '莱斯特城',
  'Ipswich Town': '伊普斯维奇',
  'Ipswich Town FC': '伊普斯维奇',
  'Southampton': '南安普顿',
  'Southampton FC': '南安普顿',
  'Sheffield United': '谢菲尔德联',
  'Sheffield United FC': '谢菲尔德联',
  'Luton Town': '卢顿',
  'Luton Town FC': '卢顿',
  'Burnley': '伯恩利',
  'Burnley FC': '伯恩利',

  // ================= 西甲 (La Liga) =================
  'Real Madrid': '皇家马德里',
  'Real Madrid CF': '皇家马德里',
  'FC Barcelona': '巴塞罗那',
  'Barcelona': '巴塞罗那',
  'Atlético Madrid': '马德里竞技',
  'Club Atlético de Madrid': '马德里竞技',
  'Real Sociedad': '皇家社会',
  'Real Sociedad de Fútbol': '皇家社会',
  'Villarreal': '比利亚雷亚尔',
  'Villarreal CF': '比利亚雷亚尔',
  'Real Betis': '皇家贝蒂斯',
  'Real Betis Balompié': '皇家贝蒂斯',
  'Sevilla': '塞维利亚',
  'Sevilla FC': '塞维利亚',
  'Athletic Club': '毕尔巴鄂竞技',
  'Athletic Bilbao': '毕尔巴鄂竞技',
  'Girona': '赫罗纳',
  'Girona FC': '赫罗纳',
  'Valencia': '瓦伦西亚',
  'Valencia CF': '瓦伦西亚',

  // ================= 德甲 (Bundesliga) =================
  'Bayern Munich': '拜仁慕尼黑',
  'FC Bayern München': '拜仁慕尼黑',
  'Borussia Dortmund': '多特蒙德',
  'BVB': '多特蒙德',
  'Bayer Leverkusen': '勒沃库森',
  'Bayer 04 Leverkusen': '勒沃库森',
  'RB Leipzig': '莱比锡',

  // ================= 意甲 (Serie A) =================
  'Juventus': '尤文图斯',
  'Juventus FC': '尤文图斯',
  'Inter': '国际米兰',
  'Inter Milan': '国际米兰',
  'FC Internazionale Milano': '国际米兰',
  'AC Milan': 'AC米兰',
  'Napoli': '那不勒斯',
  'SSC Napoli': '那不勒斯',
  'AS Roma': '罗马',
  'Roma': '罗马',
  'Lazio': '拉齐奥',
  'SS Lazio': '拉齐奥',

  // ================= 法甲 (Ligue 1) =================
  'Paris Saint-Germain': '巴黎圣日耳曼',
  'Paris Saint-Germain FC': '巴黎圣日耳曼',
  'PSG': '巴黎圣日耳曼',
};

const COMPETITION_MAP: Record<string, string> = {
  'Premier League': '英超',
  'La Liga': '西甲',
  'Primera Division': '西甲',
  'Bundesliga': '德甲',
  'Serie A': '意甲',
  'Ligue 1': '法甲',
  'UEFA Champions League': '欧冠',
  'Champions League': '欧冠',
};

export function translateTeam(name: string): string {
  if (!name) return name;
  const cleanName = name.trim();
  // 1. 精确匹配
  if (TEAM_MAP[cleanName]) return TEAM_MAP[cleanName];

  // 2. 去除常见尾缀再匹配一次
  const stripped = cleanName.replace(/\s+(FC|CF|de\s+Madrid|Balompié|de\s+Fútbol)$/i, '').trim();
  if (TEAM_MAP[stripped]) return TEAM_MAP[stripped];

  return name;
}

export function translateCompetition(name: string): string {
  if (!name) return name;
  const cleanName = name.trim();
  return COMPETITION_MAP[cleanName] || name;
}
