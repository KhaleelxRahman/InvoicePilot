import os
import subprocess
import json

FFMPEG = r"C:\Users\KhaleelLocal\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe"
FFPROBE = r"C:\Users\KhaleelLocal\AppData\Local\Microsoft\WinGet\Links\ffprobe.exe"

SLIDES_DIR = "video-production/audit_slides"
TEMP_DIR = "video-production/audit_temp"
os.makedirs(TEMP_DIR, exist_ok=True)

clips_spec = [
    ("sc01_opening", os.path.join(SLIDES_DIR, "01_opening.png"), 12.0),
    ("sc02_problem", os.path.join(SLIDES_DIR, "02_problem_solution.png"), 13.0),
    ("sc03a_start_page", os.path.join(SLIDES_DIR, "03a_start_page.png"), 9.0),
    ("sc03b_registration", os.path.join(SLIDES_DIR, "03b_registration.png"), 9.0),
    ("sc04a_dashboard", os.path.join(SLIDES_DIR, "04a_dashboard.png"), 8.5),
    ("sc04b_clients", os.path.join(SLIDES_DIR, "04b_clients.png"), 8.5),
    ("sc05a_invoice_form", os.path.join(SLIDES_DIR, "05a_invoice_form.png"), 11.0),
    ("sc05b_invoice_detail", os.path.join(SLIDES_DIR, "05b_invoice_detail.png"), 11.0),
    ("sc06_gemini", os.path.join(SLIDES_DIR, "06_gemini_copilot.png"), 18.0),
    ("sc07_approval", os.path.join(SLIDES_DIR, "07_approval_slip.png"), 17.0),
    ("sc08a_paypal_settings", os.path.join(SLIDES_DIR, "08a_paypal_settings.png"), 8.5),
    ("sc08b_paypal_proof", os.path.join(SLIDES_DIR, "08b_paypal_proof.png"), 8.5),
    ("sc09a_invoice_pdf", os.path.join(SLIDES_DIR, "09a_invoice_pdf.png"), 5.5),
    ("sc09b_activity_log", os.path.join(SLIDES_DIR, "09b_activity_log.png"), 5.5),
    ("sc10_architecture", os.path.join(SLIDES_DIR, "10_architecture.png"), 17.0),
    ("sc11_conclusion", os.path.join(SLIDES_DIR, "11_conclusion.png"), 14.0)
]

total_film_dur = sum(c[2] for c in clips_spec)
print(f"Total Video Target Runtime: {total_film_dur:.3f}s (Target: 176.000s)\n")

rendered_clips = []
for name, img_path, dur in clips_spec:
    out_mp4 = os.path.join(TEMP_DIR, f"{name}.mp4")
    cmd = [
        FFMPEG, "-y",
        "-loop", "1",
        "-i", img_path,
        "-t", f"{dur:.3f}",
        "-vf", "scale=1920:1080,format=yuv420p",
        "-r", "30",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
        "-an",
        out_mp4
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    rendered_clips.append(out_mp4)
    print(f"  Rendered clip {name}: {dur:.3f}s")

# Concatenate all video clips
concat_txt = os.path.join(TEMP_DIR, "audit_master_concat.txt")
with open(concat_txt, "w") as f:
    for c in rendered_clips:
        safe_path = os.path.abspath(c).replace('\\', '/')
        f.write(f"file '{safe_path}'\n")

print("\n=== Concatenating Video Track ===")
video_only_mp4 = os.path.join(TEMP_DIR, "audit_video_only_176s.mp4")
cmd_concat = [
    FFMPEG, "-y",
    "-f", "concat", "-safe", "0",
    "-i", concat_txt,
    "-c:v", "copy",
    video_only_mp4
]
subprocess.run(cmd_concat, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

probe_v = [
    FFPROBE, "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", video_only_mp4
]
v_dur = float(subprocess.check_output(probe_v).decode().strip())
print(f"Master Video Track Duration: {v_dur:.6f}s")

# Multiplex with master audio track
print("\n=== Multiplexing Audio & Video into Final Master ===")
master_audio_wav = "video-production/audit_audio/master_audit_audio_176s.wav"
final_master_mp4 = "video-production/InvoicePilot_Judge_Cinematic_Demo_2m56.mp4"

cmd_mux = [
    FFMPEG, "-y",
    "-i", video_only_mp4,
    "-i", master_audio_wav,
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "256k",
    "-ar", "48000",
    "-ac", "2",
    "-movflags", "+faststart",
    "-shortest",
    final_master_mp4
]
subprocess.run(cmd_mux, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

probe_final = [
    FFPROBE, "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", final_master_mp4
]
final_dur = float(subprocess.check_output(probe_final).decode().strip())
print(f"\nSUCCESS! Master Hackathon Demo Video Created at: {final_master_mp4}")
print(f"Final Verified Runtime: {final_dur:.6f}s")
