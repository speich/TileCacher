define(['dojo/_base/declare', 'dojo/Deferred'], function (declare, Deferred) {
    'use strict';

    return declare(null, {

        /**
         * Add a new service configuration.
         * @param {String} name name of service
         * @return {Promise}
         */
        add: function (name) {
            var dfd = new Deferred();

            return dfd;
        },

        /**
         * Delete the service configuration.
         * @param {String} name name of service
         * @return {Promise}
         */
        del: function (name) {
            var dfd = new Deferred();

            return dfd;
        },

        /**
         * Update the service configuration.
         * @param {String} name name of service
         * @return {Promise}
         */
        update: function(name) {
            var dfd = new Deferred();

            return dfd;
        },

        /**
         * Load the service configuration.
         * @param {String} name name of service
         * @return {Promise}
         */
        get: function(name) {
            var dfd = new Deferred();

            return dfd;
        }

    });
});
