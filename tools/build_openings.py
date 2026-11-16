"""Convierte los TSV de lichess-org/chess-openings (CC0) a data/openings.json,
traduciendo al español los nombres más habituales.
Uso: python tools/build_openings.py
"""
import json
import re

FAMILIES = {
    "Sicilian Defense": "Defensa Siciliana",
    "French Defense": "Defensa Francesa",
    "Caro-Kann Defense": "Defensa Caro-Kann",
    "Italian Game": "Apertura Italiana",
    "Ruy Lopez": "Apertura Española",
    "Queen's Gambit Declined": "Gambito de Dama rehusado",
    "Queen's Gambit Accepted": "Gambito de Dama aceptado",
    "Queen's Gambit": "Gambito de Dama",
    "King's Gambit Accepted": "Gambito de Rey aceptado",
    "King's Gambit Declined": "Gambito de Rey rehusado",
    "King's Gambit": "Gambito de Rey",
    "Scotch Game": "Apertura Escocesa",
    "Scotch Gambit": "Gambito Escocés",
    "Four Knights Game": "Partida de los cuatro caballos",
    "Three Knights Opening": "Apertura de los tres caballos",
    "Petrov's Defense": "Defensa Petrov",
    "Russian Game": "Defensa Petrov",
    "Philidor Defense": "Defensa Philidor",
    "Pirc Defense": "Defensa Pirc",
    "Modern Defense": "Defensa Moderna",
    "Alekhine Defense": "Defensa Alekhine",
    "Scandinavian Defense": "Defensa Escandinava",
    "English Opening": "Apertura Inglesa",
    "Réti Opening": "Apertura Réti",
    "London System": "Sistema Londres",
    "King's Indian Defense": "Defensa India de Rey",
    "King's Indian Attack": "Ataque Indio de Rey",
    "Queen's Indian Defense": "Defensa India de Dama",
    "Nimzo-Indian Defense": "Defensa Nimzoindia",
    "Bogo-Indian Defense": "Defensa Bogoindia",
    "Old Indian Defense": "Defensa India Antigua",
    "Indian Defense": "Defensa India",
    "Grünfeld Defense": "Defensa Grünfeld",
    "Semi-Slav Defense": "Defensa Semieslava",
    "Slav Defense": "Defensa Eslava",
    "Dutch Defense": "Defensa Holandesa",
    "Benoni Defense": "Defensa Benoni",
    "Benko Gambit": "Gambito Benko",
    "Catalan Opening": "Apertura Catalana",
    "Vienna Game": "Partida Vienesa",
    "Vienna Gambit": "Gambito Vienés",
    "Bishop's Opening": "Apertura de Alfil",
    "Center Game": "Partida del Centro",
    "Danish Gambit": "Gambito Danés",
    "Evans Gambit": "Gambito Evans",
    "Two Knights Defense": "Defensa de los dos caballos",
    "Hungarian Opening": "Apertura Húngara",
    "Owen Defense": "Defensa Owen",
    "Nimzowitsch Defense": "Defensa Nimzowitsch",
    "Bird Opening": "Apertura Bird",
    "Trompowsky Attack": "Ataque Trompowsky",
    "Queen's Pawn Game": "Partida de peón de dama",
    "King's Pawn Game": "Partida de peón de rey",
    "Englund Gambit": "Gambito Englund",
    "Elephant Gambit": "Gambito Elefante",
    "Latvian Gambit": "Gambito Letón",
    "Ponziani Opening": "Apertura Ponziani",
    "Polish Opening": "Apertura Polaca",
    "Grob Opening": "Apertura Grob",
    "Nimzo-Larsen Attack": "Ataque Nimzo-Larsen",
    "Colle System": "Sistema Colle",
    "Blackmar-Diemer Gambit": "Gambito Blackmar-Diemer",
    "Torre Attack": "Ataque Torre",
    "Budapest Defense": "Defensa Budapest",
    "Zukertort Opening": "Apertura Zukertort",
    "Tarrasch Defense": "Defensa Tarrasch",
    "Albin Countergambit": "Contragambito Albin",
    "Chigorin Defense": "Defensa Chigorin",
    "Rapport-Jobava System": "Sistema Rapport-Jobava",
    "Van't Kruijs Opening": "Apertura Van't Kruijs",
    "Mieses Opening": "Apertura Mieses",
    "Englund": "Englund",
    "Giuoco Piano": "Giuoco Piano",
    "Stonewall Attack": "Ataque Stonewall",
    "Lion Defense": "Defensa León",
    "Czech Defense": "Defensa Checa",
    "Mexican Defense": "Defensa Mexicana",
    "Hippopotamus Defense": "Defensa Hipopótamo",
    "Rat Defense": "Defensa Rata",
    "St. George Defense": "Defensa San Jorge",
    "Kangaroo Defense": "Defensa Canguro",
    "Horwitz Defense": "Defensa Horwitz",
    "Ware Defense": "Defensa Ware",
    "Center Game Accepted": "Partida del Centro",
}

WORDS = {
    "Main Line": "Línea principal",
    "Exchange": "del Cambio",
    "Advance": "del Avance",
    "Classical": "Clásica",
    "Modern": "Moderna",
    "Accepted": "aceptado",
    "Declined": "rehusado",
    "Attack": "Ataque",
    "Gambit": "Gambito",
    "Countergambit": "Contragambito",
    "Defense": "Defensa",
    "System": "Sistema",
    "Line": "Línea",
    "Deferred": "diferida",
    "Closed": "Cerrada",
    "Open": "Abierta",
    "Fianchetto": "Fianchetto",
    "Normal": "Normal",
    "Countergambit": "Contragambito",
}


def translate(name):
    parts = name.split(":", 1)
    fam = parts[0].strip()
    fam_es = FAMILIES.get(fam, fam)
    if len(parts) == 1:
        return fam_es
    rest = []
    for chunk in parts[1].split(","):
        c = chunk.strip()
        m = re.match(r"^(.*)\s+Variation$", c)
        if m:
            inner = m.group(1)
            for en, es in WORDS.items():
                inner = re.sub(rf"\b{re.escape(en)}\b", es, inner)
            c = "Variante " + inner
        else:
            for en, es in WORDS.items():
                c = re.sub(rf"\b{re.escape(en)}\b", es, c)
        rest.append(c)
    return fam_es + ": " + ", ".join(rest)


out = []
for letter in "abcde":
    with open(f"tools/{letter}.tsv", encoding="utf-8") as f:
        next(f)
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            eco, name, pgn = line.split("\t")
            moves = [t for t in pgn.split() if not re.match(r"^\d+\.+$", t)]
            out.append([eco, translate(name), " ".join(moves)])

with open("data/openings.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(len(out), "aperturas")
print(out[0], out[1000], out[2000])
