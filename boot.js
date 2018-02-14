var _ = require('lodash')
var path = require('path')
var minimist = require('minimist') 

module.exports = function (cb) {
  var zenbot = require('./')
  var c = getConfiguration()

  var defaults = require('./conf-sample')
  Object.keys(defaults).forEach(function (k) {
    if (typeof c[k] === 'undefined') {
      c[k] = defaults[k]
    }
  })
  zenbot.conf = c

  function withMongo () {
    cb(null, zenbot)
  }

  var authStr = '', authMechanism
  
  if(c.mongo.username){
    authStr = encodeURIComponent(c.mongo.username)

    if(c.mongo.password) authStr += ':' + encodeURIComponent(c.mongo.password)

    authStr += '@'

    // authMechanism could be a conf.js parameter to support more mongodb authentication methods
    authMechanism = 'DEFAULT'
  }

  var u = (function() {
    if (c.mongo.connectionString) {
      return c.mongo.connectionString
    }

    return 'mongodb://' + authStr + c.mongo.host + ':' + c.mongo.port + '/' + c.mongo.db + '?' +
      (c.mongo.replicaSet ? '&replicaSet=' + c.mongo.replicaSet : '' ) +
      (authMechanism ? '&authMechanism=' + authMechanism : '' )
  })()
  require('mongodb').MongoClient.connect(u, function (err, client) {
    if (err) {
      //zenbot.set('zenbot:db.mongo', null)
      console.error('WARNING: MongoDB Connection Error: ', err)
      console.error('WARNING: without MongoDB some features (such as backfilling/simulation) may be disabled.')
      console.error('Attempted authentication string: ' + u)
      return withMongo()
    }
    var db = client.db(c.mongo.db)
    _.set(zenbot, 'conf.db.mongo', db)
    withMongo()
  })

  function getConfiguration() {
    var args = minimist(process.argv.slice(3))
    var conf = undefined

    try {
      if(!_.isUndefined(args.conf)){
        try {
          conf = require(path.resolve(process.cwd(), args.conf))
        } catch (ee) {
          console.log('Fall back to conf.js, ' + ee)
          conf = require('./conf')
        }
      } else {
        conf = require('./conf')
      }
    }
    catch (e) {
      console.log('Fall back to sample-conf.js, ' + e)
      conf = {}
    }
    
    // prevent modifying cached module with a clone
    return _.cloneDeep(conf)
  }
}
