import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
    groupRankingBreakdownMatchesFrom,
    isRankingBreakdownGroupsBlock,
    organizeRankingBreakdownBlocks,
} from '@polla-2026/shared';
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
    title,
    totalPoints,
    countLabel,
    expandLabel,
    expanded,
    pointsClassName,
}: {
    title: string;
    totalPoints: number;
    countLabel: string;
    expandLabel: { open: string; closed: string };
    expanded: boolean;
    pointsClassName: string;
}) {
    return (
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <div className="min-w-0 text-left">
                <p className="truncate text-sm font-bold text-slate-900">{title}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                    <span className={`font-black ${pointsClassName}`}>{totalPoints} pts</span>
                    <span className="text-slate-300"> · </span>
                    <span>{countLabel}</span>
                    <span className="text-slate-300"> · </span>
                    <span className="font-semibold text-slate-600">
                        {expanded ? expandLabel.open : expandLabel.closed}
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

function MatchList<T>({
    matches,
    getMatchKey,
    renderMatch,
}: {
    matches: T[];
    getMatchKey: (match: T) => string;
    renderMatch: (match: T) => React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            {matches.map((match) => (
                <div key={getMatchKey(match)}>{renderMatch(match)}</div>
            ))}
        </div>
    );
}

function KnockoutSection<T>({
    section,
    expanded,
    onToggle,
    getMatchKey,
    renderMatch,
    pointsClassName,
}: {
    section: RankingBreakdownSection<T>;
    expanded: boolean;
    onToggle: () => void;
    getMatchKey: (match: T) => string;
    renderMatch: (match: T) => React.ReactNode;
    pointsClassName: string;
}) {
    const panelId = `ranking-section-${section.key}`;
    const matchLabel = section.matches.length === 1 ? '1 partido' : `${section.matches.length} partidos`;

    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={expanded}
                aria-controls={panelId}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
            >
                <SectionHeader
                    title={section.label}
                    totalPoints={section.totalPoints}
                    countLabel={matchLabel}
                    expandLabel={{ open: 'Ocultar partidos', closed: 'Ver partidos' }}
                    expanded={expanded}
                    pointsClassName={pointsClassName}
                />
            </button>
            {expanded && (
                <div id={panelId} className="space-y-2 border-t border-slate-100 bg-slate-50/60 px-2 py-2">
                    <MatchList matches={section.matches} getMatchKey={getMatchKey} renderMatch={renderMatch} />
                </div>
            )}
        </div>
    );
}

function GroupsBlock<T>({
    block,
    parentExpanded,
    onToggleParent,
    expandedGroupKeys,
    onToggleGroup,
    getMatchKey,
    renderMatch,
    pointsClassName,
}: {
    block: ReturnType<typeof organizeRankingBreakdownBlocks<T>>[number] & { kind: 'groups-parent' };
    parentExpanded: boolean;
    onToggleParent: () => void;
    expandedGroupKeys: Set<string>;
    onToggleGroup: (key: string) => void;
    getMatchKey: (match: T) => string;
    renderMatch: (match: T) => React.ReactNode;
    pointsClassName: string;
}) {
    const panelId = 'ranking-section-groups';
    const groupCountLabel = block.groupCount === 1 ? '1 grupo' : `${block.groupCount} grupos`;
    const matchLabel = block.matchCount === 1 ? '1 partido' : `${block.matchCount} partidos`;

    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
                type="button"
                onClick={onToggleParent}
                aria-expanded={parentExpanded}
                aria-controls={panelId}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
            >
                <SectionHeader
                    title={block.label}
                    totalPoints={block.totalPoints}
                    countLabel={`${matchLabel} · ${groupCountLabel}`}
                    expandLabel={{ open: 'Ocultar grupos', closed: 'Ver grupos' }}
                    expanded={parentExpanded}
                    pointsClassName={pointsClassName}
                />
            </button>
            {parentExpanded && (
                <div id={panelId} className="space-y-2 border-t border-slate-100 bg-slate-50/60 px-2 py-2">
                    {block.groups.map((group) => {
                        const groupExpanded = expandedGroupKeys.has(group.key);
                        const groupPanelId = `ranking-section-${group.key}`;
                        const groupMatchLabel =
                            group.matches.length === 1 ? '1 partido' : `${group.matches.length} partidos`;

                        return (
                            <div
                                key={group.key}
                                className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                            >
                                <button
                                    type="button"
                                    onClick={() => onToggleGroup(group.key)}
                                    aria-expanded={groupExpanded}
                                    aria-controls={groupPanelId}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-50"
                                >
                                    <SectionHeader
                                        title={group.label}
                                        totalPoints={group.totalPoints}
                                        countLabel={groupMatchLabel}
                                        expandLabel={{ open: 'Ocultar', closed: 'Ver partidos' }}
                                        expanded={groupExpanded}
                                        pointsClassName={pointsClassName}
                                    />
                                </button>
                                {groupExpanded && (
                                    <div
                                        id={groupPanelId}
                                        className="space-y-2 border-t border-slate-100 bg-slate-50/40 px-2 py-2"
                                    >
                                        <MatchList
                                            matches={group.matches}
                                            getMatchKey={getMatchKey}
                                            renderMatch={renderMatch}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
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
    const blocks = useMemo(() => {
        const sections = groupRankingBreakdownMatchesFrom(matches, matchSelectors);
        return organizeRankingBreakdownBlocks(sections);
    }, [matchSelectors, matches]);

    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
    const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(() => new Set());

    const toggleKey = (key: string) => {
        setExpandedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleGroupKey = (key: string) => {
        setExpandedGroupKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    if (!blocks.length) return null;

    return (
        <div className="space-y-2">
            {blocks.map((block) => {
                if (isRankingBreakdownGroupsBlock(block)) {
                    return (
                        <GroupsBlock
                            key={block.key}
                            block={block}
                            parentExpanded={expandedKeys.has(block.key)}
                            onToggleParent={() => toggleKey(block.key)}
                            expandedGroupKeys={expandedGroupKeys}
                            onToggleGroup={toggleGroupKey}
                            getMatchKey={getMatchKey}
                            renderMatch={renderMatch}
                            pointsClassName={pointsClassName}
                        />
                    );
                }

                return (
                    <KnockoutSection
                        key={block.key}
                        section={block}
                        expanded={expandedKeys.has(block.key)}
                        onToggle={() => toggleKey(block.key)}
                        getMatchKey={getMatchKey}
                        renderMatch={renderMatch}
                        pointsClassName={pointsClassName}
                    />
                );
            })}
        </div>
    );
}
