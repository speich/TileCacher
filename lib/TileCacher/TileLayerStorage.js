define(['dojo/_base/declare', 'dojo/_base/lang', 'lib/Leaflet/leaflet.js'], function(declare, lang, L) {

	var autoindex = 0;

	/**
	 * @module TileCacher/TileLayerStorage
	 */
	return declare([L.TileLayer], {

		name: 'tiles-',

		constructor: function(url, params) {
			this.name = params.name || this.name + (autoindex++); // name is used as object store
		},

		/**
		 * Convert image to a data url for db storage.
		 * @param image
		 * @returns {string}
		 * @private
		 */
		_imageToDataUri: function(image) {
			var context, canvas = window.document.createElement('canvas');

			canvas.width = image.naturalWidth || image.width;
			canvas.height = image.naturalHeight || image.height;

			context = canvas.getContext('2d');
			context.drawImage(image, 0, 0);

			return canvas.toDataURL('image/png');
		},

		_tileOnLoadWithCache: function(tile) {
			var img, storage = this.options.storage;

			if (storage) {
				img = this._imageToDataUri(tile);
				storage.add(this.name, tile._storageKey, img);
			}
			L.TileLayer.prototype._tileOnLoad.apply(tile, arguments);
		},

		_setUpTile: function(tile, key, value, cache) {
			var query, options = this.options;

			tile._layer = this;

			if (cache) {
				// add tile to cache
				tile._storageKey = key;
				if (options.crossOrigin) {
					tile.crossOrigin = this.options.crossOrigin;
				}
				tile.onload = lang.hitch(this, function() {
					this._tileOnLoadWithCache(tile);
				});
			}
			else {
				// load tile from cache
				tile.onload = this._tileOnLoad;
			}
			tile.onerror = this._tileOnError;

			if (options.proxy && cache) {
				query = '?img=' + value + (options.referrer ? '&ref=' + options.referrer : '');
				tile.src = this.options.proxy + query;
			}
			else {
				tile.src = value;
			}
		},

		_loadTile: function(tile, tilePoint) {
			var key, self = this,
				options = this.options,
				storage = options.storage;

			this._adjustTilePoint(tilePoint);
			key = tilePoint.z + ',' + tilePoint.y + ',' + tilePoint.x;

			if (storage) {
				// try to load tile from db
				storage.get(this.name, key)
					.then(function(value) {

						// tile found
						if (value) {
							self._setUpTile(tile, key, value, false);
						}
						// no tile found, add to db cache
						else if (!options.cacheOnly) {
							self._setUpTile(tile, key, self.getTileUrl(tilePoint), options.cacheTiles);
						}
						else {
							self._tileOnError.call(tile);
						}
					},
					// error, no tile found
					function(err) {
						console.log(err);
			//			self._setUpTile(tile, key, self.getTileUrl(tilePoint), false);
					});
			}
			// no database given
			else {
				self._setUpTile(tile, key, self.getTileUrl(tilePoint), false);
			}
		}
	});
});