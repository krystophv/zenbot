const fs = require('fs')
const _ = require('lodash')
const json2csv = require('./scripts/genetic_backtester/node_modules/json2csv')
const glob = require('glob')

function customizer(objValue, srcValue) {
  if (_.isArray(objValue)) {
    return objValue.concat(srcValue)
  }
}

const collector = {}

glob(__dirname + '/simulations/**/results.json', (err, matches)=>{
  _.forEach(matches, file => {
    var data = require(file)
    _.forEach(data, (strat_array, strategy) => {
      _.remove(strat_array, function(run){
        return (
          !run.sim.fitness ||
          run.sim.roi <= 0 ||
          run.sim.vsBuyHold < 0 
        )
      })
      console.log(strategy, strat_array.length)
      _.forEach(strat_array, run => {
        _.merge(run, run.sim)
        delete run.sim
        if (run.params) {
          _.merge(run, JSON.parse(run.params.slice(17)))
        }
        delete run.params
        delete run.command
        run.period = parseInt(run.period_length)
      })
    })
    _.mergeWith(collector, data, customizer)
  })
  _.forEach(collector, (runs, strategy) => {
    const fileName = `./simulations/summary_${strategy}.csv`
    const csv = json2csv({
      data: (_.sortBy(runs, 'fitness')).reverse()
    })
  
    fs.writeFile(fileName, csv, err => {
      if (err) throw err
      console.log(`\nResults successfully saved to ${fileName}!\n`)
    })
  })
})