define(['dojo/_base/declare', 'dojo/_base/lang', 'dojo/topic', '/lib/Leaflet/leaflet-src.js'], function(declare, lang, topic, L) {

	/**
	 * @module TileCacher/TileCache
	 */
	return declare(null, {

		map: null,
		layer: null,
		timeout: 100,

		/**
		 * Constructs the TileCache
		 * @param {Object} params.map
		 * @param {Object} params.layer
		 * @param {Object} [params.timeout]
		 */
		constructor: function(params) {
			lang.mixin(this, params);
		},

		/**
		 * Convert geographical bounds to tile bounds.
		 * @param {LatLngBounds} bounds
		 * @param {Number} zoom
		 * @return {Object} tileBounds
		 */
		toTileBounds: function(bounds, zoom) {
			var ne,sw, pixelBounds, tileBounds,
				topLeft, bottomRight,
				tileSize = this.layer.options.tileSize;

			// note: pixel bound are topLeft, bottomRight and not sw, ne as geographical bounds
			// TODO: this depends on the tms, does it?
			//nw = bounds.getNorthWest();
			//se = bounds.getSouthEast();
			sw = bounds.getSouthWest();
			ne = bounds.getNorthEast();

			topLeft = this.map.options.crs.latLngToPoint(sw, zoom);
			bottomRight = this.map.options.crs.latLngToPoint(ne, zoom);
			pixelBounds = L.bounds(topLeft, bottomRight);

			// tile coordinates (e.g. tile resource)
			tileBounds = L.bounds(
				pixelBounds.min.divideBy(tileSize)._floor(),
				pixelBounds.max.divideBy(tileSize)._floor()
			);

			return tileBounds;
		},

		/**
		 * Count number of tiles within bounds.
		 * @param {LatLngBounds} bounds
		 * @param {Number} zoom
		 * @return {Number}
		 */
		getNumTiles: function(bounds, zoom) {
			var x, y,
				tileBounds = this.toTileBounds(bounds, zoom);

			// does not take into account special case when same tile occurs more than once, e.g. screen pixel > world pixel
			x = tileBounds.max.x - tileBounds.min.x;
			y = tileBounds.max.y - tileBounds.min.y;

			return (x + 1) * (y + 1);
		},

		/**
		 * Save tiles to database.
		 * Save all tiles within bounds and given zoom to storage by adding them to a queue.
		 * @param {LatLngBounds} bounds
		 * @param {Number} zoom
		 */
		saveTiles: function(bounds, zoom) {
			var queue = [],
				layer = this.layer,
				tileBounds = this.toTileBounds(bounds, zoom);

			if (!layer.store) {
				return;
			}

			for (var j = tileBounds.min.y; j <= tileBounds.max.y; j++) {
				for (var i = tileBounds.min.x; i <= tileBounds.max.x; i++) {
					var point = new L.Point(i, j);

					if (this.tileShouldBeLoaded(point)) {
						queue.push(point);
					}
				}
			}

			this._saveNext(queue, zoom);
		},

		/**
		 * Save tiles in queue.
		 * A queue is used to limit the number of requests to a server, when loading and caching tiles.
		 * @param {Array} queue
		 * @param {Number} zoom
		 */
		_saveNext: function(queue, zoom) {
			var self = this, key, tilePoint, tile,
				layer = this.layer;

			tilePoint = queue.shift();

			if (tilePoint) {
				tile = new Image();
				tilePoint = layer._adjustTilePoint(tilePoint, zoom);
				key = layer.getKey(tilePoint);
				layer._loadTile(tile, tilePoint);

				// try to load tile from db in case it was already cached previously
				layer.store.get(layer.name, key).then(function(result) {
						// tile not found ?
						if (!value) {
							window.setTimeout(function() {
								self.setupTile(tilePoint);
								self._saveNext(queue, zoom);

							}, this.timeout);
						}
						else {
							topic.publish('TileCacher/tile-cached', value);
							self._saveNext(queue, zoom);
						}
					});
			}
		},

		/**
		 * Check if tile is within world boundaries.
		 * @param {Object} tilePoint
		 * @return {Boolean}
		 */
		tileShouldBeLoaded: function(tilePoint) {
			var limit = this.getWrapTileNum();

			// don't load if exceeds world bounds
			return !(tilePoint.y < 0 || tilePoint.y >= limit.y);
		},

		/**
		 * Wrap tile coordinates to positive indexes
		 * @param {Object} tilePoint
		 * @param {Number} zoom
		 * @return {Object} tilePoint
		 */
		_adjustTilePoint: function (tilePoint, zoom) {
			this.layer._adjustTilePoint(tilePoint);
			tilePoint.z = zoom;

			return tilePoint;
		},

		getWrapTileNum: function(zoom) {
			var crs = this.map.options.crs,
				size = crs.getSize(zoom);

			return size.divideBy(this.layer.options.tileSize)._floor();
		},

		/**
		 * Add a tile to the cache.
		 * @param {Image} tile image decorated with additional properties
		 * @param {String} key
		 */
		addToCache: function(tile, key) {
			this.layer.addToCache(tile, key).then(function(tile) {
				topic.publish('TileCacher/tile-cached', tile);
			});
		},

		/**
		 * Prepare a tile for caching.
		 * @param tilePoint
		 */
		setupTile_XXx: function(tilePoint) {
			var query, options = this.layer.options,
				layer = this.layer,
				tileImg = new Image(),
				value = layer.getTileUrl(tilePoint),
				key = layer.getKey(tilePoint);

			// add tile to cache
			tileImg._storageKey = key;
			if (options.crossOrigin) {
				tileImg.crossOrigin = options.crossOrigin;
			}
			tileImg.onload = lang.hitch(this, function() {
				this.addToCache(tileImg);
			});
			tileImg.onerror = function() {
				console.log('error loading tile:', value);
			};

			if (options.proxy) {
				query = '?img=' + value + (options.referrer ? '&ref=' + options.referrer : '');
				tileImg.src = options.proxy + query;
			}
			else {
				tileImg.src = value;
			}
		}
	});
});