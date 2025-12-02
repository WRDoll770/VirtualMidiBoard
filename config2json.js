// Converts config.yaml to config.json for frontend use
const fs = require('fs');
const yaml = require('js-yaml');

try {
  const config = yaml.load(fs.readFileSync('config.yaml', 'utf8'));
  fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
  console.log('config.json generated from config.yaml');
} catch (e) {
  console.error('Fehler beim Konvertieren von config.yaml zu config.json:', e);
}
