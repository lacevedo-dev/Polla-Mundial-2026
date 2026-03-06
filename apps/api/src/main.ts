import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { assertRequiredEnv, resolveStartupDiagnostics } from './config/startup.config';

export async function bootstrap(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const diagnostics = resolveStartupDiagnostics(env);
  assertRequiredEnv(diagnostics);

  console.info(
    `[bootstrap] Starting API (env=${diagnostics.nodeEnv}, port=${diagnostics.port}, databaseUrlConfigured=${diagnostics.missingEnv.includes('DATABASE_URL') ? 'no' : 'yes'}, jwtSecretConfigured=${diagnostics.missingEnv.includes('JWT_SECRET') ? 'no' : 'yes'})`,
  );

  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();

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
