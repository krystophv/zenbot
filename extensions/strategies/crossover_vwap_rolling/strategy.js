var z = require('zero-fill')
  , n = require('numbro')

module.exports = function container (get, set, clear) {
  return {
    name: 'crossover_vwap_rolling',
    description: 'Estimate trends by comparing a rolling Volume Weighted Average Price to the Exponential Moving Average.',

    getOptions: function () {     
      this.option('period', 'period length, same as --period_length', String, '120m')
      this.option('period_length', 'period length, same as --period', String, '120m')
      this.option('ema_length', 'Number of periods for the EMA', Number, 30 ) //green
      this.option('vwap_length', 'Number of periods for the VWAP', Number, 10 ) //gold
      this.option('let_stop_exit', 'Truthy/Falsy to let other stops handle exits', Boolean, true)
    },
    
    calculate: function (s) {
       
    },
    
    onPeriod: function (s, cb) {
      if(s.lookback.length >= Math.max(s.options.vwap_length, s.options.ema_length)){
        get('lib.vwap_rolling')(s, 'vwap', s.options.vwap_length) //gold
        get('lib.ema')(s, 'ema', s.options.ema_length) //green
        
        if(s.period.vwap && s.period.ema){
          if(s.period.vwap > s.period.ema) {
            if (s.trend !== 'up') {
              s.acted_on_trend = false
            }
            s.trend = 'up'
            if(s.options.let_stop_exit){
              s.signal = 'buy'
            } else {
              s.signal = !s.acted_on_trend ? 'buy' : null
            }
          } else {
            if(!s.options.let_stop_exit){
              if (s.trend !== 'down') {
                s.acted_on_trend = false
              }
              s.trend = 'down'
              s.signal = !s.acted_on_trend ? 'sell' : null
            }
          } 
        }
      } 
      cb()
    },

    onReport: function (s) {
      var cols = []
      let emagreen = s.period.ema,
        vwapgold = s.period.vwap
      
      if (vwapgold && emagreen) {   
        var color = vwapgold > emagreen ? 'red' : 'green'
          
        cols.push(z(6, n(vwapgold).format('0.00000'), '')['yellow'] + ' ')
        cols.push(z(6, n(emagreen).format('0.00000'), '')[color] + ' ')
      }
      else {
        cols.push('                ')
      }
      return cols
    }
  }
}
