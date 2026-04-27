# Testing Guide for New Implementations

This guide provides practical examples for testing all four implemented optimizations.

---

## 1. Testing Response Compression (Issue #390)

### Test with curl
```bash
# Test Gzip compression
curl -H "Accept-Encoding: gzip" -v http://localhost:3000/api/v1/projects

# Test Brotli compression (if supported)
curl -H "Accept-Encoding: br" -v http://localhost:3000/api/v1/projects

# Check response headers for:
# Content-Encoding: gzip
# or
# Content-Encoding: br
```

### Expected Results
- Response headers should include `Content-Encoding: gzip` or `br`
- Response size should be 50-70% smaller than uncompressed
- Look for `Content-Length` header showing reduced size

---

## 2. Testing Sparse Fieldsets (Issue #390)

### REST API Tests
```bash
# Request only specific fields
curl http://localhost:3000/api/v1/projects?fields=id,title,category

# Request fields with filters
curl "http://localhost:3000/api/v1/projects?fields=id,title,goal,status&status=ACTIVE&take=5"

# Compare response sizes
curl http://localhost:3000/api/v1/projects?take=10 > full_response.json
curl "http://localhost:3000/api/v1/projects?fields=id,title&take=10" > sparse_response.json
# Compare file sizes - sparse should be much smaller
```

### Expected Results
- Response should only contain requested fields
- Smaller payload for sparse fieldsets
- Faster response times

---

## 3. Testing Elasticsearch Search (Issue #383)

### Setup Elasticsearch (if not running)
```bash
docker run -d -p 9200:9200 -e "discovery.type=single-node" elasticsearch:8.11.0
```

### Enable in .env
```env
ELASTICSEARCH_ENABLED=true
ELASTICSEARCH_URL=http://localhost:9200
```

### Test Search Endpoints
```bash
# Basic search
curl "http://localhost:3000/api/v1/search/projects?q=blockchain"

# Search with filters
curl "http://localhost:3000/api/v1/search/projects?q=fintech&category=finance&status=ACTIVE"

# Search with goal range
curl "http://localhost:3000/api/v1/search/projects?q=tech&minGoal=1000&maxGoal=50000"

# Test fuzzy search (typo tolerance)
curl "http://localhost:3000/api/v1/search/projects?q=blocchain"  # Should find "blockchain"

# Test auto-completion
curl "http://localhost:3000/api/v1/search/suggest?prefix=sol"

# Pagination
curl "http://localhost:3000/api/v1/search/projects?q=project&limit=5&offset=10"
```

### Expected Results
- Fast response times (< 100ms)
- Results sorted by relevance score
- Typos still find correct results
- Suggestions returned for auto-completion

### Test PostgreSQL Fallback
```bash
# Disable Elasticsearch
ELASTICSEARCH_ENABLED=false

# Search should still work (using LIKE queries)
curl "http://localhost:3000/api/v1/search/projects?q=test"
```

---

## 4. Testing DataLoaders (Issue #413)

### GraphQL Query Test
Open GraphQL Playground at `http://localhost:3000/graphql`

#### Test Query (would cause N+1 without DataLoaders)
```graphql
query {
  projects(take: 10) {
    projects {
      id
      title
      creator {        # Uses userLoader
        id
        email
        walletAddress
      }
      contributions {  # Uses contributionsByProjectLoader
        id
        amount
        investor {     # Uses userLoader (batched)
          id
          email
        }
      }
      milestones {     # Uses milestonesByProjectLoader
        id
        title
        status
      }
    }
  }
}
```

### Monitor Database Queries
Enable Prisma query logging in `.env`:
```env
DEBUG=prisma:query
```

#### Expected Results
**WITHOUT DataLoaders** (10 projects):
- 1 query for projects
- 10 queries for creators (N+1)
- 10 queries for contributions (N+1)
- 10 queries for milestones (N+1)
- **Total: 31+ queries**

**WITH DataLoaders** (10 projects):
- 1 query for projects
- 1 query for all creators (batched)
- 1 query for all contributions (batched)
- 1 query for all milestones (batched)
- **Total: 4 queries**

### Verify Batching
Check server logs - you should see:
- Single query with `WHERE id IN (...)` instead of multiple queries
- Dramatically reduced query count
- Faster response times

---

## 5. Testing Dynamic Fees (Issue #377)

### Test Fee Calculation
```typescript
// In your code or tests
const feeConfig = await dynamicFeeService.getDynamicFee('medium', false);
console.log(feeConfig);
// Output:
// {
//   baseFee: 100,
//   priorityFee: 20,
//   totalFee: 120,
//   feeLevel: 'medium'
// }
```

### Test Different Priority Levels
```typescript
// Low priority (cheapest)
const lowFee = await dynamicFeeService.getDynamicFee('low', false);

// Medium priority (balanced)
const medFee = await dynamicFeeService.getDynamicFee('medium', false);

// High priority (faster)
const highFee = await dynamicFeeService.getDynamicFee('high', false);

// Urgent priority (fastest)
const urgentFee = await dynamicFeeService.getDynamicFee('urgent', false);

// High-value transaction (with priority bidding)
const highValueFee = await dynamicFeeService.getDynamicFee('high', true);

console.log('Low:', lowFee.totalFee);
console.log('Medium:', medFee.totalFee);
console.log('High:', highFee.totalFee);
console.log('Urgent:', urgentFee.totalFee);
console.log('High-Value:', highValueFee.totalFee);
```

### Test Network Congestion Detection
```typescript
const congestion = await dynamicFeeService.getNetworkCongestionLevel();
console.log('Network congestion:', congestion);
// Returns: 'low' | 'medium' | 'high' | 'critical'
```

### Test Transaction with Dynamic Fees
```typescript
// Process refund with dynamic fee
await stellarService.processRefund(
  userId,
  amount,
  'high' // priority level
);

// Execute swap with high-value priority bidding
await stellarService.executeSwap(
  sourceAsset,
  destAsset,
  amount,
  undefined,
  undefined,
  true // isHighValue - triggers priority bidding
);
```

### Expected Results
- Fees adapt to network conditions
- Higher priority = higher fees = faster confirmation
- High-value transactions get automatic priority boost
- No stuck transactions during congestion
- Logs show actual fees used

---

## 6. Integration Testing

### Full Workflow Test
```bash
# 1. Search for a project (Elasticsearch)
PROJECT_ID=$(curl -s "http://localhost:3000/api/v1/search/projects?q=test&limit=1" | jq -r '.[0].id')

# 2. Get project with sparse fieldsets (Compression + Sparse Fields)
curl -H "Accept-Encoding: gzip" \
  "http://localhost:3000/api/v1/projects/$PROJECT_ID?fields=id,title,goal,status"

# 3. Query project with relations via GraphQL (DataLoaders)
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { project(id: \"'$PROJECT_ID'\") { id title creator { id email } } }"
  }'

# 4. Monitor server logs for:
# - Compression applied
# - Only requested fields returned
# - Batched database queries (DataLoaders)
# - Dynamic fees used for any transactions
```

---

## 7. Performance Benchmarks

### Measure Response Times
```bash
# Time the requests
time curl http://localhost:3000/api/v1/projects?take=50
time curl "http://localhost:3000/api/v1/projects?fields=id,title&take=50"
time curl "http://localhost:3000/api/v1/search/projects?q=test"
```

### Expected Improvements
| Operation | Before | After |
|-----------|--------|-------|
| Full project list (50 items) | 500ms+ | 150-250ms |
| Sparse fieldset request | 500ms+ | 100-150ms |
| Elasticsearch search | N/A | 10-50ms |
| GraphQL with relations | 2-5s | 200-500ms |
| Transaction submission | Variable | Optimized |

---

## 8. Monitoring & Debugging

### Enable Debug Logging
Add to `.env`:
```env
# Prisma query logging
DEBUG=prisma:query

# Application logging
LOG_LEVEL=debug
```

### Check Compression
```bash
# Verbose curl to see headers
curl -v -H "Accept-Encoding: gzip, br" http://localhost:3000/api/v1/projects

# Look for:
# < Content-Encoding: gzip
# or
# < Content-Encoding: br
```

### Monitor DataLoader Batching
Add logging to resolvers:
```typescript
@ResolveField(() => Object, { name: 'creator' })
async creator(@Parent() project: Project, @Context() context: DataLoaderContext) {
  console.log('Loading creator via DataLoader:', project.creatorId);
  return context.userLoader.load(project.creatorId);
}
```

### Check Dynamic Fee Logs
Server logs should show:
```
[DynamicFeeService] Updated fee stats: mode=100, p50=150
[StellarService] Refund successful with fee: 180 stroops
[StellarService] Applied high-value priority bidding
```

---

## 9. Load Testing

### Using Apache Bench
```bash
# Test concurrent requests with compression
ab -n 100 -c 10 http://localhost:3000/api/v1/projects?take=10

# Test with sparse fieldsets
ab -n 100 -c 10 "http://localhost:3000/api/v1/projects?fields=id,title&take=10"
```

### Expected Results
- Higher throughput with compression enabled
- Lower response times with sparse fieldsets
- Consistent performance under load with DataLoaders

---

## 10. Troubleshooting

### Compression Not Working
- Ensure `compression` package is installed: `npm list compression`
- Check that responses are > 1KB (threshold)
- Verify client sends `Accept-Encoding` header

### Search Not Working
- Check Elasticsearch is running: `curl http://localhost:9200`
- Verify `ELASTICSEARCH_ENABLED=true` in `.env`
- Check logs for sync errors
- Fallback to PostgreSQL should work automatically

### DataLoaders Not Batching
- Ensure `dataloader` package is installed
- Verify GraphQL context includes DataLoaders
- Check that resolvers use `@Context()` decorator
- DataLoaders are request-scoped (new per request)

### Dynamic Fees Not Updating
- Check Horizon URL is accessible
- Verify fee stats endpoint: `curl https://horizon-testnet.stellar.org/fee_stats`
- Check cache duration (30 seconds default)
- Fallback fees should be used if Horizon unavailable

---

## ✅ Success Criteria

All tests pass when:
- ✅ Response sizes reduced by 50%+
- ✅ Sparse fieldsets return only requested data
- ✅ Search returns results in < 100ms with typo tolerance
- ✅ GraphQL queries use < 5 DB requests regardless of size
- ✅ Transactions complete without getting stuck
- ✅ Fees adapt to network conditions
- ✅ No errors in server logs
