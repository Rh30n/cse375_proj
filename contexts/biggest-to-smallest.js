'use strict';

var env = require('require-env'),
    pg  = require('pg');

module.exports = function(data, _callback) {
  var dbLimit = '';

  return pg.connect(env.require('DATABASE_URL'), function(err, client, done) {
    var callback = function() {
      done();
      return _callback.apply(null, arguments);
    };

    if (err) {
      return callback(err);
    }

    dbLimit = data.limit || 10000;

    return client.query('SELECT su_id, unit_name FROM site_park ORDER BY park_area DESC LIMIT '+ dbLimit +';', function(err, result) {
      if (err) {
        return callback(err);
      }

      return callback(null, {
        parks : result.rows,
        title : 'Biggest to smallest'
      });
    });
  });
};
