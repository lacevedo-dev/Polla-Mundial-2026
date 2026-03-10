/**
 * Performance data for a single week
 *
 * @example
 * {
 *   "week": "2026-W10",
 *   "points": 5
 * }
 */
export class PerformanceWeekDto {
  /** ISO week identifier in format YYYY-Www (e.g. "2026-W10") */
  week: string;

  /** Number of correct predictions scored during this week */
  points: number;
}
