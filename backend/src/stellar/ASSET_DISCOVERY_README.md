# Stellar Asset Auto-Discovery System

This system automatically discovers and proposes new Stellar assets for whitelisting, enabling NovaFund to instantly support community stablecoins and other high-quality assets.

## Overview

The Asset Discovery System continuously scans the Stellar network for assets that meet institutional-grade criteria, automatically proposing them for admin review and whitelisting. This eliminates manual asset management while ensuring only high-quality, liquid assets are supported.

## Architecture

### Components

1. **AssetDiscoveryService** - Core service handling asset scanning and discovery
2. **AssetDiscoveryController** - REST API for admin management of discovered assets
3. **Database Models** - DiscoveredAsset and WhitelistedAsset for tracking asset lifecycle

### Discovery Criteria

Assets are discovered based on:

- **Liquidity Score**: Calculated from trading volume, frequency, and holder count (0-10 scale)
- **Trading Volume**: Minimum 24-hour volume threshold
- **Holder Count**: Minimum number of asset holders
- **Tags**: Assets with specific tags (RWA, Stable, DeFi) or exceptional liquidity
- **TOML Information**: Valid Stellar TOML files with asset metadata

## Discovery Process

### 1. Network Scanning
- Scans recent trades on Stellar Horizon API
- Aggregates volume and liquidity data for each asset
- Filters assets by minimum criteria

### 2. Asset Enrichment
- Fetches asset details from Horizon
- Downloads and parses Stellar TOML files
- Extracts tags and metadata from TOML
- Calculates comprehensive liquidity scores

### 3. Automated Proposal
- Creates DiscoveredAsset records for new qualifying assets
- Sets status to 'DISCOVERED' for admin review
- Logs discovery metadata and timestamps

### 4. Admin Review
- Admins review proposed assets via API
- Approve/reject assets with categorization and risk assessment
- Approved assets move to WhitelistedAsset table

## API Endpoints

### Get Discovery Statistics
```http
GET /api/stellar/assets/stats
Authorization: Bearer <admin-jwt>
```

**Response:**
```json
{
  "totalDiscovered": 1250,
  "pendingReview": 23,
  "whitelisted": 89,
  "rejected": 156,
  "lastScanAt": "2024-01-15T10:30:00Z",
  "nextScanAt": "2024-01-16T10:30:00Z"
}
```

### Manual Asset Scan
```http
POST /api/stellar/assets/scan
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "maxAssets": 100
}
```

**Response:**
```json
{
  "discovered": 45,
  "new": 12,
  "proposed": 8,
  "timestamp": "2024-01-15T14:30:00Z"
}
```

### Get Pending Assets
```http
GET /api/stellar/assets/pending?limit=20&offset=0
Authorization: Bearer <admin-jwt>
```

**Response:**
```json
[
  {
    "id": "disc_abc123",
    "assetCode": "USDC",
    "assetIssuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    "assetType": "CREDIT_ALPHANUM4",
    "homeDomain": "centre.io",
    "tomlInfo": { /* TOML data */ },
    "tags": ["Stable", "USD"],
    "liquidityScore": 9.2,
    "volume24h": "500000000000",
    "holdersCount": 15420,
    "trustlinesCount": 15420,
    "lastActivity": "2024-01-15T14:25:00Z",
    "status": "DISCOVERED",
    "proposedBy": "asset-discovery-worker",
    "createdAt": "2024-01-15T14:30:00Z"
  }
]
```

### Approve Asset
```http
POST /api/stellar/assets/{assetId}/approve
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "category": "STABLECOIN",
  "riskLevel": "LOW",
  "reviewNotes": "Circle-backed USD stablecoin",
  "maxInvestment": 1000000000000,
  "minInvestment": 10000000
}
```

### Reject Asset
```http
POST /api/stellar/assets/{assetId}/reject
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "rejectionReason": "Insufficient liquidity for institutional use"
}
```

### Get Whitelisted Assets
```http
GET /api/stellar/assets/whitelisted?activeOnly=true
Authorization: Bearer <admin-jwt>
```

### Update Whitelisted Asset
```http
PUT /api/stellar/assets/whitelisted/{assetId}
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "riskLevel": "MEDIUM",
  "maxInvestment": 500000000000,
  "reviewNotes": "Updated risk assessment"
}
```

## Configuration

### Environment Variables
```env
# Asset Discovery Configuration
ASSET_DISCOVERY_MIN_LIQUIDITY_SCORE=7.5
ASSET_DISCOVERY_MIN_VOLUME_24H=10000000000
ASSET_DISCOVERY_MIN_HOLDERS_COUNT=100
ASSET_DISCOVERY_REQUIRED_TAGS=RWA,Stable
ASSET_DISCOVERY_SCAN_INTERVAL_HOURS=24
ASSET_DISCOVERY_MAX_ASSETS_PER_SCAN=100
ASSET_DISCOVERY_HOME_DOMAIN_TIMEOUT=5000
```

### Discovery Criteria
- **Minimum Liquidity Score**: 7.5/10 (configurable)
- **Minimum 24h Volume**: 1,000 XLM equivalent (in stroops)
- **Minimum Holders**: 100 accounts
- **Required Tags**: Assets must have RWA/Stable tags or score ≥9.0
- **Scan Frequency**: Daily automated scans
- **Max Assets/Scan**: 100 assets to prevent API overload

## Asset Categories

### STABLECOIN
- USD, EUR, GBP, and other fiat-backed stablecoins
- Algorithmic stablecoins with proven track records
- Cross-chain stablecoin representations

### RWA (Real World Assets)
- Tokenized real estate, commodities, securities
- Carbon credits and environmental assets
- Supply chain finance tokens

### DEFI
- Governance tokens of established protocols
- Liquid staking tokens
- Decentralized exchange tokens

### UTILITY
- Platform utility tokens
- Service access tokens
- Network participation tokens

### MEME
- High-liquidity meme coins (rare, requires exceptional metrics)
- Community-driven tokens with strong network effects

## Risk Assessment

### LOW Risk
- Established stablecoins (USDC, USDT, EURC)
- Assets from regulated entities
- Multi-year track records

### MEDIUM Risk
- New stablecoins with audited code
- Established DeFi tokens
- Assets with 6+ months history

### HIGH Risk
- New assets with limited history
- Complex financial instruments
- Assets from unverified issuers

### CRITICAL Risk
- Unaudited assets
- Assets with governance concerns
- High-volatility assets

## Liquidity Scoring

The liquidity score (0-10) is calculated from:

1. **Volume Score** (0-4 points)
   - Based on 24h trading volume
   - Scaled against 10,000 XLM equivalent threshold

2. **Trade Frequency Score** (0-3 points)
   - Based on number of trades in 24h period
   - Scaled against 100 trades threshold

3. **Holder Count Score** (0-3 points)
   - Based on number of accounts holding the asset
   - Scaled against 1,000 holders threshold

## TOML Integration

Assets with valid Stellar TOML files receive enhanced metadata:

- **Currency Information**: Names, descriptions, images
- **Issuer Details**: Organization information, documentation
- **Tags**: Official categorization from issuers
- **Compliance**: Regulatory information and attestations

## Security Features

### Data Validation
- All asset data validated against Stellar network
- TOML files verified for authenticity
- Issuer addresses confirmed on-ledger

### Access Control
- Admin-only access to discovery endpoints
- Audit logging for all approval/rejection actions
- Rate limiting on manual scan operations

### Integrity Checks
- Assets re-verified before whitelisting
- Automatic monitoring of whitelisted assets
- Alert system for asset health changes

## Monitoring & Alerts

### System Health
- **Scan Success Rate**: Track automated discovery success
- **API Response Times**: Monitor Horizon API performance
- **Queue Depth**: Alert on pending asset backlog
- **Error Rates**: Track discovery and processing failures

### Asset Health
- **Volume Monitoring**: Alert on significant volume drops
- **Holder Monitoring**: Track holder count changes
- **TOML Validation**: Alert on invalid TOML files
- **Issuer Monitoring**: Watch for issuer account changes

## Usage Examples

### Daily Operations
```bash
# Check pending assets for review
curl /api/stellar/assets/pending?limit=10 \
  -H "Authorization: Bearer <admin-token>"

# Approve a high-quality stablecoin
curl -X POST /api/stellar/assets/disc_abc123/approve \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "category": "STABLECOIN",
    "riskLevel": "LOW",
    "reviewNotes": "Circle-backed USD stablecoin"
  }'
```

### Emergency Response
```bash
# Manually scan for urgent asset additions
curl -X POST /api/stellar/assets/scan \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"maxAssets": 50}'

# Deactivate compromised asset
curl -X PUT /api/stellar/assets/whitelisted/whitelist_123 \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"isActive": false, "reviewNotes": "Security concern"}'
```

## Integration Points

### Project Creation
- Whitelisted assets automatically available for project funding
- Risk levels inform investment limits and requirements

### Investment Intent
- Asset validation against whitelist before swap routing
- Category-based investment limits applied

### Bridge Operations
- Asset whitelist validation for cross-chain transfers
- Risk-based processing for different asset categories

## Future Enhancements

1. **Machine Learning Scoring**: AI-powered liquidity and risk assessment
2. **Real-time Monitoring**: Continuous asset health tracking
3. **Automated Deactivation**: Risk-based automatic delisting
4. **Multi-network Support**: Cross-chain asset discovery
5. **Community Curation**: User-reported asset suggestions
6. **Advanced Filtering**: Custom criteria per asset category

## Compliance & Legal

This system supports compliance with:

- **Financial Regulations**: Automated asset vetting and monitoring
- **Risk Management**: Institutional-grade risk assessment framework
- **Transparency**: Complete audit trail of asset approvals
- **Due Diligence**: Automated collection of issuer and asset information

The asset discovery system enables NovaFund to scale with the Stellar ecosystem while maintaining institutional standards for asset quality and regulatory compliance.