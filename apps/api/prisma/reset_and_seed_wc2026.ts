/**
 * Reset + Seed Mundial 2026
 * Fuente: FIFA World Cup 26 Match Schedule v17 — 10/04/2026
 * Borra TODO el historial (predicciones, partidos, eventos, equipos)
 * y recarga los 50 equipos + 104 partidos del Mundial 2026.
 *
 * Ejecutar: npx tsx -r dotenv/config prisma/reset_and_seed_wc2026.ts
 * ⚠️  IRREVERSIBLE — Elimina predicciones y partidos existentes.
 *
 * Estructura:
 *   - 12 grupos × 4 equipos = 48 equipos
 *   - Fase de grupos: 72 partidos (Jornadas 1-3)
 *   - Dieciseisavos: 16 | Octavos: 8 | Cuartos: 4 | Semis: 2 | 3er/Final: 2
 *   - matchDate se guarda en UTC, calculado desde hora local Bogotá/Colombia (UTC-5).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

// ─── EQUIPOS ────────────────────────────────────────────────────────────────
function bogotaToUtcIso(date: string, time: string): string {
    // date/time vienen en hora Bogotá/Colombia UTC-5.
    // La base de datos guarda UTC para que el frontend pueda convertir por zona horaria.
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    return new Date(Date.UTC(year, month - 1, day, hour + 5, minute, 0)).toISOString();
}

const TEAMS = [
    // GRUPO A
    { name: 'México',                 code: 'MEX', group: 'A', flagUrl: 'https://flagcdn.com/w80/mx.png' },
    { name: 'Sudáfrica',              code: 'RSA', group: 'A', flagUrl: 'https://flagcdn.com/w80/za.png' },
    { name: 'República de Corea',     code: 'KOR', group: 'A', flagUrl: 'https://flagcdn.com/w80/kr.png' },
    { name: 'República Checa',        code: 'CZE', group: 'A', flagUrl: 'https://flagcdn.com/w80/cz.png' },
    // GRUPO B
    { name: 'Canadá',                 code: 'CAN', group: 'B', flagUrl: 'https://flagcdn.com/w80/ca.png' },
    { name: 'Bosnia y Herzegovina',    code: 'BIH', group: 'B', flagUrl: 'https://flagcdn.com/w80/ba.png' },
    { name: 'Catar',                  code: 'QAT', group: 'B', flagUrl: 'https://flagcdn.com/w80/qa.png' },
    { name: 'Suiza',                  code: 'SUI', group: 'B', flagUrl: 'https://flagcdn.com/w80/ch.png' },
    // GRUPO C
    { name: 'Brasil',                 code: 'BRA', group: 'C', flagUrl: 'https://flagcdn.com/w80/br.png' },
    { name: 'Marruecos',              code: 'MAR', group: 'C', flagUrl: 'https://flagcdn.com/w80/ma.png' },
    { name: 'Haití',                  code: 'HAI', group: 'C', flagUrl: 'https://flagcdn.com/w80/ht.png' },
    { name: 'Escocia',                code: 'SCO', group: 'C', flagUrl: 'https://flagcdn.com/w80/gb-sct.png' },
    // GRUPO D
    { name: 'Estados Unidos',         code: 'USA', group: 'D', flagUrl: 'https://flagcdn.com/w80/us.png' },
    { name: 'Paraguay',               code: 'PAR', group: 'D', flagUrl: 'https://flagcdn.com/w80/py.png' },
    { name: 'Australia',              code: 'AUS', group: 'D', flagUrl: 'https://flagcdn.com/w80/au.png' },
    { name: 'Turquía',                 code: 'TUR', group: 'D', flagUrl: 'https://flagcdn.com/w80/tr.png' },
    // GRUPO E
    { name: 'Alemania',               code: 'GER', group: 'E', flagUrl: 'https://flagcdn.com/w80/de.png' },
    { name: 'Curazao',                code: 'CUW', group: 'E', flagUrl: 'https://flagcdn.com/w80/cw.png' },
    { name: 'Costa de Marfil',        code: 'CIV', group: 'E', flagUrl: 'https://flagcdn.com/w80/ci.png' },
    { name: 'Ecuador',                code: 'ECU', group: 'E', flagUrl: 'https://flagcdn.com/w80/ec.png' },
    // GRUPO F
    { name: 'Países Bajos',           code: 'NED', group: 'F', flagUrl: 'https://flagcdn.com/w80/nl.png' },
    { name: 'Japón',                  code: 'JPN', group: 'F', flagUrl: 'https://flagcdn.com/w80/jp.png' },
    { name: 'Suecia',                  code: 'SWE', group: 'F', flagUrl: 'https://flagcdn.com/w80/se.png' },
    { name: 'Túnez',                  code: 'TUN', group: 'F', flagUrl: 'https://flagcdn.com/w80/tn.png' },
    // GRUPO G
    { name: 'Bélgica',                code: 'BEL', group: 'G', flagUrl: 'https://flagcdn.com/w80/be.png' },
    { name: 'Egipto',                 code: 'EGY', group: 'G', flagUrl: 'https://flagcdn.com/w80/eg.png' },
    { name: 'RI de Irán',             code: 'IRN', group: 'G', flagUrl: 'https://flagcdn.com/w80/ir.png' },
    { name: 'Nueva Zelanda',          code: 'NZL', group: 'G', flagUrl: 'https://flagcdn.com/w80/nz.png' },
    // GRUPO H
    { name: 'España',                 code: 'ESP', group: 'H', flagUrl: 'https://flagcdn.com/w80/es.png' },
    { name: 'Islas de Cabo Verde',    code: 'CPV', group: 'H', flagUrl: 'https://flagcdn.com/w80/cv.png' },
    { name: 'Arabia Saudita',         code: 'KSA', group: 'H', flagUrl: 'https://flagcdn.com/w80/sa.png' },
    { name: 'Uruguay',                code: 'URU', group: 'H', flagUrl: 'https://flagcdn.com/w80/uy.png' },
    // GRUPO I
    { name: 'Francia',                code: 'FRA', group: 'I', flagUrl: 'https://flagcdn.com/w80/fr.png' },
    { name: 'Senegal',                code: 'SEN', group: 'I', flagUrl: 'https://flagcdn.com/w80/sn.png' },
    { name: 'Irak',                    code: 'IRQ', group: 'I', flagUrl: 'https://flagcdn.com/w80/iq.png' },
    { name: 'Noruega',                code: 'NOR', group: 'I', flagUrl: 'https://flagcdn.com/w80/no.png' },
    // GRUPO J
    { name: 'Argentina',              code: 'ARG', group: 'J', flagUrl: 'https://flagcdn.com/w80/ar.png' },
    { name: 'Argelia',                code: 'ALG', group: 'J', flagUrl: 'https://flagcdn.com/w80/dz.png' },
    { name: 'Austria',                code: 'AUT', group: 'J', flagUrl: 'https://flagcdn.com/w80/at.png' },
    { name: 'Jordania',               code: 'JOR', group: 'J', flagUrl: 'https://flagcdn.com/w80/jo.png' },
    // GRUPO K
    { name: 'Portugal',               code: 'POR', group: 'K', flagUrl: 'https://flagcdn.com/w80/pt.png' },
    { name: 'RD del Congo',            code: 'COD', group: 'K', flagUrl: 'https://flagcdn.com/w80/cd.png' },
    { name: 'Uzbekistán',             code: 'UZB', group: 'K', flagUrl: 'https://flagcdn.com/w80/uz.png' },
    { name: 'Colombia',               code: 'COL', group: 'K', flagUrl: 'https://flagcdn.com/w80/co.png' },
    // GRUPO L
    { name: 'Inglaterra',             code: 'ENG', group: 'L', flagUrl: 'https://flagcdn.com/w80/gb-eng.png' },
    { name: 'Croacia',                code: 'CRO', group: 'L', flagUrl: 'https://flagcdn.com/w80/hr.png' },
    { name: 'Ghana',                  code: 'GHA', group: 'L', flagUrl: 'https://flagcdn.com/w80/gh.png' },
    { name: 'Panamá',                 code: 'PAN', group: 'L', flagUrl: 'https://flagcdn.com/w80/pa.png' },
    // PLACEHOLDERS fase eliminatoria
    { name: 'Por determinar A',       code: 'TBDA', group: null, flagUrl: null },
    { name: 'Por determinar B',       code: 'TBDB', group: null, flagUrl: null },
];

// ─── PARTIDOS ───────────────────────────────────────────────────────────────
const MATCHES = [
    // ═══════════════════════ FASE DE GRUPOS ═══════════════════════
    { num:  1, home:'MEX', away:'RSA', date: bogotaToUtcIso('2026-06-11', '14:00'), venue:'Estadio Banorte, Ciudad de México', phase:'GROUP', group:'A' },
    { num:  2, home:'KOR', away:'CZE', date: bogotaToUtcIso('2026-06-11', '21:00'), venue:'Estadio Akron, Guadalajara', phase:'GROUP', group:'A' },
    { num:  3, home:'CAN', away:'BIH', date: bogotaToUtcIso('2026-06-12', '14:00'), venue:'BMO Field, Toronto', phase:'GROUP', group:'B' },
    { num:  4, home:'USA', away:'PAR', date: bogotaToUtcIso('2026-06-12', '20:00'), venue:'SoFi Stadium, Los Angeles', phase:'GROUP', group:'D' },
    { num:  8, home:'QAT', away:'SUI', date: bogotaToUtcIso('2026-06-13', '14:00'), venue:'Levi\'s Stadium, Santa Clara', phase:'GROUP', group:'B' },
    { num:  7, home:'BRA', away:'MAR', date: bogotaToUtcIso('2026-06-13', '17:00'), venue:'MetLife Stadium, East Rutherford', phase:'GROUP', group:'C' },
    { num:  5, home:'HAI', away:'SCO', date: bogotaToUtcIso('2026-06-13', '20:00'), venue:'Gillette Stadium, Foxborough', phase:'GROUP', group:'C' },
    { num:  6, home:'AUS', away:'TUR', date: bogotaToUtcIso('2026-06-13', '23:00'), venue:'BC Place, Vancouver', phase:'GROUP', group:'D' },
    { num: 10, home:'GER', away:'CUW', date: bogotaToUtcIso('2026-06-14', '12:00'), venue:'NRG Stadium, Houston', phase:'GROUP', group:'E' },
    { num: 11, home:'NED', away:'JPN', date: bogotaToUtcIso('2026-06-14', '15:00'), venue:'AT&T Stadium, Arlington', phase:'GROUP', group:'F' },
    { num:  9, home:'CIV', away:'ECU', date: bogotaToUtcIso('2026-06-14', '18:00'), venue:'Lincoln Financial Field, Philadelphia', phase:'GROUP', group:'E' },
    { num: 12, home:'SWE', away:'TUN', date: bogotaToUtcIso('2026-06-14', '21:00'), venue:'Estadio BBVA, Monterrey', phase:'GROUP', group:'F' },
    { num: 14, home:'ESP', away:'CPV', date: bogotaToUtcIso('2026-06-15', '11:00'), venue:'Mercedes-Benz Stadium, Atlanta', phase:'GROUP', group:'H' },
    { num: 16, home:'BEL', away:'EGY', date: bogotaToUtcIso('2026-06-15', '14:00'), venue:'Lumen Field, Seattle', phase:'GROUP', group:'G' },
    { num: 13, home:'KSA', away:'URU', date: bogotaToUtcIso('2026-06-15', '17:00'), venue:'Hard Rock Stadium, Miami', phase:'GROUP', group:'H' },
    { num: 15, home:'IRN', away:'NZL', date: bogotaToUtcIso('2026-06-15', '20:00'), venue:'SoFi Stadium, Los Angeles', phase:'GROUP', group:'G' },
    { num: 17, home:'FRA', away:'SEN', date: bogotaToUtcIso('2026-06-16', '14:00'), venue:'MetLife Stadium, East Rutherford', phase:'GROUP', group:'I' },
    { num: 18, home:'IRQ', away:'NOR', date: bogotaToUtcIso('2026-06-16', '17:00'), venue:'Gillette Stadium, Foxborough', phase:'GROUP', group:'I' },
    { num: 19, home:'ARG', away:'ALG', date: bogotaToUtcIso('2026-06-16', '20:00'), venue:'GEHA Field at Arrowhead Stadium, Kansas City', phase:'GROUP', group:'J' },
    { num: 20, home:'AUT', away:'JOR', date: bogotaToUtcIso('2026-06-16', '23:00'), venue:'Levi\'s Stadium, Santa Clara', phase:'GROUP', group:'J' },
    { num: 21, home:'POR', away:'COD', date: bogotaToUtcIso('2026-06-17', '12:00'), venue:'NRG Stadium, Houston', phase:'GROUP', group:'K' },
    { num: 22, home:'ENG', away:'CRO', date: bogotaToUtcIso('2026-06-17', '15:00'), venue:'AT&T Stadium, Arlington', phase:'GROUP', group:'L' },
    { num: 23, home:'GHA', away:'PAN', date: bogotaToUtcIso('2026-06-17', '18:00'), venue:'BMO Field, Toronto', phase:'GROUP', group:'L' },
    { num: 24, home:'UZB', away:'COL', date: bogotaToUtcIso('2026-06-17', '21:00'), venue:'Estadio Banorte, Ciudad de México', phase:'GROUP', group:'K' },
    { num: 25, home:'CZE', away:'RSA', date: bogotaToUtcIso('2026-06-18', '11:00'), venue:'Mercedes-Benz Stadium, Atlanta', phase:'GROUP', group:'A' },
    { num: 26, home:'SUI', away:'BIH', date: bogotaToUtcIso('2026-06-18', '14:00'), venue:'SoFi Stadium, Los Angeles', phase:'GROUP', group:'B' },
    { num: 27, home:'CAN', away:'QAT', date: bogotaToUtcIso('2026-06-18', '17:00'), venue:'BC Place, Vancouver', phase:'GROUP', group:'B' },
    { num: 28, home:'MEX', away:'KOR', date: bogotaToUtcIso('2026-06-18', '20:00'), venue:'Estadio Akron, Guadalajara', phase:'GROUP', group:'A' },
    { num: 32, home:'USA', away:'AUS', date: bogotaToUtcIso('2026-06-19', '14:00'), venue:'Lumen Field, Seattle', phase:'GROUP', group:'D' },
    { num: 30, home:'SCO', away:'MAR', date: bogotaToUtcIso('2026-06-19', '17:00'), venue:'Gillette Stadium, Foxborough', phase:'GROUP', group:'C' },
    { num: 29, home:'BRA', away:'HAI', date: bogotaToUtcIso('2026-06-19', '19:30'), venue:'Lincoln Financial Field, Philadelphia', phase:'GROUP', group:'C' },
    { num: 31, home:'TUR', away:'PAR', date: bogotaToUtcIso('2026-06-19', '22:00'), venue:'Levi\'s Stadium, Santa Clara', phase:'GROUP', group:'D' },
    { num: 35, home:'NED', away:'SWE', date: bogotaToUtcIso('2026-06-20', '12:00'), venue:'NRG Stadium, Houston', phase:'GROUP', group:'F' },
    { num: 33, home:'GER', away:'CIV', date: bogotaToUtcIso('2026-06-20', '15:00'), venue:'BMO Field, Toronto', phase:'GROUP', group:'E' },
    { num: 34, home:'ECU', away:'CUW', date: bogotaToUtcIso('2026-06-20', '19:00'), venue:'GEHA Field at Arrowhead Stadium, Kansas City', phase:'GROUP', group:'E' },
    { num: 36, home:'TUN', away:'JPN', date: bogotaToUtcIso('2026-06-20', '23:00'), venue:'Estadio BBVA, Monterrey', phase:'GROUP', group:'F' },
    { num: 38, home:'ESP', away:'KSA', date: bogotaToUtcIso('2026-06-21', '11:00'), venue:'Mercedes-Benz Stadium, Atlanta', phase:'GROUP', group:'H' },
    { num: 39, home:'BEL', away:'IRN', date: bogotaToUtcIso('2026-06-21', '14:00'), venue:'SoFi Stadium, Los Angeles', phase:'GROUP', group:'G' },
    { num: 37, home:'URU', away:'CPV', date: bogotaToUtcIso('2026-06-21', '17:00'), venue:'Hard Rock Stadium, Miami', phase:'GROUP', group:'H' },
    { num: 40, home:'NZL', away:'EGY', date: bogotaToUtcIso('2026-06-21', '20:00'), venue:'BC Place, Vancouver', phase:'GROUP', group:'G' },
    { num: 43, home:'ARG', away:'AUT', date: bogotaToUtcIso('2026-06-22', '12:00'), venue:'AT&T Stadium, Arlington', phase:'GROUP', group:'J' },
    { num: 42, home:'FRA', away:'IRQ', date: bogotaToUtcIso('2026-06-22', '16:00'), venue:'Lincoln Financial Field, Philadelphia', phase:'GROUP', group:'I' },
    { num: 41, home:'NOR', away:'SEN', date: bogotaToUtcIso('2026-06-22', '19:00'), venue:'MetLife Stadium, East Rutherford', phase:'GROUP', group:'I' },
    { num: 44, home:'JOR', away:'ALG', date: bogotaToUtcIso('2026-06-22', '22:00'), venue:'Levi\'s Stadium, Santa Clara', phase:'GROUP', group:'J' },
    { num: 47, home:'POR', away:'UZB', date: bogotaToUtcIso('2026-06-23', '12:00'), venue:'NRG Stadium, Houston', phase:'GROUP', group:'K' },
    { num: 45, home:'ENG', away:'GHA', date: bogotaToUtcIso('2026-06-23', '15:00'), venue:'Gillette Stadium, Foxborough', phase:'GROUP', group:'L' },
    { num: 46, home:'PAN', away:'CRO', date: bogotaToUtcIso('2026-06-23', '18:00'), venue:'BMO Field, Toronto', phase:'GROUP', group:'L' },
    { num: 48, home:'COL', away:'COD', date: bogotaToUtcIso('2026-06-23', '21:00'), venue:'Estadio Akron, Guadalajara', phase:'GROUP', group:'K' },
    { num: 51, home:'SUI', away:'CAN', date: bogotaToUtcIso('2026-06-24', '14:00'), venue:'BC Place, Vancouver', phase:'GROUP', group:'B' },
    { num: 52, home:'BIH', away:'QAT', date: bogotaToUtcIso('2026-06-24', '14:00'), venue:'Lumen Field, Seattle', phase:'GROUP', group:'B' },
    { num: 49, home:'SCO', away:'BRA', date: bogotaToUtcIso('2026-06-24', '17:00'), venue:'Hard Rock Stadium, Miami', phase:'GROUP', group:'C' },
    { num: 50, home:'MAR', away:'HAI', date: bogotaToUtcIso('2026-06-24', '17:00'), venue:'Mercedes-Benz Stadium, Atlanta', phase:'GROUP', group:'C' },
    { num: 54, home:'RSA', away:'KOR', date: bogotaToUtcIso('2026-06-24', '20:00'), venue:'Estadio BBVA, Monterrey', phase:'GROUP', group:'A' },
    { num: 53, home:'CZE', away:'MEX', date: bogotaToUtcIso('2026-06-24', '20:00'), venue:'Estadio Banorte, Ciudad de México', phase:'GROUP', group:'A' },
    { num: 55, home:'CUW', away:'CIV', date: bogotaToUtcIso('2026-06-25', '15:00'), venue:'Lincoln Financial Field, Philadelphia', phase:'GROUP', group:'E' },
    { num: 56, home:'ECU', away:'GER', date: bogotaToUtcIso('2026-06-25', '15:00'), venue:'MetLife Stadium, East Rutherford', phase:'GROUP', group:'E' },
    { num: 57, home:'JPN', away:'SWE', date: bogotaToUtcIso('2026-06-25', '18:00'), venue:'AT&T Stadium, Arlington', phase:'GROUP', group:'F' },
    { num: 58, home:'TUN', away:'NED', date: bogotaToUtcIso('2026-06-25', '18:00'), venue:'GEHA Field at Arrowhead Stadium, Kansas City', phase:'GROUP', group:'F' },
    { num: 60, home:'PAR', away:'AUS', date: bogotaToUtcIso('2026-06-25', '21:00'), venue:'Levi\'s Stadium, Santa Clara', phase:'GROUP', group:'D' },
    { num: 59, home:'TUR', away:'USA', date: bogotaToUtcIso('2026-06-25', '21:00'), venue:'SoFi Stadium, Los Angeles', phase:'GROUP', group:'D' },
    { num: 61, home:'NOR', away:'FRA', date: bogotaToUtcIso('2026-06-26', '14:00'), venue:'Gillette Stadium, Foxborough', phase:'GROUP', group:'I' },
    { num: 62, home:'SEN', away:'IRQ', date: bogotaToUtcIso('2026-06-26', '14:00'), venue:'BMO Field, Toronto', phase:'GROUP', group:'I' },
    { num: 66, home:'URU', away:'ESP', date: bogotaToUtcIso('2026-06-26', '19:00'), venue:'Estadio Akron, Guadalajara', phase:'GROUP', group:'H' },
    { num: 65, home:'CPV', away:'KSA', date: bogotaToUtcIso('2026-06-26', '19:00'), venue:'NRG Stadium, Houston', phase:'GROUP', group:'H' },
    { num: 63, home:'EGY', away:'IRN', date: bogotaToUtcIso('2026-06-26', '22:00'), venue:'Lumen Field, Seattle', phase:'GROUP', group:'G' },
    { num: 64, home:'NZL', away:'BEL', date: bogotaToUtcIso('2026-06-26', '22:00'), venue:'BC Place, Vancouver', phase:'GROUP', group:'G' },
    { num: 67, home:'PAN', away:'ENG', date: bogotaToUtcIso('2026-06-27', '16:00'), venue:'MetLife Stadium, East Rutherford', phase:'GROUP', group:'L' },
    { num: 68, home:'CRO', away:'GHA', date: bogotaToUtcIso('2026-06-27', '16:00'), venue:'Lincoln Financial Field, Philadelphia', phase:'GROUP', group:'L' },
    { num: 71, home:'COL', away:'POR', date: bogotaToUtcIso('2026-06-27', '18:30'), venue:'Hard Rock Stadium, Miami', phase:'GROUP', group:'K' },
    { num: 72, home:'COD', away:'UZB', date: bogotaToUtcIso('2026-06-27', '18:30'), venue:'Mercedes-Benz Stadium, Atlanta', phase:'GROUP', group:'K' },
    { num: 70, home:'JOR', away:'ARG', date: bogotaToUtcIso('2026-06-27', '21:00'), venue:'AT&T Stadium, Arlington', phase:'GROUP', group:'J' },
    { num: 69, home:'ALG', away:'AUT', date: bogotaToUtcIso('2026-06-27', '21:00'), venue:'GEHA Field at Arrowhead Stadium, Kansas City', phase:'GROUP', group:'J' },
    // ═══════════════════════ DIECISEISAVOS DE FINAL ═══════════════════════
    { num: 73, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-06-28', '14:00'), venue:'SoFi Stadium, Los Angeles', phase:'ROUND_OF_32', group:null },
    { num: 76, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-06-29', '12:00'), venue:'NRG Stadium, Houston', phase:'ROUND_OF_32', group:null },
    { num: 74, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-06-29', '15:30'), venue:'Gillette Stadium, Foxborough', phase:'ROUND_OF_32', group:null },
    { num: 75, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-06-29', '20:00'), venue:'Estadio BBVA, Monterrey', phase:'ROUND_OF_32', group:null },
    { num: 78, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-06-30', '12:00'), venue:'AT&T Stadium, Arlington', phase:'ROUND_OF_32', group:null },
    { num: 77, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-06-30', '16:00'), venue:'MetLife Stadium, East Rutherford', phase:'ROUND_OF_32', group:null },
    { num: 79, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-06-30', '20:00'), venue:'Estadio Banorte, Ciudad de México', phase:'ROUND_OF_32', group:null },
    { num: 80, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-01', '11:00'), venue:'Mercedes-Benz Stadium, Atlanta', phase:'ROUND_OF_32', group:null },
    { num: 82, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-01', '15:00'), venue:'Lumen Field, Seattle', phase:'ROUND_OF_32', group:null },
    { num: 81, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-01', '19:00'), venue:'Levi\'s Stadium, Santa Clara', phase:'ROUND_OF_32', group:null },
    { num: 84, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-02', '14:00'), venue:'SoFi Stadium, Los Angeles', phase:'ROUND_OF_32', group:null },
    { num: 83, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-02', '18:00'), venue:'BMO Field, Toronto', phase:'ROUND_OF_32', group:null },
    { num: 85, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-02', '22:00'), venue:'BC Place, Vancouver', phase:'ROUND_OF_32', group:null },
    { num: 88, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-03', '13:00'), venue:'AT&T Stadium, Arlington', phase:'ROUND_OF_32', group:null },
    { num: 86, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-03', '17:00'), venue:'Hard Rock Stadium, Miami', phase:'ROUND_OF_32', group:null },
    { num: 87, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-03', '20:30'), venue:'GEHA Field at Arrowhead Stadium, Kansas City', phase:'ROUND_OF_32', group:null },
    // ═══════════════════════ OCTAVOS DE FINAL ═══════════════════════
    { num: 90, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-04', '12:00'), venue:'NRG Stadium, Houston', phase:'ROUND_OF_16', group:null },
    { num: 89, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-04', '16:00'), venue:'Lincoln Financial Field, Philadelphia', phase:'ROUND_OF_16', group:null },
    { num: 91, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-05', '15:00'), venue:'MetLife Stadium, East Rutherford', phase:'ROUND_OF_16', group:null },
    { num: 92, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-05', '19:00'), venue:'Estadio Banorte, Ciudad de México', phase:'ROUND_OF_16', group:null },
    { num: 93, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-06', '14:00'), venue:'AT&T Stadium, Arlington', phase:'ROUND_OF_16', group:null },
    { num: 94, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-06', '19:00'), venue:'Lumen Field, Seattle', phase:'ROUND_OF_16', group:null },
    { num: 95, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-07', '11:00'), venue:'Mercedes-Benz Stadium, Atlanta', phase:'ROUND_OF_16', group:null },
    { num: 96, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-07', '15:00'), venue:'BC Place, Vancouver', phase:'ROUND_OF_16', group:null },
    // ═══════════════════════ CUARTOS DE FINAL ═══════════════════════
    { num: 97, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-09', '15:00'), venue:'Gillette Stadium, Foxborough', phase:'QUARTER', group:null },
    { num: 98, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-10', '14:00'), venue:'SoFi Stadium, Los Angeles', phase:'QUARTER', group:null },
    { num: 99, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-11', '16:00'), venue:'Hard Rock Stadium, Miami', phase:'QUARTER', group:null },
    { num:100, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-11', '20:00'), venue:'GEHA Field at Arrowhead Stadium, Kansas City', phase:'QUARTER', group:null },
    // ═══════════════════════ SEMIFINALES ═══════════════════════
    { num:101, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-14', '14:00'), venue:'AT&T Stadium, Arlington', phase:'SEMI', group:null },
    { num:102, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-15', '14:00'), venue:'Mercedes-Benz Stadium, Atlanta', phase:'SEMI', group:null },
    // ═══════════════════════ TERCER PUESTO ═══════════════════════
    { num:103, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-18', '16:00'), venue:'Hard Rock Stadium, Miami', phase:'THIRD_PLACE', group:null },
    // ═══════════════════════ FINAL ═══════════════════════
    { num:104, home:'TBDA', away:'TBDB', date: bogotaToUtcIso('2026-07-19', '14:00'), venue:'MetLife Stadium, East Rutherford', phase:'FINAL', group:null },
] as const;

// ─── HELPER ─────────────────────────────────────────────────────────────────
function getRound(num: number, phase: string): string {
    if (phase === 'GROUP') {
        if (num <= 24) return 'Jornada 1';
        if (num <= 48) return 'Jornada 2';
        return 'Jornada 3';
    }
    const map: Record<string, string> = {
        ROUND_OF_32:  'Dieciseisavos de Final',
        ROUND_OF_16:  'Octavos de Final',
        QUARTER:      'Cuartos de Final',
        SEMI:         'Semifinal',
        THIRD_PLACE:  'Tercer Puesto',
        FINAL:        'Final',
    };
    return map[phase] ?? phase;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
    console.log('⚠️  RESET + Seed Mundial 2026...');
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) throw new Error('DATABASE_URL no encontrado en .env');
    const connectionUrl = rawUrl.startsWith('mysql://')
        ? `mariadb://${rawUrl.slice('mysql://'.length)}`
        : rawUrl;
    const adapter = new PrismaMariaDb(connectionUrl);
    const prisma = new PrismaClient({ adapter: adapter as any });
    await prisma.$connect();

    try {
        // ── 1. Borrar torneos sin partidos ────────────────────────────────
        console.log('\n🗑️  Limpiando torneos sin partidos...');

        const tournamentsWithMatches = await prisma.tournament.findMany({
            where: { matches: { some: {} } },
            select: { id: true },
        });
        const idsConPartidos = tournamentsWithMatches.map(t => t.id);

        const toursSinPartidos = await prisma.tournament.findMany({
            where: { id: { notIn: idsConPartidos } },
            select: { id: true, name: true },
        });

        if (toursSinPartidos.length > 0) {
            const idsSinPartidos = toursSinPartidos.map(t => t.id);

            // Nullificar FKs en League y Match antes de borrar
            await prisma.league.updateMany({
                where: { primaryTournamentId: { in: idsSinPartidos } },
                data: { primaryTournamentId: null },
            });
            await prisma.match.updateMany({
                where: { tournamentId: { in: idsSinPartidos } },
                data: { tournamentId: null },
            });

            // LeagueTournament se borra con Cascade, pero lo hacemos explícito
            await prisma.leagueTournament.deleteMany({
                where: { tournamentId: { in: idsSinPartidos } },
            });

            const delTours = await prisma.tournament.deleteMany({
                where: { id: { in: idsSinPartidos } },
            });
            console.log(`  ✓ Torneos sin partidos eliminados: ${delTours.count}`);
        } else {
            console.log('  ✓ No había torneos sin partidos');
        }

        // ── 2. Borrar partidos, eventos y equipos existentes ──────────────
        console.log('\n🗑️  Borrando historial existente...');

        const delPredictions = await prisma.prediction.deleteMany({});
        console.log(`  ✓ Predicciones borradas: ${delPredictions.count}`);

        const delLeagueMatches = await prisma.leagueMatch.deleteMany({});
        console.log(`  ✓ LeagueMatches borrados: ${delLeagueMatches.count}`);

        const delMatchEvents = await prisma.matchEvent.deleteMany({});
        console.log(`  ✓ MatchEvents borrados: ${delMatchEvents.count}`);

        const delAutomationRuns = await prisma.automationRun.deleteMany({});
        console.log(`  ✓ AutomationRuns borrados: ${delAutomationRuns.count}`);

        const delParticipation = await prisma.participationObligation.deleteMany({});
        console.log(`  ✓ ParticipationObligations borrados: ${delParticipation.count}`);

        // FootballSyncLog.matchId es nullable — nullificar para no bloquear delete
        await prisma.footballSyncLog.updateMany({ data: { matchId: null } });

        const delMatches = await prisma.match.deleteMany({});
        console.log(`  ✓ Partidos borrados: ${delMatches.count}`);

        const delTeams = await prisma.team.deleteMany({});
        console.log(`  ✓ Equipos borrados: ${delTeams.count}`);

        // ── 2. Upsert torneo FIFA World Cup 2026 ──────────────────────────
        console.log('\n🏆 Creando torneo FIFA World Cup 2026...');
        const tournament = await prisma.tournament.upsert({
            where: { apiFootballLeagueId: 1 },
            create: {
                name: 'FIFA World Cup',
                country: 'World',
                type: 'KNOCKOUT',
                logoUrl: 'https://media.api-sports.io/football/leagues/1.png',
                apiFootballLeagueId: 1,
                season: 2026,
                active: true,
            },
            update: {
                name: 'FIFA World Cup',
                country: 'World',
                season: 2026,
                active: true,
                logoUrl: 'https://media.api-sports.io/football/leagues/1.png',
            },
        });
        console.log(`  ✓ Torneo creado/actualizado: ${tournament.id}`);

        // ── 3. Insertar equipos ────────────────────────────────────────────
        console.log(`\n📋 Insertando ${TEAMS.length} equipos...`);
        for (const t of TEAMS) {
            await prisma.team.create({
                data: { name: t.name, code: t.code, shortCode: t.code, group: t.group, flagUrl: t.flagUrl },
            });
            process.stdout.write(`  ✓ ${t.code}\r`);
        }
        console.log(`  ✓ ${TEAMS.length} equipos OK          `);

        // ── 4. Mapa code → id ──────────────────────────────────────────────
        const allTeams = await prisma.team.findMany({ select: { id: true, code: true } });
        const teamMap = new Map(allTeams.map(t => [t.code, t.id]));

        // ── 5. Insertar partidos ───────────────────────────────────────────
        console.log(`\n⚽ Insertando ${MATCHES.length} partidos...`);
        for (const m of MATCHES) {
            await prisma.match.create({
                data: {
                    matchNumber:  m.num,
                    homeTeamId:   teamMap.get(m.home)!,
                    awayTeamId:   teamMap.get(m.away)!,
                    phase:        m.phase as any,
                    group:        m.group,
                    round:        getRound(m.num, m.phase),
                    matchDate:    new Date(m.date),
                    venue:        m.venue,
                    status:       'SCHEDULED',
                    tournamentId: tournament.id,
                },
            });
            process.stdout.write(`  Partido ${m.num}/104\r`);
        }

        console.log(`\n✅ ${MATCHES.length} partidos insertados`);
        console.log('🏆 Reset + Seed Mundial 2026 completo!\n');
    } catch (err) {
        console.error('\n❌ Error:', err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
