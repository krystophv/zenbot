module.exports = {
  _ns: 'zenbot',

  'strategies.neural_lstm': require('./strategy'),
  'strategies.list[]': '#strategies.neural_lstm'
}
