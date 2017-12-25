module.exports = {
  _ns: 'zenbot',

  'strategies.timeseries_analysis': require('./strategy'),
  'strategies.list[]': '#strategies.timeseries_analysis'
}
