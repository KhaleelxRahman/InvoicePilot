import asyncio
import edge_tts
import os
import subprocess
import json

SCENES = [
    {
        "id": "scene1",
        "title": "Premium Opening & PayPal Hackathon Branding",
        "target_dur": 12.0,
        "text": "Welcome to InvoicePilot, a working prototype built for the PayPal AI Hackathon 2026. This is intelligent financial operations with absolute human control."
    },
    {
        "id": "scene2",
        "title": "Problem & Solution",
        "target_dur": 13.0,
        "text": "Freelancers lose hours to manual invoicing, while autonomous AI creates financial risk. InvoicePilot introduces human control: AI prepares, humans approve, and PayPal transacts."
    },
    {
        "id": "scene3",
        "title": "Login & Onboarding",
        "target_dur": 18.0,
        "text": "Every journey begins at the live start page. Freelancers authenticate securely via scrypt sessions, complete business onboarding, and configure payment preferences before entering the workspace."
    },
    {
        "id": "scene4",
        "title": "Dashboard & Clients",
        "target_dur": 17.0,
        "text": "The dashboard aggregates live account data: total receivables, aging buckets, and collection forecasts. In client management, users maintain verified client profiles scoped strictly to their account."
    },
    {
        "id": "scene5",
        "title": "Invoice Creation",
        "target_dur": 22.0,
        "text": "Here is conventional invoice creation. Users draft multi-line items with instant tax calculations. All financial amounts are tracked in integer minor units, completely preventing floating-point rounding errors."
    },
    {
        "id": "scene6",
        "title": "Gemini AI Assistant",
        "target_dur": 18.0,
        "text": "With our Gemini copilot, natural language requests are converted into structured schema outputs. Gemini resolves client identities exclusively against stored records—it never invents clients, and never executes autonomously."
    },
    {
        "id": "scene7",
        "title": "Approval & Validation",
        "target_dur": 17.0,
        "text": "Before any invoice leaves the system, it halts at the Paper Approval Slip. The backend generates a SHA-256 payload hash and locks execution until the user manually signs off."
    },
    {
        "id": "scene8",
        "title": "PayPal Sandbox Integration",
        "target_dur": 17.0,
        "text": "Approved invoices dispatch directly to the PayPal Sandbox Invoicing API, generating real buyer payment links. Notice this is strictly a test sandbox environment—no live money is ever moved."
    },
    {
        "id": "scene9",
        "title": "PDF & Reporting",
        "target_dur": 11.0,
        "text": "Users can instantly download a standardized PDF invoice, while the append-only activity log records every lifecycle transition and webhook event."
    },
    {
        "id": "scene10",
        "title": "Architecture & Engineering Evidence",
        "target_dur": 17.0,
        "text": "Our zero-trust architecture spans React 19, Express, Supabase PostgreSQL, and PayPal REST APIs, validated by one hundred fifty-seven Vitest unit tests and thirty-six Playwright browser tests."
    },
    {
        "id": "scene11",
        "title": "Conclusion & Thank You",
        "target_dur": 14.0,
        "text": "AI proposes, humans decide, and PayPal processes. Inspect our verified GitHub repository, or test the live demo today. Thank you for watching."
    }
]

VOICE = "en-US-ChristopherNeural"
RATE = "+6%"
PITCH = "+0Hz"
FFPROBE = r"C:\Users\KhaleelLocal\AppData\Local\Microsoft\WinGet\Links\ffprobe.exe"

async def generate():
    out_dir = "video-production/audit_audio"
    os.makedirs(out_dir, exist_ok=True)

    results = []
    total_speech = 0.0
    total_target = sum(s["target_dur"] for s in SCENES)

    print(f"Target Total Duration: {total_target:.1f}s (02:56.000)\n")

    for sc in SCENES:
        out_file = os.path.join(out_dir, f"{sc['id']}.mp3")
        communicate = edge_tts.Communicate(sc["text"], VOICE, rate=RATE, pitch=PITCH)
        await communicate.save(out_file)

        cmd = [
            FFPROBE, "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", out_file
        ]
        dur = float(subprocess.check_output(cmd).decode().strip())
        headroom = sc["target_dur"] - dur
        total_speech += dur
        results.append({
            "id": sc["id"],
            "title": sc["title"],
            "target_dur": sc["target_dur"],
            "speech_dur": dur,
            "headroom": headroom
        })
        print(f"{sc['id']} ({sc['title']}): speech={dur:.2f}s, target={sc['target_dur']:.1f}s, breathing_room=+{headroom:.2f}s")

    print(f"\nTotal Speech Duration: {total_speech:.2f}s across {total_target:.1f}s total target runtime.")
    with open(os.path.join(out_dir, "speech_durations.json"), "w") as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    asyncio.run(generate())
