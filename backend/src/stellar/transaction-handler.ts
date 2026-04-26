// transaction-handler.ts

import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { TransactionService } from './transaction.service';

@Controller('transactions')
export class TransactionHandler {
  constructor(private readonly txService: TransactionService) {}

  /**
   * STEP 1: Create transaction (Optimistic Response)
   */
  @Post()
  async createTransaction(@Body() body: { userId: string; xdr: string }) {
    const tx = this.txService.createTransaction(body.userId, body.xdr);

    return {
      transactionId: tx.id,
      status: tx.status,
      message: 'Transaction created. Please sign with your wallet.',
    };
  }

  /**
   * STEP 2: Submit signed transaction
   */
  @Post(':id/sign')
  async submitSignedTransaction(
    @Param('id') id: string,
    @Body() body: { signedXdr: string },
  ) {
    const tx = this.txService.updateTransaction(id, {
      status: 'SIGNED',
      signedXdr: body.signedXdr,
    });

    if (!tx) {
      return { error: 'Transaction not found' };
    }

    // Simulate async blockchain submission
    setTimeout(() => {
      this.txService.updateTransaction(id, {
        status: 'CONFIRMED',
      });
    }, 5000);

    return {
      status: 'SUBMITTED',
      message: 'Transaction submitted to network',
    };
  }

  /**
   * STEP 3: Long Polling Endpoint
   */
  @Get(':id/status')
  async getStatus(
    @Param('id') id: string,
    @Query('wait') wait = 'false',
  ) {
    const shouldWait = wait === 'true';

    if (!shouldWait) {
      return this.txService.getTransaction(id);
    }

    return this.waitForStatusChange(id, 30000); // 30s max wait
  }

  /**
   * Long polling implementation
   */
  private async waitForStatusChange(id: string, timeout: number) {
    const start = Date.now();

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const tx = this.txService.getTransaction(id);

        if (!tx) {
          clearInterval(interval);
          return resolve({ error: 'Transaction not found' });
        }

        if (tx.status === 'CONFIRMED' || tx.status === 'FAILED') {
          clearInterval(interval);
          return resolve(tx);
        }

        if (Date.now() - start > timeout) {
          clearInterval(interval);
          return resolve(tx); // return current state
        }
      }, 1000);
    });
  }
}