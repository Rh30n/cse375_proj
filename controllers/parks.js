'use strict';

var cpad               = require('../lib/cpad.js'),
    stories            = require('../lib/stories.js'),
    activityCategories = require('../config/activities.json'),
    pgToGeoJSON        = require('../lib/pg-to-geojson.js');

module.exports = function(req, res, data, callback) {

  var story, templateData;

  function getActivityFilterState(withString) {

    var activities = {},
        urlStates;

    urlStates = withString ? withString.toLowerCase().split(',') : [];

    //
    // Make a new object with the same keys as the activityCategories object.
    // and the values will be the status of that filter from the `with` parameter
    // in the URL
    //

    activities = JSON.parse(JSON.stringify(activityCategories));
    Object.keys(activities).forEach(function(key) {
      if (key && activities[key]) {
        activities[key].filterState = (urlStates.indexOf(key.toLowerCase()) > -1); //Is it in the 'with' URL param
      }
    });

    return activities;
  }

  //
  // Is this a story context?
  //
  if (data.context === 'story') {
    story = stories.getBySlug(req.params.query);

    if (story.parks) {
      return cpad.getParksByIdList(story.parks, req.query.with, req.query.near, function() {

        data.query = {
          with : req.query.with
        }

        if (req.query.near) {
          data.query.near = req.query.near;
        }

        go.apply(this, arguments);
      });
    }
  }

  //
  // Add querystring but don't clobber anything called query from the caller
  //
  if (data.context === 'with') {
    data.query = {
      q    : req.query.q || '',
      near : req.params.near  || req.query.near || null,
      with : req.params.query || null,
      bbox : req.query.bbox
    };
  } else if (data.context === 'near') {

    //
    // In this case, return nothing to the template so it
    // can attempt to geolocate on the client
    //
    if (!req.params.query) {
      return callback(null,[]);
    }

    data.query = {
      q    : req.query.q || '',
      near : req.params.query,
      with : req.params.with  || req.query.with || null,
      bbox : req.query.bbox
    };
  } else if (req.params.query || req.query.q || req.query.near || req.query.with) {
    data.query = {
      q    : req.params.query || req.query.q || '',
      near : req.query.near || null,
      with : req.query.with || null,
      bbox : req.query.bbox
    };
  } else {
    data.query = {
      q    : req.params.query || req.query.q || '',
      near : null,
      with : null,
      bbox : req.query.bbox
    };
  }

  data.options = {
    startat : (req.query && req.query.startat) ? (req.query.startat) : "0",
    perpage : (req.query && req.query.perpage) ? (req.query.perpage|0) : "30",
    not     : (req.query && req.query.not) ? req.query.not : null
  };

  return cpad.getParks(data, go);

  function go(err, parks, place) {

    if (err && err.Error && err.Error.substring(0,17) !== "Failed to geocode") {
      return callback(err);
    }

    templateData = {
      parks          : parks,
      total          : parks ? parks.length : 0,
      startat        : (data.options) ? data.options.startat|0 : 0,
      perpage        : (data.options) ? data.options.perpage : "30",
      query          : data.query,
      activities     : getActivityFilterState(data.query.with),
      place          : place
    };

    if (parks) {
      templateData["parksGeoJSON"] = new pgToGeoJSON.GeoFeatureCollection(parks,{
        "excludeProperties" : ["geometry"]
      });
    }

    if (parks) {
      templateData["parksGeoJSON"] = new pgToGeoJSON.GeoFeatureCollection(parks,{
        "excludeProperties" : ["geometry"]
      });
    }

    if (req.query.home) {
      templateData['homeLocation'] = (req.query.home === "true")
    }

    if (data.context === "story") {
      templateData['story'] = stories.getBySlug(req.params.query).copy
    }

    return callback(null, templateData);
  }

};
