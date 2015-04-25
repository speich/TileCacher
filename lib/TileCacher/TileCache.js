define(['dojo/_base/declare', 'dojo/Deferred', 'dojo/_base/lang', 'dojo/topic', 'Leaflet/leaflet'], function(declare, Deferred, lang, topic, L) {

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
		 * @param {LatLngBounds} latLngBounds
		 * @param {Number} zoom
		 * @return {Object} tileBounds
		 */
		toTileBounds: function(latLngBounds, zoom) {
			var ne, nw, se, sw, pixelBounds, tileBounds,
				topLeft, bottomRight,
				tileSize = this.layer.options.tileSize;

			// TODO: this depends on the order of z/x/y of the tms
			//   url = L.Util.template(this._url, {s: this._getSubdomain(tilePoint)});
			// for {z}/{y}/{x}
			nw = latLngBounds.getNorthWest();
			se = latLngBounds.getSouthEast();
			topLeft = this.map.options.crs.latLngToPoint(nw, zoom);
			bottomRight = this.map.options.crs.latLngToPoint(se, zoom);

			// for {z}/{x}/{y}
/*			sw = latLngBounds.getSouthWest();
			ne = latLngBounds.getNorthEast();
			topLeft = this.map.options.crs.latLngToPoint(sw, zoom);
			bottomRight = this.map.options.crs.latLngToPoint(ne, zoom);*/

			pixelBounds = L.bounds(topLeft, bottomRight);

			// tile coordinates (e.g. tile resource indexes)
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

			for (var j = tileBounds.min.y; j < tileBounds.max.y; j++) {
				for (var i = tileBounds.min.x; i < tileBounds.max.x; i++) {
					var point = new L.Point(i, j, false);

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
			var self = this, tilePoint, tile,
				layer = this.layer;

			tilePoint = queue.shift();

			if (tilePoint) {
				tile = new Image();
				tilePoint = layer._adjustTilePoint(tilePoint, zoom);
				this._loadTile(tile, tilePoint).then(function(tile){
					if (tile.cached) {
						topic.publish('TileCacher/tile-cached', tile);
						self._saveNext(queue, zoom);
					}
					else {
						// use timeout to limit number of requests to server
						window.setTimeout(function() {
							self._saveNext(queue, zoom);
						}, self.timeout);
					}
				});
			}
		},

		/**
		 * Load tile by setting its source and loading events.
		 * @see TileLayerOffline._loadTile
		 * @param {Image} tile
		 * @param {Point} tilePoint
		 */
		_loadTile: function(tile, tilePoint) {
			var self = this,
				dfd = new Deferred();

			tile.onload = function() {
				dfd = self._tileOnLoad(tile, tilePoint);
			};

			this.layer._adjustTilePoint(tilePoint);
			this.layer.getTileSource(tile, tilePoint).then(function(src){
				tile.src = src;
			});

			return dfd;
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
				key = this.layer.getKey(tilePoint);
				dfd = this.layer.addToCache(tile, key);
			}

			return dfd;
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
			tilePoint.z = zoom;  // override, because z was written from current zoom level

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
		}
	});
});