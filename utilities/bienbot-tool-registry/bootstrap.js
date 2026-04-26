const { registerProvider } = require('./index');

let bootstrapped = false;

function bootstrap() {
  if (bootstrapped) return;
  bootstrapped = true;
  // Provider registrations are added in subsequent tasks (T7+).
}

function _resetForTest() {
  bootstrapped = false;
}

module.exports = { bootstrap, _resetForTest };
