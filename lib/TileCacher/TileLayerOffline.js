define(['dojo/_base/declare', 'dojo/Deferred', 'Leaflet/leaflet'], function(declare, Deferred, L) {

	var autoindex = 0;

	/**
	 * @module TileCacher/TileLayerOffline
	 * @extends TileLayer
	 */
	return declare([L.TileLayer], /** @lends TileLayerOffline.prototype */ {

		name: 'tiles-',

		constructor: function(url, params, store) {
			this.name = params.name || this.name + (autoindex++); // name is used as object store
			this.store = store;
		},

		/**
		 * Convert image to a data url for db storage.
		 * @param {Image} img
		 * @return {string}
		 */
		imageToDataUri: function(img) {
			// TODO: store image directly as BLOB
			var context, canvas = window.document.createElement('canvas');

			canvas.width = img.naturalWidth || img.width;
			canvas.height = img.naturalHeight || img.height;
			context = canvas.getContext('2d');
			context.drawImage(img, 0, 0);

			return canvas.toDataURL('image/png');
		},

		/**
		 * Load tile by setting its source and loading events.
		 * @param {Image} tile
		 * @param {Point} tilePoint
		 */
		_loadTile: function(tile, tilePoint) {
			var self = this;

			tile._layer = this;
			tile.onload = function() {
				var dfd = self._tileOnLoad(tile, tilePoint);

				dfd.then(function(tile) {
					L.TileLayer.prototype._tileOnLoad.apply(tile, arguments);
				});
			};
			tile.onerror = this._tileOnError;

			this._adjustTilePoint(tilePoint);   // modifies the tilePoint
			this.setTileSource(tile, tilePoint);

			this.fire('tileloadstart', {
				tile: tile,
				url: tile.src  // TODO: problem that this could be data:uri in case of a cached tile?
			});
		},

		/**
		 * Handle tile loading event by adding tile to store.
		 * @param {Image} tile
		 * @param {Point} tilePoint
		 */
		_tileOnLoad: function(tile, tilePoint) {
			var key, dfd = new Deferred();

			if (tile.cached) {
				dfd.resolve(tile);
			}
			else {
				key = this.getKey(tilePoint);
				dfd = this.addToCache(tile, key);
			}

			return dfd;
		},

		/**
		 * Add the tile to the cache.
		 * @param {Image} tile
		 * @param {String} key
		 * @return {Deferred} loaded tile
		 */
		addToCache: function(tile, key) {
			var img;

			img = this.imageToDataUri(tile);

			return this.store.add(this.name, key, img).then(function() {
				tile.cached = true;

				return tile;
			});
		},

		/**
		 * Get image (tile) source either from store or from url.
		 * If tile was previously cached it's just loaded from the cache. Otherwise it's loaded from url.
		 * @param {Image} tile image decorated with additional properties
		 * @param {Point} tilePoint
		 * @return {Deferred}
		 */
		setTileSource: function(tile, tilePoint) {
			var key, self = this,
				options = this.options;

			tile.crossOrigin = options.crossOrigin ? options.crossOrigin : null;

			key = this.getKey(tilePoint);

			// try to load tile (image) from db, maybe it was already cached previously
			this.store.get(this.name, key).then(function(result) {
				var src;

				// not cached previously, add to store after tile onload
				// Note: setting src will fire onload event which was setup in _loadTile, also for data:uri
				if (typeof result === 'undefined') {
					src = self.getTileUrl(tilePoint);
					if (options.proxy) {
						src = options.proxy + '?img=' + src + (options.referrer ? '&ref=' + options.referrer: '');
					}
					tile.cached = false;
				}
				else {
					src = result.value;
					tile.cached = true;

					// note: setting this attribute on an image with a data uri will prevent display and loading of the image in FF38
					// -> set to null only when loading from url
					// TODO: can be removed as soon as https://bugzilla.mozilla.org/show_bug.cgi?id=1109693 is fixed
					// tile.crossOrigin = null;
				}

				// this will trigger _tileOnLoad
				tile.src = src;
			});
		},

		/**
		 * Get key to access a stored tile.
		 * @param tilePoint
		 * @return {string}
		 */
		getKey: function(tilePoint) {
			// tiles get stored with corrected z offset, because tilePoint contains already offset already,
			// but for display we need to revert corrections
			return tilePoint.z  + ',' + tilePoint.y + ',' + tilePoint.x;
		}
	});
});