const { spawn } = require('child_process');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(npx, ['expo', 'start', '--web', '--port', '8080'], { 
  cwd: 'C:/Users/Administrator/Desktop/Yeni klasör (5)', 
  shell: true 
});
child.stdout.on('data', d => console.log('stdout:', d.toString()));
child.stderr.on('data', d => console.log('stderr:', d.toString()));
child.on('exit', code => console.log('exit:', code));
