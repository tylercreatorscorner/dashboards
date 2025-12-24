# Daily Upload Process - Updated December 2024

## What to Upload Daily

### ✅ REQUIRED FILES (4 per brand)

| # | File Type | TikTok Location | Rename To |
|---|-----------|-----------------|-----------|
| 1 | 🟢 Creator Data | Affiliate Center → Creator Data | `{Brand}_Creator_Data_{date}.xlsx` |
| 2 | 🟣 Video Data | Affiliate Center → Video Data | `{Brand}_Video_Data_{date}.xlsx` |
| 3 | 🔵 Video List | Affiliate Center → Video List | `{Brand}_Video_List_{date}.xlsx` |
| 4 | 🟠 Affiliate Products | Transaction Analysis → Product | `{Brand}_Transaction_Analysis_{date}.xlsx` |

### Total Files Per Day
- **5 brands × 4 files = 20 files daily**
- Or focus on your active brands

---

## ❌ NO LONGER NEEDED

| Old File | Why Removed |
|----------|-------------|
| 🟡 Shop Analytics | Not relevant for affiliate management |
| 🔵 Product List (old) | Replaced by Affiliate Products - old version included non-affiliate sales |

---

## File Naming Examples

**Physicians Choice (Dec 10, 2024):**
```
PhysiciansChoice_Creator_Data_20251210.xlsx
PhysiciansChoice_Video_Data_20251210.xlsx
PhysiciansChoice_Video_List_20251210.xlsx
PhysiciansChoice_Transaction_Analysis_20251210.xlsx
```

**JiYu (Dec 10, 2024):**
```
JiYu_Creator_Data_20251210.xlsx
JiYu_Video_Data_20251210.xlsx
JiYu_Video_List_20251210.xlsx
JiYu_Transaction_Analysis_20251210.xlsx
```

**Brand Prefixes:**
| Brand | Prefix |
|-------|--------|
| Cata-Kor | `CataKor_` |
| JiYu | `JiYu_` |
| Physicians Choice | `PhysiciansChoice_` |
| Peach Slices | `PeachSlices_` |
| Yerba Magic | `YerbaMagic_` |

---

## Where to Find Each File in TikTok

### 1. 🟢 Creator Data
```
TikTok Shop Seller Center → Affiliate Center → Creator Data
→ Export → Select date → Download
→ Rename to: {Brand}_Creator_Data_{date}.xlsx
```

### 2. 🟣 Video Data  
```
TikTok Shop Seller Center → Affiliate Center → Video Data
→ Export → Select date → Download
→ Rename to: {Brand}_Video_Data_{date}.xlsx
```

### 3. 🔵 Video List (NEW)
```
TikTok Shop Seller Center → Affiliate Center → Video List
→ Export → Select date → Download
→ Rename to: {Brand}_Video_List_{date}.xlsx
```

### 4. 🟠 Affiliate Products (NEW)
```
TikTok Shop Seller Center → Transaction Analysis → Product
→ Filter by "Affiliate" channel → Export → Download
→ Rename to: {Brand}_Transaction_Analysis_{date}.xlsx
```
**Why this matters:** This shows only affiliate-generated sales, not organic/ads/shop tab.

---

## What Each File Does

### 🟢 Creator Data → `creator_performance` table
- Daily GMV, orders, videos per creator
- Powers: Leaderboards, Weekly Review, Creator Stats

### 🟣 Video Data → `video_performance` table
- GMV per video per product
- Powers: Product-level GMV tracking, video ROI

### 🔵 Video List → `videos` table (NEW)
- Video post dates and engagement metrics
- Powers: Product-specific posting counts, engagement tracking
- **This enables accurate "how many Fiber videos did they post?" tracking**

### 🟠 Affiliate Products → `product_performance` table
- Affiliate-only product metrics
- Powers: Product Analytics, true affiliate ROI
- **Shows only creator-driven sales, not organic/ads**

---

## Database Migrations Required

Run these SQL files in Supabase before uploading:

1. `videos_table.sql` - Creates new videos table
2. `product_performance_update.sql` - Adds affiliate columns

---

## Upload Workflow

1. Export files from TikTok (see locations above)
2. **Rename files** with brand prefix and date
3. Go to Dashboard → Upload
4. Drag all files to the upload area
5. Verify brand/date detected correctly
6. Click "Upload Files"
7. Wait for confirmation

---

## Quick Reference Card

```
DAILY UPLOAD CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Per Brand:
  □ {Brand}_Creator_Data_{date}.xlsx
  □ {Brand}_Video_Data_{date}.xlsx  
  □ {Brand}_Video_List_{date}.xlsx
  □ {Brand}_Transaction_Analysis_{date}.xlsx

NO LONGER NEEDED:
  ✗ Shop Analytics
  ✗ Product List (old version)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
