import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all notification preferences for a user
   */
  async getUserPreferences(userId: string) {
    const matrix = await this.prisma.notificationMatrix.findMany({
      where: { userId },
    });

    // Group by event type
    const preferences = {};
    for (const entry of matrix) {
      if (!preferences[entry.eventType]) {
        preferences[entry.eventType] = {};
      }
      preferences[entry.eventType][entry.channel] = entry.enabled;
    }

    return preferences;
  }

  /**
   * Set preference for a specific event type and channel
   */
  async setPreference(
    userId: string,
    eventType: string,
    channel: string,
    enabled: boolean,
  ) {
    return this.prisma.notificationMatrix.upsert({
      where: {
        userId_eventType_channel: {
          userId,
          eventType: eventType as any,
          channel: channel as any,
        },
      },
      update: { enabled },
      create: {
        userId,
        eventType: eventType as any,
        channel: channel as any,
        enabled,
      },
    });
  }

  /**
   * Set multiple preferences at once
   */
  async setPreferences(
    userId: string,
    preferences: Record<string, Record<string, boolean>>,
  ) {
    const operations = [];

    for (const [eventType, channels] of Object.entries(preferences)) {
      for (const [channel, enabled] of Object.entries(channels)) {
        operations.push(
          this.prisma.notificationMatrix.upsert({
            where: {
              userId_eventType_channel: {
                userId,
                eventType: eventType as any,
                channel: channel as any,
              },
            },
            update: { enabled },
            create: {
              userId,
              eventType: eventType as any,
              channel: channel as any,
              enabled,
            },
          }),
        );
      }
    }

    return this.prisma.$transaction(operations);
  }

  /**
   * Check if a user has enabled a specific channel for an event type
   */
  async isEnabled(userId: string, eventType: string, channel: string): Promise<boolean> {
    const preference = await this.prisma.notificationMatrix.findUnique({
      where: {
        userId_eventType_channel: {
          userId,
          eventType: eventType as any,
          channel: channel as any,
        },
      },
    });

    // Default to true if no preference set
    return preference?.enabled ?? true;
  }

  /**
   * Get enabled channels for a specific event type
   */
  async getEnabledChannels(userId: string, eventType: string): Promise<string[]> {
    const preferences = await this.prisma.notificationMatrix.findMany({
      where: {
        userId,
        eventType: eventType as any,
        enabled: true,
      },
    });

    return preferences.map(p => p.channel);
  }
}