'use strict';

(function(window) {

  window.STMN = window.STMN || {};

  var bounds = bounds;

  function displayUsCa(rootSelector, options) {

    options = options || {
      //defaults
      canvasWidth  : 110,
      canvasHeight : 150,
      scale         : 600,
      fillColor    : "rgb(34, 17, 2)",
      dotLocation  : null,
      dotRadius    : 2,
      dotColor     : 'white'
    };

    var svgUsCa = d3.select(rootSelector).append("svg")
        .attr("width", options.canvasWidth)
        .attr("height", options.canvasHeight)
        .attr("viewBox", [0, 0, options.canvasWidth, options.canvasHeight])
        .attr("preserveAspectRatio", "meet xMidYMid");

    var UsCa; // background shape

    var projectionUsCa = d3.geo.albers()
        .center([0,36.5]) // For statewide view
        .rotate([119, 0]) // For statewide view
        .parallels([32,40])
        .scale(options.scale)
        .translate([options.canvasWidth / 2, options.canvasHeight / 2]);

    var pathUsCa = d3.geo.path().projection(projectionUsCa);

    d3.json("/data/gadm_california.topojson", function(error, units) {

        UsCa = svgUsCa.append("g").selectAll("path")
            .data(topojson.feature(units, units.objects.gadm_california).features)
          .enter().append("path")
            .attr("d", pathUsCa)
            .attr("fill", options.fillColor)
            .attr("stroke", "rgba(255,255,255,.4)");

        if (options.dotLocation) {
          var coordinates = projectionUsCa(options.dotLocation);
          svgUsCa.append('svg:circle')
              .attr('cx', coordinates[0])
              .attr('cy', coordinates[1])
              .attr('r', options.dotRadius)
              .attr("fill", options.dotColor)
              .attr("stroke", "rgba(0,0,0,.2)");
        }

    });

  }

  function initView(data) {

    //TODO: move some of this logic out

    var instagramPhotos;

    //
    // Invoke the header carousel
    //
    var carousel = new SetUpCaousel('#coverphoto-carousel');

    //
    // Draw California
    //
    if (data.UsCaShape.display) {
      displayUsCa(
        data.UsCaShape.rootSelector, 
        data.UsCaShape.options
      );
    }

    //
    // Instagram display
    //
    if (data.instagramQueue.display) {
      instagramPhotos = new STMN.QueuedElementList('#instagram-photos .instagram-photo-container', {
        queue     : data.instagramQueue.photos,
        template  : data.instagramQueue.template,
        batchSize : 100
      });

      $('#instagram-photos button').on('click', function() {
        instagramPhotos.writeNextBatch();
      });

      instagramPhotos.on('writeBatch',function(e) {
        if (!e.queue.length) {
          $('#instagram-photos button').hide();
        }
      });
    }

  }

  function SetUpCaousel(rootSelector) {

    var that = this;

    //
    // Biggest to smallest carousel
    //
    this.instance    = new window.STMN.Carousel(rootSelector);
    this.rootElement = document.querySelector(rootSelector).parentNode;
    this.backElement = this.rootElement.querySelector('.carousel-back-button');
    this.backElement.addEventListener('click', function() {
      that.instance.goBackward();
    }, false);
    this.instance.on('forward', function(e) {

      if (e.target.scrollLeft > (e.target.scrollWidth-(e.target.offsetWidth+e.target.offsetWidth/2))) {
        that.rootElement.classList.add('scrolled-furthest');
      } else {
        that.rootElement.classList.remove('scrolled-furthest');
      }

      if (e.target.scrollLeft < (e.target.offsetWidth/2)) {
        that.rootElement.classList.add('not-scrolled');
      } else {
        that.rootElement.classList.remove('not-scrolled');
      }
    });
    this.instance.on('backward', function(e) {

      if (e.target.scrollLeft > (e.target.scrollWidth-(e.target.offsetWidth+e.target.offsetWidth/2))) {
        that.rootElement.classList.add('scrolled-furthest');
      } else {
        that.rootElement.classList.remove('scrolled-furthest');
      }

      if (e.target.scrollLeft < (e.target.offsetWidth/2)) {
        that.rootElement.classList.add('not-scrolled');
      } else {
        that.rootElement.classList.remove('not-scrolled');
      }
    });
    this.forwardElement = this.rootElement.querySelector('.carousel-forward-button');
    this.forwardElement.addEventListener('click', function() {
      that.instance.goForward();
    }, false);

  }

  //Public interface
  STMN.initView = initView;

}(window));