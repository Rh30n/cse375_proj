'use strict';

var util = require('util');

var async    = require('async'),
    pg       = require('pg'),
    gpsUtil  = require('gps-util'),
    distance = require('gps-distance'),
    numeral  = require('numeral');

var dbCon    = process.env.DATABASE_URL,
    hashtags = require('../public/data/hashtagsBySuId.json'),
    contexts = {},
    cpadModified;

function fuzzyRound(N) {
  var rounded = Math.max(Math.round(N / 10) * 10);
  
  if(rounded === 0) {
    return N | 0;
  } else {
    return rounded;
  }
}

contexts.tweets = require('../public/data/context-tweets.json');
contexts.foursquareCheckins = require('../public/data/context-foursquare-checkins.json');
contexts.foursquareVenues = require('../public/data/context-foursquare-venues.json');
contexts.flickrPhotos = require('../public/data/context-flickr-photos.json');
contexts.instagramPhotos = require('../public/data/context-instagram-photos.json');

module.exports = function(req, res, data, callback) {
    var pgClient = new pg.Client(dbCon);

    var park_id = req.params.id,
        positions = {};

    var template  = 'park',
        foursquare_checkins = 0, 
        foursquare_tips     = 0, 
        tweet_iteration     = 0,
        instagramPreload    = [],
        instagramPostload   = [],
        tweetsPreload       = [],
        tweetsPostload      = [],
        flickrPreload       = [],
        flickrPostload      = [],
        tweets_all, tweets_filtered, thisOne;

    //
    // Get positions
    //
    contexts.tweets.forEach(function(pos, i) {
      if ((pos.su_id | 0) === (park_id | 0)) {
        positions.tweets = i;
      }
    });
    contexts.foursquareCheckins.forEach(function(pos, i) {
      if ((pos.su_id | 0) === (park_id | 0)) {
        positions.foursquareCheckins = i;
      }
    });
    contexts.foursquareVenues.forEach(function(pos, i) {
      if ((pos.su_id | 0) === (park_id | 0)) {
        positions.foursquareVenues = i;
      }
    });
    contexts.flickrPhotos.forEach(function(pos, i) {
      if ((pos.su_id | 0) === (park_id | 0)) {
        positions.flickrPhotos = i;
      }
    });
    contexts.instagramPhotos.forEach(function(pos, i) {
      if ((pos.su_id | 0) === (park_id | 0)) {
        positions.instagramPhotos = i;
      }
    });

    //
    // Get special template if one exists
    //
    if (data.overrideTemplates[park_id]) {
      template = data.overrideTemplates[park_id].template;
      title    = data.overrideTemplates[park_id].title;
    }

    pgClient.connect(function(err) {
      if(err) {
        console.error('could not connect to postgres', err);
        pgClient.end();
        return callback(err);
      }

      return async.parallel({
        result: async.apply(pgClient.query.bind(pgClient), 'select * from site_park where su_id = $1 limit 9000', [park_id]),
        flesult: async.apply(pgClient.query.bind(pgClient), 'select photoid, owner, secret, server, farm, title, latitude, longitude, accuracy, woeid, tags, dateupload, datetaken, ownername, description, license, o_width, o_height, url_l, height_l, width_l from site_park_flickr_photos where containing_park_id = $1 limit 9000', [park_id]),
        instasult: async.apply(pgClient.query.bind(pgClient), 'select * from site_instagram_photos where su_id = $1 limit 9000', [park_id]),
        foursult: async.apply(pgClient.query.bind(pgClient), 'select id,venueid,name,lat,lng,address,postcode,city,state,country,cc,categ_id,categ_name,verified,restricted,referral_id,checkinscount,tipcount,likescount,mayor_id,mayor_firstname,mayor_lastname from site_foursquare_venues_activity where su_id = $1 limit 9000', [park_id]),
        tweetsult: async.apply(pgClient.query.bind(pgClient), 'select id_str, place, coords, username, fullname, client, date, retweet_count, favorite_count, lang, content from site_tweets where su_id = $1 limit 9000', [park_id])
      }, function(err, apiResponse) {
        if (err) {
          console.error('error running query', err);
          pgClient.end();
          return callback(err);
        }

        var result = apiResponse.result,
            flesult = apiResponse.flesult,
            instasult = apiResponse.instasult,
            foursult = apiResponse.foursult,
            tweetsult = apiResponse.tweetsult;

        //
        // Was a park found? if not, just 404
        //
        if (result.rows[0]) {

          //
          // Get checkins and tips count from Foursquare
          //
          foursult.rows.forEach(function(venue) {
            foursquare_checkins += venue.checkinscount;
            foursquare_tips += venue.tipcount;
          });

          var venues_count     = numeral(foursult.rows.length).format('0,0'),
              venues_checkins  = numeral(foursquare_checkins).format('0,0'),
              venues_tips      = numeral(foursquare_tips).format('0,0');

          var bbox;

          try {
            bbox = JSON.parse(result.rows[0].bbox).coordinates[0];
          } catch (err) {
            pgClient.end();
            return callback(err);
          }

          var kInMiles         = 1.60934,
              ftInK            = 3280.84,
              imageWidthPx     = 300,
              scaleBarWidthPx  = 15,
              devideBy         = imageWidthPx / scaleBarWidthPx,
              totalDistanceInK = distance(bbox[0][1], bbox[0][0], bbox[1][1], bbox[1][0]),
              displayMi        = fuzzyRound((totalDistanceInK/devideBy)/kInMiles),
              displayFt        = fuzzyRound((totalDistanceInK/devideBy)*ftInK);

          //separate the instagram into preload and post load
          // preloading 32
          var instographer_count = {};
          instasult.rows.forEach(function(photo, i) {

            instographer_count[photo.username] = true;

            thisOne = photo;
            thisOne.thumb = thisOne.standard_resolution.split('_7').join('_5');
            thisOne.thumb = thisOne.standard_resolution.split('_7').join('_5');

            if(i < 32) {
              instagramPreload.push(photo);
            } else {
              instagramPostload.push(photo)
            }

          });

          //separate the tweets into preload and post load
          // preloading 10
          var tweeter_count = {};
          tweetsult.rows.forEach(function(tweet, i) {

            tweeter_count[tweet.username] = true;

            if(i < 10) {
              tweetsPreload.push(tweet);
            } else {
              tweetsPostload.push(tweet)
            }

          });

          //separate flickr into preload and post load
          // preloading 5
          var flotographer_count = {};
          flesult.rows.forEach(function(photo, i) {

            flotographer_count[photo.ownername] = true;

            if(i < 5) {
              flickrPreload.push(photo);
            } else {
              flickrPostload.push(photo)
            }

          });

          //
          // Modify CPAD to work better as an API output
          //
          cpadModified            = result.rows[0]
          
          try {
            cpadModified.park_shape = JSON.parse(result.rows[0].park_shape);
            cpadModified.bbox       = JSON.parse(result.rows[0].bbox);
          } catch (e) {
            callback(e);
          }

          callback( null, {
            appTitle         : 'California Open Spaces > ' + result.rows[0].unit_name,
            park_id          : result.rows[0].su_id,
            name             : result.rows[0].unit_name,
            agency_slug      : result.rows[0].agncy_name.split(' ').join('+'),
            totalPhotos      : flesult.rows.length ? flesult.rows.length : 0,
            flickrPhotos     : flickrPreload,
            flotographer_count : Object.keys(flotographer_count).length,
            queue_flickr_photos : JSON.stringify(flickrPostload),
            noFlickrScroll   : (flesult.rows.length < 2),
            coverPhoto       : flesult.rows.length ? flesult.rows[0] : null,
            locationDisplay  : {
              lat : gpsUtil.getDMSLatitude(result.rows[0].centroid_latitude),
              lon : gpsUtil.getDMSLongitude(result.rows[0].centroid_longitude)
            },
            centroid               : [result.rows[0].centroid_latitude, result.rows[0].centroid_longitude],
            cpadPark               : result.rows[0],
            hashtag                : hashtags[result.rows[0].su_id],
            tweets                 : tweetsPreload,
            tweets_queue           : JSON.stringify(tweetsPostload),
            tweets_queue_count     : tweetsPostload.length,
            tweet_count            : tweetsult.rows.length,
            tweeter_count          : Object.keys(tweeter_count).length,
            empty_right_column     : !(tweetsult.rows.length > 0) && !instasult.rows.length,
            has_tweets             : (tweetsult.rows.length > 0),
            has_instagram_photos   : (instasult.rows.length > 0),
            top_instagram_photos   : instagramPreload,
            instographer_count     : Object.keys(instographer_count).length,
            queue_instagram_photos : JSON.stringify(instagramPostload),
            queue_instagram_length : instagramPostload.length,
            instagram_count        : instasult.rows.length,
            has_foursquare         : (venues_count > 0),
            venues_activity        : foursult.rows,
            venues_count           : foursult.rows.length < 1000000 ? venues_count : '1 M +',
            venues_checkins        : foursquare_checkins < 1000000 ? venues_checkins : '1 M +',
            venues_tips            : foursquare_tips < 1000000 ? venues_tips : '1 M +',
            parkShapeScale         : {
              'pixels' : scaleBarWidthPx,
              'miles'  : fuzzyRound((totalDistanceInK/devideBy)/kInMiles),
              'feet'   : fuzzyRound((totalDistanceInK/devideBy)*ftInK),
              'best'   : displayMi > 0 ? numeral(displayMi, '0,0') : numeral(displayFt, '0,0'),
              'label'  : displayMi > 0 ? (displayMi === 1 ? 'Mile' : 'Miles') : (displayFt === 1 ? 'Foot' : 'Feet')
            }
          } );

        } else {
          callback( null, null );
        }
      
        pgClient.end();

      });
    });

}
