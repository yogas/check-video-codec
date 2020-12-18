# check-mp4-codec

JavaScript library for that use both mediainfo.js and mp4box for detect video codec

API
===
```javascript
const fs = require('fs')
const CheckMp4Codec = require('check-video-codec')

const filePath = './video/android_open_vpn.mp4' // path to video
const fileStream = fs.createReadStream(filePath)

const checkMp4Codec = new CheckMp4Codec()
// waiting when mediainfo.js will be init
checkMp4Codec.init().then( () => {
    let buf = Buffer.alloc(0)
    fileStream.on('data', async (chunk) => {
        buf = Buffer.concat([chunk])
        // get information about video codec
        const res = await checkMp4Codec.check(buf)
        if (res) {
            console.log(res)
            fileStream.destroy()
        }
    })
})

```
