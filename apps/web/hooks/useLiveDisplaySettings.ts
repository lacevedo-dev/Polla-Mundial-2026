import React from 'react';
import { BASE_URL } from '../api';
import {
    DEFAULT_LIVE_DISPLAY_SETTINGS,
    type LiveDisplaySettings,
} from '../utils/liveDisplayConfig';

export function useLiveDisplaySettings(): LiveDisplaySettings {
    const [settings, setSettings] = React.useState<LiveDisplaySettings>(
        DEFAULT_LIVE_DISPLAY_SETTINGS,
    );

    React.useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        fetch(`${BASE_URL}/matches/live/display-settings`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => (r.ok ? r.json() : null))
            .then((data: LiveDisplaySettings | null) => {
                if (data) setSettings({ ...DEFAULT_LIVE_DISPLAY_SETTINGS, ...data });
            })
            .catch(() => { /* defaults */ });
    }, []);

    return settings;
}
