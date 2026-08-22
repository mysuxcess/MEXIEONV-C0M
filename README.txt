MEXIEON — Marketplace + AI Operations Platform
===============================================

Single-repo full stack. Express 5 backend (node:sqlite, zero external DB)
serving a static storefront and the AI operations console.

Requirements
------------
- Node.js 22.5+ (uses node:sqlite — Node 26 recommended)

Run locally
-----------
    npm install      # install dependencies
    node seed.js     # populate the product catalog (1,098 products)
    node server.js   # or: npm start

Then open:
    http://localhost:4000/                 -> Storefront (index.html)
    http://localhost:4000/mexieon-v9.html  -> AI Operations console (V9)

Data lives in mexieon.db (auto-created on first start).

API
---
    GET  /api/health                     -> health check
    POST /api/auth/signup, /login        -> accounts (JWT)
    GET  /api/auth/me                    -> profile (auth required)
    GET  /api/products                   -> product catalog
    POST /api/cart, GET /api/cart        -> cart
    POST /api/rfq, /api/hunter           -> RFQ / sourcing requests
    POST /api/outreach, /api/facility    -> supplier outreach, trade facility
    POST /api/orders, GET /api/orders    -> checkout / order history
    POST /api/nova/chat                  -> NOVA support (keyword fallback)
    POST /api/country-agent              -> country concierge
    POST /api/orchestrate/plan           -> free-text -> agent task graph
    POST /api/orchestrate/execute        -> run the graph (mock LLM sim)
    GET  /api/orchestrate/project/:id    -> project state + ATLAS summary

Config (optional — defaults work out of the box)
------------------------------------------------
    PORT                 -> default 4000
    JWT_SECRET           -> default dev secret (set for production)
    ANTHROPIC_API_KEY    -> upgrades NOVA / concierge to a real model
                            (falls back to keyword/curated answers without it)

The orchestration layer (routes-orchestrate.js + agents.js) runs a full
mock-LLM pipeline — ARCHITECT -> INTERIOR -> PROCUREMENT -> FINANCE ->
LOGISTICS -> MARKETING -> PUBLISHING -> ANALYTICS — producing a structured
ATLAS summary with no API key required.
