// transaction.service.ts

import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { TransactionRecord } from './transaction.types';

@Injectable()
export class TransactionService {
  private transactions = new Map<string, TransactionRecord>();

  createTransaction(userId: string, xdr: string): TransactionRecord {
    const tx: TransactionRecord = {
      id: uuid(),
      userId,
      status: 'PENDING',
      xdr,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.transactions.set(tx.id, tx);
    return tx;
  }

  getTransaction(id: string): TransactionRecord | null {
    return this.transactions.get(id) || null;
  }

  updateTransaction(id: string, updates: Partial<TransactionRecord>) {
    const tx = this.transactions.get(id);
    if (!tx) return null;

    const updated = {
      ...tx,
      ...updates,
      updatedAt: new Date(),
    };

    this.transactions.set(id, updated);
    return updated;
  }
}