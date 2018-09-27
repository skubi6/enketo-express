'use strict';

var forge = require( 'node-forge' );
var utils = require( './utils' );
var SparkMD5 = require( 'spark-md5' );

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
var OPENROSA_XFORMS_NS = 'http://openrosa.org/xforms';

function isSupported() {
    return typeof ArrayBuffer !== 'undefined' &&
        new ArrayBuffer( 8 ).byteLength === 8 &&
        typeof Uint8Array !== 'undefined' &&
        new Uint8Array( 8 ).length === 8;
}

/**
 * 
 * @param {{id: string, version: string, encryptionKey: string}} form 
 * @param {{instanceId: string, xml: string, files?: [blob]}} record 
 */
function encryptRecord( form, record ) {
    var symmetricKey = _generateSymmetricKey();
    var publicKeyPem = '-----BEGIN PUBLIC KEY-----' + form.encryptionKey + '-----END PUBLIC KEY-----';
    var forgePublicKey = forge.pki.publicKeyFromPem( publicKeyPem );
    var base64EncryptedSymmetricKey = _encryptSymmetricKey( symmetricKey, forgePublicKey );
    var seed = new Seed( record.instanceId, symmetricKey ); //_getIvSeedArray( record.instanceId, symmetricKey );

    var elements = [ form.id ];
    if ( form.version ) {
        elements.push( form.version );
    }
    elements = elements.concat( [ base64EncryptedSymmetricKey, record.instanceId ] );

    var manifestEl = document.createElementNS( ODK_SUBMISSION_NS, 'data' );
    manifestEl.setAttribute( '_client', 'enketo' ); // temporary for debugging
    manifestEl.setAttribute( 'encrypted', 'yes' );
    manifestEl.setAttribute( 'id', form.id );
    if ( form.version ) {
        manifestEl.setAttribute( 'version', form.version );
    }
    var keyEl = document.createElementNS( ODK_SUBMISSION_NS, 'base64EncryptedKey' );
    keyEl.textContent = base64EncryptedSymmetricKey;
    manifestEl.appendChild( keyEl );

    var metaEl = document.createElementNS( OPENROSA_XFORMS_NS, 'meta' );
    var instanceIdEl = document.createElementNS( OPENROSA_XFORMS_NS, 'instanceID' );
    instanceIdEl.textContent = record.instanceId;
    metaEl.appendChild( instanceIdEl );
    manifestEl.appendChild( metaEl );

    //var saveAs = require( 'jszip/vendor/FileSaver' );

    return _encryptMediaFiles( record.files, symmetricKey, seed )
        .then( function( blobs ) {
            blobs.forEach( function( blob ) {
                var mediaEl = document.createElementNS( ODK_SUBMISSION_NS, 'media' );
                var fileEl = document.createElementNS( ODK_SUBMISSION_NS, 'file' );
                fileEl.setAttribute( 'type', 'file' );
                fileEl.textContent = blob.name;
                mediaEl.appendChild( fileEl );
                manifestEl.appendChild( mediaEl );
            } );
            return blobs;
        } )
        .then( function( blobs ) {
            var submissionXmlEnc = _encryptContent( record.xml, symmetricKey, seed );
            submissionXmlEnc.name = 'submission.xml.enc';
            submissionXmlEnc.md5 = _md5ArrayBuffer( record.xml );
            var xmlFileEl = document.createElementNS( ODK_SUBMISSION_NS, 'encryptedXmlFile' );
            xmlFileEl.setAttribute( 'type', 'file' );
            xmlFileEl.textContent = submissionXmlEnc.name;
            manifestEl.appendChild( xmlFileEl );
            blobs.push( submissionXmlEnc );
            return blobs;
        } )
        /*.then( function( blobs ) {
            // DEBUG
            blobs.forEach( function( blob ) {
                saveAs( blob, blob.name );
            } );
            return blobs;
        } )*/
        .then( function( blobs ) {
            console.log( 'blobs done', blobs );
            var fileMd5s = blobs.map( function( blob ) {
                return blob.name.substring( 0, blob.name.length - 4 ) + '::' + blob.md5;
            } );
            elements = elements.concat( fileMd5s );
            console.log( 'elements', elements );
            var signatureEl = document.createElementNS( ODK_SUBMISSION_NS, 'base64EncryptedElementSignature' );
            signatureEl.textContent = _getBase64EncryptedElementSignature( elements, forgePublicKey );
            manifestEl.appendChild( signatureEl );

            //var manifest = new Blob( [ new XMLSerializer().serializeToString( manifestEl ) ] );
            //manifest.name = 'submission.xml';

            //console.log( 'manifest', manifest );
            // saveAs( manifest, manifest.name );

            // DEBUG
            /*
            _decryptFiles( blobs, symmetricKey, new Seed( record.instanceId, symmetricKey ) )
                .then( function( blbs ) {
                    blbs.forEach( function( blob ) {
                        saveAs( blob, blob.name );
                    } );
                } );
            */
            // overwrite record properties so it can be process as a regular submission
            record.xml = new XMLSerializer().serializeToString( manifestEl );
            record.files = blobs;
            return record;
        } );
}

function _generateSymmetricKey() {
    // 256 bit key (32 bytes) for AES256
    return forge.random.getBytesSync( 32 );
}

// Equivalent to "RSA/NONE/OAEPWithSHA256AndMGF1Padding"
function _encryptSymmetricKey( symmetricKey, publicKey ) {
    console.log( 'symm key to encrypt', symmetricKey );
    var encryptedKey = publicKey.encrypt( symmetricKey, ASYMMETRIC_ALGORITHM, ASYMMETRIC_OPTIONS );
    return forge.util.encode64( encryptedKey );
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
/*
function _md5( content ) {
    var md = forge.md.md5.create();
    md.update( content );
    var digest = md.digest();
    console.log( 'digest forge', digest.toHex() );
    console.log( 'alt' );
    return md.digest().toHex();
}
*/

function _md5ArrayBuffer( buf ) {
    var digest = SparkMD5.ArrayBuffer.hash( buf );
    console.log( 'digest Spark', digest );
    return digest;
}

function _getBase64EncryptedElementSignature( elements, publicKey ) {
    var elementsStr = elements.join( '\n' );
    console.log( 'string to md5', elementsStr );

    var md = forge.md5.create();
    md.update( elementsStr );
    var messageDigest = md.digest().getBytes();

    ///var messageDigest = SparkMD5.ArrayBuffer.hash( forge.util.createBuffer( elementsStr, 'utf8' ), true );
    console.log( 'Forge digest to encrypt', messageDigest, 'Spark alternative', SparkMD5.hash( elementsStr, true ) );

    var encryptedDigest = publicKey.encrypt( messageDigest, ASYMMETRIC_ALGORITHM, ASYMMETRIC_OPTIONS );
    var base64EncryptedDigest = forge.util.encode64( encryptedDigest );
    return base64EncryptedDigest;
}


function _encryptMediaFiles( files, symmetricKey, seed ) {
    files = files || [];

    var funcs = files.map( function( file ) {
        return function() {
            return utils.blobToArrayBuffer( file )
                .then( function( content ) {
                    var mediaFileEnc = _encryptContent( content, symmetricKey, seed );
                    mediaFileEnc.name = file.name + '.enc';
                    mediaFileEnc.md5 = _md5ArrayBuffer( content );
                    //console.log( 'forge:', _md5( content ), 'spark:', mediaFileEnc.md5 );
                    return mediaFileEnc;
                } );
        };
    } );
    // This needs to be sequential for seed array incrementation!
    return funcs.reduce( function( prevPromise, func ) {
        return prevPromise.then( function( result ) {
            return func()
                .then( function( blob ) {
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

    var iv = seed.getIncrementedSeedArray();
    console.log( 'iv to use', iv );
    cipher.start( {
        iv: iv
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
    isSupported: isSupported,
    encryptRecord: encryptRecord,
    Seed: Seed
};

function _decryptFiles( files, symmetricKey, seed ) {
    files = files || [];

    var funcs = files.map( function( file ) {
        return function() {
            return utils.blobToArrayBuffer( file )
                .then( function( content ) {
                    var decrypted = _decryptContent( content, symmetricKey, seed );
                    decrypted.name = 'decrypted-' + file.name.substring( 0, file.name.length - 4 );
                    return decrypted;
                } );
        };
    } );
    // This needs to be sequential for seed array incrementation!
    return funcs.reduce( function( prevPromise, func ) {
        return prevPromise.then( function( result ) {
            return func()
                .then( function( blob ) {
                    result.push( blob );
                    return result;
                } );
        } );
    }, Promise.resolve( [] ) );
}

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
