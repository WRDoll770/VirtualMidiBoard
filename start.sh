#!/bin/bash

yaml_port() {
	grep "^$1:" config.yaml | awk '{print $2}'
}

BACKEND_PORT=$(yaml_port backend_port)
FRONTEND_PORT=$(yaml_port frontend_port)

# Leere die Datei midi-output-state.json beim Neustart um veraltete Zustände zu vermeiden
> midi-output-state.json

node midi-backend.js &
php -S 0.0.0.0:$FRONTEND_PORT > /dev/null 2>&1