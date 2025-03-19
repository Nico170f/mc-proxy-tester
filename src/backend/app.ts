import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { ProxyHandler } from './ProxyHandler';
import { MinecraftBot } from './MinecraftBot';
import { AccountManager } from './AccountManager';
import { ProxyChecker } from './ProxyChecker';

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

  // console.log('dirname:', __dirname);

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../frontend/browser/index.html'));
    // mainWindow.loadFile(path.join(__dirname, '../frontend/index.html'));
  } else {
    // mainWindow.loadURL('http://localhost:4200');
    mainWindow.loadFile(path.join(__dirname, '../frontend/browser/index.html'));
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('test-connection', async (event, arg) => {
  console.log('Received from renderer:', arg);

  Test();

  return { success: true, message: 'Response from Electron main process' };
});

async function Test() {
  const test: ProxyChecker = new ProxyChecker();

  const accountHandler: AccountManager = new AccountManager();
  accountHandler.loadAccounts();

  const proxyHandler: ProxyHandler = new ProxyHandler();
  proxyHandler.loadProxies();

  // console.log(proxyHandler.proxies);

  const minecraftBot: MinecraftBot = new MinecraftBot(
    accountHandler.accounts[0],
    proxyHandler.proxies[0],
    '65.108.242.46.66',
    2006
  );

  try {
    const result: boolean = await minecraftBot.start();
    console.log('result: ', result);
  } catch (error) {
    console.error('Error starting bot:', error);
  }
}

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
