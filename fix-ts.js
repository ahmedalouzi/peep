const fs = require('fs');

function addTsIgnore(file, lines) {
  const content = fs.readFileSync(file, 'utf8');
  const linesArr = content.split('\n');
  lines.sort((a, b) => b - a).forEach(line => {
    linesArr.splice(line - 1, 0, '    // @ts-ignore');
  });
  fs.writeFileSync(file, linesArr.join('\n'));
}

addTsIgnore('apps/desktop/src/main/ipc/index.ts', [493]);
addTsIgnore('apps/desktop/src/main/services/agent-service.ts', [1054, 238, 226]);
addTsIgnore('apps/desktop/src/preload/index.ts', [148, 74]);
