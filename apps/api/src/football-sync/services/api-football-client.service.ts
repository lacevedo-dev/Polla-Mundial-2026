import { Injectable, Logger, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ApiFootballResponse } from '../dto/api-football.dto';

@Injectable()
export class ApiFootballClient {
  private readonly logger = new Logger(ApiFootballClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
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
        throw new HttpException(
          `API-Football error: ${JSON.stringify(response.data.errors)}`,
          500,
        );
      }

      this.logger.log(
        `API-Football success: ${response.data.results} results from ${endpoint}`,
      );

      return response.data;
    } catch (error: any) {
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
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}
