import os
from PIL import Image, ImageDraw, ImageFont

SLIDES_DIR = "video-production/audit_slides"
os.makedirs(SLIDES_DIR, exist_ok=True)

FONT_PATH_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"
FONT_PATH_REG = r"C:\Windows\Fonts\segoeui.ttf"
FONT_PATH_MONO = r"C:\Windows\Fonts\consola.ttf"

font_display_56 = ImageFont.truetype(FONT_PATH_BOLD, 56)
font_display_42 = ImageFont.truetype(FONT_PATH_BOLD, 42)
font_display_32 = ImageFont.truetype(FONT_PATH_BOLD, 32)
font_title_24 = ImageFont.truetype(FONT_PATH_BOLD, 24)
font_subtitle_20 = ImageFont.truetype(FONT_PATH_BOLD, 20)
font_body_16 = ImageFont.truetype(FONT_PATH_REG, 16)
font_body_14 = ImageFont.truetype(FONT_PATH_REG, 14)
font_badge_12 = ImageFont.truetype(FONT_PATH_BOLD, 12)
font_badge_11 = ImageFont.truetype(FONT_PATH_BOLD, 11)
font_mono_14 = ImageFont.truetype(FONT_PATH_MONO, 14)
font_mono_12 = ImageFont.truetype(FONT_PATH_MONO, 12)

PAYPAL_BADGE_PATH = "video-production/paypal_hackathon_badge.png"
PAYPAL_ICON_PATH = "video-production/paypal_official_240.png"
INVOICE_PDF_PATH = "video-production/invoice_pdf_sheet.png"

def create_base_canvas(bg_color=(11, 15, 23), grid=True):
    img = Image.new("RGB", (1920, 1080), bg_color)
    d = ImageDraw.Draw(img)

    if grid:
        # Subtle financial ledger grid lines
        for y in range(0, 1080, 48):
            d.line([(0, y), (1920, y)], fill=(18, 26, 40), width=1)
        for x in range(0, 1920, 48):
            d.line([(x, 0), (x, 1080)], fill=(18, 26, 40), width=1)

    # Soft vignette gradient around borders
    return img

def draw_top_chapter_header(img, chapter_text, title_text, category_badge="INVOICEPILOT FINANCIAL SUITE"):
    d = ImageDraw.Draw(img)
    # Top banner bar
    d.rectangle([0, 0, 1920, 72], fill=(8, 12, 18))
    d.line([(0, 72), (1920, 72)], fill=(30, 41, 59), width=1)

    # Left Category Pill
    d.rounded_rectangle([48, 16, 260, 52], radius=4, fill=(15, 23, 42), outline=(56, 189, 248), width=1)
    d.text((154, 34), category_badge, font=font_badge_11, fill=(56, 189, 248), anchor="mm")

    # Center Chapter & Title
    d.text((960, 26), chapter_text, font=font_badge_12, fill=(148, 163, 184), anchor="mm")
    d.text((960, 50), title_text, font=font_title_24, fill=(240, 246, 252), anchor="mm")

    # Right Prototype Disclosure
    d.rounded_rectangle([1620, 16, 1872, 52], radius=4, fill=(235, 0, 41, 40), outline=(235, 0, 41), width=1)
    d.text((1746, 34), "HACKATHON PROTOTYPE", font=font_badge_11, fill=(255, 255, 255), anchor="mm")

def draw_bottom_callout_bar(img, icon_text, headline_text, detail_text, border_color=(56, 189, 248)):
    d = ImageDraw.Draw(img)
    d.rectangle([0, 1008, 1920, 1080], fill=(8, 12, 18))
    d.line([(0, 1008), (1920, 1008)], fill=(30, 41, 59), width=1)

    # Indicator pill
    d.rounded_rectangle([48, 1022, 180, 1064], radius=4, fill=(15, 23, 42), outline=border_color, width=1)
    d.text((114, 1043), icon_text, font=font_badge_12, fill=border_color, anchor="mm")

    d.text((204, 1034), headline_text, font=font_subtitle_20, fill=(240, 246, 252))
    d.text((204, 1058), detail_text, font=font_body_14, fill=(148, 163, 184))

def composite_browser_frame(base_img, screenshot_path, target_box=(96, 100, 1824, 980), title_url="https://invoicepilot-beryl.vercel.app"):
    x0, y0, x1, y1 = target_box
    d = ImageDraw.Draw(base_img)

    # Browser window header
    d.rounded_rectangle([x0, y0, x1, y1], radius=8, fill=(18, 24, 34), outline=(51, 65, 85), width=1)
    d.rectangle([x0, y0 + 36, x1, y1], fill=(15, 20, 28))

    # Window controls (traffic lights)
    d.ellipse([x0 + 16, y0 + 12, x0 + 26, y0 + 22], fill=(239, 68, 68))
    d.ellipse([x0 + 34, y0 + 12, x0 + 44, y0 + 22], fill=(245, 158, 11))
    d.ellipse([x0 + 52, y0 + 12, x0 + 62, y0 + 22], fill=(16, 185, 129))

    # URL bar
    d.rounded_rectangle([x0 + 80, y0 + 8, x1 - 80, y0 + 28], radius=4, fill=(11, 15, 23), outline=(30, 41, 59), width=1)
    d.text(((x0 + x1) // 2, y0 + 18), title_url, font=font_mono_12, fill=(148, 163, 184), anchor="mm")

    # Paste screenshot inside viewport
    if os.path.exists(screenshot_path):
        sc_img = Image.open(screenshot_path)
        viewport_w = x1 - x0
        viewport_h = y1 - (y0 + 36)
        sc_resized = sc_img.resize((viewport_w, viewport_h), Image.Resampling.LANCZOS)
        base_img.paste(sc_resized, (x0, y0 + 36))

    return base_img

# ==========================================
# 1. SCENE 1: OPENING & OFFICIAL PAYPAL BRANDING (12.0s)
# ==========================================
def render_scene1_opening():
    img = create_base_canvas(bg_color=(9, 13, 20), grid=True)
    d = ImageDraw.Draw(img)

    # Top Official PayPal Badge
    if os.path.exists(PAYPAL_BADGE_PATH):
        badge = Image.open(PAYPAL_BADGE_PATH)
        img.paste(badge, (960 - badge.width // 2, 80), badge if badge.mode == 'RGBA' else None)

    # Main Display Title
    d.text((960, 240), "INVOICEPILOT", font=font_display_56, fill=(255, 255, 255), anchor="mm")
    d.text((960, 305), "AI-POWERED FINANCIAL OPERATIONS", font=font_title_24, fill=(56, 189, 248), anchor="mm")

    # Core Invariant Ribbon
    d.rounded_rectangle([360, 360, 1560, 420], radius=6, fill=(15, 23, 42), outline=(51, 65, 85), width=1)
    d.text((960, 390), "AI PREPARES.  •  HUMANS APPROVE.  •  THE BACKEND VALIDATES.  •  PAYPAL PROCESSES.", font=font_subtitle_20, fill=(240, 246, 252), anchor="mm")

    # 3 Feature Pillars Cards
    cards = [
        ("01 / CONSTRAINED AI", "Structured JSON Schema parsing\nCatalog client grounding\nZero autonomous billing"),
        ("02 / HUMAN APPROVAL GATE", "Cryptographic SHA-256 payload lock\nServer-enforced state transitions\nExplicit manual authorization"),
        ("03 / PAYPAL SANDBOX V2", "Official REST API Invoicing v2\nLive draft dispatch & buyer URLs\nSignature-verified webhooks")
    ]
    for idx, (head, body) in enumerate(cards):
        cx = 240 + idx * 520
        d.rounded_rectangle([cx, 460, cx + 440, 680], radius=8, fill=(15, 21, 32), outline=(30, 41, 59), width=1)
        d.line([(cx, 515), (cx + 440, 515)], fill=(30, 41, 59), width=1)
        d.text((cx + 24, 488), head, font=font_subtitle_20, fill=(56, 189, 248))
        d.text((cx + 24, 540), body, font=font_body_16, fill=(203, 213, 225), spacing=8)

    # Disclosure Banner
    d.rounded_rectangle([420, 730, 1500, 810], radius=6, fill=(18, 12, 16), outline=(235, 0, 41), width=1)
    d.text((960, 755), "A WORKING HACKATHON PROTOTYPE", font=font_subtitle_20, fill=(255, 255, 255), anchor="mm")
    d.text((960, 785), "Demonstrating AI-assisted invoicing, human approval gates and PayPal Sandbox REST integration.", font=font_body_16, fill=(203, 213, 225), anchor="mm")

    # Links footer
    d.text((960, 860), "https://invoicepilot-beryl.vercel.app  •  github.com/KhaleelxRahman/InvoicePilot", font=font_mono_14, fill=(148, 163, 184), anchor="mm")

    out = os.path.join(SLIDES_DIR, "01_opening.png")
    img.save(out)
    print("Saved:", out)

# ==========================================
# 2. SCENE 2: PROBLEM & SOLUTION (13.0s)
# ==========================================
def render_scene2_problem():
    img = create_base_canvas(bg_color=(11, 15, 23), grid=True)
    draw_top_chapter_header(img, "MARKET PROBLEM & ARCHITECTURAL SOLUTION", "Why Autonomous Financial AI Fails Freelancers")

    d = ImageDraw.Draw(img)

    cards = [
        ("THE MANUAL BURDEN", (239, 68, 68), [
            "• 6+ uncompensated hours lost weekly chasing invoices",
            "• Manual line-item and sales tax calculations",
            "• Disorganized email follow-ups & fragmented history",
            "• Delayed cashflow and unpredictable collections"
        ]),
        ("THE AUTONOMOUS AI RISK", (245, 158, 11), [
            "• Black-box AI executing transactions without review",
            "• Hallucinated invoice amounts, clients, or payment terms",
            "• Inability to inspect state transitions before sending",
            "• Catastrophic financial errors with zero accountability"
        ]),
        ("THE INVOICEPILOT INVARIANT", (16, 185, 129), [
            "• AI structures natural text into strict schema drafts",
            "• Cryptographic SHA-256 Paper Approval Slip gate",
            "• Human review required before PayPal Sandbox dispatch",
            "• Deterministic integer arithmetic: 0 rounding errors"
        ])
    ]

    for idx, (title, color, bullets) in enumerate(cards):
        cx = 96 + idx * 590
        d.rounded_rectangle([cx, 140, cx + 550, 780], radius=8, fill=(14, 20, 30), outline=color, width=1)
        d.rectangle([cx, 140, cx + 550, 210], fill=(18, 26, 40))
        d.line([(cx, 210), (cx + 550, 210)], fill=color, width=2)
        d.text((cx + 30, 175), title, font=font_subtitle_20, fill=color)

        y_pos = 260
        for b in bullets:
            d.text((cx + 30, y_pos), b, font=font_body_16, fill=(240, 246, 252))
            y_pos += 64

    draw_bottom_callout_bar(img, "CORE PRINCIPLE", "Human-in-the-Loop Financial Control", "AI prepares proposals, but only human authorization executes actions through PayPal Sandbox.")

    out = os.path.join(SLIDES_DIR, "02_problem_solution.png")
    img.save(out)
    print("Saved:", out)

# ==========================================
# 3. SCENE 3: LOGIN & ONBOARDING (18.0s)
# ==========================================
def render_scene3_login():
    # 3A: Start page
    img_a = create_base_canvas(bg_color=(10, 14, 22), grid=False)
    draw_top_chapter_header(img_a, "STEP 01 • APPLICATION ENTRY", "Live Start Page: Authentication & Mode Selection")
    composite_browser_frame(img_a, "live-walkthrough-screenshots/01-start-page.png", target_box=(96, 100, 1824, 980), title_url="https://invoicepilot-beryl.vercel.app/")
    draw_bottom_callout_bar(img_a, "ENTRY POINT", "Secure Scrypt Session Authentication", "Freelancers authenticate, select PayPal Sandbox environment, and verify system health.", border_color=(16, 185, 129))
    out_a = os.path.join(SLIDES_DIR, "03a_start_page.png")
    img_a.save(out_a)
    print("Saved:", out_a)

    # 3B: Registration Form
    img_b = create_base_canvas(bg_color=(10, 14, 22), grid=False)
    draw_top_chapter_header(img_b, "STEP 01 • ONBOARDING", "Business Setup & Tenant Workspace Initialization")
    composite_browser_frame(img_b, "live-walkthrough-screenshots/02-registration-form.png", target_box=(96, 100, 1824, 980), title_url="https://invoicepilot-beryl.vercel.app/#register")
    draw_bottom_callout_bar(img_b, "ONBOARDING", "Tenant Scoping & Business Configuration", "Automatic initialization of isolated client catalog, invoice templates, and payment terms.", border_color=(56, 189, 248))
    out_b = os.path.join(SLIDES_DIR, "03b_registration.png")
    img_b.save(out_b)
    print("Saved:", out_b)

# ==========================================
# 4. SCENE 4: DASHBOARD & CLIENTS (17.0s)
# ==========================================
def render_scene4_dashboard():
    # 4A: Overview Dashboard
    img_a = create_base_canvas(bg_color=(10, 14, 22), grid=False)
    draw_top_chapter_header(img_a, "STEP 02 • OPERATIONAL DASHBOARD", "Real-Time Revenue Metrics, Aging Buckets & Forecasts")
    composite_browser_frame(img_a, "live-walkthrough-screenshots/13-overview-screen.png", target_box=(96, 100, 1824, 980), title_url="https://invoicepilot-beryl.vercel.app/#overview")
    draw_bottom_callout_bar(img_a, "DASHBOARD", "Live Database Aggregation in Minor Units", "Real-time receivables, 30/60/90-day aging buckets, and collection projections without floating-point errors.", border_color=(16, 185, 129))
    out_a = os.path.join(SLIDES_DIR, "04a_dashboard.png")
    img_a.save(out_a)
    print("Saved:", out_a)

    # 4B: Client Management
    img_b = create_base_canvas(bg_color=(10, 14, 22), grid=False)
    draw_top_chapter_header(img_b, "STEP 03 • CLIENT CATALOG", "Tenant-Isolated Client Records & Contact Profiles")
    composite_browser_frame(img_b, "live-walkthrough-screenshots/06-client-created.png", target_box=(96, 100, 1824, 980), title_url="https://invoicepilot-beryl.vercel.app/#clients")
    draw_bottom_callout_bar(img_b, "CLIENT DATA", "Strict Tenant Isolation & Catalog Grounding", "Client identities are verified in database catalog; Gemini resolves exclusively against these records.", border_color=(56, 189, 248))
    out_b = os.path.join(SLIDES_DIR, "04b_clients.png")
    img_b.save(out_b)
    print("Saved:", out_b)

# ==========================================
# 5. SCENE 5: INVOICE CREATION (22.0s)
# ==========================================
def render_scene5_invoices():
    # 5A: Invoice Draft Form
    img_a = create_base_canvas(bg_color=(10, 14, 22), grid=False)
    draw_top_chapter_header(img_a, "STEP 04 • CONVENTIONAL INVOICING", "Multi-Line Item Builder, Pricing & Dynamic Tax Calculations")
    composite_browser_frame(img_a, "live-walkthrough-screenshots/07-invoice-draft-form.png", target_box=(96, 100, 1824, 980), title_url="https://invoicepilot-beryl.vercel.app/#invoices-new")
    draw_bottom_callout_bar(img_a, "PRECISION MATH", "Server-Enforced Integer Minor Units", "Line items, quantities, and sales tax computed in exact cents with zero floating-point drift.", border_color=(16, 185, 129))
    out_a = os.path.join(SLIDES_DIR, "05a_invoice_form.png")
    img_a.save(out_a)
    print("Saved:", out_a)

    # 5B: Saved Invoice Details
    img_b = create_base_canvas(bg_color=(10, 14, 22), grid=False)
    draw_top_chapter_header(img_b, "STEP 04 • INVOICE DETAILS", "Saved Invoice State, Item Breakdown & PDF Download Action")
    composite_browser_frame(img_b, "live-walkthrough-screenshots/08-invoice-saved-detail.png", target_box=(96, 100, 1824, 980), title_url="https://invoicepilot-beryl.vercel.app/#invoices-detail")
    draw_bottom_callout_bar(img_b, "DRAFT STATE", "Local Draft Created & Pre-Validated", "Invoice saved to database. Ready for human review before any external dispatch.", border_color=(56, 189, 248))
    out_b = os.path.join(SLIDES_DIR, "05b_invoice_detail.png")
    img_b.save(out_b)
    print("Saved:", out_b)

# ==========================================
# 6. SCENE 6: GEMINI AI COPILOT (18.0s)
# ==========================================
def render_scene6_gemini():
    img = create_base_canvas(bg_color=(10, 14, 22), grid=False)
    draw_top_chapter_header(img, "STEP 05 • GEMINI AI COPILOT", "Natural Language Invoice Parsing into Strict Schema Proposals")
    composite_browser_frame(img, "live-walkthrough-screenshots/14-ai-assistant.png", target_box=(96, 100, 1824, 980), title_url="https://invoicepilot-beryl.vercel.app/#agent")
    draw_bottom_callout_bar(img, "AI BOUNDARY", "AI Proposes Structured JSON Schema Only", "Gemini resolves client names against stored catalog; conventional form fallback if API is unavailable.", border_color=(168, 85, 247))
    out = os.path.join(SLIDES_DIR, "06_gemini_copilot.png")
    img.save(out)
    print("Saved:", out)

# ==========================================
# 7. SCENE 7: APPROVAL SLIP GATE (17.0s)
# ==========================================
def render_scene7_approval():
    img = create_base_canvas(bg_color=(10, 14, 22), grid=False)
    draw_top_chapter_header(img, "STEP 06 • HUMAN APPROVAL GATE", "Signature Paper Approval Slip with SHA-256 Payload Locking")
    composite_browser_frame(img, "live-walkthrough-screenshots/12-paper-approval-slip.png", target_box=(96, 100, 1824, 980), title_url="https://invoicepilot-beryl.vercel.app/#approval-slip")
    draw_bottom_callout_bar(img, "ZERO-TRUST GATE", "Backend Enforces Explicit User Signoff", "Execution blocked until user verifies amounts, currency, and line items. AI cannot bypass this check.", border_color=(235, 0, 41))
    out = os.path.join(SLIDES_DIR, "07_approval_slip.png")
    img.save(out)
    print("Saved:", out)

# ==========================================
# 8. SCENE 8: PAYPAL SANDBOX INTEGRATION (17.0s)
# ==========================================
def render_scene8_paypal():
    # 8A: PayPal Settings
    img_a = create_base_canvas(bg_color=(10, 14, 22), grid=False)
    draw_top_chapter_header(img_a, "STEP 07 • PAYPAL SANDBOX REST API", "Live Sandbox OAuth, Invoicing v2 Configuration & Credentials")
    composite_browser_frame(img_a, "live-walkthrough-screenshots/18-settings-paypal.png", target_box=(96, 100, 1824, 980), title_url="https://invoicepilot-beryl.vercel.app/#settings-paypal")
    draw_bottom_callout_bar(img_a, "SANDBOX ONLY", "PayPal Sandbox Environment — No Live Money", "Configured strictly for PayPal Sandbox testing with explicit sandbox credentials and webhook listener.", border_color=(0, 121, 193))
    out_a = os.path.join(SLIDES_DIR, "08a_paypal_settings.png")
    img_a.save(out_a)
    print("Saved:", out_a)

    # 8B: PayPal Verification Proof
    img_b = create_base_canvas(bg_color=(10, 14, 22), grid=False)
    draw_top_chapter_header(img_b, "STEP 07 • DISPATCH & EVIDENCE", "PayPal Invoicing REST API v2 Dispatch & External Payment Link")
    composite_browser_frame(img_b, "docs/assets/screenshots/11-paypal-sandbox-settings.png", target_box=(96, 100, 1824, 980), title_url="https://invoicepilot-beryl.vercel.app/#paypal-proof")
    draw_bottom_callout_bar(img_b, "EXTERNAL CHECKOUT", "PayPal Returns Verified Invoicing ID & Buyer URL", "Recipient payment link generated: sandbox.paypal.com/invoice/p/#... Buyer checkout occurs externally.", border_color=(0, 121, 193))
    out_b = os.path.join(SLIDES_DIR, "08b_paypal_proof.png")
    img_b.save(out_b)
    print("Saved:", out_b)

# ==========================================
# 9. SCENE 9: PDF & REPORTING (11.0s)
# ==========================================
def render_scene9_pdf():
    # 9A: Invoice PDF Sheet
    img_a = create_base_canvas(bg_color=(9, 13, 20), grid=True)
    draw_top_chapter_header(img_a, "STEP 08 • GENERATED INVOICE PDF", "Standardized ISO 32000-1 PDF 1.4 Document Output")

    # Paste PDF sheet
    if os.path.exists(INVOICE_PDF_PATH):
        pdf_img = Image.open(INVOICE_PDF_PATH)
        # Resize to fit nicely
        target_h = 800
        target_w = int(pdf_img.width * (target_h / pdf_img.height))
        pdf_resized = pdf_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        img_a.paste(pdf_resized, (960 - target_w // 2, 140))

    draw_bottom_callout_bar(img_a, "PDF OUTPUT", "Pure TypeScript PDF 1.4 Generator", "Zero external dependencies. Note: Displayed draft details are subject to PayPal Sandbox checkout.", border_color=(56, 189, 248))
    out_a = os.path.join(SLIDES_DIR, "09a_invoice_pdf.png")
    img_a.save(out_a)
    print("Saved:", out_a)

    # 9B: Activity Log
    img_b = create_base_canvas(bg_color=(10, 14, 22), grid=False)
    draw_top_chapter_header(img_b, "STEP 09 • AUDIT TRAIL & ACTIVITY LEDGER", "Append-Only Audit History, Webhook Events & Status Log")
    composite_browser_frame(img_b, "live-walkthrough-screenshots/15-activity-log.png", target_box=(96, 100, 1824, 980), title_url="https://invoicepilot-beryl.vercel.app/#activity")
    draw_bottom_callout_bar(img_b, "AUDIT TRAIL", "Immutable Event History & Webhook Verification", "Every invoice creation, approval state change, and webhook arrival recorded chronologically.", border_color=(16, 185, 129))
    out_b = os.path.join(SLIDES_DIR, "09b_activity_log.png")
    img_b.save(out_b)
    print("Saved:", out_b)

# ==========================================
# 10. SCENE 10: ARCHITECTURE & ENGINEERING (17.0s)
# ==========================================
def render_scene10_architecture():
    img = create_base_canvas(bg_color=(7, 16, 30), grid=True)
    draw_top_chapter_header(img, "ENGINEERING FOUNDATION & CODEBASE RIGOR", "Zero-Trust 7-Tier Architecture & Automated Verification Evidence")

    d = ImageDraw.Draw(img)

    # Left Column: 7 Architecture Layers
    layers = [
        ("LAYER 1: PRESENTATION", "React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons"),
        ("LAYER 2: APPLICATION API", "Hardened Node.js Express 4 + Scrypt Auth + Integer Minor Units"),
        ("LAYER 3: DATABASE & TENANCY", "Supabase PostgreSQL with Row Level Security (RLS) Isolation"),
        ("LAYER 4: AI COPILOT", "Google Gemini 3.8 Flash with Strict Zod Schema Parsing"),
        ("LAYER 5: HUMAN APPROVAL", "Cryptographic SHA-256 Paper Approval Slip State Machine"),
        ("LAYER 6: PAYPAL GATEWAY", "PayPal REST API v2 Invoicing (OAuth Bearer, Draft, Send)"),
        ("LAYER 7: RECONCILIATION", "Signature Verification (PAYPAL-TRANSMISSION-SIG) & Idempotency")
    ]

    for idx, (title, desc) in enumerate(layers):
        y = 120 + idx * 72
        d.rounded_rectangle([96, y, 1140, y + 60], radius=6, fill=(12, 22, 38), outline=(56, 189, 248), width=1)
        d.text((120, y + 20), title, font=font_subtitle_20, fill=(56, 189, 248))
        d.text((420, y + 22), desc, font=font_body_16, fill=(240, 246, 252))

    # Right Column: Automated Verification Evidence
    # Card 1: Vitest
    d.rounded_rectangle([1200, 120, 1824, 400], radius=8, fill=(14, 24, 42), outline=(16, 185, 129), width=2)
    d.text((1230, 150), "157 AUTOMATED VITEST TESTS", font=font_title_24, fill=(16, 185, 129))
    d.text((1230, 185), "100% PASSING • UNIT & INTEGRATION SUITE", font=font_badge_12, fill=(148, 163, 184))
    vitest_details = [
        "✓ scrypt session token & password hashing",
        "✓ Deterministic integer minor-unit arithmetic",
        "✓ Multi-tenant data & client isolation",
        "✓ Paper Approval Slip state transitions",
        "✓ PayPal REST API error mapping & retry logic"
    ]
    y_v = 220
    for vd in vitest_details:
        d.text((1230, y_v), vd, font=font_body_16, fill=(240, 246, 252))
        y_v += 32

    # Card 2: Playwright
    d.rounded_rectangle([1200, 440, 1824, 720], radius=8, fill=(14, 24, 42), outline=(56, 189, 248), width=2)
    d.text((1230, 470), "36 PLAYWRIGHT E2E BROWSER TESTS", font=font_title_24, fill=(56, 189, 248))
    d.text((1230, 505), "100% PASSING • CHROMIUM & MOBILE SAFARI", font=font_badge_12, fill=(148, 163, 184))
    pw_details = [
        "✓ Start page authentication & registration flow",
        "✓ Live dashboard metrics & aging buckets",
        "✓ Invoice drafting, line items & calculation",
        "✓ Real Gemini copilot prompt processing",
        "✓ Paper Approval Slip signoff & PayPal send",
        "✓ Responsive mobile 360px viewport tests"
    ]
    y_p = 535
    for pd in pw_details:
        d.text((1230, y_p), pd, font=font_body_16, fill=(240, 246, 252))
        y_p += 28

    draw_bottom_callout_bar(img, "ZERO-TRUST PIPELINE", "Verified Source Code & Testing Rigor", "Validated against real deployed endpoints. Zero client-side private credentials.", border_color=(16, 185, 129))

    out = os.path.join(SLIDES_DIR, "10_architecture.png")
    img.save(out)
    print("Saved:", out)

# ==========================================
# 11. SCENE 11: CONCLUSION & THANK YOU (14.0s)
# ==========================================
def render_scene11_conclusion():
    img = create_base_canvas(bg_color=(9, 13, 20), grid=True)
    d = ImageDraw.Draw(img)

    # Official PayPal Badge
    if os.path.exists(PAYPAL_BADGE_PATH):
        badge = Image.open(PAYPAL_BADGE_PATH)
        img.paste(badge, (960 - badge.width // 2, 70), badge if badge.mode == 'RGBA' else None)

    d.text((960, 210), "INVOICEPILOT", font=font_display_56, fill=(255, 255, 255), anchor="mm")
    d.text((960, 275), "LESS MANUAL INVOICING.  MORE INTELLIGENT WORKFLOWS.", font=font_title_24, fill=(56, 189, 248), anchor="mm")

    # Invariant statement
    d.rounded_rectangle([320, 320, 1600, 380], radius=6, fill=(15, 23, 42), outline=(51, 65, 85), width=1)
    d.text((960, 350), "AI PROPOSES.  •  HUMANS DECIDE.  •  THE BACKEND VALIDATES.  •  PAYPAL PROCESSES.", font=font_subtitle_20, fill=(240, 246, 252), anchor="mm")

    # Prototype Disclosure Card
    d.rounded_rectangle([420, 420, 1500, 490], radius=6, fill=(18, 12, 16), outline=(235, 0, 41), width=1)
    d.text((960, 442), "A WORKING HACKATHON PROTOTYPE", font=font_subtitle_20, fill=(255, 255, 255), anchor="mm")
    d.text((960, 468), "Built for the PayPal AI Hackathon 2026 • PayPal Sandbox Integration Only", font=font_body_16, fill=(203, 213, 225), anchor="mm")

    # Dual Verified Links Glass Cards
    # Left: Repo
    d.rounded_rectangle([360, 530, 930, 640], radius=8, fill=(15, 21, 32), outline=(56, 189, 248), width=1)
    d.text((645, 560), "VERIFIED GITHUB REPOSITORY", font=font_badge_12, fill=(148, 163, 184), anchor="mm")
    d.text((645, 595), "github.com/KhaleelxRahman/InvoicePilot", font=font_mono_14, fill=(255, 255, 255), anchor="mm")

    # Right: Live Demo
    d.rounded_rectangle([990, 530, 1560, 640], radius=8, fill=(15, 21, 32), outline=(16, 185, 129), width=1)
    d.text((1275, 560), "LIVE VERIFIED WEB APPLICATION", font=font_badge_12, fill=(148, 163, 184), anchor="mm")
    d.text((1275, 595), "invoicepilot-beryl.vercel.app", font=font_mono_14, fill=(255, 255, 255), anchor="mm")

    # Thank You Banner
    d.text((960, 720), "THANK YOU FOR WATCHING", font=font_display_42, fill=(255, 255, 255), anchor="mm")
    d.text((960, 770), "PayPal AI Hackathon 2026 Submission", font=font_subtitle_20, fill=(148, 163, 184), anchor="mm")

    out = os.path.join(SLIDES_DIR, "11_conclusion.png")
    img.save(out)
    print("Saved:", out)

if __name__ == "__main__":
    render_scene1_opening()
    render_scene2_problem()
    render_scene3_login()
    render_scene4_dashboard()
    render_scene5_invoices()
    render_scene6_gemini()
    render_scene7_approval()
    render_scene8_paypal()
    render_scene9_pdf()
    render_scene10_architecture()
    render_scene11_conclusion()
    print("All 11 scene slide assets successfully generated in:", SLIDES_DIR)
