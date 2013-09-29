var redis = require('redis');
var namespace = "resque_test";
var queue = "test_queue";

exports.specHelper = {
  AR: require(__dirname + "/../index.js"),
  namespace: namespace,
  queue: queue,
  timeout: 500,
  connectionDetails: {
    host:      "127.0.0.1",
    password:  "",
    port:      6379,
    database:  1,
    namespace: namespace,
    // looping: true
  },
  connect: function(callback){
    var self = this;
    self.redis = redis.createClient(self.connectionDetails.port, self.connectionDetails.host, self.connectionDetails.options);
    if(self.connectionDetails.password != null && self.connectionDetails.password != ""){
      self.redis.auth(self.connectionDetails.password, function(err){
        self.redis.select(self.connectionDetails.database, function(err){
          callback(err);
        });
      }); 
    }else{
      self.redis.select(self.connectionDetails.database, function(err){
        callback(err);
      });
    }
  },
  cleanup: function(callback){
    var self = this;
    self.redis.keys(self.namespace + "*", function(err, keys){
      if(keys.length == 0){ 
        callback(); 
      }else{
        self.redis.del(keys, function(){
          callback();
        });
      }
    });
  },
  startAll: function(jobs, callback){
    var self = this;
    self.worker = new self.AR.worker({connection: self.connectionDetails, queues: self.queue, timeout: self.timeout}, jobs, function(){
      self.scheduler = new self.AR.scheduler({connection: self.connectionDetails, timeout: self.timeout}, function(){
        self.queue = new self.AR.queue({connection: self.connectionDetails, queue: self.queue}, function(){
          callback();
        });
      });
    });
  },
  endAll: function(callback){
    self.worker.end(function(){
      self.scheduler.end(function(){
        callback()
      })
    });
  }
}