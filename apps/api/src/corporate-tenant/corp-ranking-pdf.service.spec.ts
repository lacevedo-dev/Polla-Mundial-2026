import { CorpRankingPdfService, pdfSafeText } from './corp-ranking-pdf.service';

describe('pdfSafeText', () => {
    it('conserva tildes/ñ y reemplaza tipografia smart', () => {
        const result = pdfSafeText('José — Peña · “A”');
        expect(result).toContain('José');
        expect(result).toContain('Peña');
        expect(result).toContain('-');
        expect(result).toContain('"A"');
        expect(result).not.toContain('—');
        expect(result).not.toContain('·');
    });

    it('elimina caracteres fuera de Latin-1', () => {
        expect(pdfSafeText('Hola 😀 mundo')).toBe('Hola ? mundo');
    });
});

describe('CorpRankingPdfService', () => {
    it('genera PDF con nombres acentuados y muchas filas sin lanzar', async () => {
        const service = new CorpRankingPdfService();
        const rows = Array.from({ length: 120 }, (_, i) => ({
            rank: i + 1,
            documentNumber: i % 7 === 0 ? '' : `10${i}`,
            name: i % 5 === 0 ? `José María Ñoño — ${i}` : `Participante ${i}`,
            totalPoints: 100 - i * 0.5,
        }));

        const buffer = await service.buildRankingPdf({
            orgName: 'LA POLLA COOPCANAPRO',
            exportPayload: {
                league: { id: 'l1', name: 'Polla Mundialista 2026' },
                category: 'GENERAL',
                generatedAt: new Date().toISOString(),
                totalParticipants: rows.length,
                rows,
            },
        });

        expect(buffer.length).toBeGreaterThan(1000);
        expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    });
});
