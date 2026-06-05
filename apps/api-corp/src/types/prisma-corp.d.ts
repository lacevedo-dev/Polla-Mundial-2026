// Type declarations for @prisma/client-corp
// Este archivo es un stub para evitar errores del IDE en desarrollo local
// El cliente real se genera durante el build de Docker

declare module '@prisma/client-corp' {
  import { PrismaClient as BasePrismaClient, PrismaClientOptions } from '@prisma/client';
  
  // Prisma 7.x usa la variable de entorno CORP_DATABASE_URL automáticamente
  export class PrismaClient extends BasePrismaClient {
    constructor(options?: PrismaClientOptions);
  }
}
