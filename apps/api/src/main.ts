import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { assertRequiredEnv, resolveStartupDiagnostics } from './config/startup.config';

export async function bootstrap(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const diagnostics = resolveStartupDiagnostics(env);
  assertRequiredEnv(diagnostics);

  console.info(
    `[bootstrap] Starting API (env=${diagnostics.nodeEnv}, port=${diagnostics.port}, databaseUrlConfigured=${diagnostics.missingEnv.includes('DATABASE_URL') ? 'no' : 'yes'}, jwtSecretConfigured=${diagnostics.missingEnv.includes('JWT_SECRET') ? 'no' : 'yes'})`,
  );

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS configuration
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://polla.agildesarrollo.com.co',
    'https://polla.agildesarrollo.com',
    'https://tupollamundial.com',
    'https://www.tupollamundial.com',
    'https://zonapronosticos.com',
    'https://www.zonapronosticos.com',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Swagger / OpenAPI documentation — available at /api-docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Polla 2026 API')
    .setDescription('REST API for the Polla 2026 prediction platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(diagnostics.port);
  console.info(`[bootstrap] API listening on port ${diagnostics.port}`);
}

if (require.main === module) {
  bootstrap().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[bootstrap] Startup failed: ${message}`);
    process.exit(1);
  });
}
