export interface ZkKycProvider {
  /**
   * Create a verification session with the ZK-KYC provider
   */
  createVerificationSession(userId: string): Promise<{
    sessionId: string;
    verificationUrl: string;
  }>;

  /**
   * Verify a ZK proof submitted by the user
   */
  verifyProof(proofData: string, publicInputs?: string): Promise<{
    isValid: boolean;
    userId?: string;
    attributes?: Record<string, any>;
  }>;

  /**
   * Get provider name
   */
  getProviderName(): string;
}