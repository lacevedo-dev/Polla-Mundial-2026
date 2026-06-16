import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { CorpAppModule } from './corp-app.module';
import { resolveCorpBuildCommit, readCorpBuildInfo } from './build-info';
import { CORP_BUILD_MARKER } from './build-marker';

const DEFAULT_PRODUCTION_CORS_ORIGINS = [
    'https://coopcanapro.zonapronosticos.com',
    'https://pollacoopcanapro.atencionesvirtuales.com.co',
];

function parseCorsOrigins(value: string | undefined): string[] {
    return (value ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map((origin) => origin.replace(/\/+$/, ''));
}

function resolveAllowedCorsOrigins(nodeEnv: string): string[] {
    const configuredOrigins = [
        ...parseCorsOrigins(process.env.CORP_CORS_ORIGINS),
        ...parseCorsOrigins(process.env.CORP_FRONTEND_URL),
    ];
    const defaultOrigins = nodeEnv === 'production' ? DEFAULT_PRODUCTION_CORS_ORIGINS : [];

    return Array.from(new Set([...defaultOrigins, ...configuredOrigins]));
}

async function bootstrap(): Promise<void> {
    const port = Number(process.env.PORT ?? 3001);
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const allowDatabaseUrlFallback = process.env.CORP_ALLOW_DATABASE_URL_FALLBACK === 'true';
    const databaseUrlConfigured = Boolean(
        process.env.CORP_DATABASE_URL?.trim()
        || ((nodeEnv !== 'production' || allowDatabaseUrlFallback) && process.env.DATABASE_URL?.trim()),
    );

    if (!databaseUrlConfigured) throw new Error('CORP_DATABASE_URL es requerido');
    if (!process.env.JWT_SECRET?.trim()) throw new Error('JWT_SECRET es requerido');
    if (!process.env.CORP_DATABASE_URL?.trim() && process.env.DATABASE_URL?.trim()) {
        console.warn(
            `[corp-api] CORP_DATABASE_URL no está configurado; usando DATABASE_URL como fallback ` +
            `(env=${nodeEnv}, explicitFallback=${allowDatabaseUrlFallback ? 'yes' : 'no'}).`,
        );
    }

    console.info(`[corp-api] Iniciando (env=${nodeEnv}, port=${port}, corpDatabaseUrlConfigured=${databaseUrlConfigured ? 'yes' : 'no'})`);
    const buildInfo = readCorpBuildInfo();
    console.info(
        `[corp-api] Build commit=${resolveCorpBuildCommit()}, builtAt=${buildInfo?.builtAt ?? 'n/a'}, rankingBreakdown=${buildInfo?.rankingBreakdown ? 'yes' : 'no'}, marker=${CORP_BUILD_MARKER}`,
    );

    const app = await NestFactory.create(CorpAppModule, { rawBody: true, bodyParser: false });

    const deployStamp = process.env.CORP_DEPLOY_STAMP ?? CORP_BUILD_MARKER;
    app.use((_req, res, next) => {
        res.setHeader('X-Corp-Deploy-Stamp', deployStamp);
        res.setHeader('X-Corp-Build-Marker', CORP_BUILD_MARKER);
        next();
    });

    app.use(json({ limit: '20mb' }));
    app.use(urlencoded({ extended: true, limit: '20mb' }));

    app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    const allowedCorsOrigins = resolveAllowedCorsOrigins(nodeEnv);
    const allowAnyCorsOrigin = nodeEnv !== 'production' && allowedCorsOrigins.length === 0;

    console.info(
        `[corp-api] CORS ${allowAnyCorsOrigin ? 'permite cualquier origen en desarrollo' : `origins=${allowedCorsOrigins.join(',')}`}`,
    );

    app.enableCors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);

            const normalizedOrigin = origin.replace(/\/+$/, '');
            if (allowAnyCorsOrigin || allowedCorsOrigins.includes(normalizedOrigin)) {
                return callback(null, true);
            }

            return callback(new Error(`Origen CORS no permitido: ${origin}`), false);
        },
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With, Origin, X-Tenant-Slug',
        exposedHeaders: 'X-Corp-Deploy-Stamp, X-Corp-Build-Marker',
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
