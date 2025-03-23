import path from 'path';
import * as fs from 'fs';

export interface Proxy {
  host: string;
  port: string;
  username: string;
  password: string;
}

export class ProxyHandler {
  proxies: Proxy[] = [];

  constructor() {}

  public async loadProxies(): Promise<void> {
    const data = fs.readFileSync(
      path.join(__dirname, '../../proxies.txt'),
      'utf8'
    );

    if (!data.length) {
      console.log('No data in proxies.txt');
      return;
    }

    this.parseProxies(data);
  }

  private async parseProxies(data: string): Promise<void> {
    const lines = data.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const element = lines[i].trim();
      if (!element.length) {
        continue;
      }

      const parts = element.split('@');

      // console.log(parts);
      if (parts.length !== 2) {
        console.log('Invalid proxy format1:', element);
        continue;
      }

      const hostInfo = parts[0].split(':'); //These are flipped
      const authInfo = parts[1].split(':');

      // console.log('hostInfo:', hostInfo);
      // console.log('authInfo:', authInfo);

      if (hostInfo.length !== 2 || authInfo.length !== 2) {
        console.log('Invalid proxy format2:', element);
        continue;
      }

      const proxy: Proxy = {
        host: hostInfo[0],
        port: hostInfo[1],
        username: authInfo[0],
        password: authInfo[1],
      };

      this.proxies.push(proxy);
    }
  }
}
