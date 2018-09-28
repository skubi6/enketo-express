'use strict';

var forge = require( 'node-forge' );
var utils = require( './utils' );
var SparkMD5 = require( 'spark-md5' );
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
        .then( function( blobs ) {
            var fileMd5s = blobs.map( function( blob ) {
                return blob.name.substring( 0, blob.name.length - 4 ) + '::' + blob.md5;
            } );
            elements = elements.concat( fileMd5s );
            console.log( 'elements', elements );
            var signatureEl = document.createElementNS( ODK_SUBMISSION_NS, 'base64EncryptedElementSignature' );
            signatureEl.textContent = _getBase64EncryptedElementSignature( elements, forgePublicKey );
            manifestEl.appendChild( signatureEl );

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
    var encryptedKey = publicKey.encrypt( symmetricKey, ASYMMETRIC_ALGORITHM, ASYMMETRIC_OPTIONS );
    return forge.util.encode64( encryptedKey );
}

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
    return digest;
}

function _getBase64EncryptedElementSignature( elements, publicKey ) {
    // HEADS UP! ODK Collect code adds a newline character AT THE END TOO!
    var elementsStr = elements.join( '\n' ) + '\n';
    console.log( 'string to md5', elementsStr );

    var md = forge.md5.create();
    md.update( elementsStr );
    var messageDigest = md.digest().getBytes();

    // DEBUG:
    //var array = [];
    //for ( var i = 0; i < messageDigest.length; i++ ) {
    //    array[ i ] = messageDigest.charCodeAt( i );
    // }
    //console.log( 'digest byte array (convert to signed integers)', array.map( item => item >= 128 ? item - 256 : item ) );
    // Until here, it seems we match ODK Collect. It goes hayward afterwards.

    ///var messageDigest = SparkMD5.ArrayBuffer.hash( forge.util.createBuffer( elementsStr, 'utf8' ), true );
    //console.log( 'Forge digest to RSA encrypt', messageDigest, 'Spark alternative', SparkMD5.hash( elementsStr, true ) );

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
                    console.time( 'actual encryption of ' + file.name );
                    var mediaFileEnc = _encryptContent( content, symmetricKey, seed );
                    console.timeEnd( 'actual encryption of ' + file.name );
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
    var cipher = forge.cipher.createCipher( SYMMETRIC_ALGORITHM, symmetricKey );
    var iv = seed.getIncrementedSeedArray();

    cipher.mode.pad = forge.cipher.modes.cbc.prototype.pad.bind( cipher.mode );
    cipher.start( {
        iv: iv
    } );

    cipher.update( forge.util.createBuffer( content ) );
    var pass = cipher.finish();
    var byteString = cipher.output.getBytes();

    if ( !pass ) {
        throw new Error( 'Encryption failed.' );
    }

    // write the bytes of the string to an ArrayBuffer
    var buffer = new ArrayBuffer( byteString.length );
    var array = new Uint8Array( buffer );

    for ( var i = 0; i < byteString.length; i++ ) {
        array[ i ] = byteString.charCodeAt( i );
    }

    // write the ArrayBuffer to a blob
    var blob = new Blob( [ array ] );

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
        return ivSeedArray.map( function( code ) { return String.fromCharCode( code ); } ).join( '' );
    };
}

module.exports = {
    isSupported: isSupported,
    encryptRecord: encryptRecord,
    Seed: Seed
};
