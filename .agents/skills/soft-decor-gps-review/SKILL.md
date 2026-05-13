---
name: soft-decor-gps-review
description: Use when implementing or reviewing room-level product recommendations, SKU matching, alternatives, affiliate links, or lead tracking.
---

# Soft Decor GPS Review Skill

## checks

1. Does every recommendation have roomId and category?
2. Does every recommendation include placement anchor?
3. Are size constraints explicit?
4. Are style constraints explicit?
5. Are SKU candidates scored for style, size, and budget?
6. Are alternatives available?
7. Are lead URLs created through AffiliateProvider?
8. Are product_view, product_click, product_save, alternative_click, and contact_request tracked?
9. Is unnecessary PII excluded?

## reject conditions

- recommendations without room context
- product candidates without size or price metadata
- direct affiliate links hardcoded in UI
- claims of guaranteed fit without validation
- PII in LeadEvent metadata

## required output

- recommendation contract gaps
- SKU matching risks
- affiliate and lead tracking risks
- PII risks
