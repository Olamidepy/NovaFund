import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';
import { PrismaService } from '../../prisma.service';
import twilio from 'twilio';
import { PreferencesService } from './preferences.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly twilioClient: twilio.Twilio | null = null;
  private readonly appBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly preferencesService: PreferencesService,
  ) {
    const sendgridKey = this.config.get<string>('SENDGRID_API_KEY');
    if (sendgridKey) sgMail.setApiKey(sendgridKey);

    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    if (accountSid && authToken) {
      this.twilioClient = twilio(accountSid, authToken);
    }

    this.appBaseUrl = this.config.get<string>('APP_BASE_URL') ?? 'https://yourapp.com';
  }

  // ─────────────────────────────────────────────────────────────
  // 🔹 GENERIC NOTIFY (from first service)
  // ─────────────────────────────────────────────────────────────

  async notify(
    userId: string,
    type: 'CONTRIBUTION' | 'MILESTONE' | 'DEADLINE' | 'SYSTEM',
    title: string,
    message: string,
    data?: any,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { notificationSettings: true },
    });

    if (!user) {
      this.logger.warn(`User ${userId} not found`);
      return;
    }

    const settings = user.notificationSettings || {
      emailEnabled: true,
      pushEnabled: false,
      notifyContributions: true,
      notifyMilestones: true,
      notifyDeadlines: true,
    };

    // Legacy preference filtering (keep for backward compatibility)
    if (type === 'CONTRIBUTION' && !settings.notifyContributions) return;
    if (type === 'MILESTONE' && !settings.notifyMilestones) return;
    if (type === 'DEADLINE' && !settings.notifyDeadlines) return;

    const tasks: Promise<any>[] = [];

    // Email - check granular preference
    const emailEnabled = await this.preferencesService.isEnabled(userId, type, 'EMAIL');
    if (emailEnabled && settings.emailEnabled && user.email) {
      tasks.push(
        this.queueEmail({
          to: user.email,
          subject: title,
          html: `<p>${message}</p>`,
        }),
      );
    }

    // Push - check granular preference
    const pushEnabled = await this.preferencesService.isEnabled(userId, type, 'PUSH');
    if (pushEnabled && settings.pushEnabled && user.pushSubscription) {
      tasks.push(
        this.sendWebPush(user.pushSubscription, {
          title,
          body: message,
          data,
        }),
      );
    }

    // SMS - check granular preference (if SMS is enabled globally)
    const smsEnabled = await this.preferencesService.isEnabled(userId, type, 'SMS');
    if (smsEnabled && settings.smsEnabled && user.profileData?.phone && this.twilioClient) {
      tasks.push(
        this.sendSms(user.profileData.phone, title, message),
      );
    }

    // App notification - check granular preference
    const appEnabled = await this.preferencesService.isEnabled(userId, type, 'APP');
    if (appEnabled && settings.appEnabled) {
      tasks.push(
        this.createInAppNotification(userId, type, title, message, data),
      );
    }

    await Promise.allSettled(tasks);
  }

  // ─────────────────────────────────────────────────────────────
  // 🔹 MILESTONE DISPUTE FLOW (from second service)
  // ─────────────────────────────────────────────────────────────

  async notifyDisputedMilestone(milestoneId: string): Promise<void> {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        project: {
          include: {
            contributions: {
              distinct: ['investorId'],
              include: {
                investor: {
                  include: { notificationSettings: true },
                },
              },
            },
          },
        },
      },
    });

    if (!milestone) return;

    const disputeUrl = `${this.appBaseUrl}/milestones/${milestoneId}/dispute`;

    const investors = milestone.project.contributions.map((c) => c.investor);

    const seen = new Set<string>();
    const uniqueInvestors = investors.filter((inv) => {
      if (seen.has(inv.id)) return false;
      seen.add(inv.id);
      return true;
    });

    await Promise.all(
      uniqueInvestors.map((investor) =>
        this.dispatchInvestorNotification(investor, milestone, disputeUrl),
      ),
    );
  }

  private async dispatchInvestorNotification(
    investor: any,
    milestone: any,
    disputeUrl: string,
  ): Promise<void> {
    const settings = investor.notificationSettings;

    if (!settings?.notifyMilestones) return;

    const tasks: Promise<any>[] = [];

    // Email
    if (settings?.emailEnabled && investor.email) {
      tasks.push(
        this.queueEmail({
          to: investor.email,
          subject: `⚠️ Milestone Disputed`,
          html: this.buildDisputeEmailHtml(investor, milestone, disputeUrl),
        }),
      );
    }

    // SMS
    const phone = investor.profileData?.phone;
    if (phone && this.twilioClient) {
      tasks.push(this.sendSms(phone, milestone.title, disputeUrl));
    }

    await Promise.allSettled(tasks);
  }

  // ─────────────────────────────────────────────────────────────
  // 🔹 EMAIL QUEUE
  // ─────────────────────────────────────────────────────────────

  async queueEmail(params: { to: string; subject: string; html: string }) {
    await this.prisma.emailOutbox.create({ data: params });
  }

  async flushEmailOutbox(): Promise<void> {
    const emails = await this.prisma.emailOutbox.findMany({
      where: { status: 'PENDING' },
      take: 50,
    });

    for (const email of emails) {
      try {
        await sgMail.send({
          to: email.to,
          from: 'noreply@yourapp.com',
          subject: email.subject,
          html: email.html,
        });

        await this.prisma.emailOutbox.update({
          where: { id: email.id },
          data: { status: 'SENT' },
        });
      } catch (err: any) {
        this.logger.error(err.message);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 🔹 SMS
  // ─────────────────────────────────────────────────────────────

  private async sendSms(to: string, title: string, message: string) {
    if (!this.twilioClient) return;

    await this.twilioClient.messages.create({
      to,
      from: this.config.get<string>('TWILIO_PHONE_NUMBER'),
      body: `${title}\n${message}`,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 🔹 PUSH (NEW - merged)
  // ─────────────────────────────────────────────────────────────

  private async sendWebPush(subscription: any, payload: any) {
    // Plug your existing WebPushService logic here
    this.logger.log('Push notification placeholder');
  }

  // ─────────────────────────────────────────────────────────────
  // 🔹 IN-APP NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────

  private async createInAppNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    data?: any,
  ) {
    await this.prisma.notification.create({
      data: {
        userId,
        type: type as any,
        title,
        message,
        data,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 🔹 EMAIL TEMPLATE
  // ─────────────────────────────────────────────────────────────

  private buildDisputeEmailHtml(investor: any, milestone: any, disputeUrl: string): string {
    return `
      <p>Hello ${investor.profileData?.name ?? 'Investor'},</p>
      <p>A milestone has been disputed:</p>
      <p><strong>${milestone.title}</strong></p>
      <a href="${disputeUrl}">Resolve Now</a>
    `;
  }
}
