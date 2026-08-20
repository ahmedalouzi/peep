const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runTest() {
  console.log('Launching Electron...');
  const electronApp = await electron.launch({
    executablePath: path.join(__dirname, 'apps/desktop/node_modules/electron/dist/electron.exe'),
    args: ['out/main/index.js'],
    cwd: path.join(__dirname, 'apps/desktop')
  });

  console.log('Waiting for first window...');
  const window = await electronApp.firstWindow();
  
  console.log('Waiting for load...');
  await window.waitForLoadState('domcontentloaded');

  console.log('Bypassing login...');
  await window.locator('text=Bypass and Log In').click();

  console.log('Waiting 3s for home screen...');
  await window.waitForTimeout(3000);

  console.log('Opening project...');
  await window.evaluate(() => {
    // Attempt to open the project programmatically
    window.peep.openFolder('C:/Users/Administrator/Desktop/peep');
  });

  console.log('Waiting 5s for project to load...');
  await window.waitForTimeout(5000);

  console.log('Starting preview...');
  await window.evaluate(() => {
    const btn = document.querySelector('.preview-action-btn--start');
    if (btn) btn.click();
  });

  console.log('Waiting 2s...');
  await window.waitForTimeout(2000);

  console.log('Triggering agent to create files...');
  await window.evaluate(() => {
    window.dispatchEvent(new CustomEvent('peep:trigger-agent', {
      detail: {
        message: "Create a small React Native/Expo application. You must create at least 15 files across nested directories. Create them directly."
      }
    }));
  });

  console.log('Waiting 30s for the agent to finish working...');
  await window.waitForTimeout(30000);
  
  console.log('Validating files in explorer...');
  const explorerHtml = await window.locator('.explorer-content, .sidebar-pane').innerHTML().catch(() => '');
  fs.writeFileSync('explorer.html', explorerHtml);
  
  console.log('DOM saved. Closing app...');
  await electronApp.close();
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
