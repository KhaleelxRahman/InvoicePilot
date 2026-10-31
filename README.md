# InvoicePilot
AI-powered invoicing and payment management for freelancers and small businesses (PAYPAL AI HACKATHON)

## Quick Start (Stage 01 Foundation)
1. Install dependencies: `npm install`
2. Optional local config: copy `.env.example` to `.env` (defaults to `PAYPAL_MODE=sandbox`; never commit `.env`).
3. Start development server (`http://localhost:3000`): `npm run dev`
4. Verify health endpoint: `GET http://localhost:3000/api/health`
5. Run checks:
   - Typecheck: `npm run typecheck`
   - Unit tests: `npm test`
   - Playwright E2E tests (desktop 1280px & mobile 360px): `npx playwright test`
   - Production build: `npm run build`

See [`docs/README.md`](docs/README.md) for the complete architecture, specification, and stage verification ledger.
