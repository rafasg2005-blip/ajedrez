"""Extrae una muestra de problemas de la base pública de Lichess (licencia CC0).

Descarga en streaming lichess_db_puzzle.csv.zst y se detiene en cuanto tiene
suficientes problemas por tramo de dificultad, así que no baja el archivo entero.
Uso: python tools/build_puzzles.py
"""
import csv
import io
import json
import sys
import urllib.request
from compression import zstd

URL = "https://database.lichess.org/lichess_db_puzzle.csv.zst"
OUT = "data/puzzles.json"
MIN_R, MAX_R, STEP = 400, 2700, 100
CAP = 1500          # problemas por tramo de 100 puntos
MAX_ROWS = 3_000_000

buckets = {r: [] for r in range(MIN_R, MAX_R, STEP)}


def full():
    return all(len(v) >= CAP for v in buckets.values())


req = urllib.request.Request(URL, headers={"User-Agent": "ajedrez-local/1.0"})
with urllib.request.urlopen(req) as resp:
    stream = zstd.ZstdFile(resp)
    text = io.TextIOWrapper(stream, encoding="utf-8", newline="")
    reader = csv.reader(text)
    header = next(reader)
    rows = 0
    for row in reader:
        rows += 1
        pid, fen, moves, rating, rd, pop, plays, themes = row[:8]
        rating, rd, pop, plays = int(rating), int(rd), int(pop), int(plays)
        if rd > 90 or pop < 80 or plays < 300:
            continue
        b = (rating // STEP) * STEP
        if b < MIN_R:
            b = MIN_R
        if b not in buckets or len(buckets[b]) >= CAP:
            continue
        buckets[b].append([pid, fen, moves, rating, themes])
        if rows % 100_000 == 0:
            print(rows, sum(len(v) for v in buckets.values()), flush=True)
        if full() or rows >= MAX_ROWS:
            break

allp = [p for v in buckets.values() for p in v]
allp.sort(key=lambda p: p[3])
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(allp, f, separators=(",", ":"))
print("filas leídas:", rows, "problemas:", len(allp))
for b, v in buckets.items():
    print(b, len(v))
