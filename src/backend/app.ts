import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../frontend/browser/index.html'));
  console.log('dirname:', __dirname);
  // if (app.isPackaged) {
  //   mainWindow.loadFile(path.join(__dirname, '../frontend/index.html'));
  // } else {
  //   mainWindow.loadURL('http://localhost:4200');
  //   mainWindow.webContents.openDevTools();
  // }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('test-connection', async (event, arg) => {
  console.log('Received from renderer:', arg);
  return { success: true, message: 'Response from Electron main process' };
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
