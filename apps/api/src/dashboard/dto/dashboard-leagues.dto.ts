/**
 * Single league item in the dashboard leagues response
 *
 * @example
 * {
 *   "id": "clxyz...",
 *   "nombre": "Liga Premium",
 *   "posicion": 1,
 *   "tusPuntos": 45,
 *   "maxPuntos": 50,
 *   "participantes": 25
 * }
 */
export class DashboardLeagueDto {
  /** Unique league identifier (cuid) */
  id: string;

  /** League display name */
  nombre: string;

  /** User's current position/rank in the league (1-based) */
  posicion: number;

  /** User's total correct predictions in this league */
  tusPuntos: number;

  /** Maximum points scored by any participant in this league */
  maxPuntos: number;

  /** Total number of participants in the league */
  participantes: number;
}

/**
 * Dashboard leagues response DTO
 *
 * Returns the list of leagues the user participates in,
 * with their position, points, and league metadata.
 *
 * @example
 * {
 *   "ligas": [
 *     {
 *       "id": "clxyz...",
 *       "nombre": "Liga Premium",
 *       "posicion": 1,
 *       "tusPuntos": 45,
 *       "maxPuntos": 50,
 *       "participantes": 25
 *     }
 *   ]
 * }
 */
export class DashboardLeaguesResponseDto {
  /** Array of leagues the user belongs to */
  ligas: DashboardLeagueDto[];
}
