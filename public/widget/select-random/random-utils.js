 if ( typeof exports === 'object' && typeof exports.nodeName !== 'string' && typeof define !== 'function' ) {
     var define = function( factory ) {
         factory( require, exports, module );
     };
 }
 define( function( require, exports, module ) {
     'use strict';

     /**
      * Generates an array of random integer numbers from 0 to the provided positive end number.
      * 
      * @param  {Number} length End of range, positive integer 
      * @return {<Number>}        
      */
     function getRandomNumberArray( length ) {
         var array = [];

         if ( !Number.isInteger( length ) || length < 0 ) {
             return null;
         }

         while ( length ) {
             array.push( -1 + length-- );
         }

         return _shuffle( array );
     }

     /**
      * Performs a Fisher-Yates efficient in-place array shuffle.
      * 
      * @param  {<*>} array the array to shuffle
      * @return {<*>}       the suffled array
      */
     function _shuffle( array ) {
         var m = array.length;
         var t;
         var i;

         // While there remain elements to shuffle…
         while ( m ) {
             // Pick a remaining element…
             i = Math.floor( Math.random() * m-- );
             // And swap it with the current element.
             t = array[ m ];
             array[ m ] = array[ i ];
             array[ i ] = t;
         }

         return array;
     }

     // Polyfill
     Number.isInteger = Number.isInteger || function( value ) {
         return typeof value === 'number' &&
             isFinite( value ) &&
             Math.floor( value ) === value;
     };

     module.exports = {
         getRandomNumberArray: getRandomNumberArray
     };
 } );
