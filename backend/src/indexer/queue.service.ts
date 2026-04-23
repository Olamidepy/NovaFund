import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { PrismaService } from 'src/prisma.service';

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
};

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue;
  private worker: Worker;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.queue = new Queue('events', { connection });

    this.worker = new Worker(
      'events',
      async (job: Job) => {
        await this.prisma.event.create({ data: job.data });
      },
      {
        connection,
        concurrency: 20,
      },
    );
  }

  async push(eventData: Record<string, unknown>): Promise<void> {
    await this.queue.add('ingest', eventData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
  }
}