import React from 'react';
import { BASE_URL } from '../api';
import {
    DEFAULT_GOAL_STICKER_SETTINGS,
    type GoalStickerSettings,
} from '../utils/goalStickerConfig';

export function useGoalStickerSettings(): GoalStickerSettings {
    const [settings, setSettings] = React.useState<GoalStickerSettings>(
        DEFAULT_GOAL_STICKER_SETTINGS,
    );

    React.useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        fetch(`${BASE_URL}/matches/live/goal-sticker-settings`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => (r.ok ? r.json() : null))
            .then((data: GoalStickerSettings | null) => {
                if (data) setSettings({ ...DEFAULT_GOAL_STICKER_SETTINGS, ...data });
            })
            .catch(() => { /* defaults */ });
    }, []);

    return settings;
}
