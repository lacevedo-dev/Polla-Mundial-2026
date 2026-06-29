import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { groupRankingBreakdownMatchesFrom } from '@polla-2026/shared';
import type { RankingBreakdownSection } from '@polla-2026/shared';

type MatchSelectors<T> = {
    phase: (match: T) => string;
    group: (match: T) => string | null | undefined;
    points: (match: T) => number;
    date: (match: T) => string;
};

type RankingBreakdownAccordionProps<T> = {
    matches: T[];
    getMatchKey: (match: T) => string;
    renderMatch: (match: T) => React.ReactNode;
    matchSelectors: MatchSelectors<T>;
    pointsClassName?: string;
};

function SectionHeader({
    section,
    expanded,
    pointsClassName,
}: {
    section: RankingBreakdownSection<unknown>;
    expanded: boolean;
    pointsClassName: string;
}) {
    const count = section.matches.length;
    const matchLabel = count === 1 ? '1 partido' : `${count} partidos`;

    return (
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <div className="min-w-0 text-left">
                <p className="truncate text-sm font-bold text-slate-900">{section.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                    <span className={`font-black ${pointsClassName}`}>{section.totalPoints} pts</span>
                    <span className="text-slate-300"> · </span>
                    <span>{matchLabel}</span>
                    <span className="text-slate-300"> · </span>
                    <span className="font-semibold text-slate-600">
                        {expanded ? 'Ocultar partidos' : 'Ver partidos'}
                    </span>
                </p>
            </div>
            <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                aria-hidden="true"
            />
        </div>
    );
}

export function RankingBreakdownAccordion<T>({
    matches,
    getMatchKey,
    renderMatch,
    matchSelectors,
    pointsClassName = 'text-lime-600',
}: RankingBreakdownAccordionProps<T>) {
    const sections = useMemo(
        () => groupRankingBreakdownMatchesFrom(matches, matchSelectors),
        [matchSelectors, matches],
    );
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

    const toggleSection = (key: string) => {
        setExpandedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    if (!sections.length) return null;

    return (
        <div className="space-y-2">
            {sections.map((section) => {
                const expanded = expandedKeys.has(section.key);
                const panelId = `ranking-section-${section.key}`;

                return (
                    <div
                        key={section.key}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                    >
                        <button
                            type="button"
                            onClick={() => toggleSection(section.key)}
                            aria-expanded={expanded}
                            aria-controls={panelId}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                        >
                            <SectionHeader
                                section={section}
                                expanded={expanded}
                                pointsClassName={pointsClassName}
                            />
                        </button>
                        {expanded && (
                            <div id={panelId} className="space-y-2 border-t border-slate-100 bg-slate-50/60 px-2 py-2">
                                {section.matches.map((match) => (
                                    <div key={getMatchKey(match)}>{renderMatch(match)}</div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
