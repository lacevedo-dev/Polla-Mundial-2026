import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Compatibilidad legacy: mantiene endpoint raíz simple para checks básicos.
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
