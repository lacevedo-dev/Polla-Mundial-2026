import { Injectable } from '@nestjs/common';
import {
  PredictionsService,
  type ProvisionalLeagueImpact,
} from '../../predictions/predictions.service';

export type LeagueGoalImpactSummary = {
  leagueId: string;
  leagueName: string;
  exactScoreCount: number;
  exactScoreNames: string[];
  scoringCount: number;
  topScorers: Array<{ displayName: string; points: number }>;
  popularPredictions: Array<{ score: string; count: number }>;
};

@Injectable()
export class GoalImpactAnalyzerService {
  constructor(private readonly predictions: PredictionsService) {}

  async summarizeByLeague(
    matchId: string,
    homeScore: number,
    awayScore: number,
  ): Promise<LeagueGoalImpactSummary[]> {
    const impacts = await this.predictions.computeProvisionalImpactByLeague(
      matchId,
      homeScore,
      awayScore,
    );
    return impacts.map((impact) => this.summarizeOneLeague(impact));
  }

  summarizeOneLeague(impact: ProvisionalLeagueImpact): LeagueGoalImpactSummary {
    const exactEntries = impact.entries.filter(
      (e) => e.detailType === 'EXACT_SCORE',
    );
    const scoringEntries = impact.entries.filter((e) => e.points > 0);

    const scoreCounts = new Map<string, number>();
    for (const entry of impact.entries) {
      const key = `${entry.predictedHome}-${entry.predictedAway}`;
      scoreCounts.set(key, (scoreCounts.get(key) ?? 0) + 1);
    }

    const popularPredictions = [...scoreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([score, count]) => ({ score, count }));

    const topScorers = [...scoringEntries]
      .sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName))
      .slice(0, 3)
      .map((e) => ({ displayName: e.displayName, points: e.points }));

    return {
      leagueId: impact.leagueId,
      leagueName: impact.leagueName,
      exactScoreCount: exactEntries.length,
      exactScoreNames: exactEntries.slice(0, 5).map((e) => e.displayName),
      scoringCount: scoringEntries.length,
      topScorers,
      popularPredictions,
    };
  }
}
