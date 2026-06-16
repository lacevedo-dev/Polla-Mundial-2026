import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export type CorpBuildInfo = {
    gitCommit?: string;
    builtAt?: string;
    rankingBreakdown?: boolean;
};

export function readCorpBuildInfo(): CorpBuildInfo | null {
    const buildInfoPath = join(process.cwd(), '.build-info.json');
    if (!existsSync(buildInfoPath)) return null;
    try {
        return JSON.parse(readFileSync(buildInfoPath, 'utf8')) as CorpBuildInfo;
    } catch {
        return null;
    }
}

export function resolveCorpBuildCommit(): string {
    const fromEnv = process.env.BUILD_GIT_COMMIT?.trim();
    if (fromEnv) return fromEnv;
    const fromFile = readCorpBuildInfo()?.gitCommit?.trim();
    if (fromFile) return fromFile;
    return 'unknown';
}
