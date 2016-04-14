if ( typeof exports === 'object' && typeof exports.nodeName !== 'string' && typeof define !== 'function' ) {
    var define = function( factory ) {
        factory( require, exports, module );
    };
}

define( function( require, exports, module ) {
    'use strict';
    var Widget = require( '../../../node_modules/enketo-core/src/js/Widget' );
    var $ = require( 'jquery' );
    var pluginName = 'selectpickerUngaPlaceholder';

    /*
     * @constructor
     * @param {Element} element [description]
     * @param {(boolean|{touch: boolean, repeat: boolean})} options options
     * @param {*=} e     event
     */
    function SelectPickerUngaPlaceholder( element, options ) {
        this.namespace = pluginName;
        Widget.call( this, element, options );
        this._init();
    }

    //copy the prototype functions from the Widget super class
    SelectPickerUngaPlaceholder.prototype = Object.create( Widget.prototype );

    //ensure the constructor is the new one
    SelectPickerUngaPlaceholder.prototype.constructor = SelectPickerUngaPlaceholder;

    SelectPickerUngaPlaceholder.prototype._init = function() {
        var $el = $( this.element );
        // set label as placeholder from .question label
        var $label = $el.siblings( '.question-label.active' ).text();
        $el.find( 'option:first-child' ).html( $label );
    };

    SelectPickerUngaPlaceholder.prototype.destroy = function( element ) {};

    SelectPickerUngaPlaceholder.prototype.update = function( element ) {
        this._init();
    };

    $.fn[ pluginName ] = function( options, event ) {
        return this.each( function() {
            var $this = $( this ),
                data = $this.data( pluginName );

            options = options || {};

            if ( !data && typeof options === 'object' ) {
                $this.data( pluginName, ( data = new SelectPickerUngaPlaceholder( this, options, event ) ) );
            } else if ( data && typeof options === 'string' ) {
                data[ options ]( this );
            }
        } );
    };

    module.exports = {
        'name': pluginName,
        'selector': '.or-appearance-unga-placeholder-minimal select'
    };
} );
