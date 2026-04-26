const { registerProvider } = require('./index');
const wikivoyage = require('./providers/wikivoyage');

let bootstrapped = false;

function bootstrap() {
  if (bootstrapped) return;
  bootstrapped = true;
  registerProvider(wikivoyage);
}

function _resetForTest() {
  bootstrapped = false;
}

module.exports = { bootstrap, _resetForTest };
