import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ElectronService } from './services/electron-service.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  standalone: true,
})
export class AppComponent {
  title = 'proxy-tester';

  response: any;

  constructor(private electronService: ElectronService) {}

  async testElectronConnection() {
    try {
      this.response = await this.electronService.testConnection({
        msg: 'Hello from Angular!',
      });
    } catch (error) {
      console.error('Error communicating with Electron:', error);
    }
  }
}
