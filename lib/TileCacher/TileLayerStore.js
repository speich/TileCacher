define(['dojo/_base/declare', 'dojo/Deferred', '/lib/Leaflet/leaflet-src.js'], function(declare, Deferred, L) {

	var autoindex = 0;

	/**
	 * @module TileCacher/TileLayerStore
	 * @extends L.TileLayer
	 */
	return declare([L.TileLayer], {

		name: 'tiles-',

		constructor: function(url, params, store) {
			this.name = params.name || this.name + (autoindex++); // name is used as object store
			this.store = store;
		},

		/**
		 * Convert image to a data url for db storage.
		 * @param {Image} image
		 * @return {string}
		 */
		imageToDataUri: function(image) {
			var context, canvas = window.document.createElement('canvas');

			canvas.width = image.naturalWidth || image.width;
			canvas.height = image.naturalHeight || image.height;

			context = canvas.getContext('2d');
			context.drawImage(image, 0, 0);

			return canvas.toDataURL('image/png');
		},

		/**
		 * Prepare tile to load from url.
		 * @param {Image} tile image decorated with additional properties
		 * @param tilePoint
		 * @private
		 * @param src
		 */
		load: function(tile, tilePoint, src) {
			var options = this.options,
				dfd = new Deferred();

			if (options.proxy) {
				src = options.proxy + '?img=' + src + (options.referrer ? '&ref=' + options.referrer: '');
			}
			if (options.crossOrigin) {
				tile.crossOrigin = this.options.crossOrigin;
			}
			tile._layer = this;
			tile.onload = function() {
				//this._tileOnLoad;     // parent method
				L.TileLayer.prototype._tileOnLoad.apply(tile, arguments);
				dfd.resolve(tile);
			};
			tile.onerror = function(evt) {
				L.TileLayer.prototype._tileOnError.apply(tile, arguments);
				//this._tileOnError;   // parent method
				dfd.cancel(evt);
			};

			// this will load the tile and trigger the onload event
			tile.src = src;

			this.fire('tileloadstart', {
				tile: tile,
				url: tile.src
			});

			return dfd;
		},

		/**
		 * Load tile from cache or url.
		 * If tile was previously cached it's just loaded from the cache. Otherwise it's loaded from url and then
		 * added to the cache.
		 * @param {Image} tile image decorated with additional properties
		 * @param {Point} tilePoint
		 */
		_loadTile: function(tile, tilePoint) {
			var key, self = this, src,
			options = this.options;

			this._adjustTilePoint(tilePoint);

			key = this.getKey(tilePoint, options.zoomOffset);

			// try to load tile (image) from db, maybe it was already cached previously
			this.store.get(this.name, key).then(function(result) {
				var src;

				// not cached previously, add to store after tile onload
				if (typeof result === 'undefined' && !options.useCacheOnly) {
					// loadTile by setting its src and handle events
					src = self.getTileUrl(tilePoint);
				}
				else {
					src = result;
				}

				if (typeof result === 'undefined' && !options.useCacheOnly) {
					self.load(tile, tilePoint, src).then(function(tile) {
						console.log(key, ' not found, adding it to cache');

						var img = self.imageToDataUri(tile);

						self.store.add(self.name, key, img);
					});
				}
				else {
					// loads a tile by setting its src and setup event handlers
					console.log(key, ' found');
					this.load(tile, tilePoint, src);
				}
			},
			// db error
			function(err) {
				console.log(err);
			});
		},

		/**
		 * Create a key to store a tile.
		 * @param tilePoint
		 * @return {string}
		 */
		createKey: function(tilePoint) {
			return tilePoint.z + ',' + tilePoint.y + ',' + tilePoint.x;
		},

		/**
		 * Get key to access a stored tile.
		 * @param tilePoint
		 * @param zoomOffset
		 * @return {string}
		 */
		getKey: function(tilePoint, zoomOffset) {
			// tiles get stored with corrected z offset, because tilePoint contains already offset already,
			// but for display we need to revert corrections
			zoomOffset = 0;
			return (tilePoint.z - zoomOffset) + ',' + tilePoint.y + ',' + tilePoint.x;
		}
	});
});