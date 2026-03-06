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
        summary: 'Condiciones básicas para usar Polla 2026, participar en ligas y proteger la integridad del juego.',
        sections: [
            {
                heading: 'Uso de la plataforma',
                body: [
                    'Polla 2026 es una plataforma digital para crear ligas privadas, registrar pronósticos y consultar rankings relacionados con el Mundial 2026.',
                    'Debes usar información veraz, proteger tu cuenta y evitar cualquier conducta que afecte la experiencia de otros participantes.',
                ],
            },
            {
                heading: 'Elegibilidad y conducta',
                body: [
                    'Solo pueden participar personas mayores de edad según la normativa aplicable en su jurisdicción.',
                    'Nos reservamos el derecho de suspender cuentas por fraude, suplantación, uso automatizado abusivo o incumplimiento de estas reglas.',
                ],
            },
            {
                heading: 'Predicciones, ligas y premios',
                body: [
                    'Los pronósticos solo serán válidos hasta la hora de cierre definida para cada partido o ronda.',
                    'Las reglas de puntaje, premios y distribución pueden variar por liga; cada administrador deberá informar claramente esas condiciones antes de invitar participantes.',
                ],
            },
        ],
    },
    privacy: {
        title: 'Política de Privacidad',
        summary: 'Resumen claro de qué datos usamos, por qué los usamos y qué controles tiene cada persona usuaria.',
        sections: [
            {
                heading: 'Datos que recopilamos',
                body: [
                    'Podemos recopilar nombre, correo electrónico, teléfono, nombre de usuario, avatar opcional y actividad básica dentro de la plataforma.',
                    'También registramos eventos técnicos mínimos para seguridad, prevención de fraude y estabilidad operativa.',
                ],
            },
            {
                heading: 'Cómo usamos la información',
                body: [
                    'Usamos tus datos para crear tu cuenta, autenticar tu sesión, mostrar tu perfil en ligas y rankings, y brindar soporte cuando sea necesario.',
                    'No compartimos datos personales con terceros salvo cuando sea necesario para operar la plataforma, cumplir obligaciones legales o procesar servicios claramente informados.',
                ],
            },
            {
                heading: 'Tus derechos y controles',
                body: [
                    'Puedes solicitar corrección o actualización de tus datos de perfil cuando las funcionalidades correspondientes estén disponibles o mediante soporte.',
                    'Si deseas cerrar tu cuenta o ejercer derechos de acceso y eliminación, podrás solicitarlo a través de los canales oficiales de atención.',
                ],
            },
        ],
    },
};
