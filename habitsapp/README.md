# auramaxx – dein Lifemaxxing-Tracker

Eine App für Self-Improvement im Stil vom TikTok-Trend **Lifemaxxing**. Du dokumentierst jeden Tag, was du für dich tust: Habits, Essen, Training, Schlaf, Stimmung und Fortschrittsfotos. Dafür sammelst du **Aura**. 100 Aura am Tag heißt: Tag gemaxxt.

## Funktionen

**Heute**
- Day-Counter („Day 1“, „Day 2“ …) und ein Aura-Ring mit Tagesziel
- Serie: wie viele Tage am Stück du etwas dokumentiert hast
- Schnell-Buttons für Essen, Wasser, Training, Check-in und Foto
- Check-in mit Stimmung, Energie, Schlaf, „Win des Tages“ und Journal
- „Dein Log“: alles, was du an dem Tag eingetragen hast, als Zeitleiste
- **Tageskarte für TikTok**: ein Bild im Story-Format (1080 × 1920) mit deinen Werten, zum Teilen oder Speichern

**Habits**
- Eigene Habits mit Emoji, Ziel, Bereich (Body, Mind, Focus, Glow-up, Social) und 1–7 Tagen pro Woche
- Serien in Tagen oder Wochen, Wochenbalken zum Nachtragen vergessener Tage
- 13 fertige Lifemaxxing-Ideen zum Antippen (Kalt duschen, 10k Schritte, Handy weg …)

**Essen**
- Wasser-Tracker mit Gläsern
- Mahlzeiten mit Uhrzeit, Protein, optionalen Kalorien und Tags (Gemüse/Obst, selbst gekocht …)
- „Schnell wieder eintragen“ für Mahlzeiten, die du öfter isst
- Proteinziel und Rückblick auf die letzten 7 Tage

**Training**
- Kraft, Laufen, Cardio, Sport, Mobility, Spaziergang
- Übungen mit Sätzen, Wiederholungen und Gewicht
- Neue Bestleistungen (PRs) werden automatisch erkannt und gefeiert
- Wochenziel und Minuten pro Tag als Diagramm

**Fortschritt**
- 8 Level von „NPC“ bis „Legende“
- Konstanz-Heatmap der letzten 12 Wochen
- Stimmung und Schlaf der letzten 14 Tage im Diagramm
- Glow-up-Fotos mit Vorher/Nachher-Vergleich (Day X vs. Day Y)
- Alle Wins und Journal-Einträge gesammelt

**Sonstiges**
- Installierbar als App auf dem Handy (PWA) und offline nutzbar
- Dunkler und heller Modus
- Backup als Datei exportieren und wieder importieren
- Alle Daten bleiben auf dem Gerät. Es gibt keinen Server und keinen Account.

## Barrierefreiheit

- Alle Buttons haben Beschriftungen für Screenreader, Statusmeldungen werden angesagt
- Große Touch-Ziele (mindestens 44 px), gut lesbare Kontraste in beiden Modi
- Komplett per Tastatur bedienbar, sichtbarer Fokus
- Respektiert „Bewegung reduzieren“ und den Modus „Hoher Kontrast“
- Informationen hängen nie nur an Farben (Häkchen, Muster, Text)

## Aura-Punkte

| Aktion | Aura |
| --- | --- |
| Habit erledigt | 10 |
| Mahlzeit eingetragen (max. 6 pro Tag) | 5 |
| Glas Wasser (bis zum Ziel) | 2 |
| Training (max. 2 pro Tag) | 25 |
| Check-in (Stimmung) | 10 |
| Win des Tages oder Journal | 10 |
| Fortschrittsfoto (1 pro Tag) | 15 |

## Starten

Die App braucht keinen Build-Schritt. Am einfachsten über GitHub Pages:

1. Im Repo auf **Settings → Pages** gehen
2. Bei „Source“ **Deploy from a branch** wählen, Branch `main`, Ordner `/ (root)`
3. Nach ein bis zwei Minuten läuft die App unter `https://<dein-name>.github.io/<repo>/habitsapp/`
4. Auf dem Handy öffnen und „Zum Home-Bildschirm hinzufügen“ wählen

Lokal testen: im Ordner `habitsapp` den Befehl `python3 -m http.server` ausführen und `http://localhost:8000` öffnen.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `index.html` | Grundgerüst, Navigation und alle Dialoge |
| `styles.css` | Design, Farben, heller und dunkler Modus |
| `app.js` | Die ganze Logik: Daten, Aura, Ansichten, Tageskarte |
| `sw.js` | Service Worker für die Offline-Nutzung |
| `manifest.webmanifest` | App-Name und Icons für die Installation |
| `icons/` | App-Icons |

Wenn du Dateien änderst, erhöhe in `sw.js` die Versionsnummer (`auramaxx-v1` → `auramaxx-v2`), damit installierte Apps das Update bekommen.
