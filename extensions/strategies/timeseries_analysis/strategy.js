var math = require('mathjs')
var timeseries = require('timeseries-analysis')
var z = require('zero-fill')
var n = require('numbro')

module.exports = function container (get, set, clear) {
  return {
    name: 'timeseries_analysis',
    description: 'Calculate a trendline and trade when trend is positive vs negative.',
    getOptions: function () {
      this.option('period', 'period length, same as --periodLength', String, '1s')
      this.option('periodLength', 'period length, same as --period', String, '1s')
      this.option('min_periods', 'Basically avgpoints + a BUNCH of more preroll periods for anything less than 5s period', Number, 100)
      this.option('max_sell_loss_pct', 'Max Sell loss Pct', Number, 0)
      this.option('markup_pct', 'Default Strategy Markup - Hard In The Paint Mode', Number, 0.01)
      this.option('num_predictions', 'Number of periods to predict from regression', Number, 10)
      this.option('lookback_mean', 'Number of periods back to include in average for comparison to prediction', Number, 10)
      this.option('smoothing', 'Number of periods to use to smooth data for regression', Number, 3)
    },
    calculate: function (s) {

    },
    onPeriod: function (s, cb) {
      if(s.lookback[(s.options.min_periods)] && s.lookback[(s.options.lookback_mean)]) {
        const closes = []
        for (let i = 0; i < (math.max(s.options.min_periods, s.options.lookback_mean)); i++) { 
          closes.push(
            [ s.lookback[i].close_time, s.lookback[i].close ]
          ) 
        }
        closes.reverse()
        const last_entries = closes.slice(-(s.options.lookback_mean-1)).map((value)=> value[1])
        last_entries.push(s.period.close)
        var t = new timeseries.main(closes)
        t.smoother({ period: s.options.smoothing }).save('smoothed')
        const bestSettings = t.regression_forecast_optimize()
        t.regression_forecast({
          sample: bestSettings.sample, 
          degree: bestSettings.degree,
          method: bestSettings.method,
          start: s.options.min_periods,
          n: s.options.num_predictions
        })
        const predictions = t.output().slice(-s.options.num_predictions).map( (value) => value[1] )
        const mean_predict = math.mean(predictions)
        const mean_previous = math.mean(last_entries)

        if(mean_predict > mean_previous){
          s.signal = 'buy'
        } else {
          s.signal = 'sell'
        }
      }
      cb()
    },
    onReport: function (s) {
      var cols = []
      cols.push('  ')
      cols.push(z(8, n(s.stats).format('0.00000'), ' ')[s.stats > 1 ? 'green' : 'red'])
      cols.push('  ')
      cols.push(z(8, n(s.stats2).format('0.00000'), ' ')[s.stats2 > 1 ? 'green' : 'red'])
      cols.push('  ')
      return cols
    },
  }
}
