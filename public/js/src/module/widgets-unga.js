if ( typeof exports === 'object' && typeof exports.nodeName !== 'string' && typeof define !== 'function' ) {
    var define = function( factory ) {
        factory( require, exports, module );
    };
}

define( function( require, exports, module ) {
    var widgets = [
        require( '../../../widget/select-random/selectrandomizer' ),
        require( '../../../widget/unga-header/header' ),
        require( '../../../../node_modules/enketo-core/src/widget/horizontal-choices/horizontalchoices' ),
        require( '../../../widget/select-unga/select-unga' ),
        require( '../../../widget/select-unga-collapse/select-unga-collapse' ),
        require( '../../../widget/select-unga-placeholder/select-unga-placeholder' ),
        require( '../../../widget/unga-slider/unga-slider' ),
        require( '../../../widget/unga-placeholder/unga-placeholder' ),
    ];

    module.exports = widgets;
} );
