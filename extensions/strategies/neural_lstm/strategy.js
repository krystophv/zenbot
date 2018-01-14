var z = require('zero-fill')
var n = require('numbro')
var math = require('mathjs')
var neataptic = require('neataptic')

global.last_predict = ''
global.last_actual = ''

module.exports = function container (get, set, clear) {
  return {
    name: 'neural_lstm',
    description: 'Use neural long short term memory learning to predict future price. Buy = mean(last 3 real prices) < mean(current & last prediction)',
    getOptions: function () {
      this.option('period', 'period length - make sure to lower your poll trades time to lower than this value. Same as --period_length', String, '1m')
      this.option('period_length', 'period length - make sure to lower your poll trades time to lower than this value. Same as --period', String, '1m')
      this.option('min_periods', 'Periods to calculate learn from', Number, 500)
      this.option('momentum', 'momentum of prediction', Number, 0.5)
      this.option('decay', 'decay of prediction, use teeny tiny increments', Number, 0)
      this.option('learns', 'Number of times to \'learn\' the neural network with past data', Number, 10)
      this.option('markup_pct', 'Defaulting a markup percent', Number, 0.05)
      this.option('memory_cells', 'Number of memory cells for LSTM network', Number, 6)
      this.option('input_remember', 'Number of previous inputs the network remembers', Number, 3)
      this.option('output_remember', 'Number of preivous outputs the network remembers', Number, 3)
      this.option('cross_validate_pct', 'Percentage of samples to use for cross validation instead of training', Number, 0.3)
    },
    calculate: function (s) {
    },
    onPeriod: function (s, cb) {
      if (s.lstm_network === undefined) {
        s.lstm_network = new neataptic.architect.NARX(
          4, // input size
          [ s.options.memory_cells, s.options.memory_cells ], // hiddenLayers
          2, // output size
          s.options.input_remember, // previous number of inputs to remember
          s.options.output_remember  // previous number of outputs to remember
        )
      }
      if(s.lookback.length > s.options.min_periods) {
        //console.log('training')
        let training_data = s.lookback.slice(0, s.options.min_periods) 
        training_data = training_data.reverse()
        const multi_dim_array = training_data.map((value)=>{
          return [ 
            value.high,
            value.low,
            value.open,
            value.close,
            // value.volume 
          ]
        })
        // max is highest high
        const max = math.max(multi_dim_array, 0)
        const max_price = 20000 //max[0] 
        //const max_vol = max[4]
        // min is lowest low
        const min = math.min(multi_dim_array, 0)
        const min_price = 10000 //min[1]
        //const min_vol = min[4]
        const divisor = (max_price-min_price)
        const scalePrice = (value) => { return (value - min_price) / divisor }
        //const scaleVolume = (vol) => { return (vol - min_vol) / (max_vol - min_vol) } 
        training_data = training_data.map((value, i, data) => {
          // normalize data for set between 0 and 1
          const input = [ 
            scalePrice(value.high),
            scalePrice(value.low),
            scalePrice(value.open),
            scalePrice(value.close),
            //scaleVolume(value.volume) 
          ]
          return { 
            input: input, 
            output: [ 
              data[i+1] && scalePrice(data[i+1].close), 
              data[i+2] && scalePrice(data[i+2].close) 
            ]
          } 
        })

        // last one will have undefined output
        training_data.pop()
        training_data.pop()
        //console.log(training_data)

        s.lstm_network.train(training_data, {
          log: 500,
          iterations: 1000,
          //clear: true,
          error: 0.01,
          momentum: s.options.momentum,
          rate: 0.1,
          crossValidate: {
            testSize: s.options.cross_validate_pct,
            testError: 0.01
          }
          //cost: neataptic.methods.cost.MAE
          //dropout: 0.5,
          //rate: 0.05,
        })

        const network_output = s.lstm_network.activate([
          scalePrice(s.period.high),
          scalePrice(s.period.low),
          scalePrice(s.period.open),
          scalePrice(s.period.close),
          // scaleVolume(s.period.volume)
        ])

        const predict_1 = network_output[0]
        const predict_2 = network_output[1]

        const predict_1_rescaled = predict_1 * divisor + min_price
        const predict_2_rescaled = predict_2 * divisor + min_price

        /*console.log(`
         current: ${s.period.close},
         prediction_1: ${predict_1_rescaled}, 
         prediction_2: ${predict_2_rescaled}`)
        */
        s.period.predict_1 = predict_1_rescaled
        s.period.predict_2 = predict_2_rescaled

        if(predict_2 > scalePrice(s.period.close) && predict_1 > scalePrice(s.period.close)){
          s.signal = 'buy'
        } else {
          s.signal = 'sell'
        }
      }
      cb()
      
    },
    onReport: function (s) {
      var cols = []
      cols.push(z(8, n(s.period.predict_1).format('00000.000'), ' ')[s.period.predict_1 > s.period.close ? 'green' : 'red'])
      cols.push('    ')
      cols.push(z(8, n(s.period.predict_2).format('00000.000'), ' ')[s.period.predict_2 > s.period.close ? 'green' : 'red'])
      return cols
    },
  }
}
