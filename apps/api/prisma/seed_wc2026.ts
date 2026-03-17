/**
 * Seed Mundial 2026 — 50 equipos + 104 partidos
 * Horarios originales en COT (UTC-5). Convertidos a UTC sumando 5h.
 * Ejecutar: npx ts-node prisma/seed_wc2026.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

// ─── EQUIPOS ────────────────────────────────────────────────────────────────
const TEAMS = [
    // GRUPO A
    { name: 'México',                 code: 'MEX', group: 'A', flagUrl: 'https://flagcdn.com/w80/mx.png' },
    { name: 'Sudáfrica',              code: 'RSA', group: 'A', flagUrl: 'https://flagcdn.com/w80/za.png' },
    { name: 'República de Corea',     code: 'KOR', group: 'A', flagUrl: 'https://flagcdn.com/w80/kr.png' },
    { name: 'DEN/MKD/CZE/IRL',        code: 'PED', group: 'A', flagUrl: null },
    // GRUPO B
    { name: 'Canadá',                 code: 'CAN', group: 'B', flagUrl: 'https://flagcdn.com/w80/ca.png' },
    { name: 'ITA/NIR/WAL/BIH',        code: 'PEA', group: 'B', flagUrl: null },
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
    { name: 'TUR/ROU/SVK/KOS',        code: 'PEC', group: 'D', flagUrl: null },
    // GRUPO E
    { name: 'Alemania',               code: 'GER', group: 'E', flagUrl: 'https://flagcdn.com/w80/de.png' },
    { name: 'Curazao',                code: 'CUW', group: 'E', flagUrl: 'https://flagcdn.com/w80/cw.png' },
    { name: 'Costa de Marfil',        code: 'CIV', group: 'E', flagUrl: 'https://flagcdn.com/w80/ci.png' },
    { name: 'Ecuador',                code: 'ECU', group: 'E', flagUrl: 'https://flagcdn.com/w80/ec.png' },
    // GRUPO F
    { name: 'Países Bajos',           code: 'NED', group: 'F', flagUrl: 'https://flagcdn.com/w80/nl.png' },
    { name: 'Japón',                  code: 'JPN', group: 'F', flagUrl: 'https://flagcdn.com/w80/jp.png' },
    { name: 'UKR/SWE/POL/ALB',        code: 'PEB', group: 'F', flagUrl: null },
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
    { name: 'BOL/SUR/IRQ',            code: 'IC2', group: 'I', flagUrl: null },
    { name: 'Noruega',                code: 'NOR', group: 'I', flagUrl: 'https://flagcdn.com/w80/no.png' },
    // GRUPO J
    { name: 'Argentina',              code: 'ARG', group: 'J', flagUrl: 'https://flagcdn.com/w80/ar.png' },
    { name: 'Argelia',                code: 'ALG', group: 'J', flagUrl: 'https://flagcdn.com/w80/dz.png' },
    { name: 'Austria',                code: 'AUT', group: 'J', flagUrl: 'https://flagcdn.com/w80/at.png' },
    { name: 'Jordania',               code: 'JOR', group: 'J', flagUrl: 'https://flagcdn.com/w80/jo.png' },
    // GRUPO K
    { name: 'Portugal',               code: 'POR', group: 'K', flagUrl: 'https://flagcdn.com/w80/pt.png' },
    { name: 'NCL/JAM/COD',            code: 'IC1', group: 'K', flagUrl: null },
    { name: 'Uzbekistán',             code: 'UZB', group: 'K', flagUrl: 'https://flagcdn.com/w80/uz.png' },
    { name: 'Colombia',               code: 'COL', group: 'K', flagUrl: 'https://flagcdn.com/w80/co.png' },
    // GRUPO L
    { name: 'Inglaterra',             code: 'ENG', group: 'L', flagUrl: 'https://flagcdn.com/w80/gb-eng.png' },
    { name: 'Croacia',                code: 'CRO', group: 'L', flagUrl: 'https://flagcdn.com/w80/hr.png' },
    { name: 'Ghana',                  code: 'GHA', group: 'L', flagUrl: 'https://flagcdn.com/w80/gh.png' },
    { name: 'Panamá',                 code: 'PAN', group: 'L', flagUrl: 'https://flagcdn.com/w80/pa.png' },
    // PLACEHOLDERS para fase eliminatoria
    { name: 'Por determinar A',       code: 'TBDA', group: null, flagUrl: null },
    { name: 'Por determinar B',       code: 'TBDB', group: null, flagUrl: null },
];

// ─── PARTIDOS ───────────────────────────────────────────────────────────────
// phase: GROUP | ROUND_OF_32 | ROUND_OF_16 | QUARTER | SEMI | THIRD_PLACE | FINAL
// Todos los horarios en UTC (COT+5h). Formato: 'YYYY-MM-DDTHH:MM:00Z'
const MATCHES = [
    // ══════════════════════════ FASE DE GRUPOS ══════════════════════════════
    // ─── JORNADA 1 ──────────────────────────────────────────────────────────
    // Jun 11
    { num:  1, home:'MEX', away:'RSA', date:'2026-06-11T19:00:00Z', venue:'Estadio Azteca, Ciudad de México',             phase:'GROUP', group:'A' },
    { num:  2, home:'KOR', away:'PED', date:'2026-06-12T02:00:00Z', venue:'Estadio Akron, Guadalajara',                   phase:'GROUP', group:'A' },
    // Jun 12
    { num:  3, home:'CAN', away:'PEA', date:'2026-06-12T19:00:00Z', venue:'BMO Field, Toronto',                           phase:'GROUP', group:'B' },
    { num:  4, home:'USA', away:'PAR', date:'2026-06-13T01:00:00Z', venue:'SoFi Stadium, Los Angeles',                    phase:'GROUP', group:'D' },
    // Jun 13
    { num:  5, home:'QAT', away:'SUI', date:'2026-06-13T19:00:00Z', venue:"Levi's Stadium, Santa Clara",                  phase:'GROUP', group:'B' },
    { num:  6, home:'BRA', away:'MAR', date:'2026-06-13T22:00:00Z', venue:'MetLife Stadium, East Rutherford',             phase:'GROUP', group:'C' },
    { num:  7, home:'HAI', away:'SCO', date:'2026-06-14T01:00:00Z', venue:'Gillette Stadium, Foxborough',                 phase:'GROUP', group:'C' },
    { num:  8, home:'AUS', away:'PEC', date:'2026-06-14T04:00:00Z', venue:'BC Place, Vancouver',                          phase:'GROUP', group:'D' },
    // Jun 14
    { num:  9, home:'GER', away:'CUW', date:'2026-06-14T17:00:00Z', venue:'NRG Stadium, Houston',                         phase:'GROUP', group:'E' },
    { num: 10, home:'NED', away:'JPN', date:'2026-06-14T20:00:00Z', venue:'AT&T Stadium, Arlington',                      phase:'GROUP', group:'F' },
    { num: 11, home:'CIV', away:'ECU', date:'2026-06-14T23:00:00Z', venue:'Lincoln Financial Field, Philadelphia',        phase:'GROUP', group:'E' },
    { num: 12, home:'PEB', away:'TUN', date:'2026-06-15T02:00:00Z', venue:'Estadio BBVA, Monterrey',                      phase:'GROUP', group:'F' },
    // Jun 15
    { num: 13, home:'ESP', away:'CPV', date:'2026-06-15T16:00:00Z', venue:'Mercedes-Benz Stadium, Atlanta',               phase:'GROUP', group:'H' },
    { num: 14, home:'BEL', away:'EGY', date:'2026-06-15T19:00:00Z', venue:'Lumen Field, Seattle',                        phase:'GROUP', group:'G' },
    { num: 15, home:'KSA', away:'URU', date:'2026-06-15T22:00:00Z', venue:'Hard Rock Stadium, Miami',                    phase:'GROUP', group:'H' },
    { num: 16, home:'IRN', away:'NZL', date:'2026-06-16T01:00:00Z', venue:'SoFi Stadium, Los Angeles',                   phase:'GROUP', group:'G' },
    // Jun 16
    { num: 17, home:'FRA', away:'SEN', date:'2026-06-16T19:00:00Z', venue:'MetLife Stadium, East Rutherford',             phase:'GROUP', group:'I' },
    { num: 18, home:'IC2', away:'NOR', date:'2026-06-16T22:00:00Z', venue:'Gillette Stadium, Foxborough',                 phase:'GROUP', group:'I' },
    { num: 19, home:'ARG', away:'ALG', date:'2026-06-17T01:00:00Z', venue:'Arrowhead Stadium, Kansas City',               phase:'GROUP', group:'J' },
    { num: 20, home:'AUT', away:'JOR', date:'2026-06-17T04:00:00Z', venue:"Levi's Stadium, Santa Clara",                  phase:'GROUP', group:'J' },
    // Jun 17
    { num: 21, home:'POR', away:'IC1', date:'2026-06-17T17:00:00Z', venue:'NRG Stadium, Houston',                         phase:'GROUP', group:'K' },
    { num: 22, home:'ENG', away:'CRO', date:'2026-06-17T20:00:00Z', venue:'AT&T Stadium, Arlington',                      phase:'GROUP', group:'L' },
    { num: 23, home:'GHA', away:'PAN', date:'2026-06-17T23:00:00Z', venue:'BMO Field, Toronto',                           phase:'GROUP', group:'L' },
    { num: 24, home:'UZB', away:'COL', date:'2026-06-18T02:00:00Z', venue:'Estadio Azteca, Ciudad de México',             phase:'GROUP', group:'K' },

    // ─── JORNADA 2 ──────────────────────────────────────────────────────────
    // Jun 18
    { num: 25, home:'PED', away:'RSA', date:'2026-06-18T16:00:00Z', venue:'Mercedes-Benz Stadium, Atlanta',               phase:'GROUP', group:'A' },
    { num: 26, home:'SUI', away:'PEA', date:'2026-06-18T19:00:00Z', venue:'SoFi Stadium, Los Angeles',                   phase:'GROUP', group:'B' },
    { num: 27, home:'CAN', away:'QAT', date:'2026-06-18T22:00:00Z', venue:'BC Place, Vancouver',                          phase:'GROUP', group:'B' },
    { num: 28, home:'MEX', away:'KOR', date:'2026-06-19T01:00:00Z', venue:'Estadio Akron, Guadalajara',                   phase:'GROUP', group:'A' },
    // Jun 19
    { num: 29, home:'USA', away:'AUS', date:'2026-06-19T19:00:00Z', venue:'Lumen Field, Seattle',                        phase:'GROUP', group:'D' },
    { num: 30, home:'SCO', away:'MAR', date:'2026-06-19T22:00:00Z', venue:'Gillette Stadium, Foxborough',                 phase:'GROUP', group:'C' },
    { num: 31, home:'BRA', away:'HAI', date:'2026-06-20T01:00:00Z', venue:'Lincoln Financial Field, Philadelphia',        phase:'GROUP', group:'C' },
    { num: 32, home:'PEC', away:'PAR', date:'2026-06-20T04:00:00Z', venue:"Levi's Stadium, Santa Clara",                  phase:'GROUP', group:'D' },
    // Jun 20
    { num: 33, home:'NED', away:'PEB', date:'2026-06-20T17:00:00Z', venue:'NRG Stadium, Houston',                         phase:'GROUP', group:'F' },
    { num: 34, home:'GER', away:'CIV', date:'2026-06-20T20:00:00Z', venue:'BMO Field, Toronto',                           phase:'GROUP', group:'E' },
    { num: 35, home:'ECU', away:'CUW', date:'2026-06-21T00:00:00Z', venue:'Arrowhead Stadium, Kansas City',               phase:'GROUP', group:'E' },
    { num: 36, home:'TUN', away:'JPN', date:'2026-06-21T04:00:00Z', venue:'Estadio BBVA, Monterrey',                      phase:'GROUP', group:'F' },
    // Jun 21
    { num: 37, home:'ESP', away:'KSA', date:'2026-06-21T16:00:00Z', venue:'Mercedes-Benz Stadium, Atlanta',               phase:'GROUP', group:'H' },
    { num: 38, home:'BEL', away:'IRN', date:'2026-06-21T19:00:00Z', venue:'SoFi Stadium, Los Angeles',                   phase:'GROUP', group:'G' },
    { num: 39, home:'URU', away:'CPV', date:'2026-06-21T22:00:00Z', venue:'Hard Rock Stadium, Miami',                    phase:'GROUP', group:'H' },
    { num: 40, home:'NZL', away:'EGY', date:'2026-06-22T01:00:00Z', venue:'BC Place, Vancouver',                          phase:'GROUP', group:'G' },
    // Jun 22
    { num: 41, home:'ARG', away:'AUT', date:'2026-06-22T17:00:00Z', venue:'AT&T Stadium, Arlington',                      phase:'GROUP', group:'J' },
    { num: 42, home:'FRA', away:'IC2', date:'2026-06-22T21:00:00Z', venue:'Lincoln Financial Field, Philadelphia',        phase:'GROUP', group:'I' },
    { num: 43, home:'NOR', away:'SEN', date:'2026-06-23T00:00:00Z', venue:'MetLife Stadium, East Rutherford',             phase:'GROUP', group:'I' },
    { num: 44, home:'JOR', away:'ALG', date:'2026-06-23T03:00:00Z', venue:"Levi's Stadium, Santa Clara",                  phase:'GROUP', group:'J' },
    // Jun 23
    { num: 45, home:'POR', away:'UZB', date:'2026-06-23T17:00:00Z', venue:'NRG Stadium, Houston',                         phase:'GROUP', group:'K' },
    { num: 46, home:'ENG', away:'GHA', date:'2026-06-23T20:00:00Z', venue:'Gillette Stadium, Foxborough',                 phase:'GROUP', group:'L' },
    { num: 47, home:'PAN', away:'CRO', date:'2026-06-23T23:00:00Z', venue:'BMO Field, Toronto',                           phase:'GROUP', group:'L' },
    { num: 48, home:'COL', away:'IC1', date:'2026-06-24T02:00:00Z', venue:'Estadio Akron, Guadalajara',                   phase:'GROUP', group:'K' },

    // ─── JORNADA 3 (simultánea por grupo) ───────────────────────────────────
    // Jun 24 — Grupo B y C
    { num: 49, home:'SUI', away:'CAN', date:'2026-06-24T19:00:00Z', venue:'BC Place, Vancouver',                          phase:'GROUP', group:'B' },
    { num: 50, home:'PEA', away:'QAT', date:'2026-06-24T19:00:00Z', venue:'Lumen Field, Seattle',                        phase:'GROUP', group:'B' },
    { num: 51, home:'SCO', away:'BRA', date:'2026-06-24T22:00:00Z', venue:'Hard Rock Stadium, Miami',                    phase:'GROUP', group:'C' },
    { num: 52, home:'MAR', away:'HAI', date:'2026-06-24T22:00:00Z', venue:'Mercedes-Benz Stadium, Atlanta',               phase:'GROUP', group:'C' },
    // Jun 24→25 — Grupo A
    { num: 53, home:'PED', away:'MEX', date:'2026-06-25T01:00:00Z', venue:'Estadio Azteca, Ciudad de México',             phase:'GROUP', group:'A' },
    { num: 54, home:'RSA', away:'KOR', date:'2026-06-25T01:00:00Z', venue:'Estadio BBVA, Monterrey',                      phase:'GROUP', group:'A' },
    // Jun 25 — Grupo E y F
    { num: 55, home:'CUW', away:'CIV', date:'2026-06-25T20:00:00Z', venue:'Lincoln Financial Field, Philadelphia',        phase:'GROUP', group:'E' },
    { num: 56, home:'ECU', away:'GER', date:'2026-06-25T20:00:00Z', venue:'MetLife Stadium, East Rutherford',             phase:'GROUP', group:'E' },
    { num: 57, home:'JPN', away:'PEB', date:'2026-06-25T23:00:00Z', venue:'AT&T Stadium, Arlington',                      phase:'GROUP', group:'F' },
    { num: 58, home:'TUN', away:'NED', date:'2026-06-25T23:00:00Z', venue:'Arrowhead Stadium, Kansas City',               phase:'GROUP', group:'F' },
    // Jun 25→26 — Grupo D
    { num: 59, home:'PEC', away:'USA', date:'2026-06-26T02:00:00Z', venue:'SoFi Stadium, Los Angeles',                   phase:'GROUP', group:'D' },
    { num: 60, home:'PAR', away:'AUS', date:'2026-06-26T02:00:00Z', venue:"Levi's Stadium, Santa Clara",                  phase:'GROUP', group:'D' },
    // Jun 26 — Grupo I y H y G
    { num: 61, home:'NOR', away:'FRA', date:'2026-06-26T19:00:00Z', venue:'Gillette Stadium, Foxborough',                 phase:'GROUP', group:'I' },
    { num: 62, home:'SEN', away:'IC2', date:'2026-06-26T19:00:00Z', venue:'BMO Field, Toronto',                           phase:'GROUP', group:'I' },
    { num: 63, home:'CPV', away:'KSA', date:'2026-06-27T00:00:00Z', venue:'NRG Stadium, Houston',                         phase:'GROUP', group:'H' },
    { num: 64, home:'URU', away:'ESP', date:'2026-06-27T00:00:00Z', venue:'Estadio Akron, Guadalajara',                   phase:'GROUP', group:'H' },
    { num: 65, home:'EGY', away:'IRN', date:'2026-06-27T03:00:00Z', venue:'Lumen Field, Seattle',                        phase:'GROUP', group:'G' },
    { num: 66, home:'NZL', away:'BEL', date:'2026-06-27T03:00:00Z', venue:'BC Place, Vancouver',                          phase:'GROUP', group:'G' },
    // Jun 27 — Grupo L, K y J
    { num: 67, home:'PAN', away:'ENG', date:'2026-06-27T21:00:00Z', venue:'MetLife Stadium, East Rutherford',             phase:'GROUP', group:'L' },
    { num: 68, home:'CRO', away:'GHA', date:'2026-06-27T21:00:00Z', venue:'Lincoln Financial Field, Philadelphia',        phase:'GROUP', group:'L' },
    { num: 69, home:'COL', away:'POR', date:'2026-06-27T23:30:00Z', venue:'Hard Rock Stadium, Miami',                    phase:'GROUP', group:'K' },
    { num: 70, home:'IC1', away:'UZB', date:'2026-06-27T23:30:00Z', venue:'Mercedes-Benz Stadium, Atlanta',               phase:'GROUP', group:'K' },
    { num: 71, home:'ALG', away:'AUT', date:'2026-06-28T02:00:00Z', venue:'Arrowhead Stadium, Kansas City',               phase:'GROUP', group:'J' },
    { num: 72, home:'JOR', away:'ARG', date:'2026-06-28T02:00:00Z', venue:'AT&T Stadium, Arlington',                      phase:'GROUP', group:'J' },

    // ═══════════════════════ DIECISEISAVOS DE FINAL ══════════════════════════
    { num: 73, home:'TBDA', away:'TBDB', date:'2026-06-28T19:00:00Z', venue:'SoFi Stadium, Los Angeles',                  phase:'ROUND_OF_32', group:null },
    { num: 74, home:'TBDA', away:'TBDB', date:'2026-06-29T17:00:00Z', venue:'NRG Stadium, Houston',                       phase:'ROUND_OF_32', group:null },
    { num: 75, home:'TBDA', away:'TBDB', date:'2026-06-29T20:30:00Z', venue:'Gillette Stadium, Foxborough',               phase:'ROUND_OF_32', group:null },
    { num: 76, home:'TBDA', away:'TBDB', date:'2026-06-30T01:00:00Z', venue:'Estadio BBVA, Monterrey',                    phase:'ROUND_OF_32', group:null },
    { num: 77, home:'TBDA', away:'TBDB', date:'2026-06-30T17:00:00Z', venue:'AT&T Stadium, Arlington',                    phase:'ROUND_OF_32', group:null },
    { num: 78, home:'TBDA', away:'TBDB', date:'2026-06-30T21:00:00Z', venue:'MetLife Stadium, East Rutherford',           phase:'ROUND_OF_32', group:null },
    { num: 79, home:'TBDA', away:'TBDB', date:'2026-07-01T01:00:00Z', venue:'Estadio Azteca, Ciudad de México',           phase:'ROUND_OF_32', group:null },
    { num: 80, home:'TBDA', away:'TBDB', date:'2026-07-01T16:00:00Z', venue:'Mercedes-Benz Stadium, Atlanta',             phase:'ROUND_OF_32', group:null },
    { num: 81, home:'TBDA', away:'TBDB', date:'2026-07-01T20:00:00Z', venue:'Lumen Field, Seattle',                      phase:'ROUND_OF_32', group:null },
    { num: 82, home:'TBDA', away:'TBDB', date:'2026-07-02T00:00:00Z', venue:"Levi's Stadium, Santa Clara",                phase:'ROUND_OF_32', group:null },
    { num: 83, home:'TBDA', away:'TBDB', date:'2026-07-02T19:00:00Z', venue:'SoFi Stadium, Los Angeles',                  phase:'ROUND_OF_32', group:null },
    { num: 84, home:'TBDA', away:'TBDB', date:'2026-07-02T23:00:00Z', venue:'BMO Field, Toronto',                         phase:'ROUND_OF_32', group:null },
    { num: 85, home:'TBDA', away:'TBDB', date:'2026-07-03T03:00:00Z', venue:'BC Place, Vancouver',                        phase:'ROUND_OF_32', group:null },
    { num: 86, home:'TBDA', away:'TBDB', date:'2026-07-03T18:00:00Z', venue:'AT&T Stadium, Arlington',                    phase:'ROUND_OF_32', group:null },
    { num: 87, home:'TBDA', away:'TBDB', date:'2026-07-03T22:00:00Z', venue:'Hard Rock Stadium, Miami',                  phase:'ROUND_OF_32', group:null },
    { num: 88, home:'TBDA', away:'TBDB', date:'2026-07-04T01:30:00Z', venue:'Arrowhead Stadium, Kansas City',             phase:'ROUND_OF_32', group:null },

    // ═══════════════════════ OCTAVOS DE FINAL ════════════════════════════════
    { num: 89, home:'TBDA', away:'TBDB', date:'2026-07-04T17:00:00Z', venue:'NRG Stadium, Houston',                       phase:'ROUND_OF_16', group:null },
    { num: 90, home:'TBDA', away:'TBDB', date:'2026-07-04T21:00:00Z', venue:'Lincoln Financial Field, Philadelphia',      phase:'ROUND_OF_16', group:null },
    { num: 91, home:'TBDA', away:'TBDB', date:'2026-07-05T20:00:00Z', venue:'MetLife Stadium, East Rutherford',           phase:'ROUND_OF_16', group:null },
    { num: 92, home:'TBDA', away:'TBDB', date:'2026-07-06T00:00:00Z', venue:'Estadio Azteca, Ciudad de México',           phase:'ROUND_OF_16', group:null },
    { num: 93, home:'TBDA', away:'TBDB', date:'2026-07-06T19:00:00Z', venue:'AT&T Stadium, Arlington',                    phase:'ROUND_OF_16', group:null },
    { num: 94, home:'TBDA', away:'TBDB', date:'2026-07-07T00:00:00Z', venue:'Lumen Field, Seattle',                      phase:'ROUND_OF_16', group:null },
    { num: 95, home:'TBDA', away:'TBDB', date:'2026-07-07T16:00:00Z', venue:'Mercedes-Benz Stadium, Atlanta',             phase:'ROUND_OF_16', group:null },
    { num: 96, home:'TBDA', away:'TBDB', date:'2026-07-07T20:00:00Z', venue:'BC Place, Vancouver',                        phase:'ROUND_OF_16', group:null },

    // ═══════════════════════ CUARTOS DE FINAL ════════════════════════════════
    { num:  97, home:'TBDA', away:'TBDB', date:'2026-07-09T20:00:00Z', venue:'Gillette Stadium, Foxborough',              phase:'QUARTER', group:null },
    { num:  98, home:'TBDA', away:'TBDB', date:'2026-07-10T19:00:00Z', venue:'SoFi Stadium, Los Angeles',                 phase:'QUARTER', group:null },
    { num:  99, home:'TBDA', away:'TBDB', date:'2026-07-11T21:00:00Z', venue:'Hard Rock Stadium, Miami',                 phase:'QUARTER', group:null },
    { num: 100, home:'TBDA', away:'TBDB', date:'2026-07-12T01:00:00Z', venue:'Arrowhead Stadium, Kansas City',            phase:'QUARTER', group:null },

    // ═══════════════════════ SEMIFINALES ══════════════════════════════════════
    { num: 101, home:'TBDA', away:'TBDB', date:'2026-07-14T19:00:00Z', venue:'AT&T Stadium, Arlington',                   phase:'SEMI', group:null },
    { num: 102, home:'TBDA', away:'TBDB', date:'2026-07-15T19:00:00Z', venue:'Mercedes-Benz Stadium, Atlanta',            phase:'SEMI', group:null },

    // ═══════════════════════ TERCER PUESTO ════════════════════════════════════
    { num: 103, home:'TBDA', away:'TBDB', date:'2026-07-18T21:00:00Z', venue:'Hard Rock Stadium, Miami',                 phase:'THIRD_PLACE', group:null },

    // ═══════════════════════ FINAL ═════════════════════════════════════════════
    { num: 104, home:'TBDA', away:'TBDB', date:'2026-07-19T19:00:00Z', venue:'MetLife Stadium, East Rutherford',          phase:'FINAL', group:null },
] as const;

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
    console.log('🌍 Seed Mundial 2026...');
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) throw new Error('DATABASE_URL no encontrado en .env');
    const connectionUrl = rawUrl.startsWith('mysql://')
        ? `mariadb://${rawUrl.slice('mysql://'.length)}`
        : rawUrl;
    const adapter = new PrismaMariaDb(connectionUrl);
    const prisma = new PrismaClient({ adapter: adapter as any });
    await prisma.$connect();

    try {
        // 1. Upsert equipos
        console.log(`\n📋 Insertando ${TEAMS.length} equipos...`);
        for (const t of TEAMS) {
            await prisma.team.upsert({
                where: { code: t.code },
                create: { name: t.name, code: t.code, group: t.group, flagUrl: t.flagUrl },
                update: { name: t.name, group: t.group, flagUrl: t.flagUrl },
            });
            process.stdout.write(`  ✓ ${t.code}\r`);
        }
        console.log(`  ✓ ${TEAMS.length} equipos OK`);

        // 2. Mapa code → id
        const allTeams = await prisma.team.findMany({ select: { id: true, code: true } });
        const teamMap = new Map(allTeams.map(t => [t.code, t.id]));

        const missingCodes = [...new Set(MATCHES.flatMap(m => [m.home, m.away]))].filter(c => !teamMap.has(c));
        if (missingCodes.length > 0) throw new Error(`Equipos no encontrados: ${missingCodes.join(', ')}`);

        // 3. Crear partidos (skip si matchNumber ya existe)
        console.log(`\n⚽ Insertando ${MATCHES.length} partidos...`);
        let created = 0, skipped = 0;
        for (const m of MATCHES) {
            const exists = await prisma.match.findFirst({ where: { matchNumber: m.num } });
            if (exists) { skipped++; continue; }

            await prisma.match.create({
                data: {
                    matchNumber: m.num,
                    homeTeamId:  teamMap.get(m.home)!,
                    awayTeamId:  teamMap.get(m.away)!,
                    phase:       m.phase as any,
                    group:       m.group,
                    matchDate:   new Date(m.date),
                    venue:       m.venue,
                    status:      'SCHEDULED',
                },
            });
            created++;
            process.stdout.write(`  Partido ${m.num}/104\r`);
        }

        console.log(`\n✅ Partidos creados: ${created} | omitidos (ya existían): ${skipped}`);
        console.log('\n🏆 Seed Mundial 2026 completo!');
    } catch (err) {
        console.error('\n❌ Error:', err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
