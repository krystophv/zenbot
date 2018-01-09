const fs = require('fs')
const _ = require('lodash')
const json2csv = require('./scripts/genetic_backtester/node_modules/json2csv')

function customizer(objValue, srcValue) {
  if (_.isArray(objValue)) {
    return objValue.concat(srcValue)
  }
}

const files = fs.readdirSync('simulations')
const collector = {}

_.forEach(files, file => {
  if (_.startsWith(file, 'generation_data')) {
    data = require(`./simulations/${file}`)
    //console.log(data);
    _.forEach(data, (strat_array, strategy) => {
      console.log(strategy, strat_array.length)
      _.forEach(strat_array, run => {
        _.merge(run, run.sim)
        delete run.sim
        if (run.params) {
          _.merge(run, JSON.parse(run.params.slice(17)))
        }
        delete run.params
        run.period = parseInt(run.period)
      })
    })
    _.mergeWith(collector, data, customizer)
  }
})

_.forEach(collector, (runs, strategy) => {
  const fileName = `./simulations/summary_${strategy}.csv`
  const csv = json2csv({
    data: _.sortBy(runs, 'vsBuyHold')
  })

  fs.writeFile(fileName, csv, err => {
    if (err) throw err
    console.log(`\nResults successfully saved to ${fileName}!\n`)
  })
})

//console.log(collector.trend_ema.length)
