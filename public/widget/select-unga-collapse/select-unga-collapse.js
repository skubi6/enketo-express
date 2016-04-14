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
    var pluginName = 'selectPickerUngaCollapse';

    /**
     * @constructor
     * @param {Element} element [description]
     * @param {(boolean|{touch: boolean, repeat: boolean})} options options
     * @param {*=} e     event
     */
    function SelectPickerUngaCollapse( element, options ) {
        this.namespace = pluginName;
        Widget.call( this, element, options );
        this._init();
    }

    //copy the prototype functions from the Widget super class
    SelectPickerUngaCollapse.prototype = Object.create( Widget.prototype );

    //ensure the constructor is the new one
    SelectPickerUngaCollapse.prototype.constructor = SelectPickerUngaCollapse;

    SelectPickerUngaCollapse.prototype._init = function() {
        var that = this;
        var $labelEls = $( this.element ).siblings( '.option-label' );

        $labelEls.each( function() {
            var $labelEl = $( this );
            var labels = $labelEl.html().split( /\|/ ).map( function( label ) {
                return label.trim();
            } );

            var $collapseButton = $( '<button class="btn-collapse btn-icon-only"><i class="icon"> </i></button>' );
            var $collapsible = $( '<span class="sub-option-label collapsible">' + labels[ 1 ] + '</span>' );

            $labelEl.html( labels[ 0 ] )
                .after( $collapsible );

            $labelEl.append( $collapseButton );

            that._setButtonHandler( $collapseButton );
        } );
    };

    SelectPickerUngaCollapse.prototype._renderLabels = function() {
        // reserved in case translations need to be supported..
    };

    SelectPickerUngaCollapse.prototype._setButtonHandler = function( $button ) {
        $button.on( 'click', function() {
            var $label = $( this ).parent( '.option-label' );
            var open = $label.hasClass( 'open' );
            $label.toggleClass( 'open', !open );
            return true;
        } );
    };

    SelectPickerUngaCollapse.prototype.destroy = function( element ) {};

    $.fn[ pluginName ] = function( options, event ) {
        return this.each( function() {
            var $this = $( this ),
                data = $this.data( pluginName );

            options = options || {};

            if ( !data && typeof options === 'object' ) {
                $this.data( pluginName, ( data = new SelectPickerUngaCollapse( this, options, event ) ) );
            } else if ( data && typeof options === 'string' ) {
                data[ options ]( this );
            }
        } );
    };

    module.exports = {
        'name': pluginName,
        'selector': '.or-appearance-unga-collapse input[type="checkbox"]'
    };
} );
