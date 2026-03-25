import { Injectable, Logger, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ApiFootballResponse } from '../dto/api-football.dto';
import { RateLimiterService } from './rate-limiter.service';

@Injectable()
export class ApiFootballClient {
  private readonly logger = new Logger(ApiFootballClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  /** Cached from the last API-Football response headers */
  private lastKnownRemaining: number | null = null;
  private lastKnownLimit: number | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly rateLimiter: RateLimiterService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'API_FOOTBALL_BASE_URL',
      'https://v3.football.api-sports.io',
    );
    this.apiKey = this.configService.get<string>('API_FOOTBALL_KEY', '');

    if (!this.apiKey) {
      this.logger.warn(
        'API_FOOTBALL_KEY not configured. Football sync will not work.',
      );
    }
  }

  /**
   * Get fixtures by date
   * @param date YYYY-MM-DD format
   * @param timezone e.g., "America/Bogota"
   */
  async getFixturesByDate(
    date: string,
    timezone: string = 'America/Bogota',
  ): Promise<ApiFootballResponse> {
    const endpoint = '/fixtures';
    const params = { date, timezone };

    return this.makeRequest(endpoint, params);
  }

  /**
   * Get live fixtures
   * @param timezone e.g., "America/Bogota"
   */
  async getLiveFixtures(
    timezone: string = 'America/Bogota',
  ): Promise<ApiFootballResponse> {
    const endpoint = '/fixtures';
    const params = { live: 'all', timezone };

    return this.makeRequest(endpoint, params);
  }

  /**
   * Get fixture by ID
   * @param fixtureId API-Football fixture ID
   */
  async getFixtureById(fixtureId: number): Promise<ApiFootballResponse> {
    const endpoint = '/fixtures';
    const params = { id: fixtureId };

    return this.makeRequest(endpoint, params);
  }

  /**
   * Make HTTP request to API-Football
   */
  private async makeRequest(
    endpoint: string,
    params: Record<string, unknown>,
  ): Promise<ApiFootballResponse> {
    if (!this.apiKey) {
      throw new HttpException('API_FOOTBALL_KEY not configured', 500);
    }

    try {
      const url = `${this.baseUrl}${endpoint}`;

      this.logger.debug(`API-Football request: ${endpoint}`, params);

      const response = await firstValueFrom(
        this.httpService.get<ApiFootballResponse>(url, {
          params,
          headers: {
            'x-rapidapi-key': this.apiKey,
            'x-rapidapi-host': 'v3.football.api-sports.io',
          },
        }),
      );

      if (response.data.errors && response.data.errors.length > 0) {
        this.logger.error('API-Football errors:', response.data.errors);
        await this.rateLimiter.logRequest(endpoint, params, 500, 0);
        throw new HttpException(
          `API-Football error: ${JSON.stringify(response.data.errors)}`,
          500,
        );
      }

      // Capture rate-limit headers from API-Football
      const remaining = response.headers?.['x-ratelimit-requests-remaining'];
      const limit = response.headers?.['x-ratelimit-requests-limit'];
      if (remaining !== undefined) this.lastKnownRemaining = Number(remaining);
      if (limit !== undefined) this.lastKnownLimit = Number(limit);

      const resultsCount = response.data.results ?? 0;
      this.logger.log(
        `API-Football success: ${resultsCount} results from ${endpoint} — remaining: ${this.lastKnownRemaining ?? 'unknown'}`,
      );

      // Log every API call to the DB for usage tracking
      await this.rateLimiter.logRequest(endpoint, params, response.status, resultsCount);

      return response.data;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('API-Football request failed:', error.message);

      if (error.response?.status === 429) {
        throw new HttpException('API-Football rate limit exceeded', 429);
      }

      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new HttpException('API-Football authentication failed', 401);
      }

      throw new HttpException(
        `API-Football request failed: ${error.message}`,
        error.response?.status || 500,
      );
    }
  }

  /**
   * Search leagues/tournaments available in API-Football
   */
  async getLeagues(params: {
    search?: string;
    country?: string;
    current?: boolean;
    season?: number;
    id?: number;
  }): Promise<ApiFootballResponse> {
    const endpoint = '/leagues';
    const p: Record<string, unknown> = {};
    if (params.search) p.search = params.search;
    if (params.country) p.country = params.country;
    if (params.current !== undefined) p.current = params.current;
    if (params.season) p.season = params.season;
    if (params.id) p.id = params.id;
    return this.makeRequest(endpoint, p);
  }

  /**
   * Get all fixtures for a league + season
   */
  async getFixturesByLeague(
    leagueId: number,
    season: number,
    timezone = 'America/Bogota',
  ): Promise<ApiFootballResponse> {
    return this.makeRequest('/fixtures', { league: leagueId, season, timezone });
  }

  /**
   * Get teams for a league + season
   */
  async getTeamsByLeague(leagueId: number, season: number): Promise<ApiFootballResponse> {
    return this.makeRequest('/teams', { league: leagueId, season });
  }

  /**
   * Search teams by name
   */
  async searchTeams(name: string): Promise<ApiFootballResponse> {
    return this.makeRequest('/teams', { search: name });
  }

  /**
   * Get fixtures for a specific team + season
   */
  async getFixturesByTeam(teamId: number, season: number, timezone = 'America/Bogota'): Promise<ApiFootballResponse> {
    return this.makeRequest('/fixtures', { team: teamId, season, timezone });
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get the last known remaining requests from API-Football response headers.
   * Returns null if no request has been made yet this session.
   */
  getLastKnownRemaining(): number | null {
    return this.lastKnownRemaining;
  }

  /**
   * Get the last known total limit from API-Football response headers.
   */
  getLastKnownLimit(): number | null {
    return this.lastKnownLimit;
  }
}
