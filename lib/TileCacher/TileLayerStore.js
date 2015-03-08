define(['dojo/_base/declare', 'dojo/_base/lang', 'lib/Leaflet/leaflet.js'], function(declare, lang, L) {

	var autoindex = 0;

	/**
	 * @module TileCacher/TileLayerStorage
	 * @extends L.TileLayer
	 */
	return declare([L.TileLayer], {

		name: 'tiles-',

		constructor: function(url, params, store) {
			this.name = params.name || this.name + (autoindex++); // name is used as object store
			this.store = store
		},

		/**
		 * Convert image to a data url for db storage.
		 * @param {Image} image
		 * @return {string}
		 */
		_imageToDataUri: function(image) {
			var context, canvas = window.document.createElement('canvas');

			canvas.width = image.naturalWidth || image.width;
			canvas.height = image.naturalHeight || image.height;

			context = canvas.getContext('2d');
			context.drawImage(image, 0, 0);

			return canvas.toDataURL('image/png');
		},

		/**
		 * Adds tile to storage.
		 * @param {Image} tile image decorated with additional properties
		 */
		_tileOnLoadWithCache: function(tile) {
			var img;

			if (this.store) {
				img = this._imageToDataUri(tile);
				this.store.add(this.name, tile._storageKey, img);
			}
			L.TileLayer.prototype._tileOnLoad.apply(tile, arguments);
		},

		/**
		 * Prepare tile for caching.
		 * @param {Image} tile image decorated with additional properties
		 * @param tilePoint
		 * @param value
		 * @param {bool} cacheTiles
		 * @private
		 */
		_setUpTile: function(tile, tilePoint, value, cacheTiles) {
			var query, options = this.options;

			tile._layer = this;

			if (cacheTiles) {
				tile._storageKey = this.createKey(tilePoint);
				if (options.crossOrigin) {
					tile.crossOrigin = this.options.crossOrigin;
				}
				tile.onload = lang.hitch(this, function() {
					this._tileOnLoadWithCache(tile);
				});
			}
			else {
				tile.onload = this._tileOnLoad;
			}
			tile.onerror = this._tileOnError;

			if (options.proxy && cacheTiles) {
				query = '?img=' + value + (options.referrer ? '&ref=' + options.referrer : '');
				tile.src = this.options.proxy + query;
			}
			else {
				tile.src = value;
			}
		},

		/**
		 * Load tile from cache or url.
		 * If tile was previously cached it's just loaded from the cache. Otherwise it's loaded from url and then
		 * added to the cache.
		 * @param {Image} tile image decorated with additional properties
		 * @param {Point} tilePoint
		 * @private
		 */
		_loadTile: function(tile, tilePoint) {
			var key, self = this,
				options = this.options;

			this._adjustTilePoint(tilePoint);
			key = this.getKey(tilePoint, options.zoomOffset);

			if (this.store) {
				// try to load tile from db
				this.store.get(this.name, key)
					.then(function(value) {

						// tile found
						if (value) {
							self._setUpTile(tile, tilePoint, value, false);
						}
						// no tile found, setup tile to be added to storage
						else if (!options.cacheOnly) {
							self._setUpTile(tile, tilePoint, self.getTileUrl(tilePoint), options.cacheTiles);
						}
						else {
							self._tileOnError.call(tile);
						}
					},
					// error, no tile found
					function(err) {
						console.log(err);
					});
			}
			// no database given just use url
			else {
				self._setUpTile(tile, tilePoint, self.getTileUrl(tilePoint), false);
			}
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