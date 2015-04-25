define(['dojo/_base/declare', 'dojo/Deferred', 'Leaflet/leaflet'], function(declare, Deferred, L) {
	'use strict';

	/**
	 * @module TileCacher/MenuControl
	 */
	return declare([L.Control], {

		className: 'leaflet-control configMenu',
		domNode: null,	// set by onAdd to map

		options: {
			collapsed: true,
			autoZIndex: true
		},

		onAdd: function (map) {
			this._initLayout();


			return this._container;
		},


		_initLayout: function() {

			var className = 'leaflet-control-layers';
		}
	});
});
