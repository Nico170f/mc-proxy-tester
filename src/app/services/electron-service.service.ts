import { Injectable } from '@angular/core';

interface ElectronWindow extends Window {
  electronAPI?: {
    testConnection: (data: any) => Promise<any>;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private _electronAPI: ElectronWindow['electronAPI'];

  constructor() {
    // Get access to electronAPI if it exists (we're in Electron)
    this._electronAPI = (window as ElectronWindow).electronAPI;
  }

  get isElectron(): boolean {
    return !!this._electronAPI;
  }

  testConnection(data: any): Promise<any> {
    if (this.isElectron) {
      return this._electronAPI!.testConnection(data);
    } else {
      console.warn('Not running in Electron');
      return Promise.resolve({
        success: false,
        message: 'Not running in Electron',
      });
    }
  }
}
