define(['dojo/_base/lang', 'TileCacher/IndexedDbTileStore', 'TileCacher/TileLayerOffline', 'TileCacher/TileCache'],
function(lang, IndexedDbTileStore, TileLayerOffline, TileCache) {

	return {
		layers: {},
		layersConfig: null,
		overlays: null,
		currentBaseLayer: null,
		baseLayerName: '',
		errorTileUrl: 'app/icon-ente-256.png',
		rectangleBounds: null,
		store: null,
		storeVersion: 1,
		map: null,

		init: function(params) {
			lang.mixin(this, params);
			this.store = new IndexedDbTileStore(this.storeVersion);
			this.initLayers();
		},

		initLayers: function() {
			for (var name in this.layersConfig) {
				var options;

				if (this.layersConfig.hasOwnProperty(name)) {
					options = this.layersConfig[name].options;
					options.name = name;
					options.errorTileUrl = options.errorTileUrl || this.errorTileUrl;
					this.layersConfig[name].map = this.layersConfig[name].map || {};

					// store tiles of each layer in its own object store
					this.store.objStores.push(name);	// set name of object store
					this.layers[name] = new TileLayerOffline(this.layersConfig[name].url, options, this.store);
				}
			}
			this.currentBaseLayer = this.layers[this.baseLayerName];
		},

		saveTiles: function() {
			var i, cache,
			maxTiles = 0,
			nl = document.querySelectorAll('.storageForm input[type=checkbox]'),
			elTilesToSave = document.getElementById('tilesToSave');

			elTilesToSave.max = 0;

			cache = new TileCache({
				map: this.map,
				layer: this.currentBaseLayer
			});

			for (i = 0; i < nl.length; i++) {
				if (nl[i].checked) {
					maxTiles += cache.getNumTiles(this.rectangleBounds, nl[i].value);
				}
			}
			elTilesToSave.max = maxTiles;
			for (i = 0; i < nl.length; i++) {
				if (nl[i].checked) {
					cache.saveTiles(this.rectangleBounds, nl[i].value);
				}
			}
		},

		/**
		 * Set the label of the checkbox showing the number of tiles to update.
		 * @param checkbox
		 * @param {LatLngBounds} bounds
		 */
		setLabel: function(checkbox, bounds) {
			if (checkbox.checked) {
				var cache = new TileCache({
					map: this.map,
					layer: this.currentBaseLayer
				});

				checkbox.nextSibling.innerHTML = cache.getNumTiles(bounds, checkbox.value);
				cache = null;
			}
			else {
				checkbox.nextSibling.innerHTML = '';
			}
		}
	};
});