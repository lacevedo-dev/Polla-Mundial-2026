import { Injectable, Logger } from '@nestjs/common';
import type { CorpRankingExportPayload } from './corp-ranking.service';

/** Marcador para confirmar en logs que el contenedor corre este build (no el bundle viejo). */
export const RANKING_PDF_BUILD_MARKER = 'pdfkit-eval-require-v5';

type PdfDoc = PDFKit.PDFDocument;
type PdfCtor = new (options?: PDFKit.PDFDocumentOptions) => PdfDoc;

/**
 * require nativo de Node, a prueba de que webpack reescriba `require` / `__non_webpack_require__`.
 * eslint-disable-next-line no-eval
 */
function nodeRequire(moduleId: string): unknown {
    // eslint-disable-next-line no-eval, @typescript-eslint/no-unsafe-call
    const req = eval('require') as NodeRequire;
    return req(moduleId);
}

/**
 * Carga el constructor real de pdfkit desde node_modules (CJS),
 * sin el wrapper `pdfkit_1.default` que genera webpack.
 */
function resolvePdfDocumentCtor(): PdfCtor {
    const mod = nodeRequire('pdfkit') as PdfCtor | { default?: PdfCtor } | null;
    const ctor = typeof mod === 'function'
        ? mod
        : mod && typeof mod === 'object'
            ? mod.default
            : undefined;
    if (typeof ctor !== 'function') {
        throw new Error(
            `[${RANKING_PDF_BUILD_MARKER}] pdfkit export inválido (${typeof mod})`,
        );
    }
    return ctor;
}

function createPdfDocument(options?: PDFKit.PDFDocumentOptions): PdfDoc {
    return new (resolvePdfDocumentCtor())(options);
}

const PW = 595.28;
const PH = 841.89;
const M = 36;
const CW = PW - M * 2;
const ROW_H = 18;
const FOOTER_H = 28;
const HEADER_H = 90;
const TABLE_HDR_H = 26;
const COL = {
    rank: { x: M, w: 40 },
    doc: { x: M + 40, w: 110 },
    name: { x: M + 150, w: CW - 210 },
    points: { x: M + CW - 60, w: 60 },
};

/** Reemplazos comunes que Helvetica/WinAnsi no soporta. */
const UNSAFE_CHAR_MAP: Record<string, string> = {
    '\u2014': '-', // —
    '\u2013': '-', // –
    '\u2018': "'",
    '\u2019': "'",
    '\u201C': '"',
    '\u201D': '"',
    '\u2022': '-',
    '\u2026': '...',
    '\u00A0': ' ',
    '\u202F': ' ',
    '\u2009': ' ',
    '\u200B': '',
    '\uFEFF': '',
    '\u00B7': '-', // ·
};

function toBuffer(doc: PdfDoc): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });
}

/**
 * Helvetica usa WinAnsi: caracteres fuera de Latin-1 tiran el PDF.
 * Normaliza tipografía “smart” y elimina el resto no representable.
 */
export function pdfSafeText(value: unknown, fallback = '-'): string {
    const raw = String(value ?? '').normalize('NFC');
    if (!raw.trim()) return fallback;

    let out = '';
    for (const ch of raw) {
        if (Object.prototype.hasOwnProperty.call(UNSAFE_CHAR_MAP, ch)) {
            out += UNSAFE_CHAR_MAP[ch];
            continue;
        }
        const code = ch.codePointAt(0) ?? 0;
        // WinAnsi / Latin-1 printable (incluye ñ, tildes)
        if (code === 0x09 || code === 0x0a || code === 0x0d || (code >= 0x20 && code <= 0xff)) {
            out += ch;
        } else {
            out += '?';
        }
    }
    return out.trim() || fallback;
}

function formatGeneratedAt(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(d);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === type)?.value ?? '00';
    return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

function formatPoints(value: number): string {
    if (!Number.isFinite(value)) return '0';
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

@Injectable()
export class CorpRankingPdfService {
    private readonly logger = new Logger(CorpRankingPdfService.name);

    async buildRankingPdf(params: {
        orgName: string;
        exportPayload: CorpRankingExportPayload;
    }): Promise<Buffer> {
        const { orgName, exportPayload } = params;
        const leagueName = pdfSafeText(exportPayload.league?.name, 'Sin polla activa');
        const safeOrg = pdfSafeText(orgName, 'Portal Corporativo');
        const generatedLabel = formatGeneratedAt(exportPayload.generatedAt);
        const total = exportPayload.rows.length;

        this.logger.log(
            `Generando PDF ranking marker=${RANKING_PDF_BUILD_MARKER} rows=${total}`,
        );

        // Sin bufferPages: con 10k+ filas evita RAM alta y switchToPage frágil.
        const doc = createPdfDocument({ margin: 0, size: 'A4', autoFirstPage: true, bufferPages: false });
        const done = toBuffer(doc);

        let page = 1;
        let y = this.drawHeader(doc, safeOrg, leagueName, total, generatedLabel);
        y = this.drawTableHeader(doc, y);

        try {
            for (let i = 0; i < exportPayload.rows.length; i++) {
                if (y + ROW_H > PH - FOOTER_H - M) {
                    this.drawFooter(doc, safeOrg, generatedLabel, page);
                    doc.addPage();
                    page += 1;
                    y = this.drawHeader(doc, safeOrg, leagueName, total, generatedLabel);
                    y = this.drawTableHeader(doc, y);
                }
                y = this.drawRow(doc, exportPayload.rows[i], i, y);
            }

            if (exportPayload.rows.length === 0) {
                doc.fillColor('#64748b').fontSize(11).font('Helvetica')
                    .text('No hay participantes en la polla activa.', M, y + 12, {
                        width: CW,
                        align: 'center',
                        lineBreak: false,
                    });
            }

            this.drawFooter(doc, safeOrg, generatedLabel, page);
            doc.end();
            return await done;
        } catch (error) {
            this.logger.error(
                `Error generando PDF ranking (${total} filas): ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error.stack : undefined,
            );
            try {
                doc.end();
            } catch {
                /* ignore */
            }
            throw error;
        }
    }

    private drawHeader(
        doc: PdfDoc,
        orgName: string,
        leagueName: string,
        totalParticipants: number,
        generatedLabel: string,
    ): number {
        doc.rect(0, 0, PW, 78).fill('#0f172a');
        doc.fillColor('#a3e635').fontSize(16).font('Helvetica-Bold')
            .text('Listado de participantes por puntaje', M, 18, {
                width: CW,
                lineBreak: false,
            });
        doc.fillColor('#e2e8f0').fontSize(10).font('Helvetica')
            .text(orgName, M, 40, { width: CW, lineBreak: false });
        doc.fillColor('#94a3b8').fontSize(9)
            .text(
                pdfSafeText(
                    `${leagueName} - ${totalParticipants} participante${totalParticipants === 1 ? '' : 's'} - ${generatedLabel}`,
                ),
                M,
                56,
                { width: CW, lineBreak: false },
            );
        return HEADER_H;
    }

    private drawTableHeader(doc: PdfDoc, y: number): number {
        doc.rect(M, y, CW, 22).fill('#1e293b');
        doc.fillColor('#f8fafc').fontSize(9).font('Helvetica-Bold');
        doc.text('Pos.', COL.rank.x + 4, y + 6, { width: COL.rank.w - 4, lineBreak: false });
        doc.text('Cedula', COL.doc.x + 4, y + 6, { width: COL.doc.w - 4, lineBreak: false });
        doc.text('Nombres', COL.name.x + 4, y + 6, { width: COL.name.w - 4, lineBreak: false });
        doc.text('Puntaje', COL.points.x, y + 6, {
            width: COL.points.w,
            align: 'right',
            lineBreak: false,
        });
        return y + TABLE_HDR_H;
    }

    private drawRow(
        doc: PdfDoc,
        row: CorpRankingExportPayload['rows'][number],
        index: number,
        y: number,
    ): number {
        if (index % 2 === 0) {
            doc.rect(M, y, CW, ROW_H).fill('#f8fafc');
        }
        const textOpts = { lineBreak: false, height: ROW_H - 4 } as const;
        doc.fillColor('#0f172a').fontSize(9).font('Helvetica');
        doc.text(pdfSafeText(row.rank, '0'), COL.rank.x + 4, y + 4, {
            width: COL.rank.w - 4,
            ...textOpts,
        });
        doc.text(pdfSafeText(row.documentNumber), COL.doc.x + 4, y + 4, {
            width: COL.doc.w - 4,
            ...textOpts,
        });
        doc.text(pdfSafeText(row.name), COL.name.x + 4, y + 4, {
            width: COL.name.w - 4,
            ...textOpts,
        });
        doc.font('Helvetica-Bold')
            .text(formatPoints(row.totalPoints), COL.points.x, y + 4, {
                width: COL.points.w,
                align: 'right',
                ...textOpts,
            });
        return y + ROW_H;
    }

    private drawFooter(
        doc: PdfDoc,
        orgName: string,
        generatedLabel: string,
        page: number,
    ) {
        doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
            .text(
                pdfSafeText(`${orgName} - Generado: ${generatedLabel}`),
                M,
                PH - FOOTER_H,
                { width: CW - 80, align: 'left', lineBreak: false },
            )
            .text(`Pag. ${page}`, M, PH - FOOTER_H, {
                width: CW,
                align: 'right',
                lineBreak: false,
            });
    }
}
