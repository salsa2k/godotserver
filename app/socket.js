 function Socket() {
    "use strict";

    var $this = this,
        _debug = true;

    /**
     * Process data
     * @param client
     * @param buf
     */
    this.data = function (client, buf) {
        buf = buf.slice(4);
        var data = $this.decode(buf).value;

        //--------------------------------------------------------------------------------------------------------------
        // Handle data
        // 20 = Dictionary
        //--------------------------------------------------------------------------------------------------------------
        if (data !== null) {
            $this.handleData(client, data);
        }
    };

    /**
     * Decode data
     * @param buf
     * @returns {*}
     */
    this.decode = function (buf) {
        buf = new Buffer(buf);

        var type = buf.readUInt32LE(0),
            data;

        switch (type) {
            case 1:
                data = $this.decodeBoolean(buf);
                break;
            case 2:
                data = $this.decodeInteger(buf);
                break;
            case 3:
                data = $this.decodeFloat(buf);
                break;
            case 4:
                data = $this.decodeString(buf);
                break;
            case 20:
                data = $this.decodeDictionary(buf);
                break;
            case 0:
            default:
                data = {
                    "value": null,
                    "length": 4
                };
                break;
        }

        //--------------------------------------------------------------------------------------------------------------
        // Debug type info
        //--------------------------------------------------------------------------------------------------------------
        //$this.debug('Received [' + type + '] (' + typeof(buf) + '): ' + buf);

        return data;
    };

    /**
     * Decode boolean
     * @param buf
     * @returns {boolean}
     */
    this.decodeBoolean = function (buf) {
        //--------------------------------------------------------------------------------------------------------------
        // Read the integer value and check if it's 1 (true)
        //--------------------------------------------------------------------------------------------------------------
        return {
            "value": buf.readUInt32LE(4) === 1,
            "length": 8
        };
    };

    /**
     * Decode integer
     * @param buf
     * @returns {*}
     */
    this.decodeInteger = function (buf) {
        //--------------------------------------------------------------------------------------------------------------
        // Read the signed integer
        //--------------------------------------------------------------------------------------------------------------
        return {
            "value": buf.readInt32LE(4),
            "length": 8
        };
    };

    /**
     * Decode float
     * @param buf
     * @returns {*}
     */
    this.decodeFloat = function (buf) {
        //--------------------------------------------------------------------------------------------------------------
        // Read the IEE 754 32-Bits Float
        //--------------------------------------------------------------------------------------------------------------
        return {
            // Read the IEE 754 32-Bits Float
            "value": buf.readFloatLE(4),
            "length": 8
        };
    };

    /**
     * Decode string
     * @param buf
     * @returns {string}
     */
    this.decodeString = function (buf) {
        //--------------------------------------------------------------------------------------------------------------
        // Read the length of the string, in bytes
        //--------------------------------------------------------------------------------------------------------------
        var len = buf.readUInt32LE(4);
        var pad = len % 4 === 0 ? 0 : 4 - len % 4;

        //--------------------------------------------------------------------------------------------------------------
        // Read the bytes of the string (utf8)
        //--------------------------------------------------------------------------------------------------------------
        return {
            "value": buf.toString('utf8', 8, 8 + len),
            "length": 8 + len + pad
        };
    };

    /**
     * Decode dictionary
     * @param buf
     * @returns {{value: {}, length: number}}
     */
    this.decodeDictionary = function (buf) {
        //--------------------------------------------------------------------------------------------------------------
        // Read the number of entries
        //--------------------------------------------------------------------------------------------------------------
        var nrEntries = buf.readUInt32LE(4) & 0x7FFFFFFF;

        var dict = {},
            bufPos = 8;

        for (var i = 0; i < nrEntries; i++) {
            var decodedKey = $this.decode(buf.slice(bufPos));
            bufPos += decodedKey.length;

            var decodedValue = $this.decode(buf.slice(bufPos));
            bufPos += decodedValue.length;

            dict[decodedKey.value] = decodedValue.value;
        }

        return {
            "value": dict,
            "length": bufPos
        };
    };

    /**
     * Send packet
     * @param client
     * @param value
     */
    this.send = function (client, value) {
        //--------------------------------------------------------------------------------------------------------------
        // Packet
        //--------------------------------------------------------------------------------------------------------------
        var packet = function (data) {
            var buf = new Buffer(data.length + 4);

            //----------------------------------------------------------------------------------------------------------
            // Writes length of the "packet" (variable)
            //----------------------------------------------------------------------------------------------------------
            buf.writeUInt32LE(data.length, 0);

            //----------------------------------------------------------------------------------------------------------
            // Write "variable" into packet
            //----------------------------------------------------------------------------------------------------------
            data.value.copy(buf, 4);

            return buf;
        };

        //--------------------------------------------------------------------------------------------------------------
        // Socket write
        //--------------------------------------------------------------------------------------------------------------
        client.write(packet($this.prepareSend(value)));
    };

    /**
     * Prepare command message
     * @param value
     * @returns {*}
     */
    this.prepareSend = function (value) {
        var data;

        //--------------------------------------------------------------------------------------------------------------
        // Encode process
        //--------------------------------------------------------------------------------------------------------------
        switch (typeof value) {
            case 'undefined':
                break;

            case 'object':
                if (_.isObject(value)) {
                    var encode = [];

                    _.each(value, function (v, i) {
                        encode.push($this.prepareSend(i));
                        encode.push($this.prepareSend(v));
                    });

                    data = $this.encodeDictionary(encode);
                }
                break;

            case 'boolean':
                data = $this.encodeBoolean(value);
                break;

            case 'number':
                //------------------------------------------------------------------------------------------------------
                // Integer
                //------------------------------------------------------------------------------------------------------
                if (Number(value) === value && value % 1 === 0) {
                    data = $this.encodeInteger(value);
                }

                //------------------------------------------------------------------------------------------------------
                // Float
                //------------------------------------------------------------------------------------------------------
                if (value === Number(value) && value % 1 !== 0) {
                    data = $this.encodeFloat(value);
                }
                break;

            case 'string':
                data = $this.encodeString(value);
                break;
        }

        return data;
    };

    /**
     * Write type
     * @param buf
     * @param type
     */
    this.writeType = function (buf, type) {
        buf.writeUInt32LE(type, 0);
    };

    /**
     * Encode null
     * @returns {{value: Buffer, length: Number}}
     */
    this.encodeNull = function () {
        var buf = new Buffer(4);

        $this.writeType(buf, 0);

        return {
            "value": buf,
            "length": buf.length
        };
    };

    /**
     * Encode boolean
     * @param value
     * @returns {{value: Buffer, length: Number}}
     */
    this.encodeBoolean = function (value) {
        var buf = new Buffer(8);

        $this.writeType(buf, 1);
        buf.writeUInt32LE(value ? 1 : 0, 4);

        return {
            "value": buf,
            "length": buf.length
        };
    };

    /**
     * Encode integer
     * @param value
     * @returns {{value: Buffer, length: Number}}
     */
    this.encodeInteger = function (value) {
        var buf = new Buffer(8);

        $this.writeType(buf, 2);
        buf.writeInt32LE(value, 4);

        return {
            "value": buf,
            "length": buf.length
        };
    };

    /**
     * Encode float
     * @param value
     * @returns {{value: Buffer, length: Number}}
     */
    this.encodeFloat = function (value) {
        var buf = new Buffer(8);

        $this.writeType(buf, 3);
        buf.writeFloatLE(value, 4);

        return {
            "value": buf,
            "length": buf.length
        };
    };

    /**
     * Encode string
     * @param value
     * @returns {{value: Buffer, length: Number}}
     */
    this.encodeString = function (value) {
        var len = Buffer.byteLength(value);

        //--------------------------------------------------------------------------------------------------------------
        // Calculate the padding
        //--------------------------------------------------------------------------------------------------------------
        var pad = len % 4 == 0 ? 0 : 4 - len % 4;

        //--------------------------------------------------------------------------------------------------------------
        // See below for more details on why 8
        //--------------------------------------------------------------------------------------------------------------
        var buf = new Buffer(8 + len + pad);

        $this.writeType(buf, 4);

        //--------------------------------------------------------------------------------------------------------------
        // Writes the length of the string, in bytes
        //--------------------------------------------------------------------------------------------------------------
        buf.writeUInt32LE(len, 4);

        //--------------------------------------------------------------------------------------------------------------
        // Writes the bytes of the string (utf8)
        //--------------------------------------------------------------------------------------------------------------
        buf.write(value, 8);

        //--------------------------------------------------------------------------------------------------------------
        // Add some bytes to meet the padding of 4 bytes
        //--------------------------------------------------------------------------------------------------------------
        if (pad !== 0) {
            var pos = 8 + len;

            for (var i = 0; i < pad; i++) {
                buf.write('\0', i + pos);
            }
        }

        return {
            "value": buf,
            "length": buf.length
        };
    };

    /**
     * Encode dictionary
     * @param encoded
     * @returns {{value: Buffer, length: Number}}
     */
    this.encodeDictionary = function (encoded) {
        var len = 8;

        for (var i in encoded) {
            len += encoded[i].length;
        }

        var buf = new Buffer(len);

        $this.writeType(buf, 20);
        buf.writeUInt32LE((encoded.length / 2) & 0x7FFFFFFF, 4);

        var bufPos = 8;

        //--------------------------------------------------------------------------------------------------------------
        // Add key/value to buffer
        //--------------------------------------------------------------------------------------------------------------
        for (var i in encoded) {
            encoded[i].value.copy(buf, bufPos);
            bufPos += encoded[i].length;
        }

        return {
            "value": buf,
            "length": buf.length
        };
    };

    /**
     * Debug message
     * @param msg
     */
    this.debug = function (msg) {
        if (_debug) {
            console.log('[SOCKET]:', msg);
        }
    };

    /**
     * Disconnect client
     * @param client
     */
    this.disconnect = function (client) {
        client.destroy();
    };

    /**
     * Handle data commands
     * @param client
     * @param data
     */
    this.handleData = function (client, data) {
        switch (data.type) {
            case 'AUTH':
                AUTH.handleCommand(client, data);
                break;
        }
    };
}

module.exports = new Socket();
