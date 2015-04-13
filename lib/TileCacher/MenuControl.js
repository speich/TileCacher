define(['dojo/_base/declare', 'dojo/Deferred', '/lib/Leaflet/leaflet-src.js'], function (declare, Deferred, L) {
    'use strict';

    /**
     * @module TileCacher/MenuControl
     */
    return declare([L.Control], {

        options: null,
        constructor: function () {
            this.options = {
                position: 'topRight'
            };
        }
    });
});
