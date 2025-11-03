import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {

  private userAgent: string;

  constructor() {
    this.userAgent = navigator.userAgent.toLowerCase();
  }

  isTablet(): boolean {
    // Detectar tablets (iPad, Android tablet, Kindle, etc.)
    return /ipad|tablet|playbook|silk/.test(this.userAgent);
  }

  isDesktop(): boolean {
    // Desktop si no es móvil ni tablet
    return !this.isTablet() && !this.isMobile();
  }

  isMobile(): boolean {
    // Detectar móviles (iPhone, Android phone, iPod, etc.)
    return /mobile|iphone|ipod|android/.test(this.userAgent);
  }

  getUserAgent() {
    return this.userAgent;
  }

  getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    if (this.isMobile()) return 'mobile';
    if (this.isTablet()) return 'tablet';
    return 'desktop';
  }
}
