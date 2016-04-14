if ( typeof exports === 'object' && typeof exports.nodeName !== 'string' && typeof define !== 'function' ) {
    var define = function( factory ) {
        factory( require, exports, module );
    };
}

define( function( require, exports, module ) {
    'use strict';
    var Widget = require( '../../../node_modules/enketo-core/src/js/Widget' );
    var $ = require( 'jquery' );
    var pluginName = 'selectPickerUnga';

    /**
     * @constructor
     * @param {Element} element [description]
     * @param {(boolean|{touch: boolean, repeat: boolean})} options options
     * @param {*=} e     event
     */
    function SelectPickerUnga( element, options ) {
        this.namespace = pluginName;
        Widget.call( this, element, options );
        this._init();
    }

    //copy the prototype functions from the Widget super class
    SelectPickerUnga.prototype = Object.create( Widget.prototype );

    //ensure the constructor is the new one
    SelectPickerUnga.prototype.constructor = SelectPickerUnga;

    SelectPickerUnga.prototype._init = function() {
        var $el = $( this.element );
    };

    SelectPickerUnga.prototype.destroy = function( element ) {};

    $.fn[ pluginName ] = function( options, event ) {
        return this.each( function() {
            var $this = $( this ),
                data = $this.data( pluginName );

            options = options || {};

            if ( !data && typeof options === 'object' ) {
                $this.data( pluginName, ( data = new SelectPickerUnga( this, options, event ) ) );
            } else if ( data && typeof options === 'string' ) {
                data[ options ]( this );
            }
        } );
    };

    module.exports = {
        'name': pluginName,
        'selector': '.or-appearance-unga input[type="radio"]'
    };
} );
