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
    var pluginName = 'ungaSlider';

    require( '../../../node_modules/enketo-core/node_modules/bootstrap-slider-basic' );

    /**
     * @constructor
     * @param {Element} element [description]
     * @param {(boolean|{touch: boolean, repeat: boolean})} options options
     * @param {*=} e     event
     */
    function UngaSlider( element, options ) {
        this.namespace = pluginName;
        Widget.call( this, element, options );
        this._init();
    }

    //copy the prototype functions from the Widget super class
    UngaSlider.prototype = Object.create( Widget.prototype );

    //ensure the constructor is the new one
    UngaSlider.prototype.constructor = UngaSlider;

    UngaSlider.prototype._init = function() {
        var value = Number( this.element.value ) || -1;

        $( this.element ).slider( {
            reversed: false,
            min: 1,
            max: 5,
            orientation: 'horizontal',
            step: 1,
            value: value
        } );
        this.$widget = $( this.element ).next( '.widget' );
        this.$slider = this.$widget.find( '.slider' );
        this._renderSmileys();
        this._setChangeHandler();
    };

    UngaSlider.prototype._renderSmileys = function() {
        this.$widget.append( '<div class="notches"><span class="n1"></span><span class="n2"></span><span class="n3"></span><span class="n4"></span><span class="n5"></span></div>');
        this.$widget.append( '<div class="sad"><i class="fa fa-fw fa-frown-o"></i></div>' );
        this.$widget.append( '<div class="neutral"><i class="fa fa-fw fa-meh-o"></i></div>' );
        this.$widget.append( '<div class="happy"><i class="fa fa-fw fa-smile-o"></i></div>' );
    };

    UngaSlider.prototype._setChangeHandler = function() {
        var that = this;

        $( this.element ).on( 'slideStop.' + this.namespace, function( slideEvt ) {
            $( this ).trigger( 'change' );
        } );
    };

    UngaSlider.prototype.destroy = function( element ) {};

    $.fn[ pluginName ] = function( options, event ) {
        return this.each( function() {
            var $this = $( this ),
                data = $this.data( pluginName );

            options = options || {};

            if ( !data && typeof options === 'object' ) {
                $this.data( pluginName, ( data = new UngaSlider( this, options, event ) ) );
            } else if ( data && typeof options === 'string' ) {
                data[ options ]( this );
            }
        } );
    };

    module.exports = {
        'name': pluginName,
        'selector': '.or-appearance-unga-slider-5 input[type="number"]'
    };
} );
