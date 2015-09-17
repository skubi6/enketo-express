/**
 * @preserve Copyright 2014 Martijn van de Rijdt & Harvard Humanitarian Initiative
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Deals with browser storage
 */

define( [ 'localforage' ], function( localforage ) {
    "use strict";
    var databaseName = 'enketo';

    localforage.config( {
        name: databaseName,
        driver: localforage.INDEXEDDB,
        version: 3,
        storeName: 'surveys'
    } );

    /*
    record:
        instanceName( string, indexed, unique for id)
        //id (string indexed, not unique)
        lastSaved( number )
        record( xml )
        draft( boolean )
        files( blobs with property name: filename )

    survey:
        id (string, indexed, key, unique)
        form (html)
        model (xml)
        version (string)
        media (blobs with property name: full file path)
        extData 
    */

    function init() {
        return _isWriteable()
            //.then( _canStoreBlobs )
            .catch( function( e ) {
                // make error more useful and throw it further down the line
                var error = new Error( 'Browser storage is required but not available or not writeable. ' +
                    'If you are in "private browsing" mode please switch to regular mode, otherwise switch to another browser. (error: ' + e.message + ')' );
                error.status = 500;
                throw error;
            } );
    }

    function _isWriteable() {
        return updateSetting( {
            name: 'lastLaunched',
            value: new Date().getTime()
        } );
    }

    // detect older indexedDb implementations that do not support storing blobs properly (e.g. Safari 7 and 8)
    function _canStoreBlobs() {
        var oMyBlob = new Blob( [ '<a id="a"><b id="b">hey!</b></a>' ], {
            type: 'text/xml'
        } );
        return updateSetting( {
            name: 'testBlob',
            value: oMyBlob
        } );
    }

    function updateSetting( setting ) {
        console.debug( 'going to store setting', JSON.stringify( setting ) );
        return localforage.setItem( 'setting.' + setting.name, setting );
    }

    function getForm( id ) {
        console.debug( 'attempting to obtain survey from storage', id );
        return localforage.getItem( id );
    }

    function setForm( survey ) {
        console.debug( 'attempting to store new survey', survey );
        if ( !survey.form || !survey.model ) {
            throw new Error( 'Survey not complete' );
        }
        return localforage.setItem( survey.id, survey );
    }

    function updateForm( survey ) {
        console.debug( 'updating form' );
        return setForm( survey );
    }

    // completely remove the database
    function flush() {
        //localforage doesn't clear if there is a version number change
        //return localforage.clear();

        var request;
        //deferred = Q.defer();

        request = indexedDB.deleteDatabase( databaseName );

        request.onsuccess = function() {
            console.log( "Deleted database successfully" );
            //deferred.resolve( databaseName );
        };
        request.onerror = function( error ) {
            console.error( error );
            //deferred.reject( error );
        };
        request.onblocked = function( error ) {
            console.error( error );
            //deferred.reject( error );
        };
    }

    function logAll() {
        localforage.iterate( function( value, key ) {
            console.log( [ key, JSON.stringify( value.files ) ] );
        } ).then( function() {
            console.log( 'done!' );
        } );
    }

    return {
        init: init,
        updateSetting: updateSetting,
        flush: flush,
        getForm: getForm,
        setForm: setForm,
        updateForm: updateForm,
        logAll: logAll
    };

} );
