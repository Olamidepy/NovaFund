import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PreferencesService } from './services/preferences.service';

@Controller('notifications')
export class NotificationController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly preferencesService: PreferencesService,
    ) { }

    @Get('settings/:userId')
    async getSettings(@Param('userId') userId: string) {
        return this.prisma.notificationSetting.upsert({
            where: { userId },
            update: {},
            create: { userId },
        });
    }

    @Put('settings/:userId')
    async updateSettings(
        @Param('userId') userId: string,
        @Body() settings: {
            emailEnabled?: boolean;
            pushEnabled?: boolean;
            notifyContributions?: boolean;
            notifyMilestones?: boolean;
            notifyDeadlines?: boolean;
        },
    ) {
        return this.prisma.notificationSetting.upsert({
            where: { userId },
            update: settings,
            create: {
                userId,
                ...settings,
            },
        });
    }

    @Get('preferences/:userId')
    async getPreferences(@Param('userId') userId: string) {
        return this.preferencesService.getUserPreferences(userId);
    }

    @Put('preferences/:userId')
    async updatePreferences(
        @Param('userId') userId: string,
        @Body() preferences: Record<string, Record<string, boolean>>,
    ) {
        return this.preferencesService.setPreferences(userId, preferences);
    }

    @Put('preferences/:userId/:eventType/:channel')
    async updatePreference(
        @Param('userId') userId: string,
        @Param('eventType') eventType: string,
        @Param('channel') channel: string,
        @Body() body: { enabled: boolean },
    ) {
        return this.preferencesService.setPreference(userId, eventType, channel, body.enabled);
    }

    @Post('subscribe/:userId')
    async subscribeToPush(
        @Param('userId') userId: string,
        @Body() subscription: any,
    ) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { pushSubscription: subscription },
        });
        return { success: true };
    }
}
