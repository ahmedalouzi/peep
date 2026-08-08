import { ipcMain, WebContentsView, BrowserWindow } from 'electron';

let pocView: WebContentsView | null = null;

export function setupPoCIpc(mainWindow: BrowserWindow | null) {
  ipcMain.handle('peep:poc-toggle', async (_event, { visible }) => {
    if (!mainWindow) return { success: false, error: 'No main window' };

    if (!visible) {
      if (pocView) {
        mainWindow.contentView.removeChildView(pocView);
        pocView = null;
      }
      return { success: true };
    }

    if (!pocView) {
      pocView = new WebContentsView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true
        }
      });
      
      pocView.webContents.on('did-finish-load', () => {
        console.log('[PoC] View loaded');
      });

      mainWindow.contentView.addChildView(pocView);
      
      // Load a test page that prints its own innerWidth/innerHeight to prove layout constraint
      const html = `
        <html>
        <body style="background: white; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; border: 4px solid red; box-sizing: border-box;">
          <h1 style="font-size: 24px; margin-bottom: 8px;">PoC Native Sharpness</h1>
          <p id="dimensions" style="font-size: 18px; color: #333;"></p>
          <p style="font-size: 14px; color: #666; max-width: 80%; text-align: center;">If this text is perfectly sharp and the dimensions say 393x852, then the layout and rasterization constraints are satisfied.</p>
          <script>
            function updateDims() {
              document.getElementById('dimensions').innerText = 'innerWidth: ' + window.innerWidth + '\\ninnerHeight: ' + window.innerHeight;
            }
            updateDims();
            window.addEventListener('resize', updateDims);
          </script>
        </body>
        </html>
      `;
      pocView.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    }
    
    return { success: true };
  });

  ipcMain.on('peep:poc-bounds', (_event, { x, y, width, height, logicalWidth, logicalHeight, scale }) => {
    if (!pocView || !mainWindow) return;
    
    pocView.setBounds({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height)
    });

    pocView.webContents.enableDeviceEmulation({
      screenPosition: 'mobile',
      screenSize: { width: logicalWidth, height: logicalHeight },
      viewPosition: { x: 0, y: 0 },
      deviceScaleFactor: 2,
      viewSize: { width: logicalWidth, height: logicalHeight },
      scale: scale,
    });
  });
}
