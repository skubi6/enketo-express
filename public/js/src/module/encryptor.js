'use strict';

var forge = require( 'node-forge' );
var utils = require( './utils' );

// TODO: SHOULD WE DISABLE NATIVE CODE FOR ROBUSTNESS AT THE EXPENSE OF PERFORMANCE?
//forge( {
//    disableNativeCode: true
//} );

var SYMMETRIC_ALGORITHM = 'AES-CFB'; // JAVA: "AES/CFB/PKCS5Padding"
var ASYMMETRIC_ALGORITHM = 'RSA-OAEP'; // JAVA: "RSA/NONE/OAEPWithSHA256AndMGF1Padding"
var ASYMMETRIC_OPTIONS = {
    md: forge.md.sha256.create(),
    mgf: forge.mgf.mgf1.create( forge.md.sha1.create() )
};
var ODK_SUBMISSION_NS = 'http://opendatakit.org/submissions';

/**
 * 
 * @param {{id: string, version: string, encryptionKey: string}} form 
 * @param {{instanceId: string, xml: string, files?: [blob], complete?: boolean}} record 
 */
function encryptRecord( form, record ) {
    var symmetricKey = _generateSymmetricKey();
    var publicKeyPem = '-----BEGIN PUBLIC KEY-----' + form.encryptionKey + '-----END PUBLIC KEY-----';
    var forgePublicKey = forge.pki.publicKeyFromPem( publicKeyPem );
    var base64EncryptedSymmetricKey = _encryptSymmetricKey( symmetricKey, forgePublicKey );

    var seed = new Seed( record.instanceId, symmetricKey ); //_getIvSeedArray( record.instanceId, symmetricKey );


    //console.log( 'ivSeedArray', ivSeedArray, ivSeedArray.length );

    // TODO: media files
    var elements = [ form.id ];
    if ( form.version ) {
        elements.push( form.version );
    }
    elements = elements.concat( [ base64EncryptedSymmetricKey, record.instanceId, 'submission.xml::' + _md5( record.xml ) ] );
    console.log( 'elements', elements );
    var signature = _getBase64EncryptedElementSignature( elements, forgePublicKey );

    var manifestEl = document.createElementNS( ODK_SUBMISSION_NS, 'data' );
    manifestEl.setAttribute( '_client', 'enketo' ); // temporary for debugging
    manifestEl.setAttribute( 'encrypted', 'yes' );
    manifestEl.setAttribute( 'id', form.id );
    if ( form.version ) {
        manifestEl.setAttribute( 'version', form.version );
    }
    manifestEl.setAttribute( 'instanceID', record.instanceId );
    // TODO: submissionDate
    manifestEl.setAttribute( 'submissionDate', new Date().toISOString() );
    // We don't support encrypting incomplete records, but just in case it is added later, we'll set it as provided.
    manifestEl.setAttribute( 'isComplete', ( !!record.complete ).toString() );
    // TODO: markedAsCompleteDate
    manifestEl.setAttribute( 'markedAsCompleteDate', new Date().toISOString() );
    var keyEl = document.createElementNS( ODK_SUBMISSION_NS, 'base64EncryptedKey' );
    keyEl.textContent = base64EncryptedSymmetricKey;
    manifestEl.appendChild( keyEl );

    var saveAs = require( 'jszip/vendor/FileSaver' );

    _encryptMediaFiles( record.files, symmetricKey, seed )
        .then( function( blobs ) {
            blobs.forEach( function( blob ) {
                var mediaEl = document.createElementNS( ODK_SUBMISSION_NS, 'media' );
                var fileEl = document.createElementNS( ODK_SUBMISSION_NS, 'file' );
                fileEl.textContent = blob.name;
                mediaEl.appendChild( fileEl );
                manifestEl.appendChild( mediaEl );
            } );
            console.log( 'done with media' );
            return blobs;
        } )
        .then( function( blobs ) {
            var submissionXmlEnc = _encryptContent( record.xml, symmetricKey, seed );
            submissionXmlEnc.name = 'submission.xml.enc';
            var xmlFileEl = document.createElementNS( ODK_SUBMISSION_NS, 'encryptedXmlFile' );
            xmlFileEl.textContent = submissionXmlEnc.name;
            manifestEl.appendChild( xmlFileEl );

            blobs.push( submissionXmlEnc );
            return blobs;
        } )
        .then( function( blobs ) {
            // DEBUG
            blobs.forEach( function( blob ) {
                saveAs( blob, blob.name );
            } );
            return blobs;
        } )
        .then( function( blobs ) {
            console.log( 'blobs done', blobs );
            var signatureEl = document.createElementNS( ODK_SUBMISSION_NS, 'base64EncryptedElementSignature' );
            signatureEl.textContent = signature;
            //manifestEl.appendChild( signatureEl );

            var manifest = new Blob( [ new XMLSerializer().serializeToString( manifestEl ) ] );
            manifest.name = 'submission.xml';

            console.log( 'manifest', manifest );
            saveAs( manifest, manifest.name );

            // DEBUG
            var dSeed = new Seed( record.instanceId, symmetricKey );

            /**
             * seed incrementation messed up due to async simultaneous calls
             */
            blobs.forEach( function( blob ) {
                utils
                    .blobToArrayBuffer( blob )
                    .then( function( enc ) {
                        var dec = _decryptContent( enc, symmetricKey, dSeed );
                        saveAs( dec, 'decrypted-' + blob.name.substring( 0, blob.name.length - 4 ) );
                    } );
            } );


            return { manifest: manifest, encryptedFiles: blobs };
        } );
}

function _generateSymmetricKey() {
    // 256 bit key (32 bytes) for AES256
    return forge.random.getBytesSync( 32 );
}

// Equivalent to "RSA/NONE/OAEPWithSHA256AndMGF1Padding"
function _encryptSymmetricKey( symmetricKey, publicKey ) {
    console.log( 'symmetric key to encrypt', symmetricKey, typeof symmetricKey );
    var encryptedKey = publicKey.encrypt( symmetricKey, ASYMMETRIC_ALGORITHM, ASYMMETRIC_OPTIONS );

    // var base64EncryptedKey = btoa( encryptedKey );
    var base64EncryptedKey = forge.util.encode64( encryptedKey );
    //var base64EncryptedKey = b64EncodeUnicode( encryptedKey );
    //console.debug( 'encrypted symmetric key', b64EncodeUnicode( encryptedKey ), forge.util.encode64( encryptedKey ), btoa( encryptedKey ) );
    return base64EncryptedKey;
}
/*
function b64EncodeUnicode( str ) {
    // first we use encodeURIComponent to get percent-encoded UTF-8,
    // then we convert the percent encodings into raw bytes which
    // can be fed into btoa.
    return btoa( encodeURIComponent( str ).replace( /%([0-9A-F]{2})/g,
        function toSolidBytes( match, p1 ) {
            return String.fromCharCode( '0x' + p1 );
        } ) );
}
*/

function _md5( content ) {
    var md = forge.md.md5.create();
    md.update( content );
    return md.digest().toHex();
}

function _getBase64EncryptedElementSignature( elements, publicKey ) {
    var elementsStr = elements.join( '\n' );
    console.log( 'string to md5', elementsStr );

    var md = forge.md5.create();
    md.update( elementsStr );
    var messageDigest = md.digest().getBytes();
    console.log( 'digest', messageDigest, typeof messageDigest );

    var encryptedDigest = publicKey.encrypt( messageDigest, ASYMMETRIC_ALGORITHM, ASYMMETRIC_OPTIONS );
    var base64EncryptedDigest = forge.util.encode64( encryptedDigest );
    return base64EncryptedDigest;
}
/*
function _getIvSeedArray( instanceId, symmetricKey ) {
    console.log( 'original symmetric key', symmetricKey );
    // DEBUG
    //instanceId = 'uuid:aab60510-f435-45ca-a7ae-dec99914a8c8';
    //symmetricKey = [ -123, -95, -57, -51, -47, -34, -61, 71, -30, 30, 72, 71, -9, -124, -1, -92, 88, -56, -115, -87, 112, 62, 0, -24, 107, -72, 67, -85, -85, 96, 60, -24 ]
    //.map( function( e ) { return e < 0 ? e + 256 : e; } )
    //    .map( function( code ) { return String.fromCharCode( code ); } ).join( '' );

    console.log( 'symmetric key to hash for iv', symmetricKey );

    var IV_BYTE_LENGTH = 16;

    // iv is the md5 hash of the instanceID and the symmetric key
    var md = forge.md5.create();
    md.update( instanceId );
    md.update( symmetricKey );
    var messageDigest = md.digest().getBytes();
    var ivSeedArray = [];

    for ( var i = 0; i < IV_BYTE_LENGTH; i++ ) {
        ivSeedArray[ i ] = messageDigest[ ( i % messageDigest.length ) ].charCodeAt( 0 );
    }

    return ivSeedArray; //For Java comparison: .map( function( e ) { return e >= 128 ? e - 256 : e; } ); //.join( '' );

}*/

function _encryptMediaFiles( files, symmetricKey, seed ) {
    files = files || [];

    var funcs = files.map( function( file ) {
        return function() {
            console.log( 'going to convert ', file );
            return utils.blobToArrayBuffer( file )
                .then( function( content ) {
                    console.log( 'content of mdia file to encrypt', content );
                    var mediaFileEnc = _encryptContent( content, symmetricKey, seed );
                    mediaFileEnc.name = file.name + '.enc';
                    console.log( 'encrypted blob', mediaFileEnc );
                    return mediaFileEnc;
                } );
        };
    } );
    // This needs to be sequential for seed array incrementation!
    return funcs.reduce( function( prevPromise, func ) {
        console.log( 'prevPromise', prevPromise );
        return prevPromise.then( function( result ) {
            console.log( 'func', func, result );
            return func()
                .then( function( blob ) {
                    console.log( 'in reduce, ', blob );
                    result.push( blob );
                    return result;
                } );
        } );
    }, Promise.resolve( [] ) );
}

// equivalent to Java "AES/CFB/PKCS5Padding"
function _encryptContent( content, symmetricKey, seed ) {
    console.time( 'forge' );
    console.log( 'encrypting with key', symmetricKey );
    var cipher = forge.cipher.createCipher( SYMMETRIC_ALGORITHM, symmetricKey );

    cipher.mode.pad = forge.cipher.modes.cbc.prototype.pad.bind( cipher.mode );

    cipher.start( {
        iv: seed.getIncrementedSeedArray()
    } );

    cipher.update( forge.util.createBuffer( content ) );

    // manual padding: https://github.com/digitalbazaar/forge/issues/100#issuecomment-34837467
    var pass = cipher.finish();
    var byteString = cipher.output.getBytes();

    console.debug( 'pass', pass );

    // write the bytes of the string to an ArrayBuffer
    var buffer = new ArrayBuffer( byteString.length );
    var array = new Uint8Array( buffer );

    for ( var i = 0; i < byteString.length; i++ ) {
        array[ i ] = byteString.charCodeAt( i );
    }

    console.timeEnd( 'forge' );

    // write the ArrayBuffer to a blob
    var blob = new Blob( [ array ] );

    return blob;
}

module.exports = {
    encryptRecord: encryptRecord,
};

function _decryptContent( encryptedContent, key, seed ) {
    console.log( 'encrypted content', encryptedContent );
    console.time( 'decrypt' );
    // need equivalent to Java's: AES/CFB/PKCS5Padding
    //var iv = _generateIv( instanceId, key );
    // var signature = atob( base64Signature );
    //var encryptedContentBuffer = new forge.util.ByteBuffer( encryptedContent );
    var decipher = forge.cipher.createDecipher( SYMMETRIC_ALGORITHM, key );
    //decipher.mode.unpad = forge.cipher.modes.cbc.prototype.unpad;

    decipher.mode.unpad = function( output, options ) {
        // check for error: input data not a multiple of blockSize
        if ( options.overflow > 0 ) {
            return false;
        }

        // ensure padding byte count is valid
        var len = output.length();
        var count = output.at( len - 1 );
        if ( count > ( this.blockSize << 2 ) ) {
            return false;
        }

        // trim off padding bytes
        output.truncate( count );
        return true;
    };

    var iv = seed.getIncrementedSeedArray();

    decipher.start( {
        iv: iv
    } );
    decipher.update( forge.util.createBuffer( encryptedContent ) );

    var pass = decipher.finish();
    var byteString = decipher.output.getBytes();

    console.debug( 'pass', pass );

    // write the bytes of the string to an ArrayBuffer
    var buffer = new ArrayBuffer( byteString.length );
    var array = new Uint8Array( buffer );

    for ( var i = 0; i < byteString.length; i++ ) {
        array[ i ] = byteString.charCodeAt( i );
    }

    // write the ArrayBuffer to a blob
    var blob = new Blob( [ array ] );
    //console.debug( 'output', outputString );
    console.timeEnd( 'decrypt' );
    return blob;
}


function Seed( instanceId, symmetricKey ) {
    //console.log( 'original symmetric key', symmetricKey );
    // DEBUG
    //instanceId = 'uuid:aab60510-f435-45ca-a7ae-dec99914a8c8';
    //symmetricKey = [ -123, -95, -57, -51, -47, -34, -61, 71, -30, 30, 72, 71, -9, -124, -1, -92, 88, -56, -115, -87, 112, 62, 0, -24, 107, -72, 67, -85, -85, 96, 60, -24 ]
    //.map( function( e ) { return e < 0 ? e + 256 : e; } )
    //    .map( function( code ) { return String.fromCharCode( code ); } ).join( '' );

    //console.log( 'symmetric key to hash for iv', symmetricKey );

    var IV_BYTE_LENGTH = 16;

    // iv is the md5 hash of the instanceID and the symmetric key
    var md = forge.md5.create();
    md.update( instanceId );
    md.update( symmetricKey );
    var messageDigest = md.digest().getBytes();
    var ivSeedArray = [];
    var ivCounter = 0;

    for ( var i = 0; i < IV_BYTE_LENGTH; i++ ) {
        ivSeedArray[ i ] = messageDigest[ ( i % messageDigest.length ) ].charCodeAt( 0 );
    }

    this.getIncrementedSeedArray = function() {
        ++ivSeedArray[ ivCounter % ivSeedArray.length ];
        ++ivCounter;
        console.log( 'counter', ivCounter );
        return ivSeedArray.map( function( code ) { return String.fromCharCode( code ); } ).join( '' );
    };
}
