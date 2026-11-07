import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openAndMigrateDatabase } from '../../src/server/db/schema.js';
import { DEMO_TENANT_USER_ID, InvoicePilotRepository } from '../../src/server/db/repository.js';
import {
  GeminiInvoiceAgent,
  DEFAULT_GEMINI_TIMEOUT_MS,
  DEFAULT_GEMINI_MAX_RETRIES,
  DEFAULT_GEMINI_TOTAL_BUDGET_MS,
  supportsThinkingLevel
} from '../../src/server/agent/geminiAgent.js';
import { loadAppConfig } from '../../src/server/config.js';

const API_KEY = 'test-reliability-secret-key-555';

function draftEnvelopeResponse(invoiceNumber = 'INV-RELIABLE-1'): Response {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [
              { text: 'internal reasoning summary', thought: true },
              {
                text: JSON.stringify({
                  toolName: 'prepare_invoice_draft',
                  assistantMessage: 'Prepared draft for Elena Vance.',
                  prepareInvoiceDraftArgs: {
                    clientReference: 'Elena Vance',
                    invoiceNumber,
                    currencyCode: 'USD',
                    issueDate: '2026-10-31',
                    dueDate: '2026-11-14',
                    items: [
                      { description: 'Architecture Review', quantity: 1, unitPriceDecimal: '400.00' }
                    ]
                  }
                })
              }
            ]
          }
        }
      ]
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

function abortError(): Error {
  const e = new Error('The operation was aborted');
  e.name = 'AbortError';
  return e;
}

describe('Gemini structured agent reliability (timeouts, retries, fallback, duplicates)', () => {
  const tempDirs: string[] = [];
  const openDbs: DatabaseSync[] = [];

  afterEach(() => {
    for (const db of openDbs.splice(0)) {
      try {
        db.close();
      } catch {
        // already closed
      }
    }
    for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  function setup(
    fetchImpl: (url: string | URL | Request, init?: RequestInit) => Promise<Response>,
    overrides: Partial<ConstructorParameters<typeof GeminiInvoiceAgent>[1]> = {}
  ) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicepilot-reliability-'));
    tempDirs.push(dir);
    const db = openAndMigrateDatabase(path.join(dir, 'r.sqlite'));
    openDbs.push(db);
    const repo = new InvoicePilotRepository(db);
    repo.resetAndSeedDemoTenant();
    const fetchMock = vi.fn(fetchImpl);
    const sleeps: number[] = [];
    const agent = new GeminiInvoiceAgent(repo, {
      apiKey: API_KEY,
      model: 'gemini-3.8-flash',
      providerMode: 'mock',
      fetchImpl: fetchMock as unknown as typeof fetch,
      sleepImpl: async (ms) => {
        sleeps.push(ms);
      },
      randomImpl: () => 0.5,
      ...overrides
    });
    const invoiceCount = () => repo.listInvoicesForOwner(DEMO_TENANT_USER_ID).length;
    return { repo, agent, fetchMock, sleeps, invoiceCount };
  }

  it('uses realistic defaults compatible with the 60s Vercel function limit and loads them from env', () => {
    expect(DEFAULT_GEMINI_TIMEOUT_MS).toBe(20000);
    expect(DEFAULT_GEMINI_MAX_RETRIES).toBe(2);
    expect(DEFAULT_GEMINI_TOTAL_BUDGET_MS).toBeLessThan(60000);
    const cfg = loadAppConfig({ PAYPAL_MODE: 'mock', APP_ENV: 'test' }, { loadDotEnvFile: false });
    expect(cfg.geminiTimeoutMs).toBe(20000);
    expect(cfg.geminiMaxRetries).toBe(2);
    expect(cfg.geminiTotalBudgetMs).toBe(50000);
    expect(cfg.geminiThinkingLevel).toBe('low');
    const capped = loadAppConfig(
      { PAYPAL_MODE: 'mock', APP_ENV: 'test', GEMINI_TOTAL_BUDGET_MS: '120000', GEMINI_MAX_RETRIES: '9', GEMINI_THINKING_LEVEL: 'bogus' },
      { loadDotEnvFile: false }
    );
    expect(capped.geminiTotalBudgetMs).toBe(55000);
    expect(capped.geminiMaxRetries).toBe(4);
    expect(capped.geminiThinkingLevel).toBe('low');
    expect(supportsThinkingLevel('gemini-3.8-flash')).toBe(true);
    expect(supportsThinkingLevel('gemini-2.5-flash-lite')).toBe(false);
  });

  it('succeeds with a structured response, sends thinkingLevel=low and the strict schema, and ignores thought parts', async () => {
    const { agent, fetchMock, invoiceCount } = setup(async () => draftEnvelopeResponse());
    const before = invoiceCount();
    const out = await agent.processPrompt(DEMO_TENANT_USER_ID, { prompt: 'Invoice Elena Vance $400 for architecture review' });
    expect(out.ok).toBe(true);
    expect(out.status).toBe('DRAFT_PREPARED');
    expect(out.invoice?.localStatus).toBe('DRAFT');
    expect(out.invoice?.providerStatus).toBe('NONE');
    expect(invoiceCount()).toBe(before + 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).toBeDefined();
    expect('temperature' in body.generationConfig).toBe(false);
    expect(body.tools[0].functionDeclarations.length).toBeGreaterThan(0);
  });

  it('retries a transient timeout and then succeeds, creating exactly one draft', async () => {
    let calls = 0;
    const { agent, fetchMock, sleeps, invoiceCount } = setup(async () => {
      calls += 1;
      if (calls === 1) throw abortError();
      return draftEnvelopeResponse();
    });
    const before = invoiceCount();
    const out = await agent.processPrompt(DEMO_TENANT_USER_ID, { prompt: 'Invoice Elena Vance $400' });
    expect(out.status).toBe('DRAFT_PREPARED');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleeps).toHaveLength(1);
    expect(sleeps[0]).toBe(250); // 0.5 jitter * 500ms base
    expect(invoiceCount()).toBe(before + 1);
  });

  it('retries transient 503 and network failures with exponential backoff before succeeding', async () => {
    let calls = 0;
    const { agent, fetchMock, sleeps } = setup(async () => {
      calls += 1;
      if (calls === 1) return new Response('unavailable', { status: 503 });
      if (calls === 2) throw new TypeError('fetch failed');
      return draftEnvelopeResponse();
    });
    const out = await agent.processPrompt(DEMO_TENANT_USER_ID, { prompt: 'Invoice Elena Vance $400' });
    expect(out.status).toBe('DRAFT_PREPARED');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([250, 500]);
  });

  it('returns AGENT_ERROR with GEMINI_TIMEOUT after repeated timeouts, bounded attempts, no draft created', async () => {
    const { agent, fetchMock, invoiceCount } = setup(async () => {
      throw abortError();
    });
    const before = invoiceCount();
    const out = await agent.processPrompt(DEMO_TENANT_USER_ID, { prompt: 'Invoice Elena Vance $400' });
    expect(out.ok).toBe(false);
    expect(out.status).toBe('AGENT_ERROR');
    expect(out.fallbackToConventionalForm).toBe(true);
    expect(out.validationExplanation).toMatch(/^GEMINI_TIMEOUT:.*after 3 attempts/);
    expect(out.assistantMessage).toContain('automatic retries');
    expect(out.assistantMessage).toContain('prompt is preserved');
    expect(out.invoice).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1 + DEFAULT_GEMINI_MAX_RETRIES);
    expect(invoiceCount()).toBe(before);
  });

  it('honors the total budget so attempts never exceed the serverless limit', async () => {
    const { agent, fetchMock } = setup(
      async () => {
        await new Promise((r) => setTimeout(r, 600));
        throw abortError();
      },
      { totalBudgetMs: 1500, timeoutMs: 20000 }
    );
    const out = await agent.processPrompt(DEMO_TENANT_USER_ID, { prompt: 'Invoice Elena Vance $400' });
    expect(out.status).toBe('AGENT_ERROR');
    // Budget leaves room for one attempt only (each attempt needs >= 1s remaining)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.validationExplanation).toContain('timed out after 1500ms');
  });

  it('retries HTTP 429 respecting Retry-After and reports rate limiting when exhausted', async () => {
    const { agent, fetchMock, sleeps } = setup(
      async () =>
        new Response(`quota exceeded for ${API_KEY}`, { status: 429, headers: { 'Retry-After': '2' } })
    );
    const out = await agent.processPrompt(DEMO_TENANT_USER_ID, { prompt: 'Invoice Elena Vance $400' });
    expect(out.status).toBe('AGENT_ERROR');
    expect(out.validationExplanation).toMatch(/^GEMINI_RATE_LIMITED/);
    expect(out.validationExplanation).not.toContain(API_KEY);
    expect(out.assistantMessage).toContain('HTTP 429');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([2000, 2000]);
  });

  it('does not retry non-transient failures: HTTP 400, 404, invalid JSON, or schema-invalid output', async () => {
    const cases: Array<{ res: () => Response; expectCode: string }> = [
      { res: () => new Response('bad request', { status: 400 }), expectCode: 'GEMINI_HTTP_ERROR' },
      { res: () => new Response('not found', { status: 404 }), expectCode: 'GEMINI_MODEL_NOT_FOUND' },
      {
        res: () =>
          new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{not-json' }] } }] }), {
            status: 200
          }),
        expectCode: 'AGENT_OUTPUT_INVALID'
      },
      {
        res: () =>
          new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: JSON.stringify({ toolName: 'prepare_invoice_draft' }) }] } }]
            }),
            { status: 200 }
          ),
        // Strict server schema validation rejects the incomplete envelope
        expectCode: 'Invalid input'
      },
      { res: () => new Response('<html>oops</html>', { status: 200 }), expectCode: 'AGENT_OUTPUT_INVALID' }
    ];
    for (const c of cases) {
      const { agent, fetchMock, sleeps, invoiceCount } = setup(async () => c.res());
      const before = invoiceCount();
      const out = await agent.processPrompt(DEMO_TENANT_USER_ID, { prompt: 'Invoice Elena Vance $400' });
      expect(out.ok).toBe(false);
      expect(out.fallbackToConventionalForm).toBe(true);
      expect(String(out.validationExplanation)).toContain(c.expectCode);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(sleeps).toHaveLength(0);
      expect(invoiceCount()).toBe(before);
    }
  });

  it('handles empty and incomplete candidates safely with fallback and no side effects', async () => {
    for (const payload of [{}, { candidates: [] }, { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] }]) {
      const { agent, fetchMock, invoiceCount } = setup(
        async () => new Response(JSON.stringify(payload), { status: 200 })
      );
      const before = invoiceCount();
      const out = await agent.processPrompt(DEMO_TENANT_USER_ID, { prompt: 'Invoice Elena Vance $400' });
      expect(out.status).toBe('AGENT_ERROR');
      expect(out.validationExplanation).toContain('AGENT_OUTPUT_INVALID');
      expect(out.fallbackToConventionalForm).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(invoiceCount()).toBe(before);
    }
  });

  it('prevents duplicate invoices: idempotent replays are blocked and retries happen before any write', async () => {
    let calls = 0;
    const { agent, invoiceCount } = setup(async () => {
      calls += 1;
      if (calls === 1) return new Response('busy', { status: 503 });
      return draftEnvelopeResponse('INV-IDEMP-1');
    });
    const before = invoiceCount();
    const first = await agent.processPrompt(DEMO_TENANT_USER_ID, {
      prompt: 'Invoice Elena Vance $400',
      idempotencyKey: 'idem-reliability-1'
    });
    expect(first.status).toBe('DRAFT_PREPARED');
    expect(invoiceCount()).toBe(before + 1);
    const replay = await agent.processPrompt(DEMO_TENANT_USER_ID, {
      prompt: 'Invoice Elena Vance $400',
      idempotencyKey: 'idem-reliability-1'
    });
    expect(replay.status).toBe('SAFETY_BLOCKED');
    expect(invoiceCount()).toBe(before + 1);
  });

  it('falls back to grounded insights for insight prompts when Gemini repeatedly times out', async () => {
    const { agent } = setup(async () => {
      throw abortError();
    });
    const out = await agent.processPrompt(DEMO_TENANT_USER_ID, { prompt: 'Show my cash flow forecast and aging' });
    expect(out.ok).toBe(true);
    expect(out.status).toBe('FINANCIAL_INSIGHTS_RETRIEVED');
    expect(out.insights).toBeDefined();
  });

  it('reminder drafting retries transient errors and falls back to the conventional template when exhausted', async () => {
    const reminderOk = () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.stringify({ subject: 'Reminder: INV-1', body: 'Hello, invoice INV-1 is now due. Thank you.' }) }
                ]
              }
            }
          ]
        }),
        { status: 200 }
      );
    const input = {
      clientName: 'Elena Vance',
      businessName: 'Studio',
      invoiceNumber: 'INV-1',
      amountFormatted: '$100.00',
      dueDate: '2026-11-01',
      daysOverdue: 2,
      tone: 'polite' as const
    };

    let calls = 0;
    const recover = setup(async () => {
      calls += 1;
      if (calls === 1) throw abortError();
      return reminderOk();
    });
    const recovered = await recover.agent.draftReminderWording(input);
    expect(recovered.usedFallback).toBe(false);
    expect(recover.fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(String(recover.fetchMock.mock.calls[0][1]?.body));
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });

    const exhausted = setup(async () => {
      throw abortError();
    });
    const fb = await exhausted.agent.draftReminderWording(input);
    expect(fb.usedFallback).toBe(true);
    expect(fb.subject.length).toBeGreaterThan(0);
    expect(exhausted.fetchMock).toHaveBeenCalledTimes(3);
  });
});
