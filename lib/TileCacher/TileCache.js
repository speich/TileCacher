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
		 * Convert geographical bounds to tile indexes.
		 * @param {LatLngBounds} latLngBounds
		 * @param {Number} zoom
		 * @return {Object} tileBounds
		 */
		toTileBounds: function(latLngBounds, zoom) {
			var pos1, pos2, pixelBounds, tileBounds,
				topLeft, bottomRight,
				tileSize = this.layer.options.tileSize;

			// @see L.map.getPixelBounds()
			// for {z}/{x}/{y}
			if (this.layer._url.match(/\{z\}\/\{y\}\/\{x\}/g)) {
				pos1 = latLngBounds.getNorthWest();
				pos2 = latLngBounds.getSouthEast();
			}
			else {
				// for {z}/{y}/{x}
				pos1 = latLngBounds.getSouthWest();
				pos2 = latLngBounds.getNorthEast();
			}
			topLeft = this.map.options.crs.latLngToPoint(pos1, zoom);
			bottomRight = this.map.options.crs.latLngToPoint(pos2, zoom);
			pixelBounds = L.bounds(topLeft, bottomRight);

			// 1
			/*bounds = map.getPixelBounds(),
			getPixelBounds: function () {
				var topLeftPoint = this._getTopLeftPoint();
				return new L.Bounds(topLeftPoint, topLeftPoint.add(this.getSize()));
			},
			// 2
			getSize: function () {
				if (!this._size || this._sizeChanged) {
					this._size = new L.Point(
						this._container.clientWidth,
						this._container.clientHeight);

					this._sizeChanged = false;
				}
				return this._size.clone();
			},*/


			// tile coordinates (e.g. tile resource indexes)
			// @see L.TileLayer._update()
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
		 * @see L.TileLayer._addTilesFromCenterOut()
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
					var point = new L.point(i, j);

					if (layer._tileShouldBeLoaded(point)) {
						queue.push(point);
					}
				}
			}

			if (queue.length > 0) {
				this._saveNext(queue, zoom);
			}
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

		/**
		 * Override to pass zoom level as argument
		 * @override L.TileLayer._getWrapTileNum()
		 * @param zoom
		 * @returns {*}
		 */
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