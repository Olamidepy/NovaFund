# Zero-Knowledge KYC (ZK-KYC) Implementation

This document describes the Zero-Knowledge KYC implementation in NovaFund, which provides privacy-preserving identity verification without storing sensitive personal information.

## Overview

Traditional KYC processes require users to share sensitive personal identifiable information (PII) such as passport numbers, Social Security numbers, or addresses. This creates privacy risks and regulatory liabilities for the platform.

ZK-KYC uses cryptographic zero-knowledge proofs to verify user identity and attributes (like age verification) without revealing the underlying personal data. Only cryptographic proofs are stored on-chain, ensuring maximum user privacy.

## Architecture

### Components

1. **ZkKycService** - Main service handling ZK-KYC operations
2. **Provider Interface** - Abstract interface for ZK-KYC providers
3. **VioletProvider** - Integration with Violet ZK-KYC provider
4. **GalxeProvider** - Integration with Galxe ZK-KYC provider
5. **ZkKycController** - REST API endpoints for ZK-KYC operations

### Database Schema

The User model has been extended with ZK-KYC fields:

```prisma
model User {
  // ... existing fields
  kycStatus       KycStatus @default(PENDING)
  zkKycProof      String?   // SHA-256 hash of the ZK proof
  zkKycProvider   String?   // Provider name (violet/galxe)
  zkKycVerifiedAt DateTime? // Verification timestamp
}
```

## Supported Providers

### Violet
- **Website**: https://violet.co
- **Features**: Identity verification, age verification
- **ZK Technology**: Custom ZK circuits for privacy-preserving verification

### Galxe
- **Website**: https://galxe.com
- **Features**: Identity verification, credential-based KYC
- **ZK Technology**: ZK-SNARKs for anonymous verification

## API Endpoints

### Initiate Verification
```http
POST /api/verification/zk-kyc/initiate
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "provider": "violet" | "galxe"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session_123",
  "verificationUrl": "https://violet.co/verify/session_123"
}
```

### Complete Verification
```http
POST /api/verification/zk-kyc/complete
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "sessionId": "session_123",
  "proofData": "base64_encoded_proof",
  "publicInputs": "optional_public_inputs"
}
```

**Response:**
```json
{
  "success": true,
  "proofHash": "sha256_hash_of_proof",
  "verifiedAt": "2024-01-15T10:30:00Z",
  "provider": "violet",
  "userId": "user_123"
}
```

### Get Verification Status
```http
GET /api/verification/zk-kyc/status
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "status": "VERIFIED",
  "provider": "violet",
  "verifiedAt": "2024-01-15T10:30:00Z",
  "proofHash": "sha256_hash_of_proof"
}
```

### Get Supported Providers
```http
GET /api/verification/zk-kyc/providers
```

**Response:**
```json
{
  "success": true,
  "providers": ["violet", "galxe"]
}
```

## Privacy Benefits

1. **No Raw PII Storage**: Only cryptographic proof hashes are stored
2. **Zero-Knowledge Verification**: Identity attributes are verified without revealing the data
3. **Regulatory Compliance**: Reduced liability from handling sensitive data
4. **User Trust**: Users maintain control over their personal information

## Security Considerations

1. **Proof Verification**: All ZK proofs are cryptographically verified before acceptance
2. **Provider Authentication**: API calls to providers are authenticated with API keys
3. **Audit Trail**: All KYC actions are logged in the audit trail
4. **Rate Limiting**: API endpoints are rate-limited to prevent abuse

## Configuration

Add the following environment variables:

```env
# Violet Provider
VIOLET_API_KEY=your_violet_api_key
VIOLET_API_URL=https://api.violet.co

# Galxe Provider
GALXE_API_KEY=your_galxe_api_key
GALXE_API_URL=https://api.galxe.com

# Application
APP_URL=https://your-app.com
```

## Future Enhancements

1. **Additional Providers**: Support for more ZK-KYC providers
2. **Selective Disclosure**: Allow users to choose which attributes to disclose
3. **Proof Aggregation**: Combine multiple ZK proofs for enhanced verification
4. **Decentralized Identity**: Integration with DID standards

## Compliance

This ZK-KYC implementation helps with:
- **GDPR**: Minimizes personal data processing
- **CCPA**: Reduces data collection and storage
- **KYC Regulations**: Maintains verification capabilities while enhancing privacy

## Testing

Run the ZK-KYC tests:

```bash
npm run test -- zk-kyc
```

## Migration

For existing users, run the database migration:

```bash
npm run db:migrate
```

This adds the new ZK-KYC fields to the User table.