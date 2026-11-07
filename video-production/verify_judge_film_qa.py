import subprocess
import json
import os

FFPROBE = r"C:\Users\KhaleelLocal\AppData\Local\Microsoft\WinGet\Links\ffprobe.exe"
FFMPEG = r"C:\Users\KhaleelLocal\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe"
VIDEO_FILE = r"video-production\InvoicePilot_Judge_Cinematic_Demo_2m56.mp4"

def verify_film():
    print(f"=== VERIFYING FINAL REBUILT MASTER FILM: {VIDEO_FILE} ===\n")

    # 1. Probe Streams & Format
    cmd = [
        FFPROBE, "-v", "quiet", "-print_format", "json",
        "-show_format", "-show_streams", VIDEO_FILE
    ]
    res = subprocess.check_output(cmd).decode()
    data = json.loads(res)

    fmt = data["format"]
    total_dur = float(fmt["duration"])
    size_mb = int(fmt["size"]) / (1024 * 1024)
    bitrate_kbps = int(fmt["bit_rate"]) / 1000

    print(f"File Size: {size_mb:.2f} MB")
    print(f"Overall Bitrate: {bitrate_kbps:.1f} kbps")
    print(f"Total Duration: {total_dur:.6f} seconds (Target: 176.000000s, Delta: {abs(total_dur - 176.0):.6f}s)")

    v_stream = next(s for s in data["streams"] if s["codec_type"] == "video")
    a_stream = next(s for s in data["streams"] if s["codec_type"] == "audio")

    print(f"\nVideo Stream:")
    print(f"  Codec: {v_stream['codec_name']} ({v_stream['profile']})")
    print(f"  Resolution: {v_stream['width']}x{v_stream['height']}")
    print(f"  Framerate: {eval(v_stream['r_frame_rate']):.2f} fps")
    print(f"  Pixel Format: {v_stream['pix_fmt']}")

    print(f"\nAudio Stream:")
    print(f"  Codec: {a_stream['codec_name']}")
    print(f"  Sample Rate: {a_stream['sample_rate']} Hz")
    print(f"  Channels: {a_stream['channels']} ({a_stream['channel_layout']})")
    print(f"  Bitrate: {int(a_stream.get('bit_rate', 0)) / 1000:.1f} kbps")

    # 2. Overall EBU R128 Loudness
    print("\n=== EBU R128 INTEGRATED LOUDNESS MEASUREMENT ===")
    cmd_loud = [
        FFMPEG, "-i", VIDEO_FILE,
        "-filter_complex", "ebur128=peak=true",
        "-f", "null", "-"
    ]
    p = subprocess.run(cmd_loud, capture_output=True, text=True)
    for line in p.stderr.splitlines():
        if any(k in line for k in ["Integrated loudness", "Loudness range", "True peak", "Threshold"]):
            print(" ", line.strip())

    # 3. Scene by Scene Audio Level Check (volumedetect)
    print("\n=== SCENE-BY-SCENE AUDIBILITY & LEVEL AUDIT ===")
    scenes = [
        ("Scene 01 (00:00 - 00:12) Opening & PayPal Badge", 0.0, 12.0),
        ("Scene 02 (00:12 - 00:25) Problem & Solution", 12.0, 13.0),
        ("Scene 03 (00:25 - 00:43) Login & Onboarding", 25.0, 18.0),
        ("Scene 04 (00:43 - 01:00) Dashboard & Clients", 43.0, 17.0),
        ("Scene 05 (01:00 - 01:22) Conventional Invoicing", 60.0, 22.0),
        ("Scene 06 (01:22 - 01:40) Gemini Copilot Assistant", 82.0, 18.0),
        ("Scene 07 (01:40 - 01:57) Approval Slip Gate", 100.0, 17.0),
        ("Scene 08 (01:57 - 02:14) PayPal Sandbox Integration", 117.0, 17.0),
        ("Scene 09 (02:14 - 02:25) PDF & Activity Ledger", 134.0, 11.0),
        ("Scene 10 (02:25 - 02:42) Architecture & Testing Evidence", 145.0, 17.0),
        ("Scene 11 (02:42 - 02:56) Conclusion & Thank You", 162.0, 14.0)
    ]

    all_scenes_pass = True
    for name, start, dur in scenes:
        cmd_scene = [
            FFMPEG, "-ss", str(start), "-i", VIDEO_FILE,
            "-t", str(dur),
            "-af", "volumedetect",
            "-f", "null", "-"
        ]
        proc = subprocess.run(cmd_scene, capture_output=True, text=True)
        mean_v = "N/A"
        max_v = "N/A"
        for l in proc.stderr.splitlines():
            if "mean_volume:" in l:
                mean_v = l.split("mean_volume:")[-1].strip()
            elif "max_volume:" in l:
                max_v = l.split("max_volume:")[-1].strip()

        is_audible = False
        try:
            mean_f = float(mean_v.replace("dB", "").strip())
            if -30.0 <= mean_f <= -10.0:
                is_audible = True
        except:
            pass

        status = "PASS (Audible & Balanced)" if is_audible else "FAIL"
        if not is_audible:
            all_scenes_pass = False
        print(f"  {name}: Mean = {mean_v}, Peak = {max_v} -> {status}")

    print(f"\nAll 11 Scenes Audibility Verification: {'100% PASS' if all_scenes_pass else 'FAIL'}")

if __name__ == "__main__":
    verify_film()
