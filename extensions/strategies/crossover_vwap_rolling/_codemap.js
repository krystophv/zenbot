module.exports = {
  _ns: 'zenbot',

  'strategies.crossover_vwap_rolling': require('./strategy'),
  'strategies.list[]': '#strategies.crossover_vwap_rolling'
}
