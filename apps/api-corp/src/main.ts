import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { CorpAppModule } from './corp-app.module';

async function bootstrap(): Promise<void> {
    const port = Number(process.env.PORT ?? 3001);
    const nodeEnv = process.env.NODE_ENV ?? 'development';

    if (!process.env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL es requerido');
    if (!process.env.JWT_SECRET?.trim()) throw new Error('JWT_SECRET es requerido');

    console.info(`[corp-api] Iniciando (env=${nodeEnv}, port=${port})`);

    const app = await NestFactory.create(CorpAppModule, { rawBody: true });

    app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    app.enableCors({
        origin: (origin, callback) => callback(null, true),
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With, Origin, X-Tenant-Slug',
        preflightContinue: false,
        optionsSuccessStatus: 204,
    });

    const swaggerConfig = new DocumentBuilder()
        .setTitle('Polla Corp API')
        .setDescription('Backend corporativo independiente — Polla Mundial 2026')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    SwaggerModule.setup('api-docs', app, SwaggerModule.createDocument(app, swaggerConfig));

    await app.listen(port);
    console.info(`[corp-api] Escuchando en puerto ${port}`);
}

bootstrap().catch((err: unknown) => {
    console.error('[corp-api] Fallo en arranque:', err instanceof Error ? err.message : err);
    process.exit(1);
});
