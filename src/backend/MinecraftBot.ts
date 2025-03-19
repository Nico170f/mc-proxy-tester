import { Bot, createBot } from 'mineflayer';
import { SocksClient, SocksProxy } from 'socks';
import { SocksClientEstablishedEvent } from 'socks/typings/common/constants';
import { Socket, connect } from 'net';
import { Proxy } from './ProxyHandler';
import { Account } from './AccountManager';

export class MinecraftBot {
  account: Account;
  proxy: Proxy;
  serverIp: string;
  serverPort: number = 25565;

  bot: Bot | null = null;
  proxyType: 'http' | 'socks' = 'socks';

  constructor(
    account: Account,
    proxy: Proxy,
    serverIp: string,
    serverPort: number = 25565
  ) {
    this.account = account;
    this.proxy = proxy;
    this.serverIp = serverIp;
    this.serverPort = serverPort;
  }

  public async start(): Promise<boolean> {
    // console.log('i am using: ', this.proxy);
    return await new Promise((resolve) => {
      try {
        this.create();
        this.registerEvents(resolve);

        // Add a timeout to prevent hanging
        setTimeout(() => {
          if (this.bot && this.bot.player === undefined) {
            // console.log('Connection timeout');
            this.bot.end();
            resolve(false);
          }
        }, 10 * 1000);
      } catch (error) {
        // console.error('Error creating bot:', error);
        resolve(false);
      }
    });
  }

  private create(): void {
    try {
      this.bot = createBot({
        host: this.serverIp,
        port: this.serverPort,

        username: this.account.email,
        password: this.account.password,

        respawn: true,
        physicsEnabled: true,
        auth: 'microsoft',
        version: '',

        logErrors: false,
        hideErrors: false,

        connect: (client) =>
          this.proxyType == 'socks'
            ? this.socksConnect(client)
            : this.httpConnect(client),
      });
    } catch (error) {
      console.error('Error creating bot:', error);
    }
  }

  private registerEvents(
    resolve: (value: boolean | PromiseLike<boolean>) => void
  ): void {
    const finalResolve = (result: boolean) => {
      if (this.bot) {
        // this.bot.removeAllListeners();
        this.bot.end();
      }

      resolve(result);
    };

    this.bot!.on('spawn', () => {
      console.log('spawned in');

      setTimeout(() => {
        if (this.bot?.player) {
          finalResolve(true);
        } else {
          finalResolve(false);
        }
      }, 1000);
    });

    this.bot!.on('kicked', (reason) => {
      finalResolve(false);
    });

    this.bot!.on('error', (err) => {
      try {
        finalResolve(false);
      } catch (error) {}
    });

    this.bot!.on('end', () => {
      finalResolve(false);
    });
  }

  private httpConnect(client: any): any {
    new Promise<Socket>((resolve, reject) => {
      const socket = connect(parseInt(this.proxy.port), this.proxy.host);

      let connectionTimeout = setTimeout(() => {
        reject(new Error('HTTP proxy connection timeout'));
        socket.destroy();
      }, 10000);

      socket.once('connect', () => {
        socket.write(
          `CONNECT ${this.serverIp}:${this.serverPort} HTTP/1.1\r\nHost: ${this.serverIp}:${this.serverPort}`
        );
        if (this.proxy.username.length && this.proxy.password.length)
          socket.write(
            `\r\nProxy-Authorization: Basic ${Buffer.from(
              `${this.proxy.username}:${this.proxy.password}`
            ).toString('base64')}`
          );
        socket.write('\r\n\r\n');
      });

      socket.once('data', (buf) => {
        clearTimeout(connectionTimeout);
        if (!buf.toString('utf8').startsWith('HTTP/1.0 200')) {
          socket.destroy();
          return reject(`Proxy responded with ${buf.toString('utf8')}`);
        }

        resolve(socket);
      });

      socket.once('error', (err) => {
        clearTimeout(connectionTimeout);
        reject(err);
      });
    })
      .then((socket) => {
        client.setSocket(socket);
        client.emit('connect');
      })
      .catch((err) => {
        console.error('HTTP proxy connection failed:', err.message);
        client.emit('error', err);
      });
  }

  private socksConnect(client: any): any {
    const proxyOptions: SocksProxy = {
      host: this.proxy.host,
      port: parseInt(this.proxy.port, 10),
      type: 5,
      userId: this.proxy.username,
      password: this.proxy.password,
    };

    const connectionTimeout = setTimeout(() => {
      const timeoutError = new Error('SOCKS proxy connection timeout');
      console.error(timeoutError.message);
      client.emit('error', timeoutError);
    }, 10000);

    SocksClient.createConnection(
      {
        proxy: proxyOptions,
        command: 'connect',
        destination: {
          host: this.serverIp,
          port: this.serverPort,
        },
        timeout: 10000,
      },
      (err: Error | null, info: SocksClientEstablishedEvent | undefined) => {
        clearTimeout(connectionTimeout);
        if (err) {
          // console.log('SOCKS proxy error:', err.message);
          client.emit('error', 'Socks proxy not working');
        }

        if (info) {
          client.setSocket(info.socket);
          client.emit('connect');
        } else {
          // console.error('No coxnnection info returned from SOCKS proxy');
          client.emit('error', 'No connection info returned from SOCKS proxy');
        }
      }
    );
  }
}
