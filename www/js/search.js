var BASE_LAYER = APP_CONFIG.MAPBOX_BASE_LAYER;
var CONTENT_WIDTH;
var GEOLOCATE = Modernizr.geolocation;
var LOCATOR_DEFAULT_ZOOM = 15;
var RESULTS_MAP_WIDTH = 500;
var RESULTS_MAP_HEIGHT = 500;
var RESULTS_MAX_ZOOM = 16;
var RESULTS_MIN_ZOOM = 8;
var RESULTS_DEFAULT_ZOOM = 14;
var RETINA = window.devicePixelRatio > 1;
if (RETINA) {
    BASE_LAYER = APP_CONFIG.MAPBOX_BASE_LAYER_RETINA;
    LOCATOR_DEFAULT_ZOOM += 1;
    RESULTS_DEFAULT_ZOOM += 1;
}

var LETTERS = 'abcdefghijklmnopqrstuvwxyz';

var $search_title = null;
var $search_form = null;
var $search_address = null;
var $search_again = null;
var $search_divider = null;
var $search_latitude = null;
var $search_longitude = null;
var $geolocate_button = null;
var $search_results_wrapper = null;
var $search_results = null;
var $search_results_map_wrapper = null;
var $search_results_map = null;
var $search_results_map_loading = null;
var $search_wrapper = null;
var $zoom_in = null;
var $zoom_out = null;
var $search_help = null;
var $search_help_us = null;
var $did_you_mean = null;
var $results_address = null;
var $no_geocode = null;
var $results_loading = null;
var $playground_meta_hdr = null;
var $playground_meta_items = null;

var zoom = RESULTS_DEFAULT_ZOOM;
var crs = null;
var ignore_hash_change = false;

function degToCloudSearch(degree) {
    /*
     * Convert a degree of lat or lon to our CloudSearch uint representation.
     */
    return parseInt((degree + APP_CONFIG.CLOUD_SEARCH_DEG_OFFSET) * APP_CONFIG.CLOUD_SEARCH_DEG_SCALE);
}

function cloudSearchToDeg(uint) {
    /*
     * Convert a CloudSearch uint into a degree of lat or lon.
     */
    return parseFloat((uint / APP_CONFIG.CLOUD_SEARCH_DEG_SCALE) - APP_CONFIG.CLOUD_SEARCH_DEG_OFFSET);
}

function buildCloudSearchParams() {
    /*
     * Reads the current state of the UI and builds appropraite CloudSearch query params.
     */
    var deployment_target = (APP_CONFIG.DEPLOYMENT_TARGET || 'staging');
    //var query = $search_query.val();
    var latitude = parseFloat($search_latitude.val());
    var longitude = parseFloat($search_longitude.val());

    var params = {};
    var return_fields = ['name', 'display_name', 'city', 'state', 'latitude', 'longitude', 'public_remarks', 'slug'];

    var query_bits = ['deployment_target:\'' + deployment_target + '\''];

    /*if (query) {
        query_bits.push('full_text:\'' + query + '\'');
    }*/

    // If using geosearch
    if (latitude) {
        // Generate bounding box for map viewport
        var point = crs.latLngToPoint(new L.LatLng(latitude, longitude), zoom);
        var upper_left = point.subtract([RESULTS_MAP_WIDTH / 2, RESULTS_MAP_HEIGHT / 2]);
        var lower_right = point.add([RESULTS_MAP_WIDTH / 2, RESULTS_MAP_HEIGHT / 2]);
        var northwest = crs.pointToLatLng(upper_left, zoom);
        var southeast = crs.pointToLatLng(lower_right, zoom);

        query_bits.push('longitude:' + degToCloudSearch(northwest.lng) + '..' + degToCloudSearch(southeast.lng) + ' latitude:' + degToCloudSearch(southeast.lat) + '..' + degToCloudSearch(northwest.lat));

        var latitude_radians = degToRad(latitude);
        var longitude_radians = degToRad(longitude);
        var offset = APP_CONFIG.CLOUD_SEARCH_DEG_OFFSET;
        var scale = APP_CONFIG.CLOUD_SEARCH_DEG_SCALE;

        // Compile ranking algorithm (spherical law of cosines)
        // Note results are scaled up by 1000x.
        var rank_distance = '3958.761 * Math.acos(Math.sin(' + latitude_radians + ') * Math.sin(((latitude / ' + scale + ') - ' + offset + ') * 3.14159 / 180) + Math.cos(' + latitude_radians + ') * Math.cos(((latitude / ' + scale + ') - ' + offset + ') * 3.14159 / 180) * Math.cos((((longitude / ' + scale + ') - ' + offset + ') * 3.14159 / 180) - ' + longitude_radians + ')) * 1000';

        params['rank'] = 'distance';
        params['rank-distance'] = rank_distance;

        return_fields.push('distance');
    } else {
        params['rank'] = 'name';
    }

    params['bq'] = '(and ' + query_bits.join(' ') + ')';
    params['return-fields'] = return_fields.join(',');
    params['size'] = 26;

    return params;
}

function buildMapboxPin(size, shape, color, lat, lng) {
    /*
     * Generate the URL format for a mapbox static pin.
     */
    return 'pin-' + size + '-' + shape + '+' + color + '(' + lng + ',' + lat + ')';
}

function search() {
    /*
     * Execute a search using current UI state.
     */
    var latitude = parseFloat($search_latitude.val());
    var longitude = parseFloat($search_longitude.val());

    $search_results.empty();
    $search_results_map_loading.show();
    $search_results_map.css('opacity', '0.25');

    $.ajax({
        url: APP_CONFIG.CLOUD_SEARCH_PROXY_BASE_URL + '/cloudsearch/2011-02-01/search',
        data: buildCloudSearchParams(),
        dataType: 'jsonp',
        success: function(data) {
            $results_loading.hide();

            var markers = [];

            if (data['hits']['hit'].length > 0) {
                _.each(data['hits']['hit'], function(hit, i) {
                    var context = $.extend(APP_CONFIG, hit);
                    context['letter'] = LETTERS[i];

                    var html = JST.playground_item(context);
                    $search_results.append(html);

                    if (hit.data.latitude.length > 0) {
                        var lat = cloudSearchToDeg(hit.data.latitude[0]);
                        var lng = cloudSearchToDeg(hit.data.longitude[0]);

                        markers.push(buildMapboxPin('m', context['letter'], 'ff6633', lat, lng));
                    }
                });
            } else {
                $search_results.append('<li class="no-results">No results</li>');
            }

            if (latitude) {
                var search_map_width = RESULTS_MAP_WIDTH;
                var search_map_height = RESULTS_MAP_HEIGHT;

                if (RETINA) {
                    search_map_width = search_map_width * 2;
                    search_map_height = search_map_height * 2;
                    if (search_map_width > 640) {
                        search_map_width = 640;
                    }
                    if (search_map_height > 640) {
                        search_map_height = 640;
                    }
                }

                markers.push(buildMapboxPin('l', 'circle', '006633', latitude, longitude));

                $search_results_map.on('load', function() {
                    $search_results_map_loading.hide();
                    $search_results_map.css('opacity', '1.0');
                    $search_results_map.off('load');
                });
                $search_results_map.attr('src', 'http://api.tiles.mapbox.com/v3/' + BASE_LAYER + '/' + markers.join(',') + '/' + longitude + ',' + latitude + ',' + zoom + '/' + search_map_width + 'x' + search_map_height + '.png');
                $search_results_map_wrapper.show();
                $results_address.show();
            }
                
            console.log('before');
            ignore_hash_change = true;
            //$(window).off('hashchange', hashchange_callback);

            if ($search_address.val()) {
                hash.set({
                    'address': $search_address.val(),
                    'zoom': zoom
                });
            } else {
                hash.set({
                    'latitude': $search_latitude.val(),
                    'longitude': $search_longitude.val(),
                    'zoom': zoom
                });
            }
                
            //$(window).on('hashchange', hashchange_callback);
            ignore_hash_change = false;
            console.log('after');

            $search_results.show();
        },
        cache: true,
        jsonp: false,
        jsonpCallback: 'myCallback'
    });

    hide_search();
}

function reset_zoom() {
    zoom = RESULTS_DEFAULT_ZOOM;
    $zoom_in.removeAttr('disabled');
    $zoom_out.removeAttr('disabled');
}

function show_search() {
//    $search_form.show();
    $search_results_wrapper.hide();
    $search_again.hide();
    $search_title.show();
    $search_wrapper.hide();
}

function hide_search() {
//    $search_form.hide();
    $search_again.show();
    $search_wrapper.show();
}

function geolocate_callback(position) {
    hide_search();
    $search_address.val('');
    $search_help.hide();
    $search_results.empty();
    $search_results_map_wrapper.hide();
    $results_address.hide();
    $search_results_wrapper.show();

    $results_address.text('Showing Results Near You');

    $search_latitude.val(position.coords.latitude);
    $search_longitude.val(position.coords.longitude);
    $results_loading.show();
    search();
}

function hashchange_callback() {
    console.log('hash change');
    if (ignore_hash_change) {
        return false;
    }

    console.log(1);

    $search_address.val(hash.get('address') || '');
    var latitude = hash.get('latitude');
    var longitude = hash.get('longitude');
    zoom = parseInt(hash.get('zoom')) || zoom;

    console.log(2);

    if (latitude && longitude) {
        $search_latitude.val(latitude);
        $search_longitude.val(longitude);

        var position = { 'coords': { 'latitude': latitude, 'longitude': longitude } };
        geolocate_callback(position);
    } else if ($search_address.val()) {
        $search_form.submit();
    }

    console.log(3);
}

$(function() {
    $search_title = $('#search-title');
    $search_form = $('#search');
    $search_address = $('#search input[name="address"]');
    $search_again = $('#search-again');
    $search_divider = $search_form.find('h6.divider');
    $search_latitude = $('#search input[name="latitude"]');
    $search_longitude = $('#search input[name="longitude"]');
    $geolocate_button = $('#geolocate');
    $search_results_wrapper = $('#search-results-wrapper');
    $search_results = $('#search-results');
    $search_results_map_wrapper = $('#search-results-map-wrapper');
    $search_results_map = $('#search-results-map');
    $search_results_map_loading = $('#search-results-map-loading');
    $search_wrapper = $('#playground-results-wrap');
    $zoom_in = $('#zoom-in');
    $zoom_out = $('#zoom-out');
    $search_help = $('#search-help');
    $did_you_mean = $('#search-help ul');
    $search_help_us = $('#search-help-prompt');
    $results_address = $('#results-address');
    $no_geocode = $('#no-geocode');
    $results_loading = $('#results-loading');
    $playground_meta_hdr = $('#main-content').find('.about').find('h5.meta');
    $playground_meta_items = $('#main-content').find('.about').find('ul.meta');
    $alerts = $('.alerts');

    CONTENT_WIDTH = $('#main-content').width();
    RESULTS_MAP_WIDTH = CONTENT_WIDTH;
    RESULTS_MAP_HEIGHT = CONTENT_WIDTH;

    crs = L.CRS.EPSG3857;

    // Fetches the key from the URL. This could easily be undefined or null.
    var action = get_parameter_by_name('action');

    // If the URL parameter doesn't exist or is blank, don't do anything.
    // If it does exist, pass to write_message.
    // This block handles looking up the key from the URL and the message from the copy text.
    if ((action !== "undefined") && (action !== null)) {
        // Look up the message in the copy text.
        var message = COPYTEXT[action];
        // Only if the message exists should writeMessage() get called.
        if ((message !== "undefined") && (message !== null)) {
            // Use mustache for insertions
            _.templateSettings = {
                interpolate: /\{\{(.+?)\}\}/g
            };
            // Colorize the alert
            var klass = 'alert-info';
            // Add a close button; timeOut instead?
            var button = '<button type="button" class="close" data-dismiss="alert">&times;</button>';
            // Template up the alert
            var messageTemplate = _.template(
                '<div class="alert {{ klass }}">{{ button }}{{ text }}</div>'
            );
            // Pass it to the div
            $alerts.append(messageTemplate({
                klass: klass, button: button, text: message
            }));
        }
    }

    $geolocate_button.click(function() {
        reset_zoom();
        navigator.geolocation.getCurrentPosition(geolocate_callback);
        $results_address.html('Showing Results Near You');
    });

    $('#newyork').click(function() {
        $search_address.val('New York City, New York');
        $search_form.submit();
    });
    $('#huntley').click(function() {
        $search_address.val('Deicke Park, Huntley, Illinois');
        $search_form.submit();
    });
    $('#zip').click(function() {
        $search_address.val('79410');
        $search_form.submit();
    });

    $zoom_in.click(function() {
        zoom += 1;

        if (zoom == RESULTS_MAX_ZOOM) {
            $zoom_in.attr('disabled', 'disabled');
        }

        $zoom_out.removeAttr('disabled');

        search();
    });

    $zoom_out.click(function() {
        zoom -= 1;

        if (zoom == RESULTS_MIN_ZOOM) {
            $zoom_out.attr('disabled', 'disabled');
        }

        $zoom_in.removeAttr('disabled');

        search();
    });

    $did_you_mean.on('click', 'li', function() {
        var $this = $(this);
        var display_name = $this.data('display-name');
        var latitude = $this.data('latitude');
        var longitude = $this.data('longitude');

        $search_address.val(display_name);
        $search_latitude.val(latitude);
        $search_longitude.val(longitude);
        $results_address.html('Showing Results Near ' + display_name);

        $search_help.hide();
        $search_help_us.show();

        $results_loading.show();
        search();
    });

    $search_again.on('click', function() {
        show_search();
    });

    $search_form.submit(function() {
        if ($search_address.val() !== '') {
            reset_zoom();
            hide_search();
            $search_help.hide();
            $search_results.empty();
            $search_results_map_wrapper.hide();
            $results_address.hide();
            $no_geocode.hide();
            $search_results_wrapper.show();

            var address = $search_address.val();

            if (address) {
                $results_loading.show();

                $.ajax({
                    'url': 'http://open.mapquestapi.com/nominatim/v1/search.php?format=json&json_callback=playgroundCallback&q=' + address,
                    'type': 'GET',
                    'dataType': 'jsonp',
                    'cache': true,
                    'jsonp': false,
                    'jsonpCallback': 'playgroundCallback',
                    'contentType': 'application/json',
                    'success': function(data) {
                        // US addresses only, plzkthxbai.
                        data = _.filter(data, function(locale) {
                            return locale['display_name'].indexOf("United States of America") > 0;
                        });
                        $results_loading.hide();

                        if (data.length === 0) {
                            // If there are no results, show a nice message.
                            $did_you_mean.append('<li>No results</li>');
                            $no_geocode.show();
                        } else if (data.length == 1) {
                            // If there's one result, render it.

                            var locale = data[0];

                            $search_latitude.val(locale['lat']);
                            $search_longitude.val(locale['lon']);

                            $results_address.html('Showing Results Near ' + locale['display_name'].replace(', United States of America', ''));

                            $results_loading.show();
                            search();
                        } else {
                            // If there are many results,
                            // show the did-you-mean path.
                            $did_you_mean.empty();

                            _.each(data, function(locale) {
                                var context = $.extend(APP_CONFIG, locale);
                                var html = JST.did_you_mean_item(context);

                                $did_you_mean.append(html);

                            });

                            $search_help.show();
                            $search_help_us.hide();
                        }
                    }
                });
            } else {
                $search_latitude.val('');
                $search_longitude.val('');
                $results_loading.show();
                search();
            }
        }
        return false;
    });

    if (GEOLOCATE) {
        $geolocate_button.show();
        $search_divider.show();
    }

    hashchange_callback();

    $(window).on('hashchange', function() {
        hashchange_callback();
    });
});
