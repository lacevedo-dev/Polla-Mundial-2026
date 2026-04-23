/**
 * URL Utilities
 *
 * Helpers para generar URLs dinámicas basadas en el entorno
 * (desarrollo, staging, producción)
 */

/**
 * Obtiene la URL base de la aplicación según el entorno
 *
 * Orden de prioridad:
 * 1. Variable de entorno VITE_APP_URL (definida en .env)
 * 2. window.location.origin (fallback automático)
 *
 * @returns URL base sin slash final (ej: "https://tupollamundial.com")
 */
export const getBaseUrl = (): string => {
  // Usar variable de entorno si está definida
  if (import.meta.env.VITE_APP_URL) {
    return import.meta.env.VITE_APP_URL.replace(/\/$/, ''); // Remove trailing slash
  }

  // Fallback: detectar automáticamente desde el navegador
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // SSR fallback (no debería llegar aquí en Vite)
  return 'https://tupollamundial.com';
};

/**
 * Genera el link completo de invitación para una liga
 *
 * @param code - Código de la liga (ej: "ABC123")
 * @returns URL completa de invitación (ej: "https://tupollamundial.com/join/ABC123")
 *
 * @example
 * ```ts
 * const link = getInviteLink('ABC123');
 * // → "https://tupollamundial.com/join/ABC123"
 * ```
 */
export const getInviteLink = (code: string): string => {
  const base = getBaseUrl();
  const normalizedCode = code.trim().toUpperCase();
  return `${base}/join/${normalizedCode}`;
};

/**
 * Genera un link de WhatsApp con mensaje pre-llenado
 *
 * @param code - Código de la liga
 * @param leagueName - Nombre de la liga
 * @param recipientPhone - Teléfono del destinatario (opcional, sin +)
 * @returns URL de WhatsApp lista para abrir
 *
 * @example
 * ```ts
 * // Mensaje genérico (sin destinatario específico)
 * const link = getWhatsAppLink('ABC123', 'Polla Mundialista');
 * // → "https://wa.me/?text=..."
 *
 * // Con destinatario específico
 * const link = getWhatsAppLink('ABC123', 'Polla 2026', '573001234567');
 * // → "https://wa.me/573001234567?text=..."
 * ```
 */
export const getWhatsAppLink = (
  code: string,
  leagueName: string,
  recipientPhone?: string,
): string => {
  const inviteLink = getInviteLink(code);
  const message = `¡Únete a mi polla "${leagueName}"! 🏆\nCódigo: *${code}*\n${inviteLink}`;
  const encodedMessage = encodeURIComponent(message);

  if (recipientPhone) {
    // Link directo a un contacto específico
    const cleanPhone = recipientPhone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  }

  // Link genérico (abre selector de contactos)
  return `https://wa.me/?text=${encodedMessage}`;
};

/**
 * Genera un link de email con asunto y cuerpo pre-llenados
 *
 * @param code - Código de la liga
 * @param leagueName - Nombre de la liga
 * @param recipients - Email(s) del/los destinatario(s) (separados por coma)
 * @param message - Mensaje personalizado (usa plantilla si no se provee)
 * @returns URL mailto: lista para abrir
 */
export const getEmailLink = (
  code: string,
  leagueName: string,
  recipients: string,
  message?: string,
): string => {
  const inviteLink = getInviteLink(code);
  const subject = encodeURIComponent(`Invitación a la polla ${leagueName}`);

  const defaultMessage = `Hola,\n\nTe invito a participar en la polla "${leagueName}" para el Mundial 2026.\n\nPara unirte, accede al siguiente enlace:\n${inviteLink}\n\nCódigo de invitación: ${code}\n\n¡Nos vemos en la competencia!`;

  const body = encodeURIComponent(message || defaultMessage);

  return `mailto:${recipients}?subject=${subject}&body=${body}`;
};

/**
 * Genera un link de SMS con mensaje pre-llenado
 *
 * @param code - Código de la liga
 * @param leagueName - Nombre de la liga
 * @param recipientPhone - Teléfono del destinatario
 * @returns URL sms: lista para abrir
 */
export const getSMSLink = (
  code: string,
  leagueName: string,
  recipientPhone: string,
): string => {
  const inviteLink = getInviteLink(code);
  const message = `Únete a mi polla "${leagueName}" del Mundial 2026. Código: ${code}. Link: ${inviteLink}`;
  const encodedMessage = encodeURIComponent(message);

  return `sms:${recipientPhone}?body=${encodedMessage}`;
};

/**
 * Usa la API nativa de compartir del navegador (si está disponible)
 *
 * @param code - Código de la liga
 * @param leagueName - Nombre de la liga
 * @returns Promise que se resuelve cuando el usuario comparte o cancela
 */
export const shareNative = async (
  code: string,
  leagueName: string,
): Promise<void> => {
  const inviteLink = getInviteLink(code);
  const text = `¡Únete a la polla "${leagueName}"! Código: ${code}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: leagueName,
        text,
        url: inviteLink,
      });
    } catch (error) {
      // User cancelled or share failed
      // Fallback: copiar al portapapeles
      await navigator.clipboard.writeText(`${text}\n${inviteLink}`);
    }
  } else {
    // API no disponible: copiar al portapapeles
    await navigator.clipboard.writeText(`${text}\n${inviteLink}`);
  }
};
