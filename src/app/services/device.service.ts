import { Injectable, HostListener } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  // Observables para que otros componentes se subscriban
  private tabletSubject = new BehaviorSubject<boolean>(false);
  private desktopSubject = new BehaviorSubject<boolean>(false);

  tablet$ = this.tabletSubject.asObservable();
  desktop$ = this.desktopSubject.asObservable();

  constructor() {
    // Detectar al cargar
    this.detectDevice(window.innerWidth);

    // Detectar cuando la ventana cambia de tamaño
    window.addEventListener('resize', () => {
      this.detectDevice(window.innerWidth);
    });
  }

  private detectDevice(width: number) {
    if (width >= 768 && width <= 1024) {
      this.tabletSubject.next(true);
      this.desktopSubject.next(false);
    } else if (width > 1024) {
      this.desktopSubject.next(true);
      this.tabletSubject.next(false);
    } else {
      this.desktopSubject.next(false);
      this.tabletSubject.next(false);
    }
  }

  // Métodos convenientes
  isTablet(): boolean {
    return this.tabletSubject.value;
  }

  isDesktop(): boolean {
    return this.desktopSubject.value;
  }
}
