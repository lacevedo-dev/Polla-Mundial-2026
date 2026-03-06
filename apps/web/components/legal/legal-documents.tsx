export type LegalDocumentKey = 'terms' | 'privacy';

type LegalSection = {
    heading: string;
    body: string[];
};

export type LegalDocument = {
    title: string;
    summary: string;
    sections: LegalSection[];
};

export const LEGAL_DOCUMENTS: Record<LegalDocumentKey, LegalDocument> = {
    terms: {
        title: 'Términos y Condiciones',
        summary: 'Resumen breve de las reglas básicas para crear tu cuenta, participar en ligas y usar la plataforma con responsabilidad.',
        sections: [
            {
                heading: 'Uso responsable',
                body: [
                    'Tu cuenta es personal; debes usar datos reales, cuidar tu acceso y evitar fraudes o conductas que afecten a otros participantes.',
                ],
            },
            {
                heading: 'Predicciones y ligas',
                body: [
                    'Los pronósticos cierran según la hora definida por cada partido o ronda y las reglas de puntaje o premios pueden variar por liga privada.',
                ],
            },
        ],
    },
    privacy: {
        title: 'Política de Privacidad',
        summary: 'Resumen corto de los datos mínimos que usamos para operar tu cuenta y de los controles básicos que conservas.',
        sections: [
            {
                heading: 'Datos básicos',
                body: [
                    'Usamos nombre, correo, teléfono, usuario, avatar opcional y actividad esencial para autenticarte, mostrarte en ligas y mantener la seguridad del servicio.',
                ],
            },
            {
                heading: 'Tus controles',
                body: [
                    'Puedes solicitar corrección, actualización o cierre de cuenta mediante los canales oficiales cuando esas opciones no estén disponibles directamente en la app.',
                ],
            },
        ],
    },
};
