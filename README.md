# VirtualMidiBoard – Setup & Usage Guide

# English Version

## Prerequisites

- Node.js (recommended: >= 16.x) (https://nodejs.org/en/download)
- npm (Node Package Manager, usually included with Node.js)
- PHP (for the frontend, recommended: >= 7.4) (https://windows.php.net/download/)

## Installation (Step by Step)

1. **Download/Copy the Project**
   
   Copy all files into a directory of your choice.

2. **Install Backend Dependencies**

   Open a terminal in the project directory and run:
   
   ```bash
   npm install midi ws js-yaml
   ```
   
   - `midi`: For MIDI communication
   - `ws`: For WebSocket communication
   - `js-yaml`: For reading the configuration (config.yaml)

3. **Check Configuration**

   - Adjust `config.yaml` or `config.json` if needed (e.g., ports).

4. **Start Backend and Frontend**

   There are two options:

   **a) Using start.sh (recommended for Mac)**

   The script starts backend and frontend automatically in separate terminals:

   ```bash
   ./start.sh
   ```
   
   **b) Using start.sh (recommended for Windows)**

   The script starts backend and frontend automatically in separate terminals:

   ```bash
   ./start.bat
   ```

   **c) Using start.sh (recommended for Linux)**

   The script starts backend and frontend automatically in separate terminals:

   ```bash
   chmod +x start.sh
   ./start.sh
   ```
   
   **d) Manually (if preferred)**

   - Backend:
     ```bash
     node midi-backend.js
     ```
   - Frontend (in a second terminal):
     ```bash
     php -S 0.0.0.0:4040
     ```
   The frontend will then be available at http://localhost:4040

5. **Open in Browser**

   Go to `http://localhost:4040` in your browser.

6. **Select MIDI Devices**

   Use the web UI to select the desired MIDI input and output ports.

## Notes

- The file `midi-output-state.json` stores the last received MIDI input values.
- The file `midi-settings.json` stores the last selected MIDI ports.
- For network use, make sure to open firewall ports 4040 (frontend) and the backend port (e.g., 8080) if needed.

## Troubleshooting

- Make sure no other application is blocking the desired MIDI ports.
- Check the terminal output for errors.
- If you have MIDI communication issues: restart the backend and the web interface.

---

**Good luck with VirtualMidiBoard!**

# Deutsche Version

## Voraussetzungen

- Node.js (empfohlen: >= 16.x) (https://nodejs.org/en/download)
- npm (Node Package Manager, meist mit Node.js installiert)
- PHP (für das Frontend, empfohlen: >= 7.4) (https://windows.php.net/download/)

## Installation (Schritt für Schritt)

1. **Repository/Projekt herunterladen**
   
   Kopiere alle Dateien in ein Verzeichnis deiner Wahl.

2. **Backend-Abhängigkeiten installieren**

   Öffne ein Terminal im Projektverzeichnis und führe aus:
   
   ```bash
   npm install midi ws js-yaml
   ```
   
   - `midi`: Für die MIDI-Kommunikation
   - `ws`: Für WebSocket-Kommunikation
   - `js-yaml`: Für das Einlesen der Konfiguration (config.yaml)

3. **Konfiguration prüfen**

   - Passe ggf. die Datei `config.yaml` oder `config.json` an (z.B. Ports).


4. **Backend und Frontend starten**

   Es gibt zwei Möglichkeiten:

   **a) Mit start.sh (empfohlen)**

   Das Skript startet Backend und Frontend automatisch in separaten Terminals:

   ```bash
   ./start.sh
   ```

   **b) Mit start.sh (empfohlen)**

   Das Skript startet Backend und Frontend automatisch in separaten Terminals:

   ```bash
   ./start.bat
   ```

   **c) Mit start.sh (empfohlen)**

   Das Skript startet Backend und Frontend automatisch in separaten Terminals:

   ```bash
   chmod +x start.sh
   ./start.sh
   ```

   **b) Manuell (falls gewünscht)**

   - Backend:
     ```bash
     node midi-backend.js
     ```
   - Frontend (in zweitem Terminal):
     ```bash
     php -S 0.0.0.0:4040
     ```
   Das Frontend ist dann unter http://localhost:4040 erreichbar.

6. **Im Browser öffnen**

   Rufe im Browser die Adresse `http://localhost:4040` auf.

7. **MIDI-Geräte auswählen**

   Wähle im Web-UI die gewünschten MIDI-Input- und Output-Ports aus.

## Hinweise

- Die Datei `midi-output-state.json` speichert die letzten empfangenen MIDI-Input-Werte.
- Die Datei `midi-settings.json` speichert die zuletzt gewählten MIDI-Ports.
- Für die Nutzung im Netzwerk ggf. Firewall-Freigaben für die Ports 4040 (Frontend) und den Backend-Port (z.B. 8080) setzen.

## Troubleshooting

- Stelle sicher, dass keine andere Anwendung die gewünschten MIDI-Ports blockiert.
- Prüfe die Konsolenausgaben im Terminal für Fehler.
- Bei Problemen mit der MIDI-Kommunikation: Starte das Backend und die Weboberfläche neu.

---

**Viel Erfolg mit VirtualMidiBoard!**
