@echo off
type nul > midi-output-state.json
start /B node config2json.js
start /B node midi-backend.js
php -S 0.0.0.0:4040