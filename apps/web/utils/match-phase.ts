export function isKnockoutPhase(phase: string | undefined | null): boolean {
    return !!phase && phase !== 'GROUP' && phase !== 'THIRD_PLACE';
}

export function formatMatchPhaseLabel(phase: string): string {
    const labels: Record<string, string> = {
        GROUP: 'Fase de grupos',
        ROUND_OF_32: 'Dieciseisavos de final',
        ROUND_OF_16: 'Octavos de final',
        QUARTER: 'Cuartos de final',
        SEMI: 'Semifinal',
        THIRD_PLACE: 'Tercer puesto',
        FINAL: 'Final',
    };
    return labels[phase] ?? phase;
}
