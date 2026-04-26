// src/modules/reputation/reputation.service.ts

import { Injectable } from '@nestjs/common';

@Injectable()
export class ReputationService {
  /**
   * Returns reputation score between 0 - 100
   */
  async getReputationScore(userId: string): Promise<number> {
    // TODO: Replace with DB or external service call
    // Example logic
    return 75; // mock value
  }
}