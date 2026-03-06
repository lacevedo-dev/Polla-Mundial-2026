jest.mock('./../src/prisma/prisma.service', () => ({
  PrismaService: class PrismaService { },
}));

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from './../src/app.controller';
import { AppService } from './../src/app.service';
import { HealthController } from './../src/health/health.controller';
import { HealthService } from './../src/health/health.service';
import { PrismaService } from './../src/prisma/prisma.service';

describe('App + Health (e2e)', () => {
  let app: INestApplication<App>;

  const prismaServiceMock = {
    checkDatabaseConnectivity: jest.fn(),
  };

  beforeEach(async () => {
    prismaServiceMock.checkDatabaseConnectivity.mockResolvedValue(true);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController, HealthController],
      providers: [
        AppService,
        HealthService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (app) {
      await app.close();
    }
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health/live (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);

    expect(response.body.service).toBe('polla-api');
    expect(response.body.status).toBe('ok');
    expect(response.body.checks).toEqual({
      app: 'up',
      database: 'unknown',
    });
  });

  it('/health/ready (GET) returns 200 when db is reachable', async () => {
    prismaServiceMock.checkDatabaseConnectivity.mockResolvedValue(true);

    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.checks.database).toBe('up');
  });

  it('/health/ready (GET) returns 503 when db is down', async () => {
    prismaServiceMock.checkDatabaseConnectivity.mockResolvedValue(false);

    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503);

    expect(response.body.status).toBe('degraded');
    expect(response.body.checks.database).toBe('down');
  });
});
