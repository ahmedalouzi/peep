const { spawn } = require('child_process');
const child = spawn('cmd.exe', ['/c', 'echo', 'Yeni klasör (5)']);
child.stdout.on('data', d => console.log('cmd /c:', d.toString()));

const child2 = spawn('node', ['-e', 'console.log(process.cwd())'], { cwd: 'C:/Users/Administrator/Desktop/Yeni klasör (5)', shell: true });
child2.stdout.on('data', d => console.log('node shell:true:', d.toString()));

const child3 = spawn('node', ['-e', 'console.log(process.cwd())'], { cwd: 'C:/Users/Administrator/Desktop/Yeni klasör (5)', shell: false });
child3.stdout.on('data', d => console.log('node shell:false:', d.toString()));

const child4 = spawn('cmd.exe', ['/c', 'chcp 65001>nul & node -e "console.log(process.cwd())"'], { cwd: 'C:/Users/Administrator/Desktop/Yeni klasör (5)', shell: true });
child4.stdout.on('data', d => console.log('chcp 65001:', d.toString()));
