define(['dojo/_base/lang', 'TileCacher/IndexedDbTileStore', 'TileCacher/TileLayerOffline', 'TileCacher/TileCache', 'Leaflet/leaflet'],
function(lang, IndexedDbTileStore, TileLayerOffline, TileCache, L) {

	return {
		layers: {},
		layersConfig: null,
		overlays: null,
		currentBaseLayer: null,
		baseLayerName: '',
		errorTileUrl: 'app/icon-ente-256.png',
		rectangleBounds: null, // references the current drawn rectangle as LatLngBound, which represent a rectangular geographical area on the map.
		store: null,
		storeVersion: 1,
		map: null,

		init: function(params) {
			lang.mixin(this, params);
			this.store = new IndexedDbTileStore(this.storeVersion);
			this.initLayers();
			this.showCurrentPosition();
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

		cacheTiles: function() {
			var i, cache,
			maxTiles = 0,
			zoomLevels = document.querySelectorAll('.storageForm input[type=checkbox]'),
			elTilesToSave = document.getElementById('tilesToSave');

			elTilesToSave.max = 0;

			cache = new TileCache({
				map: this.map,
				layer: this.currentBaseLayer
			});

			for (i = 0; i < zoomLevels.length; i++) {
				if (zoomLevels[i].checked) {
					maxTiles += cache.getNumTiles(this.rectangleBounds, Number(zoomLevels[i].value));
				}
			}
			elTilesToSave.max = maxTiles;
			for (i = 0; i < zoomLevels.length; i++) {
				if (zoomLevels[i].checked) {
					cache.saveTiles(this.rectangleBounds, Number(zoomLevels[i].value));
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
		},

		/**
		 * Obtains the devices current location and centers the map accordingly.
		 */
		showCurrentPosition: function() {
			var self = this, geoId, timer,
				timeout = 4000,
				geo = navigator.geolocation,
				positionOptions = {
					enableHighAccuracy: true,
					maximumAge: 0
				};

			if (!geo) {
				return false;
			}

			geoId = geo.watchPosition(function(position) {
				var center = L.latLng(position.coords.latitude, position.coords.longitude);

				self.map.setView(center, self.map.zoom);
				geo.clearWatch(geoId);
				window.clearTimeout(timer);
			}, null, positionOptions);

			// cancel getting precise position after 4 seconds waiting
			timer = window.setTimeout(function() {
				geo.clearWatch(geoId);

				// use fast imprecise method instead
				geo.getCurrentPosition(function(position) {
					// initial
					var center = L.latLng(position.coords.latitude, position.coords.longitude);

					self.map.setView(center, self.map.zoom);
				}, function() {
					console.log('Sorry, but I\'m unable to retrieve your current location');
				});
			}, timeout);
		}
	};
});