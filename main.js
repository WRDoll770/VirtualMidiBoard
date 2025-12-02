const NUM_FADERS = 12;
const NUM_BUTTONS = 44;
const NUM_ENCODERS = 5;

// --- BUTTON BLINK/ON LOGIK ---
const buttonBlinkIntervals = {};
const buttonBlinkStates = {};

// --- WEBSOCKET SETUP ---
let ws = null;
window.addEventListener('load', () => {
    // State-Sync: Nach Verbindungsaufbau anfragen
    window._syncedWithPeers = false;
  // Nutze die Host-IP, damit auch andere Geräte im Netzwerk das Backend erreichen können
  let wsHost = window.location.hostname;
  if (wsHost === 'localhost' || wsHost === '127.0.0.1') wsHost = 'localhost';
  addMidiPortMenus();
  fetch('config.json')
    .then(r => r.json())
    .then(cfg => {
      const port = cfg.backend_port || 8080;
      ws = new WebSocket('ws://' + wsHost + ':' + port);
      ws.onopen = () => {
        // Nach State fragen
        setTimeout(() => ws.send(JSON.stringify({ type: 'requestState' })), 100);
        // Sende MIDI-Sync-Signal an Output um z.b. showcockpit über neue Conns zu informieren
        ws.send(JSON.stringify({ type: 'midiOut', bytes: [0x9F, 0x7F, 0x7F] }));
        const status = document.getElementById('midi-status');
        if (status) status.textContent = 'Verbunden mit Backend';
      };
      ws.onerror = () => {
        const status = document.getElementById('midi-status');
        if (status) status.textContent = 'WebSocket-Fehler';
      };
      ws.onclose = () => {
        const status = document.getElementById('midi-status');
        if (status) status.textContent = 'Verbindung getrennt';
      };
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // State-Sync: Wenn ein neuer Client beitritt, fragt er nach dem aktuellen State
        if (data.type === 'requestState') {
          // Sende aktuellen Fader- und Button-Status an den neuen Client
          const faders = Array.from(document.querySelectorAll('.fader input[type="range"]')).map(f => parseInt(f.value));
          const buttons = Array.from(document.querySelectorAll('.button')).map(b => b.classList.contains('active'));
          ws.send(JSON.stringify({ type: 'syncState', faders, buttons }));
          return;
        }
        if (data.type === 'syncState') {
          // Nur übernehmen, wenn noch nicht synchronisiert z.b. nach Reload nicht überschreiben
          if (!window._syncedWithPeers) {
            if (Array.isArray(data.faders)) {
              const faders = document.querySelectorAll('.fader input[type="range"]');
              data.faders.forEach((val, i) => { if (faders[i]) faders[i].value = val; });
            }
            if (Array.isArray(data.buttons)) {
              const buttons = document.querySelectorAll('.button');
              data.buttons.forEach((on, i) => {
                if (buttons[i]) {
                  buttons[i].classList.toggle('active', !!on);
                  // Wenn der Button im Blink-State war, Blinken wiederherstellen
                  if (on && buttonBlinkIntervals[i] && buttonBlinkIntervals[i]._intervalValue) {
                    startButtonBlink(i, buttonBlinkIntervals[i]._intervalValue);
                  }
                }
              });
            }
            window._syncedWithPeers = true;
          }
          return;
        }
        if (data.type === 'midiPortList') {
          updateMidiPortMenus(data.inputs, data.outputs, data.selectedInput, data.selectedOutput);
          return;
        }
        if (data.type === 'midiIn' && Array.isArray(data.bytes)) {
          handleIncomingMidi(data.bytes);
          return;
        }
        if (data.type === 'reloadPage') {
          location.reload();
          return;
        }
      };
    });
// --- BUTTON BLINK/ON LOGIK ---
const buttonBlinkIntervals = {};
const buttonBlinkStates = {};

function handleIncomingMidi(bytes) {
  //siehe wiki o.ä. für Midi Infos
  const [status, data1, value] = bytes;
  const type = status & 0xF0;

  if (type === 0x90) {
    const note = data1;
    const btnIdx = getButtonIdxByMidi(note);
    console.log('[MIDI] NoteOn empfangen:', {note, value, btnIdx});
    if (btnIdx === null) return;
    const btn = document.querySelectorAll('.button')[btnIdx];
    if (!btn) return;
    if (value >= 121 && value <= 127) {
      stopButtonBlink(btnIdx);
      btn.classList.add('active');
    } else if (value >= 21 && value <= 120) {
      let syncInterval = null;
      for (const idx in buttonBlinkIntervals) {
        if (buttonBlinkIntervals[idx]) {
          syncInterval = buttonBlinkIntervals[idx]._intervalValue;
          break;
        }
      }
      let interval;
      if (syncInterval) {
        interval = syncInterval;
      } else {
        const minHz = 0.5, maxHz = 2;
        const hz = minHz + (maxHz - minHz) * ((value - 21) / 99);
        interval = 1000 / hz / 2;
      }
      startButtonBlink(btnIdx, interval);
    } else {
      stopButtonBlink(btnIdx);
      btn.classList.remove('active');
    }
  } else if (type === 0xB0) {
    const cc = data1;
    // Fader-Sync
    const faderIdx = getFaderIdxByMidi(cc);
    if (faderIdx !== null) {
      const faders = document.querySelectorAll('.fader input[type="range"]');
      const slider = faders[faderIdx];
      if (slider) slider.value = value;
      return;
    }
    if (cc >= 48 && cc <= 52) {
      const encoderIdx = cc - 48;
      const encoderCanvases = document.querySelectorAll('.encoder canvas');
      const canvas = encoderCanvases[encoderIdx];
      if (!canvas) return;
      let angle = canvas._angle || 0;
      if (value === 127) angle += Math.PI/32;
      if (value === 1) angle -= Math.PI/32;
      canvas._angle = angle;
      const ctx = canvas.getContext('2d');
      const size = canvas.width;
      // Redraw
      ctx.clearRect(0,0,size,size);
      ctx.beginPath();
      ctx.arc(size/2, size/2, size/2-3, 0, 2*Math.PI);
      ctx.fillStyle = '#222';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#555';
      ctx.stroke();
      ctx.save();
      ctx.translate(size/2, size/2);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.lineTo(0,-size/2+18);
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#e74c3c';
      ctx.stroke();
      ctx.restore();
      return;
    }
  }
}
function getFaderIdxByMidi(cc) {
  // 60/100mm Fader: 53..62  0..9 (Midi CC wert zu Fader index)
  if (cc >= 53 && cc <= 62) return cc - 53;
  if (cc >= 63 && cc <= 64) return 10 + (cc - 63);
  return null;
}

function getButtonIdxByMidi(note) {
  // Umkehrfunktion zu getButtonMidi
  if (note >= 1 && note <= 10) return note - 1;
  if (note >= 11 && note <= 20) return 10 + (note - 11);
  if (note >= 21 && note <= 30) return 20 + (note - 21);
  if (note >= 31 && note <= 40) return 30 + (note - 31);
  if (note >= 41 && note <= 44) return 40 + (note - 41);
  if (note >= 45 && note <= 47) return 44 + (note - 45);
  return null;
}

function startButtonBlink(idx, interval) {
  stopButtonBlink(idx);
  const btn = document.querySelectorAll('.button')[idx];
  if (!btn) return;
  buttonBlinkStates[idx] = false;
  const blinkInterval = setInterval(() => {
    buttonBlinkStates[idx] = !buttonBlinkStates[idx];
    if (buttonBlinkStates[idx]) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }, interval);
  blinkInterval._intervalValue = interval;
  buttonBlinkIntervals[idx] = blinkInterval;
}

function stopButtonBlink(idx) {
  if (buttonBlinkIntervals[idx]) {
    clearInterval(buttonBlinkIntervals[idx]);
    buttonBlinkIntervals[idx] = null;
  }
  buttonBlinkStates[idx] = false;
}
});

function addMidiPortMenus() {
  let container = document.getElementById('midi-port-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'midi-port-container';
    container.style.margin = '10px 0';
    document.body.insertBefore(container, document.body.firstChild);
  }
  container.innerHTML = `
    <label for="midi-input-select">MIDI Input (Backend -> Frontend):</label>
    <select id="midi-input-select"></select>
    <label for="midi-output-select" style="margin-left:20px;">MIDI Output (Frontend -> Backend):</label>
    <select id="midi-output-select"></select>
  `;
}

function updateMidiPortMenus(inputs, outputs, selectedInput, selectedOutput) {
  const inputSelect = document.getElementById('midi-input-select');
  const outputSelect = document.getElementById('midi-output-select');
  if (!inputSelect || !outputSelect) return;

  inputSelect.innerHTML = '';
  outputs.forEach((port) => {
    const opt = document.createElement('option');
    opt.value = port.index;
    opt.textContent = port.name;
    if (port.index === selectedOutput) opt.selected = true;
    outputSelect.appendChild(opt);
  });
  inputs.forEach((port) => {
    const opt = document.createElement('option');
    opt.value = port.index;
    opt.textContent = port.name;
    if (port.index === selectedInput) opt.selected = true;
    inputSelect.appendChild(opt);
  });

  inputSelect.onchange = () => {
    sendMidiPortSelection();
  };
  outputSelect.onchange = () => {
    sendMidiPortSelection();
  };
}

function sendMidiPortSelection() {
  const inputSelect = document.getElementById('midi-input-select');
  const outputSelect = document.getElementById('midi-output-select');
  if (!inputSelect || !outputSelect) return;
  ws.send(JSON.stringify({
    type: 'selectMidiPorts',
    inputPort: parseInt(inputSelect.value, 10),
    outputPort: parseInt(outputSelect.value, 10)
  }));
}

// --- UI GENERATION ---
window.onload = function() {
  const encoderbank = document.querySelector('.encoderbank');
  const faderbank = document.querySelector('.faderbank');
  const buttonbank = document.querySelector('.buttonbank');

  // --- FADER + ENCODER + BUTTONS ---
  // 10x 60mm fader (mit Encoder oben, 2 Buttons oben/unten), 2x 100mm fader (auf gleicher Höhe wie Encoder, 2 Buttons oben, 3 Buttons unten zentriert)
  let buttonIdx = 0;
  const encoderPositions = [1, 3, 5, 7, 9];
  let encoderIdx = 0;
  for (let i = 0; i < 10; i++) {
    const faderGroup = document.createElement('div');
    faderGroup.className = 'fader-group';
    if (i % 2 === 0 && encoderIdx < 5) {
      const thisEncoderIdx = encoderIdx;
      const enc = document.createElement('div');
      enc.className = 'encoder';
      const label = document.createElement('label');
      label.textContent = 'Enc ' + (thisEncoderIdx+1);
      const size = 120;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.style.cursor = 'pointer';
      let angle = 0;
      let lastAngle = 0;
      let dragging = false;
      function drawKnob() {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,size,size);
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2-3, 0, 2*Math.PI);
        ctx.fillStyle = '#222';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#555';
        ctx.stroke();
        ctx.save();
        ctx.translate(size/2, size/2);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.lineTo(0,-size/2+18);
        ctx.lineWidth = 7;
        ctx.strokeStyle = '#e74c3c';
        ctx.stroke();
        ctx.restore();
      }
      drawKnob();
      function getAngle(x, y) {
        const dx = x - size/2;
        const dy = y - size/2;
        let a = Math.atan2(dx, -dy);
        if (a < 0) a += 2*Math.PI;
        return a;
      }
      canvas.addEventListener('mousedown', (e) => {
        dragging = true;
        lastAngle = getAngle(e.offsetX, e.offsetY);
      });
      window.addEventListener('mouseup', () => { dragging = false; });
      window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const a = getAngle(x, y);
        let diff = a - lastAngle;
        if (diff > Math.PI) diff -= 2*Math.PI;
        if (diff < -Math.PI) diff += 2*Math.PI;
        if (Math.abs(diff) > 0.05) {
          angle += diff;
          drawKnob();
          if (diff > 0) { sendEncoder(thisEncoderIdx, 127); }
          if (diff < 0) { sendEncoder(thisEncoderIdx, 1); }
          lastAngle = a;
        }
      });
      canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          const rect = canvas.getBoundingClientRect();
          const x = e.touches[0].clientX - rect.left;
          const y = e.touches[0].clientY - rect.top;
          dragging = true;
          lastAngle = getAngle(x, y);
        }
      });
      window.addEventListener('touchend', () => { dragging = false; });
      window.addEventListener('touchmove', (e) => {
        if (!dragging || e.touches.length !== 1) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left;
        const y = e.touches[0].clientY - rect.top;
        const a = getAngle(x, y);
        let diff = a - lastAngle;
        if (diff > Math.PI) diff -= 2*Math.PI;
        if (diff < -Math.PI) diff += 2*Math.PI;
        if (Math.abs(diff) > 0.05) {
          angle += diff;
          drawKnob();
          if (diff > 0) { sendEncoder(thisEncoderIdx, 127); }
          if (diff < 0) { sendEncoder(thisEncoderIdx, 1); }
          lastAngle = a;
        }
      });
      enc.appendChild(label);
      enc.appendChild(canvas);
      faderGroup.appendChild(enc);
      encoderIdx++;
    }
    // 2 Buttons oben
    for (let b = 0; b < 2; b++) {
      const btn = createButton(buttonIdx++);
      faderGroup.appendChild(btn);
    }
    // Fader
    const fader = document.createElement('div');
    fader.className = 'fader';
    const flabel = document.createElement('label');
    flabel.textContent = i+1;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 127;
    slider.value = 0;
    slider.oninput = () => sendFader(i, slider.value);
    fader.appendChild(flabel);
    fader.appendChild(slider);
    faderGroup.appendChild(fader);
    for (let b = 0; b < 2; b++) {
      const btn = createButton(buttonIdx++);
      faderGroup.appendChild(btn);
    }
    faderbank.appendChild(faderGroup);
  }
  const tallFaderRow = document.createElement('div');
  tallFaderRow.className = 'tall-fader-row align-top';
  for (let i = 10; i < 12; i++) {
    const faderGroup = document.createElement('div');
    faderGroup.className = 'fader-group';
    for (let b = 0; b < 2; b++) {
      const btn = createButton(buttonIdx++);
      faderGroup.appendChild(btn);
    }
    const fader = document.createElement('div');
    fader.className = 'fader tall';
    const flabel = document.createElement('label');
    flabel.textContent = i+1;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 127;
    slider.value = 0;
    slider.oninput = () => sendFader(i, slider.value);
    fader.appendChild(flabel);
    fader.appendChild(slider);
    faderGroup.appendChild(fader);
    tallFaderRow.appendChild(faderGroup);
  }
  faderbank.appendChild(tallFaderRow);
  const extraBtnCol = document.createElement('div');
  extraBtnCol.className = 'extra-btn-col';
  for (let b = 0; b < 3; b++) {
    const btn = createButton(buttonIdx++);
    extraBtnCol.appendChild(btn);
  }
  faderbank.appendChild(extraBtnCol);
  while (buttonIdx < NUM_BUTTONS) {
    const btn = createButton(buttonIdx++);
    buttonbank.appendChild(btn);
  }
}

function createButton(idx) {
  const btn = document.createElement('button');
  btn.className = 'button';
  const arrowUpIdxs = [3,7,11,15,19,23,27,31,35,39];
  const specialLabels = {
    40: 'SF',
    41: 'Page-',
    42: 'AL',
    43: 'Page+',
    44: 'Pause',
    45: 'Go+',
    46: 'Go-'
  };
  if (arrowUpIdxs.includes(idx)) {
    btn.innerHTML = '&#8593;';
  } else if (specialLabels[idx]) {
    btn.textContent = specialLabels[idx];
  } else {
    btn.innerHTML = '&#9654;';
  }
  // Speichere vorherigen Blink-/Leuchtstatus
  let wasBlinking = false;
  let wasActive = false;
  let isMouseDown = false;
  btn.onmousedown = () => {
    isMouseDown = true;
    wasBlinking = !!buttonBlinkIntervals[idx];
    wasActive = btn.classList.contains('active');
    btn.classList.add('active');
    sendButton(idx, 127);
    if (wasBlinking) stopButtonBlink(idx);
  };
  function restoreButtonState() {
    if (wasBlinking) {
      if (buttonBlinkIntervals[idx] && buttonBlinkIntervals[idx]._intervalValue) {
        startButtonBlink(idx, buttonBlinkIntervals[idx]._intervalValue);
      }
    } else if (wasActive) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
  btn.onmouseup = () => {
    isMouseDown = false;
    sendButton(idx, 0);
    restoreButtonState();
  };
  btn.onmouseleave = () => {
    if (isMouseDown) {
      isMouseDown = false;
      sendButton(idx, 0);
      restoreButtonState();
    }
  };
  return btn;
}

// --- MIDI SEND ---
const MIDI_CHANNEL = 5;

// Button index to MIDI note/CC mapping
function getButtonMidi(idx) {
  // Unterste Reihe (unter 60mm Fader): 0..9 → 1..10
  if (idx >= 0 && idx <= 9) return 1 + idx;
  // Reihe darüber: 10..19 → 11..20
  if (idx >= 10 && idx <= 19) return 11 + (idx - 10);
  // Buttons über 60mm Fadern: 20..29 → 21..30
  if (idx >= 20 && idx <= 29) return 21 + (idx - 20);
  // Buttons über 60mm Fadern: 30..39 → 31..40
  if (idx >= 30 && idx <= 39) return 31 + (idx - 30);
  // Über 100mm Fader: 40..43 → 41..44
  if (idx >= 40 && idx <= 43) return 41 + (idx - 40);
  // Unter 100mm Fader: 44..46 → 45..47
  if (idx >= 44 && idx <= 46) return 45 + (idx - 44);
  return 0;
}

function getEncoderMidi(idx) {
  // Jeder Encoder bekommt einen eigenen Controller (z.B. 53, 54, 55, 56, 57)
  return 48 + idx;
}

function getFaderMidi(idx) {
  // 60mm Fader: 0..9 → 53..62
  if (idx >= 0 && idx <= 9) return 53 + idx;
  // 100mm Fader: 10..11 → 63..64
  if (idx >= 10 && idx <= 11) return 63 + (idx - 10);
  return 0;
}


function sendButton(idx, value) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const note = getButtonMidi(idx);
  if (!note) return;
  ws.send(JSON.stringify({ type: 'midiOut', bytes: [0x90 | MIDI_CHANNEL, note, value] }));
}

function sendFader(idx, value) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const cc = getFaderMidi(idx);
  if (!cc) return;
  ws.send(JSON.stringify({ type: 'midiOut', bytes: [0xB0 | MIDI_CHANNEL, cc, parseInt(value)] }));
}

function sendEncoder(idx, value) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const cc = getEncoderMidi(idx);
  ws.send(JSON.stringify({ type: 'midiOut', bytes: [0xB0 | MIDI_CHANNEL, cc, value] }));
}
