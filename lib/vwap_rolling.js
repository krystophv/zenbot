module.exports = function vwap (s, key, length, source_key) {
  if (!source_key) source_key = 'close'
    
  if (s.lookback.length >= length) {
    // grab the periods and reverse them so they're in order from oldest to newest
    var periods = s.lookback.slice(0, length).reverse()
    // get a better average price for the period
    var cumulative_total = 0, 
      cumulative_volume = 0

    periods = periods.map(function(val){
      val.avg_price = (val.high + val.low + val.close)/3
      val.total_price = val.avg_price * val.volume
      cumulative_total += val.total_price
      cumulative_volume += val.volume
      val.vwap = cumulative_total/cumulative_volume
      return val
    })
    var last_period = periods.pop()
    //console.log(last_period)
      
    s.period[key] = last_period.vwap
            
  }
}

