import { describe, expect, it } from 'vitest';
import {
    formatGoalScorersByPlayer,
    partitionGoalsByTeam,
} from './matchEvents';
import type { MatchEventItem } from '../hooks/useLiveSyncEvents';

const goal = (
    minute: number,
    playerName: string,
    teamId: string | null = null,
): MatchEventItem => ({
    type: 'GOAL',
    detail: 'Normal Goal',
    playerName,
    assistName: null,
    minute,
    extraMin: null,
    teamId,
});

describe('partitionGoalsByTeam', () => {
    it('assigns multiple home goals without teamId to the home side', () => {
        const goals = [
            goal(5, 'Brobbey'),
            goal(17, 'Brobbey'),
        ];

        const { homeGoals, awayGoals } = partitionGoalsByTeam(
            goals,
            'home-id',
            'away-id',
            2,
            0,
        );

        expect(homeGoals).toHaveLength(2);
        expect(awayGoals).toHaveLength(0);
    });

    it('lista autogoles bajo el equipo del jugador, no el beneficiario', () => {
        const goals = [
            {
                ...goal(39, 'C. Ronaldo', 'home-id'),
                detail: 'Normal Goal',
            },
            {
                ...goal(60, 'A. Khusanov', 'home-id'),
                detail: 'Own Goal',
            },
        ];

        const { homeGoals, awayGoals } = partitionGoalsByTeam(
            goals,
            'home-id',
            'away-id',
            2,
            0,
        );

        expect(homeGoals.map((g) => g.playerName)).toEqual(['C. Ronaldo']);
        expect(awayGoals.map((g) => g.playerName)).toEqual(['A. Khusanov']);
    });
});

describe('formatGoalScorersByPlayer', () => {
    it('groups minutes by scorer', () => {
        const lines = formatGoalScorersByPlayer([
            goal(5, 'Brian Brobbey'),
            goal(17, 'Brian Brobbey'),
        ]);

        expect(lines).toEqual(["Brobbey 5', 17'"]);
    });
});
