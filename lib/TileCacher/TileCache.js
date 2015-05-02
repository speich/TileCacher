define(['dojo/_base/declare', 'dojo/Deferred', 'dojo/_base/lang', 'dojo/topic', 'Leaflet/leaflet'], function(declare, Deferred, lang, topic, L) {

	/**
	 * @module TileCacher/TileCache
	 * @typedef {Object} TilePoint
	 * @property {Number} TilePoint.x
	 * @property {Number} TilePoint.y
	 * @property {Number} TilePoint.z
	 */
	return declare(null, {

		map: null,
		layer: null,
		timeout: 100,
		queue: null,

		/**
		 * Constructs the TileCache
		 * @param {map} params.map
		 * @param {TileLayer} params.layer
		 * @param {Number} [params.timeout]
		 */
		constructor: function(params) {
			lang.mixin(this, params);
			this.queue = [];
		},

		/**
		 * Converts geographical bounds to projected pixel coordinates.
		 * @see L.map.getPixelBounds()
		 * @param {LatLngBounds} latLngBounds
		 * @param {Number} zoom
		 * @return {Bounds}
		 */
		toPixelBounds: function(latLngBounds, zoom) {
			var p1, p2,
				latLng1 = latLngBounds.getNorthWest(),
				latLng2 = latLngBounds.getSouthEast();

			p1 = this.map.project(latLng1, zoom);
			p2 = this.map.project(latLng2, zoom);

			return L.bounds(p1, p2);
		},

		/**
		 * Convert geographical bounds to tile indexes.
		 * @param {LatLngBounds} latLngBounds
		 * @param {Number} zoom
		 * @return {Object} tileBounds
		 */
		toTileBounds: function(latLngBounds, zoom) {
			var pixelBounds, tileBounds,
				tileSize = this.layer.options.tileSize;

			pixelBounds = this.toPixelBounds(latLngBounds, zoom);

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
		 * Save all tiles within passed bounds and zoom to storage by adding them to a queue.
		 * @see L.TileLayer._addTilesFromCenterOut()
		 * @param {LatLngBounds} latLngBounds rectangular geographical area by coordinates.
		 * @param {Number} zoom
		 */
		saveTiles: function(latLngBounds, zoom) {
			var queue = this.queue,
				layer = this.layer,
				tileBounds = this.toTileBounds(latLngBounds, zoom);

			if (zoom > layer.options.maxZoom || zoom < layer.options.minZoom) {
				return;
			}

			if (!layer.store) {
				return;
			}

			for (var j = tileBounds.min.y; j <= tileBounds.max.y; j++) {
				for (var i = tileBounds.min.x; i <= tileBounds.max.x; i++) {
					var point = new L.point(i, j);

					if (this.tileShouldBeLoaded(point, zoom)) {
						point = this.adjustTilePoint(point, zoom);
						queue.push(point);
					}
				}
			}

			if (queue.length > 0) {
				this.saveNext();
			}
		},

		/**
		 * Save tiles in queue.
		 * A queue is used to limit the number of requests to a server, when loading and caching tiles.
		 */
		saveNext: function() {
			var self = this, tile,
				tilePoint = this.queue.shift();

			if (tilePoint) {
				tile = new Image();
				this.loadTile(tile, tilePoint);
				this.loadTile(tile, tilePoint).then(function(tile) {
					if (tile.cached) {
						self.saveNext();
					}
					else {
						// use timeout to limit number of requests to server
						window.setTimeout(function() {
							self.saveNext();
						}, self.timeout);
					}
				});
			}
		},

		/**
		 * Load tile by setting its source and loading events.
		 * @param {Image} tile
		 * @param {TilePoint} tilePoint
		 * @return {Deferred}
		 */
		loadTile: function(tile, tilePoint) {
			var layer = this.layer,
				dfd = new Deferred();

			tile.onload = function() {
				layer._tileOnLoad(tile, tilePoint).then(function(tile) {
					topic.publish('TileCacher/tile-cached', tile);
					dfd.resolve(tile);
				});
			};

			layer.setTileSource(tile, tilePoint);

			return dfd;
		},

		/**
		 * Check if tile is within world boundaries.
		 * @see L.TileLayer._tileShouldBeLoaded
		 * Adjusted to be able to pass zoom level
		 * @param {TilePoint} tilePoint
		 * @param {Number} zoom
		 * @return {Boolean}
		 */
		tileShouldBeLoaded: function(tilePoint, zoom) {
			var limit = this.getWrapTileNum(zoom);

			// don't load if exceeds world bounds
			return !(tilePoint.y < 0 || tilePoint.y >= limit.y);
		},

		/**
		 * Wrap tile coordinates to positive indexes and adds zoom level
		 * Object with x, y, z properties.
		 * @see L.TileLayer._adjustTilePoint
		 * Adjusted to be able to pass zoom level.
		 * @param {Point} point
		 * @param {Number} zoom
		 * @return {TilePoint} tilePoint
		 */
		adjustTilePoint: function(point, zoom) {
			var tilePoint = point,
				options = this.layer.options,
				limit = this.getWrapTileNum(zoom);

			// wrap tile coordinates
			if (!options.continuousWorld && !options.noWrap) {
				tilePoint.x = ((tilePoint.x % limit.x) + limit.x) % limit.x;
			}

			if (options.tms) {
				tilePoint.y = limit.y - tilePoint.y - 1;
			}
			zoom += options.zoomOffset;
			tilePoint.z = zoom;

			return tilePoint;
		},

		/**
		 * @see L.TileLayer._getWrapTileNum
		 * Adjusted to be able to pass zoom level
		 * @param {Number} zoom
		 * @return {Number}
		 */
		getWrapTileNum: function(zoom) {
			var crs = this.map.options.crs,
			size = crs.getSize(zoom);

			return size.divideBy(this.layer.options.tileSize)._floor();
		}
	});
});