"""Озвучивает реплики Бита голосом из content/voice.json (Piper + ISSAI, казахский).

Использование:
  python3 scripts/voice/make_voice.py lines.json out_dir
lines.json: [{"id": "intro_1", "kz": "Сәлем! Мен Битпін."}, ...]  — числа писать словами.
Нужно: pip install piper-tts lameenc. Модель скачивается в ~/.cache/piper при первом запуске.
"""
import json, os, sys, subprocess, urllib.request, wave, lameenc

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
cfg = json.load(open(os.path.join(ROOT, 'content', 'voice.json')))
cache = os.path.expanduser('~/.cache/piper'); os.makedirs(cache, exist_ok=True)
model = os.path.join(cache, cfg['model'] + '.onnx')
for suffix in ('', '.json'):
    if not os.path.exists(model + suffix):
        urllib.request.urlretrieve(cfg['modelUrl'] + suffix, model + suffix)

lines, out = json.load(open(sys.argv[1])), sys.argv[2]
os.makedirs(out, exist_ok=True)
for ln in lines:
    wav = os.path.join(out, ln['id'] + '.wav')
    subprocess.run([sys.executable, '-m', 'piper', '-m', model, '-s', str(cfg['speaker']), '-f', wav],
                   input=ln['kz'].encode(), check=True, stderr=subprocess.DEVNULL)
    w = wave.open(wav); data = w.readframes(w.getnframes()); w.close()
    enc = lameenc.Encoder()
    enc.set_bit_rate(cfg['bitrateKbps']); enc.set_channels(1); enc.set_quality(2)
    # «роботный» Бит: те же сэмплы с чуть большей частотой — голос выше и немного быстрее
    enc.set_in_sample_rate(cfg['robotRate'])
    open(os.path.join(out, ln['id'] + '.mp3'), 'wb').write(enc.encode(data) + enc.flush())
    os.remove(wav)
    print('ok', ln['id'])
