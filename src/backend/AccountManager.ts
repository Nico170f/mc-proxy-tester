import path from 'path';
import * as fs from 'fs';

export interface Account {
  email: string;
  password: string;
  busy: boolean;
}

export class AccountManager {
  accounts: Account[] = [];

  constructor() {}

  public loadAccounts(): void {
    // console.log('Loading accounts...');

    const data = fs.readFileSync(
      path.join(__dirname, '../../accounts.txt'),
      'utf8'
    );

    if (!data.length) {
      console.log('No data in accounts.txt');
      return;
    }

    this.parseAccounts(data);
  }

  private parseAccounts(data: string): void {
    const lines = data.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const element = lines[i];
      const parts = element.split(':');

      if (parts.length !== 2) {
        console.log('Invalid account format:', element);
        continue;
      }

      const account: Account = {
        email: parts[0],
        password: parts[1],
        busy: false,
      };

      this.accounts.push(account);
    }
  }
}
