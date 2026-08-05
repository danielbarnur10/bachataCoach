import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return {
      name: 'Bachata Coach API',
      status: 'ok',
      frontend: 'Run the frontend project separately.',
    };
  }
}
