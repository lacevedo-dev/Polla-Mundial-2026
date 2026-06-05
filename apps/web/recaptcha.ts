declare global {
    interface Window {
        grecaptcha?: {
            ready: (callback: () => void) => void;
            execute: (siteKey: string, options: { action: string }) => Promise<string>;
        };
    }
}

let scriptPromise: Promise<void> | null = null;

function loadRecaptcha(siteKey: string) {
    if (window.grecaptcha) return Promise.resolve();
    if (scriptPromise) return scriptPromise;

    scriptPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('No se pudo cargar reCAPTCHA'));
        document.head.appendChild(script);
    });

    return scriptPromise;
}

export async function getRecaptchaToken(action = 'login') {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
    if (!siteKey) {
        if (import.meta.env.PROD) {
            throw new Error('reCAPTCHA no está configurado. Contacta al administrador.');
        }
        return undefined;
    }

    await loadRecaptcha(siteKey);
    return new Promise<string>((resolve, reject) => {
        window.grecaptcha?.ready(() => {
            window.grecaptcha
                ?.execute(siteKey, { action })
                .then(resolve)
                .catch(reject);
        });
    });
}
