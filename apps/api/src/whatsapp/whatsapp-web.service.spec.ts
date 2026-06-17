import { normalizePhoneToWhatsAppChatId } from './whatsapp-web.service';

describe('normalizePhoneToWhatsAppChatId', () => {
  it('combina código de país y teléfono local', () => {
    expect(normalizePhoneToWhatsAppChatId('+57', '3001234567')).toBe('573001234567@c.us');
  });

  it('usa el número si ya incluye código de país', () => {
    expect(normalizePhoneToWhatsAppChatId('+57', '573001234567')).toBe('573001234567@c.us');
  });

  it('retorna null si el teléfono está vacío', () => {
    expect(normalizePhoneToWhatsAppChatId('+57', '')).toBeNull();
  });
});
