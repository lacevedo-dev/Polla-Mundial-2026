import React from 'react';
import { usePredictionStore, type GoalEvent } from '../../stores/prediction.store';

function SingleGoalToast({ goal, onDismiss }: { goal: GoalEvent; onDismiss: () => void }) {
    const [visible, setVisible] = React.useState(false);

    React.useEffect(() => {
        // Animate in
        const showTimer = setTimeout(() => setVisible(true), 30);
        // Auto-dismiss after 5s
        const hideTimer = setTimeout(() => {
            setVisible(false);
            setTimeout(onDismiss, 400);
        }, 5000);
        return () => {
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
        };
    }, [onDismiss]);

    return (
        <div
            onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
            className={`cursor-pointer transition-all duration-400 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        >
            <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3 shadow-xl shadow-amber-200/50">
                {/* Ball icon */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-sm">
                    ⚽
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-900">
                        {goal.elapsed ? `Gol — ${goal.elapsed}'` : 'Gol'}
                    </p>
                    <p className="text-sm font-black text-white">
                        {goal.teamName}
                    </p>
                    <p className="mt-0.5 font-mono text-xs font-bold text-amber-900">
                        {goal.homeScore} — {goal.awayScore}
                    </p>
                </div>
                {/* Animated rings */}
                <div className="relative ml-auto shrink-0">
                    <span className="absolute inset-0 animate-ping rounded-full bg-white opacity-30" />
                    <span className="relative flex h-3 w-3 rounded-full bg-white" />
                </div>
            </div>
        </div>
    );
}

export function GoalToastContainer() {
    const goalEvents = usePredictionStore((s) => s.goalEvents);
    const clearGoalEvent = usePredictionStore((s) => s.clearGoalEvent);

    if (goalEvents.length === 0) return null;

    return (
        <div className="pointer-events-none fixed bottom-20 right-4 z-50 flex flex-col-reverse gap-2 sm:bottom-6 sm:right-6">
            {goalEvents.map((goal) => (
                <div key={goal.id} className="pointer-events-auto">
                    <SingleGoalToast
                        goal={goal}
                        onDismiss={() => clearGoalEvent(goal.id)}
                    />
                </div>
            ))}
        </div>
    );
}
