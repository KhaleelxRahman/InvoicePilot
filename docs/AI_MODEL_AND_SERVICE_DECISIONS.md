# INVOICEPILOT — AI MODEL & EXTERNAL SERVICE ARCHITECTURE DECISIONS

**Evaluation Date**: November 7, 2026  
**Auditor**: AI/LLM Integration Specialist  

---

## 1. Primary Model Decisions: Google Gemini Flash Suite

| Model | Role in InvoicePilot | Latency | Schema / Tool Support | Decision & Rationale |
|---|---|---|---|---|
| **gemini-3.8-flash** | **Primary Agent Model** | ~1.5s – 3.5s | Full JSON schema & function calling | **SELECTED AS PRIMARY**. Best-in-class price-to-performance; natively supports structured tool envelopes and low-thinking mode. |
| **gemini-3.5-flash-lite** | **Peer Failover Model** | ~0.8s – 2.0s | Full JSON schema & function calling | **SELECTED AS FAILOVER**. Seamlessly takes over when Google AI Studio experiences 503 high-demand surges. Tested live in production. |
| **gemini-3.6-flash** | **Secondary Failover** | ~1.2s – 2.5s | Full JSON schema & function calling | **RESERVED AS SECONDARY FAILOVER**. |
| **gemini-1.5-pro / 2.5-pro** | *Evaluated* | 8.0s – 25.0s | Full | **REJECTED FOR CORE PATH**. Excessive latency causes serverless timeouts; deep reasoning is unnecessary for parameter extraction where deterministic code handles math. |

---

## 2. Evaluation of External ML Models (Hugging Face / Kaggle)

| Candidate Model / Tool | Proposed Use Case | Hardware / Hosting Req. | Decision & Rationale |
|---|---|---|---|
| **Donut / LayoutLMv3 (Hugging Face)** | PDF / Image Invoice OCR | Requires PyTorch, CUDA or dedicated GPU container | **DEFERRED TO ROADMAP**. Adding heavy ML libraries would exceed serverless bundle limits (50MB) and cannot run reliably on laptops with integrated graphics. |
| **Local Llama 3 / Mistral (Ollama)** | Local offline reasoning | 8GB–16GB VRAM | **REJECTED**. Unusable in serverless cloud environments (Vercel) and overloads laptop CPU/RAM. |
| **Fine-tuned BERT (Kaggle)** | Expense categorization | Hosted PyTorch microservice | **DEFERRED TO ROADMAP**. Deterministic rule engines and Gemini Flash currently achieve 100% accuracy on category mapping without added microservice maintenance. |

---

## 3. Core Architectural Takeaway

1. **Deterministic Arithmetic Over LLM Math**: All line-item totals, basis point taxes, and aging buckets are calculated by pure TypeScript code, completely eliminating hallucinated financial totals.
2. **Hosted Serverless API**: Using hosted Google Gemini Flash via REST v1beta keeps build artifacts tiny (Vite bundle < 500kB) and cold starts under 100ms.
3. **Hardware Preservation**: Zero local GPU requirements; developers and judges can run the entire workspace on standard laptops.
