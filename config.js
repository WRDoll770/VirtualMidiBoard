// Reads config.yaml and exports backend_port and frontend_port

const fs = require('fs');
const yaml = require('js-yaml');

function getConfig() {
  try {
    const file = fs.readFileSync('config.yaml', 'utf8');
    const config = yaml.load(file);
    return config;
  } catch (e) {
    console.error('Fehler beim Laden der config.yaml:', e);
    return { backend_port: 8181, frontend_port: 4040 };
  }
}

module.exports = getConfig();
