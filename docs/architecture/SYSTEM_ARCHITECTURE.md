# System Architecture

homeAI V1 is organized around strict ownership boundaries.

## Space Truth Engine

Owns floorplan parsing, scale confirmation, user correction, space truth score, and Canonical Floorplan JSON.

Only this layer may create or update confirmed canonical geometry.

## Full-Space Scene Engine

Consumes Canonical Floorplan JSON and produces Scene Contract data for room volumes, wall extrusion, placeholders, furniture proxies, and the full-space 3D white model.

It must not mutate canonical geometry.

## Camera Planner

Consumes Scene Contract data and creates room-level camera candidates and validation state.

It must not mutate geometry.

## Render Job Orchestrator

Owns RenderBatch lifecycle, RenderImageSpec execution, persistence, retry, and regeneration.

It must call provider interfaces, not real provider APIs from UI code.

## Render Consistency Verifier

Owns verified, warning, rejected, and manual_review_needed states for render images.

Rejected images must not enter main soft decor GPS recommendations.

## Design Brief Engine

Owns lightweight parsing of user free-form design preferences into style, avoid items, and functional priorities.

M0 defines only the contract.

## Soft Decor GPS Engine

Owns product categories, placement anchors, size constraints, style constraints, SKU matching, alternatives, and lead links.

It must not claim professional fit unless size validation supports it.

## Lead Tracking Engine

Owns lead events for product view, click, save, alternative click, contact request, and regeneration.

It must not store unnecessary PII.
