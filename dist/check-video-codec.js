const MP4Box = require('mp4box')
const MediaInfo = require('mediainfo.js')

/**
 * Класс CheckMp4BoxCodec
 * Предназначен для получения медиаинформации с помощью mp4box.js
 */
class CheckMp4BoxCodec {
    mp4BoxFile = null
    mp4BoxInfo = null
    mp4BoxFileStart = 0
    chunksLength = 0;

    constructor() {
        this.initMp4Box()
    }

    /**
     * Инициализация mp4box
     */
    initMp4Box = () => {
        this.mp4BoxFile = MP4Box.createFile()
        this.mp4BoxFile.onError = this.onMp4BoxError
        this.mp4BoxFile.onReady = this.onMp4BoxReady
    }

    /**
     * Событие при ошибке mp4box
     * @param err
     */
    onMp4BoxError = (err) => {
        console.error(err)
    }

    /**
     * Событие после того как информация о кодеках прочитана
     * @param info
     */
    onMp4BoxReady = (info) => {
        this.mp4BoxInfo = info
    }

    /**
     * Конвертирует Buffer в ArrayBuffer
     * @param {Buffer} buf
     * @returns {ArrayBuffer}
     */
    toArrayBuffer = (buf) => {
        const ab = new ArrayBuffer(buf.length);
        const view = new Uint8Array(ab);
        for (let i = 0; i < buf.length; ++i) {
            view[i] = buf[i];
        }
        return ab;
    }

    /**
     * Проверка с помощью mp4box.js
     * @param {Buffer} buf
     * @returns {Object}
     */
    check = async (buf) => {
        const ab = this.toArrayBuffer(buf)
        ab.fileStart = this.mp4BoxFileStart
        this.mp4BoxFile.appendBuffer(ab)
        this.mp4BoxFileStart += buf.length
        this.chunksLength ++

        return new Promise((resolve, reject) => {
            resolve(this.mp4BoxInfo)
        })
    }
}

/**
 * Класс CheckMediainfoCodec
 * Предназначен для получения медиаинформации с помощью mediainfo.js
 */
class CheckMediainfoCodec {
    chunks = []
    mediainfo = null

    /**
     * Инициализация mediainfo
     * @returns {Promise<any>}
     */
    initMediaInfo = async () => {
        return new Promise((resolve, reject) => {
            MediaInfo({ format: 'JSON' }, (mediainfo) => {
                this.mediainfo = mediainfo
                resolve(mediainfo)
            })
        })
    }

    /**
     * Проверка с помощью mediainfo.js
     * @param {Buffer} buf
     * @returns {Promise<boolean|*>}
     */
    check = async (buf) => {
        if(!this.mediainfo) throw new Error('have to init mediainfo')
        this.chunks.push(buf)

        if (!this.mediainfo) return false

        const buffer = Buffer.concat(this.chunks)

        const info = await this.mediainfo.analyzeData(() => buffer.length, () => buffer)
        if (!info) return false;

        const json = JSON.parse(info)
        if (json.media) {
            return json
        }

        return false
    }
}

/**
 * Класс CheckMp4Codec
 * Предназначен для получения информации от mp4box.js и mediainfo.js
 */
class CheckVideoCodec {
    mp4box = null
    mediainfo = null

    constructor() {
        this.mp4box = new CheckMp4BoxCodec()
        this.mediainfo = new CheckMediainfoCodec()
    }

    /**
     * Инициализируем mediainfo
     * @returns {Promise<any>}
     */
    init = async () => {
        return this.mediainfo.initMediaInfo()
    }

    /**
     * Функция проверки кодеков
     * @param buf
     * @returns {Promise<any>}
     */
    check = async (buf) => {
        const res = await Promise.all([this.mp4box.check(buf), this.mediainfo.check(buf)])
        if(res) {
            const [mp4box, mi] = res
            let codecs = {mime: null, general: null, video: null}
            // Дожидаемся ответа от mp4box
            if(!mp4box && mi && this.mp4box.chunksLength < 2) {
                return null
            }

            if(mp4box) {
                codecs = {mime: mp4box.mime}
            }

            if(mi) {
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

            }

            return new Promise(resolve => resolve(codecs));
        }

        return res
    }
}

module.exports = CheckVideoCodec
