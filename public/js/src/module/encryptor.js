'use strict';

var forge = require( 'node-forge' );
var aesjs = require( 'aes-js' );
var NodeRSA = require( 'node-rsa' );

// TODO: SHOULD WE DISABLE NATIVE CODE FOR ROBUSTNESS AT THE EXPENSE OF PERFORMANCE?
//forge( {
//    disableNativeCode: true
//} );

var SYMMETRIC_ALGORITHM = 'AES-CFB'; // JAVA: "AES/CFB/PKCS5Padding"
var ASYMMETRIC_ALGORITHM = 'RSA-OAEP'; // JAVA: "RSA/NONE/OAEPWithSHA256AndMGF1Padding"
var ODK_SUBMISSION_NS = 'http://opendatakit.org/submissions';

// these are temporary for testing
//var SYMMETRIC_KEY = _generateSymmetricKey();
//var PUBLIC_ASYMMETRIC_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5s9p+VdyX1ikG8nnoXLCC9hKfivAp/e1sHr3O15UQ+a8CjR/QV29+cO8zjS/KKgXZiOWvX+gDs2+5k9Kn4eQm5KhoZVw5Xla2PZtJESAd7dM9O5QrqVJ5Ukrq+kG/uV0nf6X8dxyIluNeCK1jE55J5trQMWT2SjDcj+OVoTdNGJ1H6FL+Horz2UqkIObW5/elItYF8zUZcO1meCtGwaPHxAxlvODe8JdKs3eMiIo9eTT4WbH1X+7nJ21E/FBd8EmnK/91UGOx2AayNxM0RN7pAcj47a434LzeM+XCnBztd+mtt1PSflF2CFE116ikEgLcXCj4aklfoON9TwDIQSp0wIDAQAB';
//var BASE64_ENCRYPTED_SYMMETRIC_KEY = 'zjb9MWfYxjXnrASv08mlVWsrw/54bVyO5LTsQosnKDZ/jsF7EwGG2iLtCcRALnTUpVjcpQCIv+WZIYukNThYCwWcjrdeiRufjQqBo7H1lKxLMTPu2zrmBRXyj2xmnprggR3Yg/q6jhTNoK5xtm1wYOTgWM5X+/SjR34eXfMTrns6ZDchuZSOzmijtyFh+pSf7d7E5iyO56DjhNjPBI5p5DNDhRrctY1eBRwwxwsaQb5jJzT6VYqKYu1P+4kSOaxsY04jO/g+auBFytaLKOfaCMZ8TAYERl1tDaP43Fm/JCHvV1d8BGtUwUAHvyIAtieUIPmeLmnGExsq6VnUy40uCQ==';

//var BASE64_ENCRYPTED_SYMMETRIC_KEY = _encryptSymmetricKey( SYMMETRIC_KEY, PUBLIC_ASYMMETRIC_KEY );
//var SIGNATURE = 'cWUxhGaLiWEaGLhpeRN2mQrwi7RHmdp/26duNfzgsPhDkeTnnF6LzXeKBDE2DtoViEYj2jopJrBRvi4FeVyr8x5hfFQYeACq92R5jOqnE2qEzI0JuKIfjuYI12b9bQJllNcYekI30m/Df3hipawAnnK27GwI/iGRSXGRp7T1e0TA7U/H4t45IPwkWKWyFfohfFPkY0Ro4Cvb2HfRvzRxhVklIoFPAEYYdHrGracEEv+8gxlkE4vapNI7lKhRQkU6j6IQW8rlmYWp7hHaZO6gfIiHH7Hooc+n+BhYF2TY+JfrehVmJ1Qg2chp5FjNJ+A86nl8W2n0xsI1Hj67AnfYKQ==';
//var INSTANCEID = 'uuid:aab60510-f435-45ca-a7ae-dec99914a8c8';

/**
 * 
 * @param {{id: string, version: string, encryptionKey: string}} form 
 * @param {{instanceId: string, xml: string, files?: [blob], complete?: boolean}} record 
 */
function encryptRecord( form, record ) {
    console.log( 'xml record', record.xml );
    var symmetricKey = _generateSymmetricKey();
    console.log( 'encryption key in form', form.encryptionKey );
    var publicKeyPem = '-----BEGIN PUBLIC KEY-----' + form.encryptionKey + '-----END PUBLIC KEY-----';
    var forgePublicKey = forge.pki.publicKeyFromPem( publicKeyPem );
    //var base64EncryptedSymmetricKey = _encryptSymmetricKey( symmetricKey, publicKeyPem );
    var base64EncryptedSymmetricKey = _OLDencryptSymmetricKey( symmetricKey, forgePublicKey );

    var ivSeedArray = _getIvSeedArray( record.instanceId, form.encryptionKey );
    var ivCounter = 0;

    console.log( 'ivSeedArray', ivSeedArray, ivSeedArray.length );
    var sampleIv = forge.random.getBytesSync( 16 );
    console.log( 'sample forge iv', sampleIv, sampleIv.length );

    // TODO: media files
    var elements = [ form.id ];
    if ( form.version ) {
        elements.push( form.version );
    }
    elements.concat( [ base64EncryptedSymmetricKey, record.instanceId, 'submission.xml::' + _md5( record.xml ) ] );
    var signature = _getBase64EncryptedElementSignature( elements, forgePublicKey );

    var manifestEl = document.createElementNS( ODK_SUBMISSION_NS, 'data' );
    manifestEl.setAttribute( 'client', 'enketo' ); // temporary
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

    var fileEl = document.createElementNS( ODK_SUBMISSION_NS, 'encryptedXmlFile' );
    fileEl.textContent = 'submission.xml.enc';
    manifestEl.appendChild( fileEl );

    // TODO: media files

    var signatureEl = document.createElementNS( ODK_SUBMISSION_NS, 'base64EncryptedElementSignature' );
    signatureEl.textContent = signature;
    //manifestEl.appendChild( signatureEl );

    var manifest = new Blob( [ new XMLSerializer().serializeToString( manifestEl ) ] );
    manifest.name = 'submission.xml';

    console.log( 'manifest', manifest );

    var saveAs = require( 'jszip/vendor/FileSaver' );

    saveAs( manifest, manifest.name );

    //_incrementByteAt( ivSeedArray, ( ivCounter % ivSeedArray.length ) );
    ++ivSeedArray[ ivCounter % ivSeedArray.length ];
    ++ivCounter;
    //var submissionXmlEnc =
    // _encryptContent( record.xml, symmetricKey, ivSeedArray );
    var submissionXmlEnc = _OLDencryptContent( record.xml, symmetricKey, ivSeedArray );
    submissionXmlEnc.name = 'submission.xml.enc';
    saveAs( submissionXmlEnc, submissionXmlEnc.name );

    // DEBUG
    require( './utils' )
        .blobToArrayBuffer( submissionXmlEnc )
        .then( function( enc ) {
            var dec = _decryptContent( enc, record.instanceId, symmetricKey, ivSeedArray );
            saveAs( dec, dec.name );
        } );

    return { manifest: manifest, encryptedFiles: [ submissionXmlEnc ] };
}

function _generateSymmetricKey() {
    // 256 bit key (32 bytes) for AES256
    return forge.random.getBytesSync( 32 );
    // DEBUG
    //return [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 ];
}

//"RSA/NONE/OAEPWithSHA256AndMGF1Padding"
function _encryptSymmetricKey( symmetricKey, publicKey ) {
    var options;
    var key = new NodeRSA();
    key.importKey( publicKey );

    console.log( 'key test pass?', key.isPublic( true ), key.getKeySize() );

    options = {
        environment: 'browser',
        encryptionScheme: {
            scheme: 'pkcs1_oaep',
            hash: 'sha256'
        }
    };

    // generates during java decryption: 
    // java.security.InvalidKeyException: Wrong algorithm: AES or Rijndael required

    options = {
        environment: 'browser',
        encryptionScheme: 'pkcs1_oaep',
        signingScheme: 'pkcs1-sha256'
    };

    // generates: javax.crypto.BadPaddingException: data hash wrong

    key.setOptions( options );

    var base64EncryptedKey = key.encrypt( symmetricKey, 'base64' );

    console.log( 'encrypted symmetric key', base64EncryptedKey );
    return base64EncryptedKey;
}

//"RSA/NONE/OAEPWithSHA256AndMGF1Padding"
function _OLDencryptSymmetricKey( symmetricKey, publicKey ) {
    console.log( 'symmetric key to use for RSA encryption', symmetricKey, typeof symmetricKey );
    var encryptedKey = publicKey.encrypt( symmetricKey, ASYMMETRIC_ALGORITHM, {
        md: forge.md.sha256.create(),
        mgf: forge.mgf.mgf1.create( forge.md.sha1.create() )
        // mgf1: {
        //     md: forge.md.sha1.create()
        // }
    } );

    // var base64EncryptedKey = btoa( encryptedKey );
    var base64EncryptedKey = forge.util.encode64( encryptedKey );
    //var base64EncryptedKey = b64EncodeUnicode( encryptedKey );
    console.debug( 'encrypted symmetric key', b64EncodeUnicode( encryptedKey ), forge.util.encode64( encryptedKey ), btoa( encryptedKey ) );
    return base64EncryptedKey;
}

function b64EncodeUnicode( str ) {
    // first we use encodeURIComponent to get percent-encoded UTF-8,
    // then we convert the percent encodings into raw bytes which
    // can be fed into btoa.
    return btoa( encodeURIComponent( str ).replace( /%([0-9A-F]{2})/g,
        function toSolidBytes( match, p1 ) {
            return String.fromCharCode( '0x' + p1 );
        } ) );
}

function _base64ToArrayBuffer( base64 ) {
    var binary_string = window.atob( base64 );
    var len = binary_string.length;
    var bytes = new Uint8Array( len );
    for ( var i = 0; i < len; i++ ) {
        bytes[ i ] = binary_string.charCodeAt( i );
    }
    return bytes.buffer;
}

function _md5( content ) {
    var md = forge.md.md5.create();
    md.update( content );
    return md.digest().toHex();
}

function _getBase64EncryptedElementSignature( elements, publicKey ) {
    var elementsStr = elements.join( '\n' );
    var digest = _md5( elementsStr );
    // TODO: not sure about md option here;
    var encryptedDigest = publicKey.encrypt( digest, ASYMMETRIC_ALGORITHM, {
        md: forge.md.sha256.create()
    } );
    return btoa( encryptedDigest );
}

function _getIvSeedArray( instanceId, symmetricKey ) {

    //return [ 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36 ];
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

    return ivSeedArray; //.join( '' );

    // 'b95YeKbWh1BX7aL/w0W4Hw==', // index 0,1,2
    // 'b95YeabWh1BX7aL/w0W4Hw==', // index 0,1,2,3
}

function _encryptContent( content, symmetricKey, ivSeedArray ) {
    console.time( 'aes-js' );
    var segmentSize = 128 / 8; //8;
    var aesCfb = new aesjs.ModeOfOperation.cfb( symmetricKey, ivSeedArray, segmentSize );
    var contentBytes = aesjs.utils.utf8.toBytes( content );
    var paddedContentBytes = aesjs.padding.pkcs7.pad( contentBytes );
    var encryptedBytes = aesCfb.encrypt( paddedContentBytes );

    console.log( 'encrypted bytes with aejs', encryptedBytes, encryptedBytes.length );
    console.timeEnd( 'aes-js' );
    return new Blob( encryptedBytes );
}

//"AES/CFB/PKCS5Padding"
function _OLDencryptContent( content, symmetricKey, ivSeedArray ) {
    console.time( 'forge)' );
    //var iv = _generateIv( instanceId, symmetricKey );
    var cipher = forge.cipher.createCipher( SYMMETRIC_ALGORITHM, symmetricKey );

    //var contentBytes = aesjs.utils.utf8.toBytes( content );
    //var paddedContentBytes = aesjs.padding.pkcs7.pad( contentBytes );

    //var paddingLength = 16 - content.length % 16;
    //console.log( 'paddinglength', paddingLength );
    // if ( paddingLength === 0 ) paddingLength = 16;

    //var padding = '';
    //for ( let i = 0; i < paddingLength; i++ ) {
    //    padding += forge.util.hexToBytes( paddingLength.toString( 16 ) );
    //}
    //const paddedContent = content + padding;


    //cipher.mode.pad = function( input ) {
    //    var blockSize = 16;
    //    
    //    var padding = blockSize - ( input.length() % blockSize );
    //    console.log( 'padding', padding );
    //    input.fillWithByte( padding, padding );
    //    return true;
    //};
    /*
        cipher.mode.pad = function( input ) {
            var padding = this.blockSize - ( input.length() % this.blockSize );
            input.fillWithByte( padding, padding );
            return true;
        };
    */
    cipher.mode.pad = function( input, options ) {
        // add PKCS#7 padding to block (each pad byte is the
        // value of the number of pad bytes)
        var padding = ( input.length() === this.blockSize ?
            this.blockSize : ( this.blockSize - input.length() ) );
        input.fillWithByte( padding, padding );
        return true;
    };

    //cipher.mode.pad = forge.cipher.modes.cbc.prototype.pad;

    cipher.start( {
        iv: ivSeedArray //.join( '' )
    } );
    //cipher.update( forge.util.createBuffer( paddedContentBytes ) );

    cipher.update( forge.util.createBuffer( content ) );

    // manual padding: https://github.com/digitalbazaar/forge/issues/100#issuecomment-34837467
    var pass = cipher.finish();
    var encrypted = cipher.output;

    console.log( 'raw cipher output', encrypted );
    //var padding = 16 - ( encrypted.length() % 16 );
    //console.log( 'missing bytes', padding );
    //encrypted.fillWithByte( 0, padding );

    var byteString = cipher.output.getBytes();

    console.log( 'cipher output', byteString );
    console.debug( 'pass', pass );

    // write the bytes of the string to an ArrayBuffer
    var buffer = new ArrayBuffer( byteString.length );
    var array = new Uint8Array( buffer );

    for ( var i = 0; i < byteString.length; i++ ) {
        array[ i ] = byteString.charCodeAt( i );
    }

    console.timeEnd( 'forge' );
    console.log( 'old forge encrypted array', array );

    // write the ArrayBuffer to a blob
    var blob = new Blob( [ array ] );

    //console.debug( 'output', outputString );
    //saveAs( blob, filename + '.enc' );
    return blob;
}

function _incrementByteAt( arr, index ) {
    var charCode = arr[ index ].charCodeAt( 0 );
    var replacement = String.fromCharCode( charCode + 1 );
    arr[ index ] = replacement;
    return arr;
}

module.exports = {
    encryptRecord: encryptRecord,
};

function _decryptContent( encryptedContent, instanceId, key, ivSeedArray ) {
    console.log( 'encrypted content', encryptedContent );
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



    decipher.start( {
        iv: ivSeedArray //.join( '' ),
        //blockSize: 16
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
    blob.name = 'submission-decrypted.xml';
    //console.debug( 'output', outputString );
    return blob;
}
