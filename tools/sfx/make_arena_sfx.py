# Sonidos de la arena de destrucción, sintetizados por capas (golpe, cuerpo, cola, reverberación).
# Uso: python3 tools/sfx/make_arena_sfx.py  → assets/sfx/arena/*.mp3
import numpy as np, subprocess, os
from scipy import signal

SR = 44100
rng = np.random.default_rng(7)
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'sfx', 'arena')

def t(d): return np.arange(int(SR * d)) / SR
def noise(d): return rng.uniform(-1, 1, int(SR * d))
def bp(x, lo, hi, o=2): return signal.sosfilt(signal.butter(o, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'highpass', fs=SR, output='sos'), x)
def env(d, a, dec, curve=1.0):
    tt = t(d); e = np.minimum(1, tt / max(a, 1e-4)) * np.exp(-np.maximum(0, tt - a) / dec); return e ** curve
def sweep_lp(x, f0, f1, d):  # filtro paso bajo que se va cerrando (bloques)
    out = np.zeros_like(x); n = len(x); B = 1024
    for i in range(0, n, B):
        f = f0 * (f1 / f0) ** min(1, i / (SR * d)); out[i:i + B] = lp(x[i:i + B] if i == 0 else x[i - 256:i + B], f)[-len(x[i:i + B]):]
    return out
def sine_sweep(f0, f1, d, k=4.0):
    tt = t(d); f = f1 + (f0 - f1) * np.exp(-tt * k); return np.sin(2 * np.pi * np.cumsum(f) / SR)
def pad(x, d): y = np.zeros(int(SR * d)); y[:min(len(x), len(y))] += x[:len(y)]; return y
def mix(*xs):
    n = max(len(x) for x in xs); y = np.zeros(n)
    for x in xs: y[:len(x)] += x
    return y
def reverb(x, dur=1.2, wet=0.25, bright=4000):
    ir = noise(dur) * np.exp(-t(dur) / (dur / 5)); ir = lp(ir, bright); ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    return x + wet * signal.fftconvolve(x, ir)[:len(x) + int(SR * dur)][:len(x)] if False else mix(x, wet * signal.fftconvolve(x, ir))
def sat(x, k=2.0): return np.tanh(x * k) / np.tanh(k)
def norm(x, peak=0.95): return x / (np.max(np.abs(x)) + 1e-9) * peak
def save(name, x, tail_fade=0.05, maxd=None):
    if maxd: x = x[:int(SR * maxd)]; tail_fade = max(tail_fade, 0.12)
    x = norm(x); n = int(SR * tail_fade); x[-n:] *= np.linspace(1, 0, n)
    wav = os.path.join('/tmp', name + '.wav'); import wave
    with wave.open(wav, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype(np.int16).tobytes())
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-ac', '1', '-b:a', '96k', os.path.join(OUT, name + '.mp3')], check=True)
    print(name, round(len(x) / SR, 2), 's')

# ---------- disparo de ametralladora pesada (3 variantes) ----------
def mg_shot(seed):
    r = np.random.default_rng(seed); d = 0.42
    crack = hp(noise(0.006), 2500) * env(0.006, 0.0003, 0.002)
    body = bp(noise(0.12), 180, 2600) * env(0.12, 0.0008, 0.022)
    thump = sine_sweep(110 + r.uniform(-10, 10), 48, 0.12, 30) * env(0.12, 0.001, 0.035) * 0.9
    click = np.sin(2 * np.pi * (2800 + r.uniform(-300, 300)) * t(0.008)) * env(0.008, 0.0002, 0.0025) * 0.25
    tail = lp(noise(d), 1400) * env(d, 0.003, 0.09) * 0.35
    x = mix(pad(crack, d) * 0.9, pad(body, d), pad(thump, d), pad(click, d), tail)
    x = sat(x * 1.6, 2.5)
    return reverb(x, 0.6, 0.18, 3000)
for i in range(3): save(f'mg{i + 1}', mg_shot(i + 3), maxd=0.5)

# ---------- cañón del tanque ----------
d = 1.6
crack = hp(noise(0.01), 1800) * env(0.01, 0.0003, 0.003)
boom = sine_sweep(90, 34, 0.7, 7) * env(0.7, 0.002, 0.18) * 1.2
body = lp(noise(0.5), 2200) * env(0.5, 0.001, 0.07)
rumble = lp(noise(d), 300) * env(d, 0.01, 0.35) * 0.7
save('canon', maxd=2.2, x=reverb(sat(mix(pad(crack, d), pad(boom, d), pad(body, d), rumble) * 1.4, 2.2), 1.4, 0.32, 2000))

# ---------- lanzamiento de cohete ----------
d = 1.5
pop = bp(noise(0.05), 300, 3000) * env(0.05, 0.001, 0.015) * 0.9
hiss = noise(d); am = (0.75 + 0.25 * np.sin(2 * np.pi * 23 * t(d) + rng.uniform(0, 6)))
whoosh = np.zeros(int(SR * d)); B = 2048
for i in range(0, len(whoosh), B):
    f = 500 + 2600 * min(1, i / (SR * 0.35)); whoosh[i:i + B] = bp(hiss[max(0, i - 512):i + B], f * 0.6, f * 1.6)[-len(hiss[i:i + B]):]
whoosh *= env(d, 0.06, 0.45) * am
roar = lp(noise(d), 450) * env(d, 0.03, 0.4) * 0.8
save('cohete', maxd=1.7, x=reverb(sat(mix(pad(pop, d), whoosh * 0.9, roar), 1.8), 0.8, 0.2, 5000))

# ---------- explosión (cohete, bomba, mina, barril) ----------
def explosion(d, size=1.0, seed=1):
    r = np.random.default_rng(seed)
    crack = noise(0.015) * env(0.015, 0.0003, 0.005)
    n = noise(d); body = sweep_lp(n, 5000, 260, 0.9 * size) * env(d, 0.004, 0.35 * size, 1.0)
    sub = sine_sweep(70, 28, d, 5 / size) * env(d, 0.003, 0.3 * size) * 1.3
    rumble = lp(noise(d), 180) * env(d, 0.05, 0.8 * size) * 0.9
    deb = np.zeros(int(SR * d))  # cascotes que caen
    for _ in range(int(40 * size)):
        p = int(SR * (0.15 + r.exponential(0.35 * size)));
        if p >= len(deb) - 600: continue
        g = bp(noise(0.02), 1500, 6000) * env(0.02, 0.0002, 0.004) * r.uniform(0.05, 0.25) * np.exp(-p / SR / (0.8 * size)); deb[p:p + len(g)] += g
    x = mix(pad(crack, d) * 1.2, body * 1.1, sub, rumble, deb)
    return reverb(sat(x * 1.5, 2.6), 1.8 * size, 0.35, 1800)
save('explosion', explosion(2.4, 1.0, 1), maxd=3)
save('explosion2', explosion(2.4, 1.0, 9), maxd=3)

# ---------- vehículo destrozado: explosión grande + chatarra ----------
def metal(d, freqs, dec, seed):
    r = np.random.default_rng(seed); x = np.zeros(int(SR * d))
    for f in freqs: f *= r.uniform(0.93, 1.07); x += np.sin(2 * np.pi * f * t(d) + r.uniform(0, 6)) * env(d, 0.0005, dec * r.uniform(0.6, 1.3)) * r.uniform(0.3, 1) / (1 + f / 2500)
    return x
d = 3.6
big = explosion(d, 1.5, 4)
clang = np.zeros(int(SR * d))
for k, at in enumerate([0.45, 0.8, 1.25, 1.7]):
    m = metal(0.8, [240, 530, 910, 1460, 2210, 3150], 0.18, 20 + k) * 0.25; p = int(SR * at); clang[p:p + len(m)] += m[:len(clang) - p]
save('ko', mix(big, clang), maxd=4.5)

# ---------- choques de metal (embestida y contra paredes) ----------
def crash(d, seed, heavy=1.0):
    r = np.random.default_rng(seed)
    thump = sine_sweep(120, 55, 0.25, 18) * env(0.25, 0.001, 0.06) * heavy
    crunch = bp(noise(0.35), 600, 5000) * env(0.35, 0.001, 0.07) * 0.9
    grind = bp(noise(d), 1500, 7000) * env(d, 0.02, 0.18) * 0.25 * (1 + 0.5 * np.sin(2 * np.pi * 37 * t(d)))
    ring = metal(d, [180, 410, 735, 1170, 1830, 2650, 3900], 0.22, seed) * 0.45
    deb = np.zeros(int(SR * d))
    for _ in range(14):
        p = int(SR * r.uniform(0.05, d * 0.7)); g = bp(noise(0.015), 2000, 8000) * env(0.015, 0.0002, 0.003) * r.uniform(0.05, 0.2); deb[p:p + len(g)] += g[:len(deb) - p]
    x = mix(pad(thump, d), pad(crunch, d), grind, ring, deb)
    return reverb(sat(x * 1.4, 2.2), 0.7, 0.2, 3500)
save('choque', crash(1.1, 3, 1.2), maxd=1.4)
save('choque2', crash(1.1, 8, 1.0), maxd=1.4)
save('golpe', crash(0.7, 12, 0.7), maxd=0.9)

# ---------- lanzallamas ----------
d = 2.6
roar = lp(noise(d), 1100, 4) * 0.8 + bp(noise(d), 250, 600) * 0.6
flutter = 0.7 + 0.3 * lp(rng.uniform(-1, 1, int(SR * d)), 14, 1) * 18
whoof = sweep_lp(noise(0.4), 600, 3500, 0.2) * env(0.4, 0.02, 0.12)
crack = np.zeros(int(SR * d))
for _ in range(60):
    p = int(SR * rng.uniform(0, d - 0.02)); g = hp(noise(0.004), 3000) * rng.uniform(0.05, 0.25); crack[p:p + len(g)] += g
x = mix(pad(whoof, d), roar * np.clip(flutter, 0.3, 1.2) * env(d, 0.12, 9, 1) * np.minimum(1, (d - t(d)) / 0.4), crack)
save('fuego', maxd=2.9, x=reverb(sat(x * 1.3, 1.8), 0.9, 0.2, 4000))

# ---------- onda expansiva (aplastamonstruo, terremoto) ----------
d = 2.4
boom = sine_sweep(60, 24, d, 3) * env(d, 0.004, 0.5) * 1.4
thud = lp(noise(0.3), 400) * env(0.3, 0.001, 0.06)
rumble = lp(noise(d), 120) * env(d, 0.08, 0.9)
dust = bp(noise(d), 800, 3500) * env(d, 0.15, 0.5) * 0.25
gravel = np.zeros(int(SR * d))
for _ in range(80):
    p = int(SR * rng.uniform(0.1, d * 0.8)); g = bp(noise(0.01), 1200, 5000) * env(0.01, 0.0002, 0.003) * rng.uniform(0.03, 0.15); gravel[p:p + len(g)] += g
save('onda', maxd=3, x=reverb(sat(mix(boom, pad(thud, d), rumble, dust, gravel) * 1.6, 2.4), 1.6, 0.3, 1500))

# ---------- caja dorada / poder especial (potencia que sube) ----------
d = 1.3
rise = np.zeros(int(SR * d))
for h, a in [(1, 1), (2, 0.5), (3, 0.3), (4, 0.18)]:
    rise += np.sin(2 * np.pi * np.cumsum(h * (180 + 520 * (t(d) / d) ** 1.5)) / SR) * a
rise = sat(rise * env(d, 0.6, 0.35) * 0.7, 2.0)
hit = sine_sweep(150, 60, 0.4, 10) * env(0.4, 0.001, 0.1)
shine = bp(noise(d), 4000, 9000) * env(d, 0.7, 0.3) * 0.2
save('especial', maxd=1.8, x=reverb(mix(rise, pad(np.zeros(int(SR * 0.62)), 0), np.concatenate([np.zeros(int(SR * 0.62)), hit])[:int(SR * d)], shine), 1.0, 0.3, 6000))

# ================= calibres por vehículo y sonidos extra =================
def gun(seed, low=110, bright=2600, body_dec=0.022, thump=0.9, tail=0.09, click=2800, wet=0.18):
    r = np.random.default_rng(seed); d = 0.5
    crack = hp(noise(0.006), 2500) * env(0.006, 0.0003, 0.002)
    body = bp(noise(0.14), 160, bright) * env(0.14, 0.0008, body_dec)
    th = sine_sweep(low + r.uniform(-8, 8), low * 0.42, 0.14, 30) * env(0.14, 0.001, 0.035 * (110 / low) ** 0.5) * thump
    ck = np.sin(2 * np.pi * (click + r.uniform(-250, 250)) * t(0.008)) * env(0.008, 0.0002, 0.0025) * 0.25
    tl = lp(noise(d), 1400) * env(d, 0.003, tail) * 0.35
    return reverb(sat(mix(pad(crack, d) * 0.9, pad(body, d), pad(th, d), pad(ck, d), tl) * 1.6, 2.5), 0.6, wet, 3000)
# fusil ligero (tipo ametralladora de escuadra): seco, agudo, rápido
for i in range(3): save(f'ligero{i + 1}', gun(30 + i, low=150, bright=4200, body_dec=0.016, thump=0.55, tail=0.06, click=3400), maxd=0.4)
# pesada (calibre .50): grave y con cola
for i in range(3): save(f'pesado{i + 1}', gun(40 + i, low=85, bright=2000, body_dec=0.03, thump=1.25, tail=0.13, click=2200, wet=0.24), maxd=0.6)
# autocañón: golpe muy grave, eco largo
for i in range(2): save(f'autocanon{i + 1}', gun(50 + i, low=62, bright=1600, body_dec=0.05, thump=1.6, tail=0.2, click=1600, wet=0.32), maxd=0.9)

# disparo de plasma, doble ráfaga (el Escorpión)
def zap(f0=1900, f1=260, d=0.16):
    tt = t(d); f = f1 + (f0 - f1) * np.exp(-tt * 28); ph = np.cumsum(f) / SR
    x = np.sin(2 * np.pi * ph + 2.2 * np.sin(2 * np.pi * ph * 2.01)) * env(d, 0.001, 0.05)
    return x + bp(noise(d), 2000, 7000) * env(d, 0.0005, 0.015) * 0.4
for i in range(2):
    d = 0.42; a = zap(1900 + i * 150); b = zap(1750 + i * 150)
    x = np.zeros(int(SR * d)); x[:len(a)] += a; o = int(SR * 0.085); x[o:o + len(b)] += b * 0.9
    save(f'plasma{i + 1}', reverb(sat(x * 1.3, 1.8), 0.5, 0.2, 6000), maxd=0.6)

# caja que se rompe: crujido de madera, golpe y astillas
def crate(seed):
    r = np.random.default_rng(seed); d = 0.8
    knock = sine_sweep(220, 120, 0.12, 25) * env(0.12, 0.001, 0.03)
    snap = np.zeros(int(SR * d))
    for k in range(5):
        p = int(SR * (0.004 + k * r.uniform(0.008, 0.02))); g = bp(noise(0.05), 700, 3800) * env(0.05, 0.0005, 0.012) * r.uniform(0.5, 1); snap[p:p + len(g)] += g
    spl = np.zeros(int(SR * d))
    for _ in range(26):
        p = int(SR * r.uniform(0.05, 0.55)); g = bp(noise(0.02), 1800, 6500) * env(0.02, 0.0002, 0.005) * r.uniform(0.04, 0.2); spl[p:p + len(g)] += g[:len(spl) - p]
    thud = lp(noise(0.25), 500) * env(0.25, 0.002, 0.05) * 0.6
    return reverb(sat(mix(pad(knock, d), snap, spl, pad(thud, d)) * 1.5, 2), 0.5, 0.15, 4000)
save('caja1', crate(61), maxd=0.7); save('caja2', crate(62), maxd=0.7)

# caja dorada: silbido que pasa rapidísimo y chirría (como una nave), y destello
d = 1.2; hiss = noise(d); wz = np.zeros(int(SR * d)); B = 1024
for i in range(0, len(wz), B):
    q = i / len(wz); f = 600 + 7000 * q ** 1.6; wz[i:i + B] = bp(hiss[max(0, i - 256):i + B], f * 0.7, min(f * 1.4, 20000))[-len(hiss[i:i + B]):]
wz *= np.sin(np.pi * np.minimum(1, t(d) / d)) ** 1.5
scr = np.sin(2 * np.pi * np.cumsum(900 + 2600 * (t(d) / d) ** 2) / SR) * env(d, 0.5, 0.25) * 0.25
save('dorada', reverb(sat(mix(wz, scr) * 1.4, 1.6), 0.7, 0.2, 7000), maxd=1.4)

# nitro: encendido de propulsor
d = 1.4; ign = bp(noise(0.08), 200, 3000) * env(0.08, 0.001, 0.02)
roar = sweep_lp(noise(d), 600, 2600, 0.5) * env(d, 0.05, 0.5) + lp(noise(d), 200) * env(d, 0.05, 0.6) * 0.8
save('nitro', reverb(sat(mix(pad(ign, d), roar) * 1.4, 2), 0.6, 0.2, 5000), maxd=1.4)

# bomba lanzada: zumbido de bola de fuego
d = 0.9; fb = noise(d); wh = np.zeros(int(SR * d))
for i in range(0, len(wh), B):
    q = i / len(wh); f = 300 + 1500 * np.sin(np.pi * q); wh[i:i + B] = bp(fb[max(0, i - 256):i + B], f * 0.6, f * 1.6)[-len(fb[i:i + B]):]
save('lanzar', reverb(sat(wh * np.sin(np.pi * t(d) / d) * 1.3, 1.6), 0.5, 0.15, 4000), maxd=1.0)
