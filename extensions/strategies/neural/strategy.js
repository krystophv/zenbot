var convnetjs = require('convnetjs')
var z = require('zero-fill')
var stats = require('stats-lite')
var n = require('numbro')
var math = require('mathjs')
const cluster = require('cluster')
const numCPUs = require('os').cpus().length
// the below line starts you at 0 threads
global.forks = 0
// the below line is for calculating the last mean vs the now mean.
var oldmean = 0
module.exports = function container (get, set, clear) {
  return {
    name: 'neural',
    description: 'Use neural learning to predict future price. Buy = mean(last 3 real prices) < mean(current & last prediction)',
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
    },
    calculate: function (s) {
    },
    onPeriod: function (s, cb) {
      if (s.neural === undefined) {
        // Create the net the first time it is needed and NOT on every run
        s.neural = {
          net : new convnetjs.Net(),
          layer_defs : [
            {type:'input', out_sx:1, out_sy:1, out_depth:s.options.depth},
            {type:'fc', num_neurons: s.options.neurons_1, activation: s.options.activation_1_type},
            {type:'regression', num_neurons:1}
          ],
          neuralDepth: s.options.depth
        }
        s.neural.net.makeLayers(s.neural.layer_defs)
        s.neural.trainer = new convnetjs.SGDTrainer(s.neural.net, {learning_rate:0.02, momentum:s.options.momentum, batch_size:1, l2_decay:s.options.decay})
      }
      // do the network thing
      var tlp = []
      var tll = []
      if (s.lookback[s.options.min_periods] && s.lookback[s.options.min_predict]) {
        for (let i = 0; i < s.options.min_periods; i++) { tll.push(s.lookback[i].close) }
        for (let i = 0; i < s.options.min_predict; i++) { tlp.push(s.lookback[i].close) }
        var my_data = tll.reverse()
        //Learns
        for (var j = 0; j < s.options.learns; j++) {
          for (var i = 0; i < my_data.length - s.neural.neuralDepth; i++) {
            var data = my_data.slice(i, i + s.neural.neuralDepth)
            var real_value = [my_data[i + s.neural.neuralDepth]]
            var x = new convnetjs.Vol(data)
            s.neural.trainer.train(x, real_value)
          }
        }
        var item = tlp.reverse()
        var next = new convnetjs.Vol(item)
        var predicted_value = s.neural.net.forward(next)
        s.prediction = predicted_value.w[0]
        s.mean = math.mean(s.lookback[0].close, s.lookback[1].close, s.lookback[2].close)
        s.meanp = math.mean(s.prediction, oldmean)
        //oldmean = s.prediction
        oldmean = s.mean
      }
      // NORMAL onPeriod STUFF here
      global.meanp = s.meanp
      global.mean = s.mean
      //something strange is going on here
      if (global.meanp < global.mean) {
        s.signal = 'sell'
      } else {
        s.signal = 'buy'
      }
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
