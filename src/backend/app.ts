import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { ProxyHandler } from './ProxyHandler';
import { MinecraftBot } from './MinecraftBot';
import { Account, AccountManager } from './AccountManager';
import { Proxy } from './ProxyHandler';

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

const startTime = Date.now();

async function Test() {
  const tester: Tester = new Tester();
  tester.Start();
}

class Tester {
  accountHandler: AccountManager = new AccountManager();
  proxyHandler: ProxyHandler = new ProxyHandler();

  availableAccounts: Account[] = [];
  availableProxies: Proxy[] = [];

  servers: { serverIp: string; port: number }[] = [
    {
      serverIp: '65.108.242.46',
      port: 2006,
    },
    // {
    //   serverIp: 'play.minecadia.com',
    //   port: 25565,
    // },
    // {
    //   serverIp: 'donutsmp.net',
    //   port: 25565,
    // },
  ];

  constructor() {
    this.accountHandler.loadAccounts();
    this.availableAccounts = this.accountHandler.accounts;

    this.proxyHandler.loadProxies();
    this.availableProxies = this.proxyHandler.proxies;
  }

  public async Start(): Promise<void> {
    if (
      this.availableAccounts.length === 0 ||
      this.availableProxies.length === 0
    ) {
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      console.log('Test completed in', duration, 'seconds');
      console.log('No available proxies or accounts to test');
      return;
    }

    for (let i = 0; i < this.availableAccounts.length; i++) {
      const account = this.availableAccounts.shift();
      if (!account) {
        console.log('No available accounts');
        break;
      }

      const proxy = this.availableProxies.pop();
      if (!proxy) {
        console.log('No available proxies');
        break;
      }

      this.Test(proxy, account);
    }
  }

  public async Test(proxy: Proxy, account: Account): Promise<void> {
    // const proxy: Proxy | undefined = this.availableProxies.pop();
    // if (!proxy) {
    //   console.log('No available proxies');
    //   return;
    // }
    // this.removeProxyFromAvailable(proxy);

    // const account: Account | undefined = this.availableAccounts.pop();
    // if (!account) {
    //   console.log('No available accounts');
    //   return;
    // }

    const tasks: Promise<boolean>[] = [];
    const bots: MinecraftBot[] = [];

    for (let i = 0; i < this.servers.length; i++) {
      const server = this.servers[i];

      const minecraftBot: MinecraftBot = new MinecraftBot(
        account,
        proxy,
        server.serverIp,
        server.port
      );

      bots.push(minecraftBot);

      const task = minecraftBot
        .start()
        .then((result) => {
          console.log(
            `Server ${server.serverIp}:${server.port} test completed: ${
              result ? 'Success' : 'Failed'
            }`
          );
          return result;
        })
        .catch((err) => {
          console.error(
            `Error testing server ${server.serverIp}:${server.port}:`,
            err
          );
          return false;
        });

      tasks.push(task);
    }

    const results = await Promise.allSettled(tasks);
    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value === true
    ).length;

    console.log(
      `Proxy ${proxy.host}:${proxy.port} - ${successCount}/${tasks.length} successful connections`
    );

    this.addAccountToAvailable(account);
    this.Start();
  }

  private removeAccountFromAvailable(account: Account): void {
    this.availableAccounts = this.availableAccounts.filter(
      (acc) => acc.email !== account.email
    );
  }

  private removeProxyFromAvailable(proxy: Proxy): void {
    this.availableProxies = this.availableProxies.filter(
      (p) => p.host !== proxy.host
    );
  }

  private addAccountToAvailable(account: Account): void {
    this.availableAccounts.push(account);
  }

  private addProxyToAvailable(proxy: Proxy): void {
    this.availableProxies.push(proxy);
  }
}
