# Kullanım: python tools/voice.py "Ranking the highest jumps." public/vo/highest-jumps.wav
# Erkek "joe" Piper sesi (CC0, npm: vowel-lab-voices-float). İlk çalıştırmada tools/voice/ içine kurar.
import json, os, subprocess, sys
D = os.path.join(os.path.dirname(__file__), "voice")
M, C = f"{D}/joe.onnx", f"{D}/joe.onnx.json"
if not os.path.exists(M):
    os.makedirs(D, exist_ok=True)
    subprocess.run("npm pack -s vowel-lab-voices-float >/dev/null && tar xzf vowel-lab-voices-float-*.tgz "
                   "&& mv package/float.onnx joe.onnx && rm -rf package *.tgz", shell=True, cwd=D, check=True)
if not os.path.exists(C):
    from piper.phoneme_ids import DEFAULT_PHONEME_ID_MAP
    json.dump({"audio": {"sample_rate": 22050}, "espeak": {"voice": "en-us"}, "phoneme_type": "espeak",
               "num_symbols": 256, "num_speakers": 1, "phoneme_id_map": DEFAULT_PHONEME_ID_MAP,
               "inference": {"noise_scale": 0.6, "length_scale": 1.0, "noise_w": 0.7}}, open(C, "w"))
text, out = sys.argv[1], sys.argv[2]
os.makedirs(os.path.dirname(out), exist_ok=True)
raw = out + ".raw.wav"
subprocess.run([sys.executable, "-m", "piper", "-m", M, "-c", C, "--length-scale", "1.08", "-f", raw],
               input=text, text=True, check=True, capture_output=True)
# anons tonu: biraz kalın, sıkıştırılmış, hafif yankı
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af",
    "asetrate=22050*0.92,aresample=48000,atempo=1.04,bass=g=4:f=120,"
    "acompressor=threshold=-20dB:ratio=4:attack=5:release=80,aecho=0.8:0.5:45|90:0.18|0.08,"
    "loudnorm=I=-14:TP=-1:LRA=7", "-ar", "48000", out], check=True)
os.remove(raw)
print(out, subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out],
                          capture_output=True, text=True).stdout.strip())
