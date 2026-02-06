
# Fix: Pipeline Funnel & Lead Source Analytics Missing Self-Booked Sales

## Problem Identified

The Pipeline Funnel shows only **5 sales** instead of **10 sales** because 5 sales come from self-booked clients that are incorrectly excluded.

### Current Sales Breakdown:
| Member | Lead Source | Booked By | Sale Status |
|--------|-------------|-----------|-------------|
| Zoe Hall | Online Intro Offer (self-booked) | Self-booked | **EXCLUDED** |
| Adeline Harper | Online Intro Offer (self-booked) | Self-booked | **EXCLUDED** |
| Greg Watson | Online Intro Offer (self-booked) | Self-booked | **EXCLUDED** |
| Lauryn Holzkamp | Online Intro Offer (self-booked) | Self-booked | **EXCLUDED** |
| Sarah Allen | Online Intro Offer (self-booked) | Self-booked | **EXCLUDED** |
| Anna Livingston | Instagram DMs | Nora | Included |
| Mary Waller | Lead Management Call / Text | Katie | Included |
| Alyssa Mcfarland | Instagram DMs | Bri | Included |
| Lashanta Turner | Lead Management Call / Text | Bri | Included |
| Kendal Brown | Referral | Bri | Included |

### Root Cause
The logic in `useDashboardMetrics.ts` uses `firstIntroBookingsNoSelfBooked` for Pipeline Funnel and Lead Source Analytics. This incorrectly excludes self-booked clients from studio-wide conversion metrics.

**The distinction should be:**
- **Booker Stats**: Exclude self-booked (they didn't book themselves)
- **Pipeline Funnel**: Include ALL first intros (studio performance)
- **Lead Source Analytics**: Include ALL lead sources (for marketing analysis)

---

## Solution

### Change 1: Pipeline Funnel - Use ALL First Intro Bookings

**File:** `src/hooks/useDashboardMetrics.ts`

Change the pipeline calculation (lines 367-393) from using `firstIntroBookingsNoSelfBooked` to using `firstIntroBookings`:

**Before:**
```javascript
const pipelineBooked = firstIntroBookingsNoSelfBooked.length;
firstIntroBookingsNoSelfBooked.forEach(b => { ... });
```

**After:**
```javascript
const pipelineBooked = firstIntroBookings.length;
firstIntroBookings.forEach(b => { ... });
```

### Change 2: Lead Source Analytics - Include Self-Booked Lead Sources

**File:** `src/hooks/useDashboardMetrics.ts`

Change the lead source calculation (lines 337-361) to use `firstIntroBookings` instead of `firstIntroBookingsNoSelfBooked` and remove the self-booked lead source filter:

**Before:**
```javascript
firstIntroBookingsNoSelfBooked.forEach(b => {
  const source = b.lead_source || 'Unknown';
  // Skip self-booked lead sources entirely
  if (source.toLowerCase().includes('self-booked') || source.toLowerCase().includes('self booked')) {
    return;
  }
  ...
});
```

**After:**
```javascript
firstIntroBookings.forEach(b => {
  const source = b.lead_source || 'Unknown';
  // Include all lead sources for complete analytics
  ...
});
```

---

## Expected Results After Fix

### Pipeline Funnel:
| Stage | Before | After |
|-------|--------|-------|
| Booked | ~15 | ~21 (includes self-booked) |
| Showed | ~12 | ~18 (includes self-booked) |
| **Sold** | **5** | **10** |

### Lead Source Analytics:
| Lead Source | Before (Sold) | After (Sold) |
|-------------|---------------|--------------|
| Instagram DMs | 2 | 2 |
| Lead Management Call / Text | 2 | 2 |
| Referral | 1 | 1 |
| **Online Intro Offer (self-booked)** | **0 (hidden)** | **5** |

---

## System-Wide Attribution Verification

After this fix, I will verify all sections maintain correct data flow:

### Attribution Separation (No Changes Needed):
| Metric | Self-Booked Included? | Reason |
|--------|----------------------|--------|
| Booker Stats | No | Self-booked = no SA gets booking credit |
| Show Rate Leaderboard | No | Based on booking attribution |
| Pipeline Funnel | **Yes (fixing)** | Studio total conversions |
| Lead Source Analytics | **Yes (fixing)** | Marketing effectiveness |
| Per-SA Closing Rate | Yes | Based on intro_owner (who ran it) |
| Coach Performance | Yes | Based on coach who led session |
| Commission | Yes | Based on intro_owner |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useDashboardMetrics.ts` | Use `firstIntroBookings` for pipeline and lead source (remove self-booked exclusion for these sections) |

---

## Technical Implementation

### Lines 337-361 (Lead Source Metrics):
```javascript
// Lead sources - include ALL first intros for complete studio analytics
const leadSourceMap = new Map<string, LeadSourceMetrics>();
firstIntroBookings.forEach(b => {  // Changed from firstIntroBookingsNoSelfBooked
  const source = b.lead_source || 'Unknown';
  // Removed: self-booked lead source exclusion
  const existing = leadSourceMap.get(source) || { source, booked: 0, showed: 0, sold: 0, revenue: 0 };
  existing.booked++;
  
  const runs = bookingToRuns.get(b.id) || [];
  const nonNoShowRun = runs.find(r => r.result !== 'No-show');
  if (nonNoShowRun) {
    existing.showed++;
    const saleRun = runs.find(r => isMembershipSaleGlobal(r.result));
    if (saleRun) {
      existing.sold++;
      existing.revenue += saleRun.commission_amount || 0;
    }
  }
  
  leadSourceMap.set(source, existing);
});
```

### Lines 367-386 (Pipeline Metrics):
```javascript
// Pipeline - include ALL first intros for complete studio view
const pipelineBooked = firstIntroBookings.length;  // Changed from firstIntroBookingsNoSelfBooked
let pipelineShowed = 0;
let pipelineSold = 0;
let pipelineRevenue = 0;

firstIntroBookings.forEach(b => {  // Changed from firstIntroBookingsNoSelfBooked
  const runs = bookingToRuns.get(b.id) || [];
  const nonNoShowRun = runs.find(r => r.result !== 'No-show');
  if (nonNoShowRun) {
    pipelineShowed++;
    const saleRun = runs.find(r => isMembershipSaleGlobal(r.result));
    if (saleRun) {
      pipelineSold++;
      pipelineRevenue += saleRun.commission_amount || 0;
    }
  }
});
```

---

## Testing Checklist

After implementation:
- [ ] Pipeline Funnel shows 10 sales (not 5)
- [ ] Lead Source Analytics shows "Online Intro Offer (self-booked)" with 5 sales
- [ ] Booker Stats still excludes self-booked (no booking credit)
- [ ] Per-SA Table shows correct totals (Grace: 2, Kailey: 2, Lauren: 4, etc.)
- [ ] Studio Scoreboard matches Per-SA totals
- [ ] Commission totals are consistent across all views
