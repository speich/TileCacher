define(['dojo/_base/declare', 'dojo/Deferred'], function(declare, Deferred) {
	'use strict';

	// note IndexedDb is a window.object

	/**
	 * @module TileCacher/IndexedDbTileStore
	 * @extends TileCacher/IndexedDatabase
	 */
	return declare(null, {

		db: null,
		dbName: 'tileStorage',	// name of database
		objStores: null,
		keyPath: 'key',			// name of key path for object store
		deferredConnection: null,
		version: 1,

		/**
		 *
		 * @param version
		 */
		constructor: function(version) {
			this.objStores = [];
			this.version = version;
		},

		connect: function() {
			var request, self = this,
				dfd = new Deferred();

			request = window.indexedDB.open(this.dbName, this.version);
			request.onupgradeneeded = function(evt) {
				console.log('upgrade needed:', evt);
				var result = this.result;

				for (var i = 0, len = self.objStores.length; i < len; i++) {
					if (!result.objectStoreNames.contains(self.objStores[i])) {
						var store = result.createObjectStore(self.objStores[i], {
							keyPath: self.keyPath
						});

						store.createIndex(self.keyPath, self.keyPath, {
							unique: true
						});
					}
				}
			};

			request.onsuccess = function() {
				self.db = this.result;
				self.db.onerror = function(evt) {
					console.log(evt);
				};
				dfd.resolve(self.db);
			};

			request.onerror = function(evt) {
				dfd.cancel(evt);
			};

			this.deferredConnection = dfd;

			return dfd;
		},

		/**
		 *
		 * @param {String} objStore name of object store
		 * @param {String} key
		 * @param value
		 * @returns {Deferred}
		 */
		add: function(objStore, key, value) {
			var dfd = new Deferred(),
				transaction = this.db.transaction([objStore], 'readwrite'),
				objectStore = transaction.objectStore(objStore),
				request = objectStore.put({key: key, value: value});

			request.onsuccess = function() {
				dfd.resolve(this.result ? this.result: undefined);
			};

			request.onerror = function(evt) {
				dfd.cancel(evt.target.errorCode);
			};

			return dfd;
		},

		/**
		 * Delete a tile from the database at given key.
		 * @param {String} objStore
		 * @param key
		 */
		del: function(objStore, key) {
			var transaction = this.db.transaction([objStore], 'readwrite'),
				objectStore = transaction.objectStore(objStore);

			objectStore.delete(key);
		},

		/**
		 * Load a tile from database at given key.
		 * @param {String} objStore
		 * @param key
		 * @returns {Deferred}
		 */
		get: function(objStore, key) {
			var dfd = new Deferred(),
				transaction = this.db.transaction([objStore], 'readonly'),
				objectStore = transaction.objectStore(objStore),
			request = objectStore.get(key);

			request.onsuccess = function(evt) {
				dfd.resolve(evt.target.result);   // = undefined if record was not found
			};

			request.onerror = function(evt) {
				dfd.cancel(evt.target.errorCode);
			};

			return dfd;
		}
	});
});
