import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar la validación global
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // remueve propiedades que no tengan decoradores en el DTO
    forbidNonWhitelisted: true, // lanza error si existen propiedades no permitidas
    transform: true, // transforma los payloads a instancias de las clases DTO
  }));

  // Habilitar CORS
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Aplicación ejecutándose en el puerto: ${port}`);
}
bootstrap();
