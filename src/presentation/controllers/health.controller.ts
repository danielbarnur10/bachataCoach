import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): { status: string } {
    // Health endpoints are useful for monitoring and deployment checks.
    return { status: 'ok' };
  }
}
