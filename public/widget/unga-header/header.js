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
    var pluginName = 'header';

    /**
     * @constructor
     * @param {Element} element [description]
     * @param {(boolean|{touch: boolean, repeat: boolean})} options options
     * @param {*=} e     event
     */
    function Header( element, options ) {
        this.namespace = pluginName;
        Widget.call( this, element, options );
        this._init();
    }

    //copy the prototype functions from the Widget super class
    Header.prototype = Object.create( Widget.prototype );

    //ensure the constructor is the new one
    Header.prototype.constructor = Header;

    Header.prototype._init = function() {
        $( '#form-title, .form-logo' ).addClass( 'hide' );
        this._swapBackgroundImage();
        this._addScrollButton();
    };

    Header.prototype._swapBackgroundImage = function() {
        var $el = $( this.element );
        var imageUrl = $el.find( 'img.active' ).attr( 'src' );
        $el.css( 'background-image', 'url("' + imageUrl + '")' );
    };

    Header.prototype._addScrollButton = function() {
        var $el = $( this.element );
        this.$formTitles = $el.find( '.question-label' );
        this.$scrollButton = $( '<button type="button" class="btn btn-icon-only btn-scroll-to-first">' +
            '<i class="fa fa-chevron-down"></i></button>' );

        $el.append( this.$scrollButton );

        if ( this.$formTitles.find( 'span' ) ) {
            this.$elsClick = this.$formTitles.find( 'span' );
        } else {
            this.$elsClick = this.$formTitles;
        }

        this._setScrollHandler();
    };

    Header.prototype._setScrollHandler = function() {
        this.$scrollButton.add( this.$elsClick ).on( 'click', function() {
            if ( window.scrollTo ) {
                var firstTop = $( '.question' ).eq( 0 ).offset().top;
                window.scrollTo( 0, firstTop - 20 );
            }
            return false;
        } );
    };

    Header.prototype.destroy = function( element ) {};

    Header.prototype.update = function( element ) {
        this._swapBackgroundImage();
    };

    $.fn[ pluginName ] = function( options, event ) {
        return this.each( function() {
            var $this = $( this );
            var data = $this.data( pluginName );

            options = options || {};

            if ( !data && typeof options === 'object' ) {
                $this.data( pluginName, ( data = new Header( this, options, event ) ) );
            } else if ( data && typeof options === 'string' ) {
                data[ options ]( this );
            }
        } );
    };

    module.exports = {
        'name': pluginName,
        'selector': '.or-appearance-header'
    };
} );
