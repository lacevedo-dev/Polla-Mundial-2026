/**
 * Dashboard statistics DTO
 *
 * Represents the user's prediction statistics including
 * correct/incorrect counts, current streak, and success rate.
 *
 * @example
 * {
 *   "aciertos": 45,
 *   "errores": 10,
 *   "racha": 3,
 *   "tasa": 81.82
 * }
 */
export class DashboardStatsDto {
  /** Number of correct predictions (exact score match) */
  aciertos: number;

  /** Number of incorrect predictions */
  errores: number;

  /** Current consecutive correct predictions streak */
  racha: number;

  /** Success rate as percentage (0-100), rounded to 2 decimal places */
  tasa: number;
}
