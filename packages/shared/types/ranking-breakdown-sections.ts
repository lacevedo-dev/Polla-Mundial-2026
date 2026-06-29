export const KNOCKOUT_PHASE_ORDER = [
    'ROUND_OF_32',
    'ROUND_OF_16',
    'QUARTER',
    'SEMI',
    'THIRD_PLACE',
    'FINAL',
] as const;

export function formatRankingPhaseLabel(phase: string): string {
    switch (phase) {
        case 'GROUP':
            return 'Fase de grupos';
        case 'ROUND_OF_32':
            return 'Dieciseisavos';
        case 'ROUND_OF_16':
            return 'Octavos';
        case 'QUARTER':
            return 'Cuartos';
        case 'SEMI':
            return 'Semifinal';
        case 'THIRD_PLACE':
            return 'Tercer puesto';
        case 'FINAL':
            return 'Final';
        default:
            return phase;
    }
}

export interface RankingBreakdownSection<T> {
    key: string;
    kind: 'group' | 'knockout';
    label: string;
    matches: T[];
    totalPoints: number;
}

export type RankingBreakdownMatchSlice = {
    phase: string;
    group?: string | null;
    points: number;
};

function compareSectionKeys(a: string, b: string): number {
    const aIsGroup = a.startsWith('group:');
    const bIsGroup = b.startsWith('group:');
    // Eliminatorias primero; grupos al final.
    if (aIsGroup && !bIsGroup) return 1;
    if (!aIsGroup && bIsGroup) return -1;
    if (aIsGroup && bIsGroup) {
        return a.slice(6).localeCompare(b.slice(6), 'es', { sensitivity: 'base' });
    }

    const phaseA = a.slice(9);
    const phaseB = b.slice(9);
    const orderA = KNOCKOUT_PHASE_ORDER.indexOf(phaseA as (typeof KNOCKOUT_PHASE_ORDER)[number]);
    const orderB = KNOCKOUT_PHASE_ORDER.indexOf(phaseB as (typeof KNOCKOUT_PHASE_ORDER)[number]);
    const rankA = orderA === -1 ? Number.MAX_SAFE_INTEGER : orderA;
    const rankB = orderB === -1 ? Number.MAX_SAFE_INTEGER : orderB;
    if (rankA !== rankB) return rankA - rankB;
    return phaseA.localeCompare(phaseB, 'es');
}

/** Bloque padre que agrupa Grupo A, B, C… debajo de las eliminatorias. */
export interface RankingBreakdownGroupsBlock<T> {
    key: 'groups';
    kind: 'groups-parent';
    label: string;
    totalPoints: number;
    matchCount: number;
    groupCount: number;
    groups: RankingBreakdownSection<T>[];
}

export type RankingBreakdownBlock<T> = RankingBreakdownSection<T> | RankingBreakdownGroupsBlock<T>;

export function isRankingBreakdownGroupsBlock<T>(
    block: RankingBreakdownBlock<T>,
): block is RankingBreakdownGroupsBlock<T> {
    return block.kind === 'groups-parent';
}

/** Ordena eliminatorias arriba y envuelve los grupos en un bloque padre. */
export function organizeRankingBreakdownBlocks<T>(
    sections: RankingBreakdownSection<T>[],
): RankingBreakdownBlock<T>[] {
    const knockout = sections.filter((section) => section.kind === 'knockout');
    const groups = sections.filter((section) => section.kind === 'group');

    const blocks: RankingBreakdownBlock<T>[] = [...knockout];

    if (groups.length > 0) {
        blocks.push({
            key: 'groups',
            kind: 'groups-parent',
            label: 'Grupos',
            totalPoints: groups.reduce((sum, group) => sum + group.totalPoints, 0),
            matchCount: groups.reduce((sum, group) => sum + group.matches.length, 0),
            groupCount: groups.length,
            groups,
        });
    }

    return blocks;
}

/** Agrupa partidos de grupos por letra de grupo; eliminatorias por fase. */
export function groupRankingBreakdownMatches<T extends RankingBreakdownMatchSlice>(
    matches: T[],
    getDate: (match: T) => string = () => '',
): RankingBreakdownSection<T>[] {
    const buckets = new Map<string, T[]>();

    for (const match of matches) {
        const key =
            match.phase === 'GROUP'
                ? `group:${(match.group ?? '').trim().toUpperCase() || '?'}`
                : `knockout:${match.phase}`;
        const list = buckets.get(key);
        if (list) list.push(match);
        else buckets.set(key, [match]);
    }

    return buildRankingBreakdownSections(buckets, getDate, (match) => match.points ?? 0);
}

export function groupRankingBreakdownMatchesFrom<T>(
    matches: T[],
    selectors: {
        phase: (match: T) => string;
        group: (match: T) => string | null | undefined;
        points: (match: T) => number;
        date: (match: T) => string;
    },
): RankingBreakdownSection<T>[] {
    const buckets = new Map<string, T[]>();

    for (const match of matches) {
        const phase = selectors.phase(match);
        const key =
            phase === 'GROUP'
                ? `group:${(selectors.group(match) ?? '').trim().toUpperCase() || '?'}`
                : `knockout:${phase}`;
        const list = buckets.get(key);
        if (list) list.push(match);
        else buckets.set(key, [match]);
    }

    return buildRankingBreakdownSections(buckets, selectors.date, selectors.points);
}

function buildRankingBreakdownSections<T>(
    buckets: Map<string, T[]>,
    getDate: (match: T) => string,
    getPoints: (match: T) => number,
): RankingBreakdownSection<T>[] {
    const sections: RankingBreakdownSection<T>[] = [];

    for (const [key, sectionMatches] of buckets) {
        const sorted = [...sectionMatches].sort((left, right) => {
            const leftTime = new Date(getDate(left)).getTime();
            const rightTime = new Date(getDate(right)).getTime();
            if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
                return leftTime - rightTime;
            }
            return 0;
        });

        const kind = key.startsWith('group:') ? 'group' : 'knockout';
        const label =
            kind === 'group'
                ? `Grupo ${key.slice(6)}`
                : formatRankingPhaseLabel(key.slice(9));

        sections.push({
            key,
            kind,
            label,
            matches: sorted,
            totalPoints: sorted.reduce((sum, item) => sum + getPoints(item), 0),
        });
    }

    sections.sort((left, right) => compareSectionKeys(left.key, right.key));
    return sections;
}
