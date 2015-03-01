/*
 * Copyright (c) 2008-2013 Institut National de l'information Geographique et forestiere France, released under the
 * BSD license.
 */

/*---------------------------------------------------------
 *Nouvelle classe de Leaflet pour supporter les flux WMTS (basée sur L.TileLayer.WMS)
 *New Leaflet's class to support WMTS (based on L.TileLayer.WMS)
 */
L.TileLayer.WMTS = L.TileLayer.extend({

        defaultWmtsParams: {
                service: 'WMTS',
                request: 'GetTile',
                version: '1.0.0',
                layer: '',
                style: '',
                tilematrixSet: '',
                format: 'image/jpeg'
        },

        initialize: function (url, options) { // (String, Object)
                this._url = url;
                var wmtsParams = L.extend({}, this.defaultWmtsParams),
                    tileSize = options.tileSize || this.options.tileSize;
                if (options.detectRetina && L.Browser.retina) {
                        wmtsParams.width = wmtsParams.height = tileSize * 2;
                } else {
                        wmtsParams.width = wmtsParams.height = tileSize;
                }
                for (var i in options) {
                        // all keys that are not TileLayer options go to WMTS params
                        if (!this.options.hasOwnProperty(i) && i!="matrixIds") {
                                wmtsParams[i] = options[i];
                        }
                }
                this.wmtsParams = wmtsParams;
                this.matrixIds = options.matrixIds;
                L.setOptions(this, options);
        },

        onAdd: function (map) {
                L.TileLayer.prototype.onAdd.call(this, map);
        },

        getTileUrl: function (tilePoint, zoom) { // (Point, Number) -> String
                var map = this._map;
                crs = map.options.crs;
                tileSize = this.options.tileSize;
                nwPoint = tilePoint.multiplyBy(tileSize);
                //+/-1 pour être dans la tuile
                nwPoint.x+=1;
                nwPoint.y-=1; 
                sePoint = nwPoint.add(new L.Point(tileSize, tileSize)); 
                nw = crs.project(map.unproject(nwPoint, zoom));
                se = crs.project(map.unproject(sePoint, zoom));  
                tilewidth = se.x-nw.x;
                zoom=map.getZoom();
                ident = this.matrixIds[zoom].identifier;
                X0 = this.matrixIds[zoom].topLeftCorner.lng;
                Y0 = this.matrixIds[zoom].topLeftCorner.lat;
                tilecol=Math.floor((nw.x-X0)/tilewidth);
                tilerow=-Math.floor((nw.y-Y0)/tilewidth);
                url = L.Util.template(this._url, {s: this._getSubdomain(tilePoint)});
                return url + L.Util.getParamString(this.wmtsParams, url) + "&tilematrix=" + ident + "&tilerow=" + tilerow +"&tilecol=" + tilecol ;
        },

        setParams: function (params, noRedraw) {
                L.extend(this.wmtsParams, params);
                if (!noRedraw) {
                        this.redraw();
                }
                return this;
        }
});

L.tileLayer.wtms = function (url, options) {
        return new L.TileLayer.WMTS(url, options);
};
/* Fin / End
 *---------------------------------------------------------*/



var map= null;

/**
 * Function: initMap
 * Load the application. Called when all information have been loaded by
 * <loadAPI>().
 */
function initMap() {
    //The api is loaded at this step
    //L'api est chargée à cette étape

    // add translations
    translate();

    map = L.map('viewerDiv').setView([48.845, 2.424], 15);
    L.marker([48.845, 2.424]).addTo(map).bindPopup("IGN<br /> 73, avenue de Paris<br /> 94165 Saint-Mandé CEDEX");

    var carte = new L.TileLayer('http://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        maxZoom: 18,
                        attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> '
                });
                
            
    var matrixIds3857= new Array(22);
    for (var i= 0; i<22; i++) {
        matrixIds3857[i]= {
            identifier    : "" + i,
            topLeftCorner : new L.LatLng(20037508,-20037508)
        };
    }
                
    var ign = new L.TileLayer.WMTS(gGEOPORTALRIGHTSMANAGEMENT[gGEOPORTALRIGHTSMANAGEMENT.apiKey].resources['GEOGRAPHICALGRIDSYSTEMS.MAPS:WMTS'].url,
                {
                    layer: 'GEOGRAPHICALGRIDSYSTEMS.MAPS',
                    style: 'normal',
                    tilematrixSet: "PM",
                    matrixIds: matrixIds3857,
                    format: 'image/jpeg',
                    attribution: "&copy; <a href='http://www.ign.fr'>IGN</a>"
                }
    );
                
    L.control.scale({'position':'bottomleft','metric':true,'imperial':false}).addTo(map);
    var baseLayers = {"Carte OSM" : carte,"Carte IGN" : ign};
               
    map.addLayer(ign);
                
    L.control.layers(baseLayers, {}).addTo(map);
}

/**
 * Function: loadAPI
 * Load the configuration related with the API keys.
 * Called on "onload" event.
 * Call <initMap>() function to load the interface.
 */
function loadAPI() {
    // wait for all classes to be loaded
    // on attend que les classes soient chargées
    if (checkApiLoading('loadAPI();',['OpenLayers','Geoportal','L'])===false) {
        return;
    }

    // load API keys configuration, then load the interface
    // on charge la configuration de la clef API, puis on charge l'application
    Geoportal.GeoRMHandler.getConfig([config.keyJs], null, null, {
        onContractsComplete: initMap
    });
}

// assign callback when "onload" event is fired
// assignation de la fonction à appeler lors de la levée de l'évènement
// "onload"
window.onload= loadAPI;
