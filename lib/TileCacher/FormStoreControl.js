define([
	'dojo/dom-construct',
	'Leaflet/leaflet'
], function(domConstruct, L) {
	'use strict';

	/**
	 * @module TileCacher/FormStoreControl
	 * @extends L.Control
	 */
	return L.Control.extend({
		className: 'leaflet-control storageForm',
		domNode: null,	// set by onAdd to map
		options: {
			maxZoom: 8
		},

		initEvents: function() {
			var self = this;

			this._map.on({
				'draw:created': function() {
					self.reset();
					self.domNode.classList.add('display');
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

			div = domConstruct.create('div', {
				innerHTML: '<h2>Tile Storage</h2>',
				className: this.className
			});

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
		}
	});
});