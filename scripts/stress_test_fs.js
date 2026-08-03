const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '../test_workspace_detection/stress_test');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

console.log('Creating 5,000 files to trigger git:changed and fs.watch storm...');
for (let i = 0; i < 5000; i++) {
  fs.writeFileSync(path.join(targetDir, `file_${i}.txt`), 'test content');
}
console.log('Files created.');

setTimeout(() => {
  console.log('Deleting 5,000 files...');
  for (let i = 0; i < 5000; i++) {
    fs.unlinkSync(path.join(targetDir, `file_${i}.txt`));
  }
  console.log('Files deleted.');
}, 5000);
