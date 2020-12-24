const fs = require('fs')
const CheckMp4Codec = require('../dist/check-video-codec')

const filePath = './video/5.mov' // path to video
const bufferSize = 1 // Kb
const fileStream = fs.createReadStream(filePath, {highWaterMark: bufferSize*1024})

const checkMp4Codec = new CheckMp4Codec(64*1024)
let len = 1;
// waiting when mediainfo.js will be init
checkMp4Codec.init().then( () => {
    let buf = Buffer.alloc(0)
    fileStream.on('data', async (chunk) => {
        buf = Buffer.concat([chunk])
        
        // get information about video codec
        const res = await checkMp4Codec.check(buf)
        if (res) {
            console.log(JSON.stringify(res, null, 2))
            fileStream.destroy()    
            console.log('read Kb:', len*bufferSize)
        }
        len++
    })
})
