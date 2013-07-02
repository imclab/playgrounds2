var $edit_map = null;
var $search_address = null;
var $search_address_button = null;
var $search_help = null;
var $did_you_mean = null;
var $no_geocode = null;
var $geolocate_button = null;

var $possible_street = null;
var $possible_city = null;
var $possible_state = null;
var $possible_zip_code = null;
var $possible_latitude = null;
var $possible_longitude = null;
var $accept_address = null;

var $address = null;
var $city = null;
var $state = null;
var $zip_code = null;
var $latitude = null;
var $longitude = null;

$(function() {
    $search_address = $('#search-address');
    $search_address_button = $('#search-address-button');
    $search_help = $('#search-help');
    $did_you_mean = $('#did-you-mean-edit');
    $no_geocode = $('#no-geocode');
    $geolocate_button = $('#geolocate');

    $possible_street = $('#possible-street');
    $possible_city = $('#possible-city');
    $possible_state = $('#possible-state');
    $possible_zip_code = $('#possible-zip');
    $possible_latitude = $('#possible-latitude');
    $possible_longitude = $('#possible-longitude');
    $accept_address = $('#accept-address')

    $address = $('input[name="address"]');
    $city = $('input[name="city"]');
    $state = $('input[name="state"]');
    $zip_code = $('input[name="zip_code"]');
    $latitude = $('input[name="latitude"]');
    $longitude = $('input[name="longitude"]');

    map = L.map('edit-map').setView([38.9, -77], 7);
    map_layer = L.mapbox.tileLayer('geraldrich.map-h0glukvl', {
        detectRetina: true,
        retinaVersion: 'geraldrich.map-bmvyaxm2'
    }).addTo(map);
    grid_layer = L.mapbox.gridLayer('geraldrich.map-h0glukvl').addTo(map);
    map.addControl(L.mapbox.gridControl(grid_layer));

    $search_address_button.click(function() {
        var address = $search_address.val();

        if (address) {
            $search_help.hide();
            $no_geocode.hide();

            $.ajax({
                'url': 'http://open.mapquestapi.com/geocoding/v1/address',
                'data': { 'location': address },
                'dataType': 'jsonp',
                'contentType': 'application/json',
                'success': function(data) {
                    var locales = data['results'][0]['locations'];

                    locales = _.filter(locales, function(locale) {
                        return locale['adminArea1'] == 'US';
                    });

                    if (locales.length == 0) {
                        $did_you_mean.append('<li>No results</li>');

                        $no_geocode.show();
                    } else if (locales.length == 1) {
                        var locale = locales[0];

                        map.setView([locale['latLng']['lat'], locale['latLng']['lng']], 12);
                        $possible_street.val(locale['street']);
                        $possible_city.val(locale['adminArea5']);
                        $possible_state.val(locale['adminArea3']);
                        $possible_zip_code.val(locale['postalCode']);
                        $possible_latitude.val(locale['latLng']['lat']);
                        $possible_longitude.val(locale['latLng']['lng']);

                        // $results_address.html('Showing results near ' + formatMapQuestAddress(locale));
                    } else {
                        $did_you_mean.empty();

                        _.each(locales, function(locale) {
                            var context = $.extend(APP_CONFIG, locale);
                            context['address'] = formatMapQuestAddress(locale);

                            var html = JST.did_you_mean_item(context);

                            $did_you_mean.append(html);
                        });

                        $search_help.show();
                    }
                }
            });
        }  
    });

    $did_you_mean.on('click', 'li', function() {
        var $this = $(this);
        var street = $this.data('street');
        var city = $this.data('city');
        var state = $this.data('state');
        var zip = $this.data('zip');
        var latitude = $this.data('latitude');
        var longitude = $this.data('longitude');

        map.setView([latitude, longitude], 12);

        $possible_street.val(street);
        $possible_city.val(city);
        $possible_state.val(state);
        $possible_zip_code.val(zip);
        $possible_latitude.val(latitude);
        $possible_longitude.val(longitude);

        $search_help.hide();
    });

    var reverseGeocodeCallback = function(locale) {
        $possible_street.val(locale['street']);
        $possible_city.val(locale['adminArea5']);
        $possible_state.val(locale['adminArea3']);
        $possible_zip_code.val(locale['postalCode']);
        $possible_latitude.val(locale['latLng']['lat']);
        $possible_longitude.val(locale['latLng']['lng']);

        $search_address.val(formatMapQuestAddress(locale));
    }

    $geolocate_button.click(function() {
        navigator.geolocation.getCurrentPosition(function(position) {
            $search_help.hide();
            $no_geocode.hide();

            map.setView([position.coords.latitude, position.coords.longitude], 12);

            reverseGeocode(position.coords.latitude, position.coords.longitude, reverseGeocodeCallback)
        });
    });

    $accept_address.click(function() {
        if ($address.val() != $possible_street.val()) {
            $address.attr('data-changed', 'true');
            $address.val($possible_street.val())
        }

        if ($city.val() != $possible_city.val()) {
            $city.attr('data-changed', 'true');
            $city.val($possible_city.val());
        }

        if ($state.val() != $possible_state.val()) {
            $state.attr('data-changed', 'true');
            $state.val($possible_state.val());
        }

        if ($zip_code.val() != $possible_zip_code.val()) {
            $zip_code.attr('data-changed', 'true');
            $zip_code.val($possible_zip_code.val());
        }

        if ($latitude.val() != $possible_latitude.val()) {
            $latitude.attr('data-changed', 'true');
            $latitude.val($possible_latitude.val());
        }

        if ($longitude.val() != $possible_longitude.val()) {   
            $longitude.attr('data-changed', 'true');
            $longitude.val($possible_longitude.val());
        }
    });

    map.on('moveend', function() {
        var latlng = map.getCenter();
        reverseGeocode(latlng.lat,latlng.lng, reverseGeocodeCallback);
    })
});
