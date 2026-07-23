const fs = require('fs');
const png2icons = require('png2icons');

const buf = fs.readFileSync('C:/Users/Administrator/.gemini/antigravity-ide/brain/64a174bc-70ce-43f1-89b7-cbf4f1e122ea/peep_app_icon_1784142338947.png');
fs.mkdirSync('resources/icons', { recursive: true });

const icoBuf = png2icons.createICO(buf, png2icons.BICUBIC, 0, false, true);
if (icoBuf) fs.writeFileSync('resources/icons/icon.ico', icoBuf);

const icnsBuf = png2icons.createICNS(buf, png2icons.BICUBIC, 0);
if (icnsBuf) fs.writeFileSync('resources/icons/icon.icns', icnsBuf);

console.log('Icons created successfully!');
