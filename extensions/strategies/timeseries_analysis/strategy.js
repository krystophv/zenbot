var math = require('mathjs')
var timeseries = require('timeseries-analysis')
var z = require('zero-fill')
var n = require('numbro')

module.exports = function container (get, set, clear) {
  return {
    name: 'timeseries_analysis',
    description: 'Calculate a trendline and trade when trend is positive vs negative.',
    getOptions: function () {
      this.option('period', 'period length, same as --periodLength', String, '1m')
      this.option('period_length', 'period length, same as --period', String, '1m')
      this.option('min_periods', 'Minimum number of periods to use for calculation', Number, 100)
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

        s.mean_predict = mean_predict
        s.mean_previous = mean_previous

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
      cols.push(z(8, n(s.mean_predict).format('0.00000'), ' ')[s.mean_predict > s.mean_previous ? 'green' : 'red'])
      cols.push('  ')
      cols.push(z(8, n(s.mean_previous).format('0.00000'), ' ')[s.mean_predict > s.mean_previous ? 'green' : 'red'])
      cols.push('  ')
      return cols
    },
  }
}
