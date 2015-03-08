define(['dojo/_base/declare', 'dojo/Deferred', 'lib/Leaflet/leaflet.js'], function (declare, Deferred, L) {
    'use strict';

    return declare([L.Control], {

        options: null,
        constructor: function () {
            this.options = {
                position: 'topRight'
            };
        }
    });
});
