const { registerProvider } = require('./index');
const wikivoyage = require('./providers/wikivoyage');
const googleMaps = require('./providers/google-maps');
const tripadvisor = require('./providers/tripadvisor');
const unsplash = require('./providers/unsplash');

let bootstrapped = false;

function bootstrap() {
  if (bootstrapped) return;
  bootstrapped = true;
  registerProvider(wikivoyage);
  registerProvider(googleMaps);
  registerProvider(tripadvisor);
  registerProvider(unsplash);
}

function _resetForTest() {
  bootstrapped = false;
}

module.exports = { bootstrap, _resetForTest };
