if ( typeof exports === 'object' && typeof exports.nodeName !== 'string' && typeof define !== 'function' ) {
    var define = function( factory ) {
        'use strict';
        factory( require, exports, module );
    };
}
/**
 * @preserve Copyright 2016 Enketo LLC
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

define( function( require, exports, module ) {
    'use strict';
    var Widget = require( '../../../node_modules/enketo-core/src/js/Widget' );
    var $ = require( 'jquery' );
    var utils = require( './random-utils' );
    var $lastFocused = null;
    var pluginName = 'selectrandomizer';

    /**
     * Enhances radio buttons
     *
     * @constructor
     * @param {Element} element Element to apply widget to.
     * @param {(boolean|{touch: boolean})} options options
     * @param {*=} event     event
     */

    function SelectRandomizer( element, options ) {
        this.namespace = pluginName;
        Widget.call( this, element, options );
        this._init();
    }

    // Copy the prototype functions from the Widget super class
    SelectRandomizer.prototype = Object.create( Widget.prototype );

    // Ensure the constructor is the new one
    SelectRandomizer.prototype.constructor = SelectRandomizer;

    /**
     * Initialize
     */
    SelectRandomizer.prototype._init = function() {
        this.SELECTOR = 'input[type=radio], input[type=checkbox]';
        var $options = $( this.element ).find( this.SELECTOR );
        var randomArray = utils.getRandomNumberArray( $options.length );
        $options.each( function( i ) {
            $( this ).closest( 'label' ).attr( 'style', 'order: ' + randomArray[ i ] );
        } );
    };

    /**
     * Override default destroy method to do nothing
     *
     * @param  {Element} element The element (not) to destroy the widget on ;)
     */
    SelectRandomizer.prototype.destroy = function( element ) {
        $( element )
            //data is not used elsewhere by enketo
            .removeData( this.namespace )
            //remove all the event handlers that used this.namespace as the namespace
            .off( '.' + this.namespace )
            .find( this.SELECTOR ).closest( 'label' ).removeAttr( 'style' );
    };


    $.fn[ pluginName ] = function( options, event ) {

        options = options || {};

        return this.each( function() {
            var $this = $( this );
            var data = $this.data( pluginName );

            if ( !data && typeof options === 'object' ) {
                $this.data( pluginName, new SelectRandomizer( $this[ 0 ], options, event ) );
            } else if ( data && typeof options === 'string' ) {
                data[ options ]( this );
            }

        } );
    };

    module.exports = {
        'name': pluginName,
        'selector': '.question.or-appearance-random:not(.or-appearance-minimal,.or-appearance-likert,.or-appearance-label,.or-appearance-list-nolabel)'
    };
} );
