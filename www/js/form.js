$(function() {
    var playground = {
        "constants": {
            "ACTION": get_parameter_by_name('action'),
            "BASE_LAYER": APP_CONFIG.MAPBOX_BASE_LAYER,
            "CONTENT_WIDTH": 0,
            "GEOLOCATE": Modernizr.geolocation,
            "LOCATOR_DEFAULT_ZOOM": 15,
            "PAGE_WIDTH": 0,
            "RESULTS_MAP_WIDTH": 500,
            "RESULTS_MAP_HEIGHT": 500,
            "RESULTS_MAX_ZOOM": 16,
            "RESULTS_MIN_ZOOM": 8,
            "RESULTS_DEFAULT_ZOOM": 14,
            "RETINA": window.devicePixelRatio > 1
        },
        "fields": {
            // Many other fields are set dynamically.
            "locator_map": $('#locator-map'),
            "modal_map": $('#modal-locator-map'),
            "meta_items": $('#main-content').find('.about').find('ul.meta'),
            "meta_hdr": $('#main-content').find('.about').find('h5.meta')
        },
        "callbacks": {
            "geocode": function() {
                playground.fields.latitude.attr('value', locale['latLng']['lat']);
                playground.fields.longitude.attr('value', locale['latLng']['lng']);
                require_us_address(locale);
                playground.form.geocode_fields();
                $('#form').submit();
            },
            "reverse_geocode": function() {
                playground.fields.address.val(locale['street']);
                playground.fields.city.val(locale['adminArea5']);
                playground.fields.state.val(locale['adminArea3']);
                playground.fields.zip_code.val(locale['postalCode']);
                playground.fields.latitude.val(locale['latLng']['lat']);
                playground.fields.longitude.val(locale['latLng']['lng']);
            }
        },
        "form": {
            "submit": function() {
                if ( playground.fields.reverse_geocode.attr('checked') !== 'checked' ) {
                    playground.geocode(playground.form.prepare_geocode_string(), playground.callbacks.geocode);
                } else {
                    playground.form.geocode_fields();
                    playground.fields.reverse_geocoded.attr('checked', 'checked');
                    playground.fields.reverse_geocoded.attr('data-changed', 'true');
                    $('#form').submit();
                }
                return false;
            },
            "validate": function() {
                var required_fields = $('#form input[data-required="true"]');
                var flagged_fields = [];
                $.each(required_fields, function(index, required_field){
                    if (required_field.val === '') {
                        flagged_fields.push(required_field);
                    }
                });
                if (flagged_fields.length > 0){
                    playground.form.flag_fields(flagged_fields);
                    return false;
                } else {
                    return true;
                }

            },
            "flag_fields": function(flagged_fields) {
                $(required_field).addClass('flagged');
            },
            "prepare_geocode_string": function() {
                var geocode_string = playground.address.val();
                geocode_string += ' ' + playground.city.val();
                geocode_string += ', ' + playground.state.val();
                return geocode_string + ' ' + playground.zip_code.val();
            },
            "geocode_fields": function() {
                // Set the base location fields to "changed" so that they will POST.
                playground.fields.address.attr('data-changed', 'true');
                playground.fields.city.attr('data-changed', 'true');
                playground.fields.state.attr('data-changed', 'true');
                playground.fields.zip_code.attr('data-changed', 'true');
                playground.fields.latitude.attr('data-changed', 'true');
                playground.fields.longitude.attr('data-changed', 'true');

                // Try to set the state to a proper state name.
                playground.fields.state.val(STATE_NAME_TO_CODE[playground.fields.state.val()]);

                // Reset the locator map.
                playground.fields.locator_map.data('latitude', playground.fields.latitude.val());
                playground.fields.locator_map.data('longitude', playground.fields.longitude.val());
                resize_locator_map();
            }
        },
        "map": {
            "init": function() {
                /*
                * Initializes the map.
                */
                map = L.map('edit-map', {
                    minZoom: 11,
                    scrollWheelZoom: false
                });

                map_layer = L.mapbox.tileLayer(BASE_LAYER).addTo(map);
                grid_layer = L.mapbox.gridLayer(BASE_LAYER).addTo(map);
                map.addControl(L.mapbox.gridControl(grid_layer));
                playground.map.center_editor();

                if (playground.fields.latitude.val() !== '' && playground.fields.longitude.val() !== '') {
                    map.setView([
                            playground.fields.latitude.val(),
                            playground.fields.longitude.val()],
                        playground.constants.LOCATOR_DEFAULT_ZOOM);
                } else {
                    map.setView([38.9, -77], 12);
                }
            },
            "center_editor": function() {
                map.invalidateSize(false);
                var marker_left = $('#edit-map').width()/2 - 8;
                var marker_top = $('#edit-map').height()/2 - 8;
                $('#edit-marker').css({'left': marker_left, 'top': marker_top});
            },
            "resize_locator": function() {
                playground.constants.CONTENT_WIDTH = $('#main-content').width();
                playground.constants.PAGE_WIDTH = $('body').outerWidth();
                var lat = playground.fields.locator_map.data('latitude');
                var lon = playground.fields.locator_map.data('longitude'); // Because iOS refuses to obey toString()
                var map_path;
                var new_height;
                var new_width = playground.constants.CONTENT_WIDTH;

                if (playground.constants.PAGE_WIDTH > 480) {
                    new_width = Math.floor(new_width / 2) - 22;
                }
                new_height = Math.floor(playground.constants.CONTENT_WIDTH / 3);

                if (playground.constants.RETINA) {
                    new_width = new_width * 2;
                    if (new_width > 640) {
                        new_width = 640;
                    }
                    new_height = Math.floor(new_width / 3);
                }

                map_path = 'http://api.tiles.mapbox.com/v3/' + playground.constants.BASE_LAYER + '/pin-m-star+ff6633(' + lon + ',' + lat + ')/' + lon + ',' + lat + ',' + LOCATOR_DEFAULT_ZOOM + '/' + new_width + 'x' + new_height + '.png';
                playground.fields.locator_map.attr('src', map_path);
                playgrounds.fields.modal_map.attr('src', map_path);
            }
        },
        "locate_me": function() {
            navigator.geolocation.getCurrentPosition(function(position) {
                map.setView([position.coords.latitude, position.coords.longitude], playground.constants.LOCATOR_DEFAULT_ZOOM);
                playground.reverse_geocode(position.coords.latitude, position.coords.longitude, playground.callbacks.reverse_geocode);
            });
        },
        "activate_path": function(path) {
            $('#form .path').hide();
            $('.' + path).show();
            if ( $(this).attr('data-reverse-geocode') === 'checked' ) {
                playground.fields.reverse_geocode.attr('checked', 'checked');
            }
        },
        "geocode": function(address_string, callback) {
            $.ajax({
                'url': 'http://open.mapquestapi.com/geocoding/v1/?inFormat=kvp&location=' + address_string,
                'dataType': 'jsonp',
                'contentType': 'application/json',
                'success': function(data) {
                    var locales = data['results'][0]['locations'];
                    var locale = locales[0];
                    var zip_list = [];
                    callback(locale);
                }
            });
        },
        "reverse_geocode": function(latitude, longitude, callback) {
            $.ajax({
                'url': 'http://open.mapquestapi.com/geocoding/v1/reverse',
                'data': { 'location': latitude + ',' + longitude },
                'dataType': 'jsonp',
                'contentType': 'application/json',
                'success': function(data) {
                    var locales = data['results'][0]['locations'];
                    var locale = locales[0];
                    var zip_list = [];

                    if (locale['adminArea4'] == 'District of Columbia')  {
                        locale['adminArea5'] = 'Washington';
                        locale['adminArea3'] = 'District of Columbia';
                    }

                    callback(locale);
                }
            });
        },
        "init": function() {
            // Set all of the playground field names.
            // List of fields we'd like to set up.
            var field_list = [
                "address",
                "city",
                "state",
                "zip_code",
                "latitude",
                "longitude",
                "reverse_geocoded"];

            // Loop and add a playgrounds.field attribute for each of these fields.
            $.each(field_list, function(index, field_name){
                playground.fields[field_name] = $('input[name="' + field_name + '"]');
            });

            // Set up the screen width constants.
            playground.constants.CONTENT_WIDTH = $('#main-content').width();
            playground.constants.PAGE_WIDTH = $('body').outerWidth();
            playground.constants.RESULTS_MAP_WIDTH = playground.constants.CONTENT_WIDTH;
            playground.constants.RESULTS_MAP_HEIGHT = playground.constants.CONTENT_WIDTH;
            if (playground.constants.RETINA) {
                playground.constants.BASE_LAYER = APP_CONFIG.MAPBOX_BASE_LAYER_RETINA;
                playground.constants.LOCATOR_DEFAULT_ZOOM += 1;
                playground.constants.RESULTS_DEFAULT_ZOOM += 1;
            }

            // Activate the default geocode path. In this case, the map?
            playground.activate_path('path-2');

            // Sets up the click functions for each of the buttons.
            // Requires a data-action attribute on the button element.
            $('button').each(function(index, action){
                $(this).on('click', function(){
                    playground[$(this).attr('data-action')]($(this).attr('data-path'));
                    return false;
                });
            });

            // Watch for changes to the playground form.
            $('#form .input').blur(function(){

                // Set a changed attribute.
                $(this).attr('data-changed', 'true');

                // Remove a validation flag, if it exists.
                $(this).removeClass('flagged');
            });

            // Check to see if we've got a message to show.
            if (playground.constants.ACTION !== null){

                // We'll name the message div after the URL param.
                $('#' + playground.constants.ACTION).toggleClass('hide');
            }

            // Set up the map.
            playground.map.init();

            // Watch the map.
            // Perform a reverse geocode when the map is finished moving.
            map.on('moveend', function() {
                var latlng = map.getCenter();
                playground.reverse_geocode(latlng.lat, latlng.lng, playground.callbacks.reverse_geocode);
            });

            // Set up the features tooltip.
            $('.playground-features i').tooltip( { trigger: 'click' } );

            // Do this thing with the map.
            if ( $('#locator-map') ) {
                playground.map.resize_locator_map();
                $(window).resize(_.debounce(playground.map.resize_locator_map, 100));
            }

            // All of this meta_hdr and meta_items stuff.
            playground.fields.meta_hdr.html(playground.fields.meta_hdr.html() + ' &rsaquo;');
            playground.fields.meta_items.hide();
            playground.fields.meta_hdr.on('click', function() {
                playground.fields.meta_items.slideToggle('fast');
            });

        }
    };

    // Initialize the playground object.
    playground.init();
});
