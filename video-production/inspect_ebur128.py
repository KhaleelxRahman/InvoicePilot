import subprocess
import json
import os

FFMPEG = r"C:\Users\KhaleelLocal\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe"
FFPROBE = r"C:\Users\KhaleelLocal\AppData\Local\Microsoft\WinGet\Links\ffprobe.exe"
VIDEO = r"video-production\InvoicePilot_Judge_Cinematic_Demo_2m56.mp4"

def inspect():
    cmd_probe = [FFPROBE, "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", VIDEO]
    data = json.loads(subprocess.check_output(cmd_probe).decode())

    print("FORMAT METADATA:")
    fmt = data["format"]
    print(f"  Duration: {float(fmt['duration']):.6f}s")
    print(f"  Size: {int(fmt['size'])} bytes ({int(fmt['size'])/(1024*1024):.2f} MB)")
    print(f"  Bitrate: {int(fmt['bit_rate'])/1000:.1f} kbps")

    for s in data["streams"]:
        stype = s["codec_type"]
        idx = s["index"]
        cname = s["codec_name"]
        print(f"STREAM #{idx} ({stype}): Codec={cname}")
        if stype == "video":
            w, h = s["width"], s["height"]
            r_fps = eval(s["r_frame_rate"])
            nb = s.get("nb_frames", "N/A")
            pix = s["pix_fmt"]
            print(f"  Resolution: {w}x{h}, FPS: {r_fps:.2f}, Frames: {nb}, PixFmt: {pix}")
        elif stype == "audio":
            sr = s["sample_rate"]
            ch = s["channels"]
            br = int(s.get("bit_rate", 0)) / 1000
            print(f"  Sample Rate: {sr} Hz, Channels: {ch}, Bitrate: {br:.1f} kbps")

    print("\nEBU R128 TRUE PEAK & LOUDNESS ANALYSIS:")
    cmd_ebur = [FFMPEG, "-i", VIDEO, "-filter_complex", "ebur128=peak=true", "-f", "null", "-"]
    res = subprocess.run(cmd_ebur, capture_output=True, text=True)
    in_summary = False
    for line in res.stderr.splitlines():
        if "Summary:" in line:
            in_summary = True
        if in_summary:
            print(" ", line.strip())

if __name__ == "__main__":
    inspect()
