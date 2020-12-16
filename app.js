const fs = require('fs')
const CheckMp4Codec = require('./utils/check-mp4-codec')

const filePath = './video/android_open_vpn.mp4'
const fileStream = fs.createReadStream(filePath)

const checkMp4Codec = new CheckMp4Codec()
// запускаем проверку после того как инициализируется mediainfo.js
checkMp4Codec.init().then( () => {
    let buf = Buffer.alloc(0)
    fileStream.on('data', async (chunk) => {
        buf = Buffer.concat([chunk])
        // получаем информцию о кодеке
        const res = await checkMp4Codec.check(buf)
        if (res) {
            console.log(res)
            fileStream.destroy()
        }
    })
})