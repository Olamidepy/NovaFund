import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import Redis from 'ioredis';

@Injectable()
export class AuthService {
  private redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
  });

  constructor(private readonly jwt: JwtService) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async storeSession(token: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(`session:${this.hash(token)}`, '1', 'EX', ttlSeconds);
  }

  async verify(token: string): Promise<Record<string, unknown> | null> {
    const cached = await this.redis.get(`session:${this.hash(token)}`);
    if (!cached) return null;

    try {
      return this.jwt.verify(token);
    } catch {
      return null;
    }
  }

  async revoke(token: string): Promise<void> {
    await this.redis.del(`session:${this.hash(token)}`);
  }
}