define(['dojo/_base/declare', 'dojo/_base/lang', 'dojo/topic', 'lib/Leaflet/leaflet.js'], function(declare, lang, topic, L) {

	/**
	 * @module TileCacher/TileCache
	 */
	return declare(null, {

		map: null,
		layer: null,
		timeout: 100,

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
				//tileSize = this.layer._getTileSize();
				tileSize = this.layer.options.tileSize;

			// note: pixel bound are topLeft, bottomRight and not sw, ne as geographical bounds
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
		 * Save all tiles within bounds and given zoom to storage.
		 * @param {LatLngBounds} bounds
		 * @param {Number} zoom
		 */
		saveTiles: function(bounds, zoom) {
			var queue = [],
				layer = this.layer,
				tileBounds = this.toTileBounds(bounds, zoom);

			if (!layer.options.storage) {
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

			this._save(queue, zoom);
		},

		/**
		 * Save tiles in queue.
		 * @param {Array} queue
		 * @param {Number} zoom
		 */
		_save: function(queue, zoom) {
			var self = this, key, point,
				layer = this.layer;

			point = queue.shift();

			if (point) {
				point = this.adjustTilePoint(point, zoom);
				key = point.z + ',' + point.y + ',' + point.x;

				// try to load tile from db
				layer.options.storage.get(layer.name, key)
					.then(function(value) {
						// tile not found ?
						if (!value) {
							window.setTimeout(function() {
									self.cacheTile(point);
									self._save(queue, zoom);

							}, this.timeout);
						}
						else {
							topic.publish('TileCacher/tile-cached', value);
							self._save(queue, zoom);
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
		 * Store tile in storage.
		 * @param {Object} tilePoint
		 */
		cacheTile: function(tilePoint) {
			var self = this, key,
				layer = this.layer,
				tileImg = new Image();

			key = tilePoint.z + ',' + tilePoint.y + ',' + tilePoint.x;
			self.setupTile(tileImg, key, layer.getTileUrl(tilePoint));
		},

		/**
		 * Wrap tile coordinates to positive indexes
		 * @param {Object} tilePoint
		 * @param {Number} zoom
		 * @return {Object} tilePoint
		 */
		adjustTilePoint: function (tilePoint, zoom) {
			var limit = this.getWrapTileNum(zoom);

			// wrap tile coordinates
			tilePoint.x = ((tilePoint.x % limit.x) + limit.x) % limit.x;

			if (this.layer.options.tms) {
				tilePoint.y = limit.y - tilePoint.y - 1;
			}

			tilePoint.z = zoom;

			return tilePoint;
		},

		getWrapTileNum: function(zoom) {
			var crs = this.map.options.crs,
				size = crs.getSize(zoom);

			return size.divideBy(this.layer.options.tileSize)._floor();
		},

		addToCache: function(img) {
			var layer = this.layer,
				storage = layer.options.storage,
				key = img._storageKey;	// get before converting img to data

			img = layer._imageToDataUri(img);
			storage.add(layer.name, key, img).then(function() {
				topic.publish('TileCacher/tile-cached', img);
			});
		},

		setupTile: function(tileImg, key, value) {
			var query, options = this.layer.options;

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