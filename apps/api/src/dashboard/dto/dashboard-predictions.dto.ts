/**
 * A single recent prediction entry
 *
 * @example
 * {
 *   "id": "clxyz...",
 *   "match": "Colombia vs Brazil",
 *   "tuPrediccion": "2-1",
 *   "resultado": "2-1",
 *   "acierto": true,
 *   "fecha": "15/3/2026"
 * }
 */
export class RecentPredictionDto {
  /** Unique prediction identifier (cuid) */
  id: string;

  /** Match description in format "HomeTeam vs AwayTeam" */
  match: string;

  /** User's predicted score in format "home-away" (e.g. "2-1") */
  tuPrediccion: string;

  /** Actual match result in format "home-away", or "Pendiente" if not yet played */
  resultado: string;

  /** Whether the prediction was exactly correct */
  acierto: boolean;

  /** Prediction submission date formatted in es-ES locale */
  fecha: string;
}

/**
 * Dashboard recent predictions response DTO
 *
 * Returns the user's 5 most recent predictions with
 * match details and correctness information.
 *
 * @example
 * {
 *   "predicciones": [
 *     {
 *       "id": "clxyz...",
 *       "match": "Colombia vs Brazil",
 *       "tuPrediccion": "2-1",
 *       "resultado": "2-1",
 *       "acierto": true,
 *       "fecha": "15/3/2026"
 *     }
 *   ]
 * }
 */
export class RecentPredictionsResponseDto {
  /** Array of the 5 most recent predictions */
  predicciones: RecentPredictionDto[];
}
