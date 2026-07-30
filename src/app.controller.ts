import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(@Res() response: Response): void {
    // The root endpoint now serves the browser landing page directly.
    response.sendFile('index.html', { root: 'src/public' });
  }
}
