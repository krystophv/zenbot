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
      this.option('period', 'period length - make sure to lower your poll trades time to lower than this value. Same as --periodLength', String, '1m')
      this.option('periodLength', 'period length - make sure to lower your poll trades time to lower than this value. Same as --period', String, '1m')
      this.option('activation_1_type', 'Neuron Activation Type: sigmoid, tanh, relu', String, 'sigmoid')
      this.option('neurons_1', 'Neurons in layer 1 Shoot for atleast 100', Number, 1)
      this.option('depth', 'Rows of data to predict ahead for matches/learning', Number, 5)
      this.option('selector', 'Selector', String, 'Gdax.BTC-USD')
      this.option('min_periods', 'Periods to calculate learn from', Number, 300)
      this.option('min_predict', 'Periods to predict next number from', Number, 100)
      this.option('momentum', 'momentum of prediction', Number, 0.9)
      this.option('decay', 'decay of prediction, use teeny tiny increments', Number, 0)
      this.option('threads', 'Number of processing threads you\'d like to run (best for sim)', Number, 1)
      this.option('learns', 'Number of times to \'learn\' the neural network with past data', Number, 10)
      this.option('markup_pct', 'Defaulting a markup percent', Number, 0.05)
      this.option('memory_cells', 'Number of memory cells for LSTM network', Number, 6)
    },
    calculate: function (s) {
    },
    onPeriod: function (s, cb) {
      if (s.lstm_network === undefined) {
        s.lstm_network = new neataptic.architect.Perceptron(5, 10,10,10, 2)
      }
      if(
        s.lookback.length > s.options.min_periods && 
        s.lookback.length > s.options.min_predict) {
        console.log('training')
        let training_data = []
        for (let i = 0; i < s.options.min_periods; i++) { 
          training_data.push(s.lookback[i]) 
        }
        training_data = training_data.reverse()
        const multi_dim_array = training_data.map((value)=>{
          return [ 
            value.high,
            value.low,
            value.open,
            value.close,
            value.volume 
          ]
        })
        // max is highest high
        const max = math.max(multi_dim_array, 0)
        const max_price = max[0]
        const max_vol = max[4]
        // min is lowest low
        const min = math.min(multi_dim_array, 0)
        const min_price = min[1]
        const min_vol = min[4]
        const divisor = (max_price-min_price)
        training_data = training_data.map((value, i, data) => {
          // normalize data for set between 0 and 1
          const input = [ 
            (value.high-min_price)/divisor,
            (value.low-min_price)/divisor,
            (value.open-min_price)/divisor,
            (value.close-min_price)/divisor,
            (value.volume-min_vol)/(max_vol-min_vol) 
          ]
          return { 
            input: input, 
            output: [ 
              data[i+1] && (data[i+1].close-min_price)/divisor, 
              data[i+2] && (data[i+2].close-min_price)/divisor 
            ]
          } 
        })

        // last one will have undefined output
        training_data.pop()
        training_data.pop()
        //console.log(training_data)

        s.lstm_network.train(training_data, {
          log: 500,
          iterations: 100,
          clear: true,
          error: 0.03,
          //momentum: s.options.momentum
          cost: neataptic.methods.cost.MAE
          //dropout: 0.5
          //rate: 0.05,
        })

        /*
        for(var i in training_data){
          var input = training_data[i].input
          var output = s.lstm_network.activate([input])
          if(parseInt(i) == training_data.length-1){
            console.log(input)
            console.log('input: ',
              (input * scale).toFixed(2),
              ' real ',
              (training_data[i].output[0] * scale).toFixed(2),
              ' output: ',
              (output * scale).toFixed(2)
            )
          }
        }
        */

        //for(var j = 0; j < 10; j++){
        //var input = output
        //var output = s.lstm_network.activate([input])
        //console.log('next predict: ', output*scale)
        //}
        //if(Math.round(s.lstm_network.activate([s.period.close/scale])[0])){
        const network_output = s.lstm_network.activate([
          (s.period.high-min_price)/divisor,
          (s.period.low-min_price)/divisor,
          (s.period.open-min_price)/divisor,
          (s.period.close-min_price)/divisor,
          (s.period.volume-min_vol)/(max_vol-min_vol)
        ])
        const predict_1 = network_output[0]
        const predict_2 = network_output[1]
        console.log(`
         current: ${s.period.close},
         prediction_1: ${predict_1*divisor+min_price}, 
         prediction_2: ${predict_2*divisor+min_price}`)
        if(predict_2 > (s.period.close-min_price)/divisor && predict_1 > (s.period.close-min_price)/divisor){
          s.signal = 'buy'
        } else {
          s.signal = 'sell'
        }
      }
      
      // do the network thing
      /*
      var tlp = []
      var tll = []
      if (s.lookback[s.options.min_periods]) {
        for (let i = 0; i < s.options.min_periods; i++) { tll.push(s.lookback[i].close) }
        for (let i = 0; i < s.options.min_predict; i++) { tlp.push(s.lookback[i].close) }
        var my_data = tll.reverse()
        var learn = function () {
          //Learns
          for (var j = 0; j < s.options.learns; j++) {
            for (var i = 0; i < my_data.length - s.neural.neuralDepth; i++) {
              var data = my_data.slice(i, i + s.neural.neuralDepth)
              var real_value = [my_data[i + s.neural.neuralDepth]]
              var x = new convnetjs.Vol(data)
              s.neural.trainer.train(x, real_value)
              var predicted_values = s.neural.net.forward(x)
            }
          }
        }
        var predict = function(data) {
          var x = new convnetjs.Vol(data)
          var predicted_value = s.neural.net.forward(x)
          return predicted_value.w[0]
        }
        learn()
        var item = tlp.reverse()
        s.prediction = predict(item)
        s.mean = math.mean(s.lookback[0].close, s.lookback[1].close, s.lookback[2].close)
        s.meanp = math.mean(s.prediction, oldmean)
        oldmean = s.prediction
      }
      // NORMAL onPeriod STUFF here
      global.meanp = s.meanp
      global.mean = s.mean
      //something strange is going on here
      global.sig0 = global.meanp < global.mean
      if ( global.sig0 === false ){
        s.signal = 'sell'
      }
      else {
        s.signal = 'buy'
      } */
      cb()
      
    },
    onReport: function (s) {
      var cols = []
      cols.push(z(8, n(global.mean).format('00000.000'), ' ')[global.meanp > global.mean ? 'green' : 'red'])
      cols.push('    ')
      cols.push(z(8, n(global.meanp).format('00000.000'), ' ')[global.meanp > global.mean ? 'green' : 'red'])
      return cols
    },
  }
}
