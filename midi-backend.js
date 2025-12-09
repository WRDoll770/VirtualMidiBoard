
const fs = require('fs');
const midi = require('midi');
const WebSocket = require('ws');
const config = require('./config');

// Datei für persistente MIDI-Output-Werte
const MIDI_STATE_FILE = 'midi-output-state.json';

// Lese gespeicherte MIDI-Output-Werte aus json
function loadMidiOutputState() {
  if (fs.existsSync(MIDI_STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(MIDI_STATE_FILE, 'utf8'));
    } catch (e) { return {}; }
  }
  return {};
}

// Schreibe MIDI-Output-Werte
function saveMidiOutputState(state) {
  fs.writeFileSync(MIDI_STATE_FILE, JSON.stringify(state, null, 2));
}

// Initialisiere State
let midiOutputState = loadMidiOutputState();

const SETTINGS_FILE = 'midi-settings.json';


let input = new midi.Input();
let output = new midi.Output();
let inputPort = null;
let outputPort = null;
let midiInputHandler = null;

function listMidiPorts() {
  // Erzeuge temporäre MIDI-Objekte, um Duplikate zu vermeiden
  const tempInput = new midi.Input();
  const tempOutput = new midi.Output();
  const inputs = [];
  const outputs = [];
  for (let i = 0; i < tempInput.getPortCount(); i++) {
    inputs.push({ index: i, name: tempInput.getPortName(i) });
  }
  for (let i = 0; i < tempOutput.getPortCount(); i++) {
    outputs.push({ index: i, name: tempOutput.getPortName(i) });
  }
  tempInput.closePort && tempInput.closePort();
  tempOutput.closePort && tempOutput.closePort();
  return { inputs, outputs };
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

function loadSettings() {
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    } catch (e) { return {}; }
  }
  return {};
}


function openMidiPorts(inputIdx, outputIdx) {
  // Alte Instanzen schließen und dereferenzieren
  if (input && input.isPortOpen()) input.closePort();
  if (output && output.isPortOpen()) output.closePort();
  // Standard-Zuordnung: output = MIDI Output (sendet an Hardware), input = MIDI Input (empfängt von Hardware)
  output = new midi.Output();
  input = new midi.Input(); 
  inputPort = inputIdx;
  outputPort = outputIdx;
  // Handler neu registrieren
  if (midiInputHandler) input.removeListener('message', midiInputHandler);
  if (inputPort !== null && inputPort >= 0 && inputPort < input.getPortCount()) {
    input.openPort(inputPort);
    midiInputHandler = (deltaTime, message) => {
      // Speichere NUR Hardware-MIDI-Input-Events im State
      if (Array.isArray(message) && message.length >= 2) {
        const [status, cc, value] = message;
        const key = status + ',' + cc;
        midiOutputState[key] = { status, cc, value };
        saveMidiOutputState(midiOutputState);
      }
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'midiIn', bytes: message, deltaTime }));
        }
      });
    };
    input.on('message', midiInputHandler);
  }
  if (outputPort !== null && outputPort >= 0 && outputPort < output.getPortCount()) {
    output.openPort(outputPort);
    // Sende Debug-Signal zum Syncen mit zb ShowCockpit (0x9F 0x7F 0x7F)
    try {
      output.sendMessage([0x9F, 0x7F, 0x7F]);
    } catch (e) {
      console.error('Fehler beim Senden des Debug-MIDI-Signals:', e);
    }
  }
}

// Initialisiere mit gespeicherten Einstellungen oder Standard (erstes Gerät)
let settings = loadSettings();
const midiPorts = listMidiPorts();
if (settings.inputPort === undefined) settings.inputPort = midiPorts.inputs[0]?.index ?? 0;
if (settings.outputPort === undefined) settings.outputPort = midiPorts.outputs[0]?.index ?? 0;
openMidiPorts(settings.inputPort, settings.outputPort);


// WebSocket-Server starten
const wss = new WebSocket.Server({ port: config.backend_port });

function timestamp() {
  const now = new Date();
  // Format wie: [Tue Dec  2 15:42:32 2025] (php format)
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day = days[now.getDay()];
  const month = months[now.getMonth()];
  const date = now.getDate();
  const datePad = date < 10 ? ' ' + date : date;
  const time = now.toTimeString().split(' ')[0];
  const year = now.getFullYear();
  const dateStr = `${day} ${month} ${datePad} ${time} ${year}`;
  return dateStr;
}
wss.on('connection', ws => {
  const dateStr = timestamp();
  const green = '\x1b[32m';
  const reset = '\x1b[0m';
  console.log(`[${dateStr}] ${green}Backend: Frontend verbunden${reset}`);

  ws.send(JSON.stringify({
    type: 'midiPortList',
    inputs: listMidiPorts().inputs,
    outputs: listMidiPorts().outputs,
    selectedInput: settings.inputPort,
    selectedOutput: settings.outputPort
  }));

  // Sende alle gespeicherten MIDI-Input-States an neuen Client, damit UI synchronisiert wird
  Object.values(midiOutputState).forEach(entry => {
    if (entry && typeof entry.status === 'number' && typeof entry.cc === 'number' && typeof entry.value === 'number') {
      ws.send(JSON.stringify({ type: 'midiIn', bytes: [entry.status, entry.cc, entry.value], deltaTime: 0 }));
    }
  });

  ws.on('message', message => {
    try {
      const data = JSON.parse(message);
      // State-Sync: relay requestState and syncState between clients
      if (data.type === 'requestState') {
        // Sende alle gespeicherten MIDI-Output-Werte an den Client
        ws.send(JSON.stringify({ type: 'allMidiOutputState', state: midiOutputState }));
        // Relay an andere Clients wie gehabt
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'requestState' }));
          }
        });
        return;
      }
      if (data.type === 'syncState') {
        // Relay syncState only to the original requester (the last to join)
        for (const client of wss.clients) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
            break;
          }
        }
        return;
      }
      if (data.type === 'midiOut' && Array.isArray(data.bytes)) {
        // Sende NUR an den als MIDI Input gewählten Port
        output.sendMessage(data.bytes);
        const [status, cc, value] = data.bytes;
        // NICHT speichern! Nur weiterleiten
        // Relay Fader-CCs (53..64) und Button-NoteOn (0x90) an alle anderen Clients
        if ((status & 0xF0) === 0xB0 && (cc >= 53 && cc <= 64)) {
          wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'midiIn', bytes: data.bytes, deltaTime: 0 }));
            }
          });
        }
        // Button: Note On (0x90 auf passendem Channel)
        if ((status & 0xF0) === 0x90) {
          wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'midiIn', bytes: data.bytes, deltaTime: 0 }));
            }
          });
        }
      } else if (data.type === 'selectMidiPorts') {
          // Beim Portwechsel State zurücksetzen
          midiOutputState = {};
          saveMidiOutputState(midiOutputState);
        // Auswahl speichern und Ports neu öffnen
        settings.inputPort = data.inputPort;
        settings.outputPort = data.outputPort;
        saveSettings(settings);
        openMidiPorts(settings.inputPort, settings.outputPort);
        // Bestätigung und neue Portliste an alle Clients senden
        const portListMsg = JSON.stringify({
          type: 'midiPortList',
          inputs: listMidiPorts().inputs,
          outputs: listMidiPorts().outputs,
          selectedInput: settings.inputPort,
          selectedOutput: settings.outputPort
        });
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) client.send(portListMsg);
        });
        // Fordere alle Clients auf, die Seite neu zu laden
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'reloadPage' }));
        });
      }
    } catch (e) {
      console.error('Fehler beim Parsen:', e);
    }
  });
});


console.log(`MIDI-Backend läuft auf Port ${config.backend_port}`);
