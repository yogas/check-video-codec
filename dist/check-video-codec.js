const MP4Box = require('mp4box')
const MediaInfo = require('mediainfo.js')

/**
 * Class CheckMp4BoxCodec
 * For check video codec by mp4box.js
 */
class CheckMp4BoxCodec {
    constructor () {
        this.mp4BoxFile = MP4Box.createFile()
        this.mp4BoxFile.onError = this.onMp4BoxError.bind(this)
        this.mp4BoxFile.onReady = this.onMp4BoxReady.bind(this)
        this.mp4BoxInfo = null
        this.mp4BoxFileStart = 0
        this.chunksLength = 0;
    }

    /**
     * Event after catch error in mp4box
     * @param err
     */
    onMp4BoxError (err) {
        console.error(err)
    }

    /**
     * Event after get codec information
     * @param info
     */
    onMp4BoxReady (info) {
        this.mp4BoxInfo = info
    }

    /**
     * Convert Buffer to ArrayBuffer
     * @param {Buffer} buf
     * @returns {ArrayBuffer}
     */
    toArrayBuffer (buf) {
        const ab = new ArrayBuffer(buf.length);
        const view = new Uint8Array(ab);
        for (let i = 0; i < buf.length; ++i) {
            view[i] = buf[i];
        }
        return ab;
    }

    /**
     * Check by mp4box.js
     * @param {Buffer} buf
     * @returns {Object}
     */
    async check (buf) {
        const ab = this.toArrayBuffer(buf)
        ab.fileStart = this.mp4BoxFileStart
        this.mp4BoxFile.appendBuffer(ab)
        this.mp4BoxFileStart += buf.length
        this.chunksLength ++

        return new Promise((function (resolve, reject) {
            resolve(this.mp4BoxInfo)
        }).bind(this))
    }

    clear () {
        this.mp4BoxFile.flush()
    }
}

/**
 * Class CheckMediainfoCodec
 * For check codec by mediainfo.js
 */
class CheckMediainfoCodec {
    constructor() {
        this.chunks = []
        this.mediainfo = null
    }

    /**
     * Init of mediainfo
     * @returns {Promise<any>}
     */
     async initMediaInfo () {
        return new Promise((function (resolve, reject) {
            if(this.mediainfo) {
                resolve(this.mediainfo)
            } else { 
                MediaInfo({ format: 'JSON' }, (function (mediainfo) {
                    this.mediainfo = mediainfo
                    resolve(mediainfo)
                }).bind(this))
            }
        }).bind(this))
    }

    /**
     * Checking with mediainfo.js
     * @param {Buffer} buf
     * @returns {Promise<boolean|*>}
     */
    async check (buf) {
        if(!this.mediainfo) throw new Error('have to init mediainfo')
        this.chunks.push(buf)

        if (!this.mediainfo) return false

        const buffer = Buffer.concat(this.chunks)
        const getSize = function() { return buffer.length }
        const getBuffer = function() { return buffer }

        const info = await this.mediainfo.analyzeData(getSize, getBuffer)
        if (!info) return false;

        const json = JSON.parse(info)
        if (json.media) {
            return json
        }

        return false
    }

    clear () {
        this.chunks = []
    }
}

/**
 * Class CheckMp4Codec
 * For get information from mp4box.js и mediainfo.js
 */
class CheckVideoCodec {
    
    constructor(maxBufferSize=64*1024) {
        this.len = 0
        this.bufferSize = 0
        this.maxBufferSize = maxBufferSize
        this.mp4box = new CheckMp4BoxCodec()
        this.mediainfo = new CheckMediainfoCodec()
    }

    clear () {
        this.mp4box.clear()
        this.mediainfo.clear()
        this.len = 0
        this.bufferSize = 0
    }

    /**
     * Init mediainfo
     * @returns {Promise<any>}
     */
    async init () {
        return this.mediainfo.initMediaInfo()
    }

    /**
     * Check codecs
     * @param buf
     * @returns {Promise<any>}
     */
    async check (buf) {
        this.len++
        this.bufferSize = this.len*buf.length
        
        const [mp4box, mi] = await Promise.all([this.mp4box.check(buf), this.mediainfo.check(buf)])
        let codecs = {mime: null, general: null, video: null}

        if (mp4box) {
            codecs = {mime: mp4box.mime}
        }

        if (mi) {
            const [
                general,
                video
            ] = mi.media.track

            if(general) {
                codecs = {
                    ...codecs, general: {
                        format: general.Format,
                        codec_id: general.CodecID,
                        codec_id_compatible: general.CodecID_Compatible
                    }
                }
            }

            if(video) {
                codecs = {
                    ...codecs, video: {
                        format: video.Format,
                        codec_id: video.CodecID
                    }
                }
            }

            // trying to check by mp4box.js till bufferSize < maxBufferSize
            if (!mp4box && this.bufferSize < this.maxBufferSize) {
                // for .mov and webm skip checking of mp4box.js
                if (general && general.Format !== 'WebM' && general.CodecID.trim() !== 'qt') {
                    return false
                }                
            }

            return codecs
        }

        return false
    }
}

module.exports = CheckVideoCodec
