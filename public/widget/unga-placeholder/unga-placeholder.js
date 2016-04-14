if ( typeof exports === 'object' && typeof exports.nodeName !== 'string' && typeof define !== 'function' ) {
    var define = function( factory ) {
        'use strict';
        factory( require, exports, module );
    };
}

define( function( require, exports, module ) {
    'use strict';
    var Widget = require( '../../../node_modules/enketo-core/src/js/Widget' );
    var $ = require( 'jquery' );

    var pluginName = 'ungaPlaceholder';

    /*
     * @constructor
     * @param {Element} element [description]
     * @param {(boolean|{touch: boolean, repeat: boolean})} options options
     * @param {*=} e     event
     */
    function UngaPlaceholder( element, options ) {
        this.namespace = pluginName;
        Widget.call( this, element, options );
        this._init();
    }

    //copy the prototype functions from the Widget super class
    UngaPlaceholder.prototype = Object.create( Widget.prototype );

    //ensure the constructor is the new one
    UngaPlaceholder.prototype.constructor = UngaPlaceholder;

    UngaPlaceholder.prototype._init = function() {
        var $el = $( this.element );
        // set label as placeholder from .question label
        var $prev = $el.siblings( '.question-label.active' ).eq( 0 );
        $el.attr( 'placeholder', $prev.text() );
    };

    UngaPlaceholder.prototype.destroy = function( element ) {};

    UngaPlaceholder.prototype.update = function( element ) {
        this._init();
    };

    $.fn[ pluginName ] = function( options, event ) {
        return this.each( function() {
            var $this = $( this );
            var data = $this.data( pluginName );

            options = options || {};

            if ( !data && typeof options === 'object' ) {
                $this.data( pluginName, ( data = new UngaPlaceholder( this, options, event ) ) );
            } else if ( data && typeof options === 'string' ) {
                data[ options ]( this );
            }
        } );
    };

    module.exports = {
        'name': pluginName,
        'selector': '.or-appearance-unga-placeholder input[type="text"]'
    };
} );
