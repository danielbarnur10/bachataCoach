import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(
    @Body() body: { email?: string; password?: string; displayName?: string },
  ) {
    const email = body.email?.trim();
    const password = body.password?.trim();
    if (!email || !password) {
      throw new BadRequestException('Email and password are required.');
    }

    return this.usersService.register(email, password, body.displayName);
  }

  @Post('login')
  async login(@Body() body: { email?: string; password?: string }) {
    const email = body.email?.trim();
    const password = body.password?.trim();
    if (!email || !password) {
      throw new BadRequestException('Email and password are required.');
    }

    return this.usersService.login(email, password);
  }

  @Post('logout')
  async logout(@Headers('authorization') authorization?: string) {
    const token = this.extractToken(authorization);
    if (!token) {
      return { success: true };
    }

    await this.usersService.logout(token);
    return { success: true };
  }

  @Get('me')
  async me(@Headers('authorization') authorization?: string) {
    const token = this.extractToken(authorization);
    if (!token) {
      return { user: null };
    }

    const user = await this.usersService.findByToken(token);
    return { user };
  }

  @Patch('settings')
  async updateSettings(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { displayName?: string; agentApiKey?: string },
  ) {
    const token = this.extractToken(authorization);
    if (!token) {
      throw new UnauthorizedException('Please sign in first.');
    }

    this.assertValidSettingsPayload(body);

    return { user: await this.usersService.updateSettings(token, body) };
  }

  private extractToken(authorization?: string): string | null {
    if (!authorization) return null;
    const [scheme, token] = authorization.split(' ');
    return scheme === 'Bearer' && token ? token : null;
  }

  private assertValidSettingsPayload(body: {
    displayName?: string;
    agentApiKey?: string;
  }) {
    const allowedKeys = new Set(['displayName', 'agentApiKey']);
    for (const key of Object.keys(body)) {
      if (!allowedKeys.has(key)) {
        throw new BadRequestException(`Unsupported settings field: ${key}`);
      }
    }

    if (body.displayName !== undefined && typeof body.displayName !== 'string') {
      throw new BadRequestException('displayName must be a string.');
    }

    if (body.agentApiKey !== undefined && typeof body.agentApiKey !== 'string') {
      throw new BadRequestException('agentApiKey must be a string.');
    }
  }
}
