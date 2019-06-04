$(window).on('load', function() {
  var documentSettings = {};
  var markerColors = [];

  var completePoints = false;

  /**
   * Returns an Awesome marker with specified parameters
   */
  function createMarkerIcon(icon, prefix, markerColor, iconColor) {
    return L.AwesomeMarkers.icon({
      icon: icon,
      prefix: prefix,
      markerColor: markerColor,
      iconColor: iconColor
    });
  }


  /**
   * Sets the map view so that all markers are visible, or
   * to specified (lat, lon) and zoom if all three are specified
   */
  function centerAndZoomMap(points) {
    var lat = map.getCenter().lat, latSet = false;
    var lon = map.getCenter().lng, lonSet = false;
    var zoom = 12, zoomSet = false;
    var center;

    if (getSetting('_initLat') !== '') {
      lat = getSetting('_initLat');
      latSet = true;
    }

    if (getSetting('_initLon') !== '') {
      lon = getSetting('_initLon');
      lonSet = true;
    }

    if (getSetting('_initZoom') !== '') {
      zoom = parseInt(getSetting('_initZoom'));
      zoomSet = true;
    }

    if ((latSet && lonSet) || !points) {
      center = L.latLng(lat, lon);
    } else {
      center = points.getBounds().getCenter();
    }

    if (!zoomSet && points) {
      zoom = map.getBoundsZoom(points.getBounds());
    }

    map.setView(center, zoom);
  }


  /**
   * Given a collection of points, determines the layers based on 'Group'
   * column in the spreadsheet.
   */
  function determineLayers(points) {
    var layerNamesFromSpreadsheet = [];
    var layers = {};
    for (var i in points) {
    var pointLayerNameFromSpreadsheet = points[i].Group;
      if (layerNamesFromSpreadsheet.indexOf(pointLayerNameFromSpreadsheet) === -1) {
        markerColors.push(
          points[i]['Marker Icon'].indexOf('.') > 0
          ? points[i]['Marker Icon']
          : points[i]['Marker Color']
        );
        layerNamesFromSpreadsheet.push(pointLayerNameFromSpreadsheet);
      }
    }

    // if none of the points have named layers or if there was only one name, return no layers
    if (layerNamesFromSpreadsheet.length === 1) {
      layers = undefined;
    } else {
      for (var i in layerNamesFromSpreadsheet) {
        var layerNameFromSpreadsheet = layerNamesFromSpreadsheet[i];
        layers[layerNameFromSpreadsheet] = L.layerGroup();
        layers[layerNameFromSpreadsheet].addTo(map);
      }
    }
    return layers;
  }

  /**
   * Assigns points to appropriate layers and clusters them if needed
   */
  function mapPoints(points, layers) {
    var markerArray = [];
    // check that map has loaded before adding points to it?
    for (var i in points) {
      var point = points[i];

      // If icon contains '.', assume it's a path to a custom icon,
      // otherwise create a Font Awesome icon
      var iconSize = point['Custom Size'];
      var size = (iconSize.indexOf('x') > 0)
      ? [parseInt(iconSize.split('x')[0]), parseInt(iconSize.split('x')[1])]
      : [32, 32];

      var anchor = [size[0] / 2, size[1]];

      var icon = (point['Marker Icon'].indexOf('.') > 0)
        ? L.icon({
          iconUrl: point['Marker Icon'],
          iconSize: size,
          iconAnchor: anchor
        })
        : createMarkerIcon(point['Marker Icon'],
          'fa',
          point['Marker Color'].toLowerCase(),
          point['Icon Color']
        );

      var template = '<form id="popup-form">\
        <label>Add Note to Tree </label>\
        <label id="labelid" for="input">'+point['OBJECTID']+'</label>\
        <input id="input" class="popup-input" type="text" />\
        <button onClick="clickHandler()" id="button-submit" type="button">Submit</button>\
      </form>';

      if (point.Latitude !== '' && point.Longitude !== ''){
       var caliper = point['Caliper'];
       var height = point['Height'];
       var planted = point['Planted'];
       var spread = point['Spread'];
       var description = point['Description'];
       if(spread!=""){
         spread = "<br><b>Spread:</b> " + spread + " feet";
       }
       if(height!=""){
         height = "<br><b>Height:</b> " + height + " feet";
       }
       if(caliper!=""){
         caliper = "<br><b>Caliper:</b> " + caliper + " feet";
       }
       if(planted!=""){
         planted = "<br><b>Planted:</b> " + planted;
       }
       if(description!=""){
         description = "<br>" + description+"<br>";
       }
       var marker = L.marker([point.Latitude, point.Longitude], {icon: icon})
          .bindPopup("<b>" + point['Name'] + '</b><br>' +
          (point['Image'] ? ('<img src="' + point['Image'] + '">') : '') +
          description + planted + height + spread + caliper +
          '<br><br>' + template + '<br><b>Notes:</b><br> ' + point['Notes']);

        if (layers !== undefined && layers.length !== 1) {
          marker.addTo(layers[point.Group]);
        }

        markerArray.push(marker);
      }
    }

    var group = L.featureGroup(markerArray);
    var clusters = (getSetting('_markercluster') === 'on') ? true : false;

    // if layers.length === 0, add points to map instead of layer
    if (layers === undefined || layers.length === 0) {
      map.addLayer(
        clusters
        ? L.markerClusterGroup().addLayer(group).addTo(map)
        : group
      );
    } else {
      if (clusters) {
        // Add multilayer cluster support
        multilayerClusterSupport = L.markerClusterGroup.layerSupport();
        multilayerClusterSupport.addTo(map);

        for (i in layers) {
          multilayerClusterSupport.checkIn(layers[i]);
          layers[i].addTo(map);
        }
      }

      var pos = (getSetting('_pointsLegendPos') == 'off')
        ? 'topleft'
        : getSetting('_pointsLegendPos');

      var pointsLegend = L.control.layers(null, layers, {
        collapsed: false,
        position: pos,
      });

      if (getSetting('_pointsLegendPos') !== 'off') {
        //console.log(pointsLegend)
        pointsLegend.addTo(map);
        pointsLegend._container.id = 'points-legend';
        pointsLegend._container.className += ' ladder';
      }
    }

    $('#points-legend').prepend('<h6 class="pointer">' + getSetting('_pointsLegendTitle') + '</h6>');
    if (getSetting('_pointsLegendIcon') != '') {
      $('#points-legend h6').prepend('<span class="legend-icon"><i class="fa '
        + getSetting('_pointsLegendIcon') + '"></i></span>');
    }

    var displayTable = getSetting('_displayTable') == 'on' ? true : false;

    // Display table with active points if specified
    var columns = getSetting('_tableColumns').split(',')
                  .map(Function.prototype.call, String.prototype.trim);

    if (displayTable && columns.length > 1) {
      tableHeight = trySetting('_tableHeight', 40);
      if (tableHeight < 10 || tableHeight > 90) {tableHeight = 40;}
      $('#map').css('height', (100 - tableHeight) + 'vh');
      map.invalidateSize();

      // Set background (and text) color of the table header
      var colors = getSetting('_tableHeaderColor').split(',');
      if (colors[0] != '') {
        $('table.display').css('background-color', colors[0]);
        if (colors.length >= 2) {
          $('table.display').css('color', colors[1]);
        }
      }

      // Update table every time the map is moved/zoomed or point layers are toggled
      map.on('moveend', updateTable);
      map.on('layeradd', updateTable);
      map.on('layerremove', updateTable);

      // Clear table data and add only visible markers to it
      function updateTable() {
        var pointsVisible = [];
        for (i in points) {
          if (map.hasLayer(layers[points[i].Group]) &&
              map.getBounds().contains(L.latLng(points[i].Latitude, points[i].Longitude))) {
            pointsVisible.push(points[i]);
          }
        }

        tableData = pointsToTableData(pointsVisible);

        table.clear();
        table.rows.add(tableData);
        table.draw();
      }

      // Convert Leaflet marker objects into DataTable array
      function pointsToTableData(ms) {
        var data = [];
        for (i in ms) {
          var a = [];
          for (j in columns) {
            a.push(ms[i][columns[j]]);
          }
          data.push(a);
        }
        return data;
      }

      // Transform columns array into array of title objects
      function generateColumnsArray() {
        var c = [];
        for (i in columns) {
          c.push({title: columns[i]});
        }
        return c;
      }

      // Initialize DataTable
      var table = $('#maptable').DataTable({
        paging: false,
        scrollCollapse: true,
        scrollY: 'calc(' + tableHeight + 'vh - 40px)',
        info: false,
        searching: false,
        columns: generateColumnsArray(),
      });
    }

    completePoints = true;
    return group;
  }

  var layer = 0; // number representing current layer among layers in legend
  /**
   * Here all data processing from the spreadsheet happens
   */
  function onMapDataLoad() {
    var options = mapData.sheets(constants.optionsSheetName).elements;
    createDocumentSettings(options);

    document.title = getSetting('_mapTitle');
    addBaseMap();

    // Add point markers to the map
    var points = mapData.sheets(constants.pointsSheetName);
    var layers;
    var group = '';
    if (points && points.elements.length > 0) {
      layers = determineLayers(points.elements);
      group = mapPoints(points.elements, layers);
    } else {
      completePoints = true;
    }

    centerAndZoomMap(group);

    // Add Nominatim Search control
    if (getSetting('_mapSearch') !== 'off') {
      var geocoder = L.Control.geocoder({
        expand: 'click',
        position: getSetting('_mapSearch'),
        geocoder: new L.Control.Geocoder.Nominatim({
          geocodingQueryParams: {
            viewbox: [],  // by default, viewbox is empty
            bounded: 0,
          }
        }),
      }).addTo(map);

      function updateGeocoderBounds() {
        var bounds = map.getBounds();
        var mapBounds = [
          bounds._southWest.lat, bounds._northEast.lat,
          bounds._southWest.lng, bounds._northEast.lng,
        ];
        geocoder.options.geocoder.options.geocodingQueryParams.viewbox = mapBounds;
      }

      // Update search viewbox coordinates every time the map moves
      map.on('moveend', updateGeocoderBounds);
    }

    // Add location control
    if (getSetting('_mapMyLocation') !== 'off') {
      var locationControl = L.control.locate({
        keepCurrentZoomLevel: true,
        returnToPrevBounds: true,
        position: getSetting('_mapMyLocation')
      }).addTo(map);
    }

    // Add zoom control
    if (getSetting('_mapZoom') !== 'off') {
      L.control.zoom({position: getSetting('_mapZoom')}).addTo(map);
    }

    addTitle();

    // Change Map attribution to include author's info + urls
    changeAttribution();

    // Append icons to categories in markers legend
    $('#points-legend form label span').each(function(i) {
      var legendIcon = (markerColors[i].indexOf('.') > 0)
        ? '<img src="' + markerColors[i] + '" class="markers-legend-icon">'
        : '&nbsp;<i class="fa fa-map-marker" style="color: '
          + markerColors[i]
          + '"></i>';
      $(this).prepend(legendIcon);
    });

    // When all processing is done, hide the loader and make the map visible
    showMap();

    function showMap() {
      if (completePoints) {
        $('.ladder h6').append('<span class="legend-arrow"><i class="fa fa-chevron-down"></i></span>');
        $('.ladder h6').addClass('minimize');

        $('.ladder h6').click(function() {
          if ($(this).hasClass('minimize')) {
            $('.ladder h6').addClass('minimize');
            $('.legend-arrow i').removeClass('fa-chevron-up').addClass('fa-chevron-down');
            $(this).removeClass('minimize')
              .parent().find('.legend-arrow i')
              .removeClass('fa-chevron-down')
              .addClass('fa-chevron-up');
          } else {
            $(this).addClass('minimize');
            $(this).parent().find('.legend-arrow i')
              .removeClass('fa-chevron-up')
              .addClass('fa-chevron-down');
          }
        });

        $('.ladder h6').get(0).click();

        $('#map').css('visibility', 'visible');
        $('.loader').hide();

        // Open intro popup window in the center of the map
        if (getSetting('_introPopupText') != '') {
          initIntroPopup(getSetting('_introPopupText'), map.getCenter());
        };
      } else {
        setTimeout(showMap, 50);
      }
    }
  }

  /**
   * Adds title and subtitle from the spreadsheet to the map
   */
  function addTitle() {
    var dispTitle = getSetting('_mapTitleDisplay');

    if (dispTitle !== 'off') {
      var title = '<h3 class="pointer">' + getSetting('_mapTitle') + '</h3>';
      var subtitle = '<h5>' + getSetting('_mapSubtitle') + '</h5>';

      if (dispTitle == 'topleft') {
        $('div.leaflet-top').prepend('<div class="map-title leaflet-bar leaflet-control leaflet-control-custom">' + title + subtitle + '</div>');
      } else if (dispTitle == 'topcenter') {
        $('#map').append('<div class="div-center"></div>');
        $('.div-center').append('<div class="map-title leaflet-bar leaflet-control leaflet-control-custom">' + title + subtitle + '</div>');
      }

      $('.map-title h3').click(function() { location.reload(); });
    }
  }

  function initIntroPopup(info, coordinates) {
    // This is a pop-up for mobile device
    if (window.matchMedia("only screen and (max-width: 760px)").matches) {
      $('body').append('<div id="mobile-intro-popup"><p>' + info +
        '</p><div id="mobile-intro-popup-close"><i class="fa fa-times"></i></div></div>');

      $('#mobile-intro-popup-close').click(function() {
        $("#mobile-intro-popup").hide();
      });
      return;
    }

    /* And this is a standard popup for bigger screens */
    L.popup({className: 'intro-popup'})
      .setLatLng(coordinates) // this needs to change
      .setContent(info)
      .openOn(map);
  }

  /**
   * Changes map attribution (author, GitHub repo, email etc.) in bottom-right
   */
  function changeAttribution() {
    var attributionHTML = $('.leaflet-control-attribution')[0].innerHTML;
    var credit = 'View <a href="' + googleDocURL + '" target="_blank">data</a>';
    var name = getSetting('_authorName');
    var url = getSetting('_authorURL');

    if (name && url) {
      if (url.indexOf('@') > 0) { url = 'mailto:' + url; }
      credit += ' by <a href="' + url + '">' + name + '</a> | ';
    } else if (name) {
      credit += ' by ' + name + ' | ';
    } else {
      credit += ' | ';
    }

    credit += 'View <a href="' + getSetting('_githubRepo') + '">code</a>';
    if (getSetting('_codeCredit')) credit += ' by ' + getSetting('_codeCredit');
    credit += ' with ';
    $('.leaflet-control-attribution')[0].innerHTML = credit + attributionHTML;
  }


  /**
   * Loads the basemap and adds it to the map
   */
  function addBaseMap() {
    var basemap = trySetting('_tileProvider', 'CartoDB.Positron');
    L.tileLayer.provider(basemap, {
      maxZoom: 23
    }).addTo(map);
    L.control.attribution({
      position: trySetting('_mapAttribution', 'bottomright')
    }).addTo(map);
  }

  /**
   * Returns the value of a setting s
   * getSetting(s) is equivalent to documentSettings[constants.s]
   */
  function getSetting(s) {
    return documentSettings[constants[s]];
  }

  /**
   * Returns the value of setting named s from constants.js
   * or def if setting is either not set or does not exist
   * Both arguments are strings
   * e.g. trySetting('_authorName', 'No Author')
   */
  function trySetting(s, def) {
    s = getSetting(s);
    if (!s || s.trim() === '') { return def; }
    return s;
  }

  /**
   * Triggers the load of the spreadsheet and map creation
   */
   var mapData;

   $.ajax({
       url:'csv/Options.csv',
       type:'HEAD',
       error: function() {
         // Options.csv does not exist, so use Tabletop to fetch data from
         // the Google sheet
         mapData = Tabletop.init({
           key: googleDocURL,
           callback: function(data, mapData) { onMapDataLoad(); }
         });
       },
       success: function() {
         // Get all data from .csv files
         mapData = Tabletop.init({
           key: googleDocURL,
           callback: function(data, mapData) { onMapDataLoad(); }
         });
       }
   });

  /**
   * Reformulates documentSettings as a dictionary, e.g.
   * {"webpageTitle": "Leaflet Boilerplate", "infoPopupText": "Stuff"}
   */
  function createDocumentSettings(settings) {
    for (var i in settings) {
      var setting = settings[i];
      documentSettings[setting.Setting] = setting.Customize;
    }
  }

  // Returns a string that contains digits of val split by comma evey 3 positions
  // Example: 12345678 -> "12,345,678"
  function comma(val) {
      while (/(\d+)(\d{3})/.test(val.toString())) {
          val = val.toString().replace(/(\d+)(\d{3})/, '$1' + ',' + '$2');
      }
      return val;
  }

});
