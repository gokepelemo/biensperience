const { registerProvider } = require('./index');
const wikivoyage = require('./providers/wikivoyage');
const googleMaps = require('./providers/google-maps');

let bootstrapped = false;

function bootstrap() {
  if (bootstrapped) return;
  bootstrapped = true;
  registerProvider(wikivoyage);
  registerProvider(googleMaps);
}

function _resetForTest() {
  bootstrapped = false;
}

module.exports = { bootstrap, _resetForTest };
