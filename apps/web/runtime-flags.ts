export type DevelopmentSurfaceFlags = {
    includeDevRoutes: boolean;
};

type ResolveDevelopmentSurfaceFlagsInput = {
    mode?: string;
    enableDevRoutes?: string | boolean;
};

export function resolveDevelopmentSurfaceFlags({
    mode = 'development',
    enableDevRoutes,
}: ResolveDevelopmentSurfaceFlagsInput = {}): DevelopmentSurfaceFlags {
    if (mode === 'production') {
        return { includeDevRoutes: false };
    }

    if (mode === 'development') {
        return { includeDevRoutes: true };
    }

    return {
        includeDevRoutes: normalizeBooleanFlag(enableDevRoutes),
    };
}

function normalizeBooleanFlag(value?: string | boolean): boolean {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value !== 'string') {
        return false;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}
