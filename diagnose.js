const fs = require('fs');
const path = require('path');
const target = 'C:/Users/Administrator/Desktop/Yeni klasör (5)';
console.log('Target Exists:', fs.existsSync(target));
console.log('Entries:');
console.log(fs.readdirSync(target));
