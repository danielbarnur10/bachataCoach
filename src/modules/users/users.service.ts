import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';

@Injectable()
export class UsersService {
  private static readonly TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14;
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async register(email: string, password: string, displayName?: string) {
    const normalizedEmail = this.normalizeEmail(email);
    this.assertEmailFormat(normalizedEmail);
    this.assertPasswordStrength(password);

    const existing = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('An account with that email already exists.');
    }

    const user = this.userRepository.create({
      email: normalizedEmail,
      passwordHash: this.hashPassword(password),
      displayName:
        this.normalizeDisplayName(displayName) ??
        this.buildDisplayName(normalizedEmail),
      agentApiKey: null,
      authTokenHash: null,
      authTokenExpiresAt: null,
    });

    const saved = await this.userRepository.save(user);
    const { token, tokenHash, expiresAt } = this.createSessionToken();
    saved.authTokenHash = tokenHash;
    saved.authTokenExpiresAt = expiresAt;
    await this.userRepository.save(saved);

    return {
      user: this.sanitizeUser(saved),
      token,
      expiresAt,
    };
  }

  async login(email: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);
    this.assertEmailFormat(normalizedEmail);
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (
      !user?.passwordHash ||
      !this.verifyPassword(password, user.passwordHash)
    ) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const { token, tokenHash, expiresAt } = this.createSessionToken();
    user.authTokenHash = tokenHash;
    user.authTokenExpiresAt = expiresAt;
    await this.userRepository.save(user);

    return {
      user: this.sanitizeUser(user),
      token,
      expiresAt,
    };
  }

  async logout(token: string): Promise<void> {
    const user = await this.findEntityByToken(token);
    if (!user) {
      return;
    }

    user.authTokenHash = null;
    user.authTokenExpiresAt = null;
    await this.userRepository.save(user);
  }

  async findByToken(token: string) {
    const user = await this.findEntityByToken(token);
    return user ? this.sanitizeUser(user) : null;
  }

  async getAgentApiKeyForToken(token: string): Promise<string | undefined> {
    const user = await this.findEntityByToken(token);
    const apiKey = user?.agentApiKey?.trim();
    return apiKey ? apiKey : undefined;
  }

  async updateSettings(
    token: string,
    updates: { displayName?: string; agentApiKey?: string },
  ) {
    const user = await this.findEntityByToken(token);
    if (!user) {
      throw new UnauthorizedException('You need to be signed in to update settings.');
    }

    if (typeof updates.displayName === 'string') {
      user.displayName =
        this.normalizeDisplayName(updates.displayName) ??
        this.buildDisplayName(user.email);
    }

    if (typeof updates.agentApiKey === 'string') {
      user.agentApiKey = updates.agentApiKey.trim()
        ? updates.agentApiKey.trim()
        : null;
    }

    const saved = await this.userRepository.save(user);
    return this.sanitizeUser(saved);
  }

  private async findEntityByToken(token: string): Promise<UserEntity | null> {
    if (!token) return null;

    const tokenHash = this.hashToken(token);
    const user = await this.userRepository.findOne({
      where: { authTokenHash: tokenHash },
    });
    if (!user) return null;

    if (
      !user.authTokenExpiresAt ||
      user.authTokenExpiresAt.getTime() <= Date.now()
    ) {
      user.authTokenHash = null;
      user.authTokenExpiresAt = null;
      await this.userRepository.save(user);
      return null;
    }

    return user;
  }

  private sanitizeUser(user: UserEntity) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      hasAgentApiKey: Boolean(user.agentApiKey),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private assertEmailFormat(email: string) {
    if (!UsersService.EMAIL_REGEX.test(email)) {
      throw new BadRequestException('Please provide a valid email address.');
    }
  }

  private normalizeDisplayName(value?: string): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private buildDisplayName(email: string): string {
    const local = email.split('@')[0] || 'Bachata Dancer';
    return local
      .replace(/\./g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private createSessionToken(): {
    token: string;
    tokenHash: string;
    expiresAt: Date;
  } {
    const token = randomBytes(24).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + UsersService.TOKEN_TTL_MS);
    return { token, tokenHash, expiresAt };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const derived = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derived}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const [salt, expectedHash] = storedHash.split(':');
    if (!salt || !expectedHash) {
      return false;
    }

    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    if (derived.length !== expected.length) {
      return false;
    }

    try {
      return timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }

  private assertPasswordStrength(password: string) {
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long.');
    }
  }
}
