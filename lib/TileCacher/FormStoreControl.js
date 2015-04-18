define([
	'dojo/_base/declare',
	'dojo/dom-construct',
	'TileCacher/TileCache',
	'lib/Leaflet/leaflet.js'
], function(declare, domConstruct, TileCache) {
	'use strict';

	/**
	 * @module TileCacher/FormStoreControl
	 * @extends L.Control
	 */
	return declare([L.Control], {
		className: 'leaflet-control storageForm',
		domNode: null,	// set by onAdd to map
		options: {
			maxZoom: 8
		},

		initEvents: function() {
			var self = this;

			this.options.app.map.on({
				'draw:created': function() {
					self.reset();
					self.domNode.style.visibility = 'visible';
					self.domNode.style.display = 'block';
				},
				'draw:deleted': self.reset,
				'draw:edited': self.reset
			});
		},

		onRemove: function() {
			this.domNode = null;
		},

		onAdd: function(map) {
			var div, div2, len;

			div = L.DomUtil.create('div', this.className);
			div.innerHTML = '<h2>Tile Storage</h2>';

			len = map.getMaxZoom();
			len = isFinite(len) ? len : this.options.maxZoom;

			for (var i = 0; i < len; i++) {
				domConstruct.create('label', {
					for: 'fldZoomLevel' + i,
					innerHTML: 'zoom level ' + (i + 1)
				}, div);

				domConstruct.create('input', {
					type: 'checkbox',
					id: 'fldZoomLevel' + i,
					value: i
				}, div);

				domConstruct.create('span', null, div);
				domConstruct.create('br', null, div);
			}

			div2 = domConstruct.create('div', {
				className: 'tileInfo',
				innerHTML: '<span># of tiles to save:</span><span id="numTilesToSave"></span><br>'
			}, div);

			domConstruct.create('progress', {
				id: 'tilesToSave',
				innerHTML: '<span>0</span>%',
				value: 0
			}, div2);
			domConstruct.create('span', {
				id: 'numTilesToSave'
			}, div2);

			domConstruct.create('button', {
				id: 'buttStorageControl',
				innerHTML: 'save tiles'
			}, div);

			this.domNode = div;

			return div;
		},

		/**
		 * Reset to form elements.
		 */
		reset: function() {
			var nl, el = document.getElementById('tilesToSave');

			el.value = 0;
			el.max = 0;
			el.querySelector('span').innerHTML = '0';

			document.getElementById('numTilesToSave').innerHTML = '';

			nl = document.querySelectorAll('.storageForm input[type=checkbox]');
			for (var i = 0; i < nl.length; i++) {
				nl[i].checked = false;
				nl[i].nextSibling.innerHTML = '';
			}
		},

		/**
		 * Display progress bar when saving tiles.
		 * @param value
		 */
		updateProgress: function(value) {
			var el = document.getElementById('tilesToSave');

			el.value = value;
			el.querySelector('span').innerHTML = Math.floor((100 / el.max) * value);
			document.getElementById('numTilesToSave').innerHTML = ' ' + (value == el.max ? el.max +', done' : value + '/' + el.max);
		},

		/**
		 * Set the label of the checkbox showing the number of tiles to update.
		 * @param checkbox
		 * @param {LatLngBounds} bounds
		 */
		setLabel: function(checkbox, bounds) {
			if (checkbox.checked) {
				var cache = new TileCache({
					map: this.options.app.map,
					layer: this.options.app.currentBaseLayer
				});

				checkbox.nextSibling.innerHTML = cache.getNumTiles(bounds, checkbox.value);
				cache = null;
			}
			else {
				checkbox.nextSibling.innerHTML = '';
			}
		}

	});
});