export function RankingSkeleton({ rows = 8 }: { rows?: number }) {
    return (
        <div className="divide-y divide-slate-50 animate-pulse">
            {Array.from({ length: rows }, (_, index) => (
                <div key={index} className="grid grid-cols-[2.5rem_1fr_auto_2rem] gap-2 px-4 py-3 items-center">
                    <div className="h-4 w-6 rounded bg-slate-100" />
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-3.5 w-32 max-w-full rounded bg-slate-100" />
                            <div className="h-2.5 w-48 max-w-full rounded bg-slate-50" />
                        </div>
                    </div>
                    <div className="h-4 w-8 rounded bg-slate-100 justify-self-end" />
                    <div className="h-4 w-4 rounded bg-slate-50 justify-self-center" />
                </div>
            ))}
        </div>
    );
}
