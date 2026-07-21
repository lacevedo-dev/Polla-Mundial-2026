import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { CorpRankingExportPayload } from './corp-ranking.service';

const PW = 595.28;
const PH = 841.89;
const M = 36;
const CW = PW - M * 2;
const ROW_H = 20;
const FOOTER_H = 28;
const COL = {
    rank: { x: M, w: 40 },
    doc: { x: M + 40, w: 110 },
    name: { x: M + 150, w: CW - 210 },
    points: { x: M + CW - 60, w: 60 },
};

function toBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });
}

function formatGeneratedAt(iso: string): string {
    return new Date(iso).toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatPoints(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

@Injectable()
export class CorpRankingPdfService {
    async buildRankingPdf(params: {
        orgName: string;
        exportPayload: CorpRankingExportPayload;
    }): Promise<Buffer> {
        const { orgName, exportPayload } = params;
        const leagueName = exportPayload.league?.name ?? 'Sin polla activa';
        const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
        const done = toBuffer(doc);

        let y = M;
        y = this.drawHeader(doc, orgName, leagueName, exportPayload, y);
        y = this.drawTableHeader(doc, y);

        for (let i = 0; i < exportPayload.rows.length; i++) {
            if (y + ROW_H > PH - FOOTER_H - M) {
                doc.addPage();
                y = M;
                y = this.drawTableHeader(doc, y);
            }
            y = this.drawRow(doc, exportPayload.rows[i], i, y);
        }

        if (exportPayload.rows.length === 0) {
            doc.fillColor('#64748b').fontSize(11).font('Helvetica')
                .text('No hay participantes en la polla activa.', M, y + 12, { width: CW, align: 'center' });
        }

        this.addFooters(doc, `${orgName} · Generado: ${formatGeneratedAt(exportPayload.generatedAt)}`);
        doc.end();
        return done;
    }

    private drawHeader(
        doc: PDFKit.PDFDocument,
        orgName: string,
        leagueName: string,
        payload: CorpRankingExportPayload,
        y: number,
    ): number {
        doc.rect(0, 0, PW, 78).fill('#0f172a');
        doc.fillColor('#a3e635').fontSize(16).font('Helvetica-Bold')
            .text('Listado de participantes por puntaje', M, 18, { width: CW });
        doc.fillColor('#e2e8f0').fontSize(10).font('Helvetica')
            .text(orgName, M, 40, { width: CW });
        doc.fillColor('#94a3b8').fontSize(9)
            .text(
                `${leagueName} · ${payload.totalParticipants} participante${payload.totalParticipants === 1 ? '' : 's'} · ${formatGeneratedAt(payload.generatedAt)}`,
                M,
                56,
                { width: CW },
            );
        return 90;
    }

    private drawTableHeader(doc: PDFKit.PDFDocument, y: number): number {
        doc.rect(M, y, CW, 22).fill('#1e293b');
        doc.fillColor('#f8fafc').fontSize(9).font('Helvetica-Bold');
        doc.text('Pos.', COL.rank.x + 4, y + 6, { width: COL.rank.w - 4 });
        doc.text('Cédula', COL.doc.x + 4, y + 6, { width: COL.doc.w - 4 });
        doc.text('Nombres', COL.name.x + 4, y + 6, { width: COL.name.w - 4 });
        doc.text('Puntaje', COL.points.x, y + 6, { width: COL.points.w, align: 'right' });
        return y + 26;
    }

    private drawRow(
        doc: PDFKit.PDFDocument,
        row: CorpRankingExportPayload['rows'][number],
        index: number,
        y: number,
    ): number {
        if (index % 2 === 0) {
            doc.rect(M, y, CW, ROW_H).fill('#f8fafc');
        }
        doc.fillColor('#0f172a').fontSize(9).font('Helvetica');
        doc.text(String(row.rank), COL.rank.x + 4, y + 5, { width: COL.rank.w - 4 });
        doc.text(row.documentNumber || '—', COL.doc.x + 4, y + 5, { width: COL.doc.w - 4 });
        doc.text(row.name || '—', COL.name.x + 4, y + 5, { width: COL.name.w - 4, ellipsis: true });
        doc.font('Helvetica-Bold')
            .text(formatPoints(row.totalPoints), COL.points.x, y + 5, {
                width: COL.points.w,
                align: 'right',
            });
        return y + ROW_H;
    }

    private addFooters(doc: PDFKit.PDFDocument, footerText: string) {
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(range.start + i);
            doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
                .text(footerText, M, PH - FOOTER_H, { width: CW - 60, align: 'left' })
                .text(`Pág. ${i + 1} / ${range.count}`, M, PH - FOOTER_H, { width: CW, align: 'right' });
        }
    }
}
