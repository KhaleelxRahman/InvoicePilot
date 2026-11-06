import { loadAppConfig } from '../src/server/config.js';

async function main() {
  console.log('=== InvoicePilot: Gemini Live API Connectivity Verification ===');
  const config = loadAppConfig(process.env, { loadDotEnvFile: true });

  const apiKey = (config.geminiApiKey || '').trim();
  const model = (config.geminiModel || 'gemini-2.5-flash').trim();

  if (!apiKey) {
    console.log('[Gemini Verification] Status: NOT CONFIGURED');
    console.log('[Gemini Verification] Notice: GEMINI_API_KEY is not set in environment or .env.');
    console.log('[Gemini Verification] Safe fallback to conventional invoice drafting is active and verified in unit tests.');
    console.log('\nTo verify live Gemini API connectivity:');
    console.log('  1. Add your key: export GEMINI_API_KEY="your-gemini-api-key" (or in .env)');
    console.log('  2. Run: npx tsx scripts/verifyGeminiCli.ts');
    process.exit(0);
  }

  console.log(`[Gemini Verification] Testing Model: ${model}`);
  console.log(`[Gemini Verification] API Key Length: ${apiKey.length} characters (Secret Redacted)`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const promptPayload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Return a strictly formatted JSON object: {"status": "ok", "service": "invoicepilot", "message": "Gemini connectivity verified"}'
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  try {
    const start = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(promptPayload)
    });

    const elapsed = Date.now() - start;

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Gemini Verification] API Request Failed with HTTP ${response.status} (${elapsed}ms):`, errText);
      process.exit(1);
    }

    const json = await response.json() as any;
    const rawContent = json?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      console.error('[Gemini Verification] Received empty response from Gemini API.');
      process.exit(1);
    }

    const parsed = JSON.parse(rawContent);
    console.log(`[Gemini Verification] Response received in ${elapsed}ms:`, JSON.stringify(parsed));
    console.log('\n[Gemini Verification] Live Gemini API connectivity PASSED.');
    process.exit(0);
  } catch (err) {
    console.error('[Gemini Verification] Network or parsing exception:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();

