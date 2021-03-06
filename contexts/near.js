'use strict';

var env     = require('require-env'),
    pg      = require('pg'),
    request = require('request');

module.exports = function(data, callback) {

  var isLatLongTest = /^-?\d*.\d*\,-?\d*.\d*$/,
      limit         = ((data.options) ? data.options.limit : null) || 100000,
      not           = ((data.options) ? data.options.not : null) ? ' AND su_id <> ' + parseInt(data.options.not) : '',
      loc, res;

  function getPlace(callback) {

    if (data.query && isLatLongTest.test(data.query)) {
      loc = data.query.split(',');

      // TODO fetch the map id from the environment
      request('http://api.tiles.mapbox.com/v3/stamen.hckn2ljm/geocode/'+loc[1]+','+loc[0]+'.json', function (error, response, body) {
        if (error) {
          return callback(error);
        }

        try {
          callback(null, {
            'coordinates' : loc,
            'details'     : JSON.parse(body).results[0][0]
          });
        } catch (e) {
          callback(e);
        }
      });
    } else if(data.query) {

      request('http://api.tiles.mapbox.com/v3/stamen.hckn2ljm/geocode/'+data.query+'.json', function (error, response, body) {
        if (error) {
          return callback(error);
        }

        try {
          var geocoderRes = JSON.parse(body).results;
        } catch (e) {
          callback(e);
        }

        res = (geocoderRes && geocoderRes[0] && geocoderRes[0][0]) ? geocoderRes[0][0] : {lat:null,lon:null};

        callback(null, {
          'coordinates' : [res.lat, res.lon],
          'details'     : res
        });
      });

    } else {
      callback(null,null);
    }

  }

  function cpadRowFilter(item, i, array) {
    delete item.geom;
    return item;
  }

  pg.connect(env.require('DATABASE_URL'), function(err, client, done) {
    var _callback = callback;

    callback = function(err) {
      done();
      return _callback.apply(null, arguments);
    };

    if (err) {
      return callback(err);
    }

    if (data.query) {
      getPlace(function(err, place) {

        if (err) {
          return callback(err);
        }

        client.query({
          text   : 'select *, ST_AsGeoJSON(geom) as geometry, ST_AsGeoJSON(ST_Centroid(geom)) as centroid, ST_distance(geom, st_setsrid(st_makepoint($1,$2),4326)) as distance from (select * from cpad_2013b_superunits_ids_4326 where ST_DWithin(geom, st_setsrid(st_makepoint($1,$2),4326), .3)'+not+' LIMIT $3) as shortlist order by distance asc;',
          values : [place.coordinates[1],place.coordinates[0],limit]
        }, function(err, result) {
          if(err) {
            return callback(err);
          }

          return callback(null, {
            parks : result.rows.map(cpadRowFilter),
            title : place.details && place.details.name ? 'near ' + place.details.name : 'nearby'
          });
        });
      });

    } else {
      return callback(null, {
        parks : [],
        title : 'near you'
      });
    }

  });
};
