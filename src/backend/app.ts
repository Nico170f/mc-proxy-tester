import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { ProxyHandler } from './ProxyHandler';
import { MinecraftBot } from './MinecraftBot';
import { Account, AccountManager } from './AccountManager';
import { Proxy } from './ProxyHandler';
import fs from 'fs';

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
  await tester.Start(); // Make sure to await this!
}

interface TestResult {
  successAmount: number;
  totalAmount: number;
  successServers: string[];
  failedServers: string[];
}

class Tester {
  proxyResults: Map<string, TestResult> = new Map();

  accountHandler: AccountManager = new AccountManager();
  proxyHandler: ProxyHandler = new ProxyHandler();

  availableAccounts: Account[] = [];
  availableProxies: Proxy[] = [];

  servers: { serverIp: string; port: number }[] = [
    {
      serverIp: '65.108.242.46',
      port: 2006,
    },
    {
      serverIp: 'play.minecadia.com',
      port: 25565,
    },
    {
      serverIp: 'donutsmp.net',
      port: 25565,
    },
  ];

  constructor() {
    this.accountHandler.loadAccounts();
    this.availableAccounts = this.accountHandler.accounts;

    this.proxyHandler.loadProxies();
    this.availableProxies = this.proxyHandler.proxies;
  }

  public async Start(): Promise<void> {
    let totalTestsRun = 0;

    while (
      this.availableAccounts.length > 0 &&
      this.availableProxies.length > 0
    ) {
      // Define maximum parallel tests for this batch
      const maxParallelTests = 5; // Adjust this number based on your needs
      const testsToRun = Math.min(
        maxParallelTests,
        this.availableAccounts.length,
        this.availableProxies.length
      );

      console.log(`Starting batch of ${testsToRun} parallel tests`);

      // Start multiple tests in parallel
      const testPromises = [];
      for (let i = 0; i < testsToRun; i++) {
        const account = this.availableAccounts.shift();
        if (!account) break;

        const proxy = this.availableProxies.pop();
        if (!proxy) {
          this.availableAccounts.unshift(account); // Put the account back
          break;
        }

        testPromises.push(this.Test(proxy, account));
      }

      // Wait for all tests to complete
      await Promise.all(testPromises);

      totalTestsRun += testPromises.length;
      console.log(
        `Completed batch of ${testPromises.length} tests (total: ${totalTestsRun})`
      );
    }

    // After all batches complete
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    console.log('==========================================');
    console.log('ALL TESTS COMPLETED');
    console.log(`Total tests run: ${totalTestsRun}`);
    console.log(`Total execution time: ${duration.toFixed(2)} seconds`);
    console.log('==========================================');

    // Print results
    console.log('Proxy test results:');
    console.log(this.proxyResults);
    this.writeResultsToFile();
  }

  public async Test(proxy: Proxy, account: Account): Promise<void> {
    const tasks: Promise<boolean>[] = [];
    const bots: MinecraftBot[] = [];

    // Track server results for this specific test
    const serverResults: { server: string; success: boolean }[] = [];

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

          serverResults.push({
            server: `${server.serverIp}:${server.port}`,
            success: result,
          });
          return result;
        })
        .catch((err) => {
          console.error(
            `Error testing server ${server.serverIp}:${server.port}:`,
            err
          );
          serverResults.push({
            server: `${server.serverIp}:${server.port}`,
            success: false,
          });
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

    const proxyKey = `${proxy.host}:${proxy.port}`;
    const existingResult = this.proxyResults.get(proxyKey) || {
      successAmount: 0,
      totalAmount: 0,
      successServers: [],
      failedServers: [],
    };

    // Update the result
    existingResult.successAmount += successCount;
    existingResult.totalAmount += tasks.length;

    serverResults.forEach((sr) => {
      if (sr.success) {
        if (!existingResult.successServers.includes(sr.server)) {
          existingResult.successServers.push(sr.server);
        }
      } else {
        if (!existingResult.failedServers.includes(sr.server)) {
          existingResult.failedServers.push(sr.server);
        }
      }
    });

    this.proxyResults.set(proxyKey, existingResult);
    this.addAccountToAvailable(account);
  }

  private writeResultsToFile(): void {
    // Write results to a file
    const resultsObj = Object.fromEntries(this.proxyResults);

    try {
      fs.writeFileSync(
        'result.json',
        JSON.stringify(resultsObj, null, 2),
        'utf8'
      );
      console.log('Results successfully written to result.json');
    } catch (error) {
      console.error('Error writing results to file:', error);
    }
  }

  private addAccountToAvailable(account: Account): void {
    this.availableAccounts.push(account);
  }
}
