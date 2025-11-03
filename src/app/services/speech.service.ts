import { Injectable, NgZone } from '@angular/core';
import { Subject, Observable } from 'rxjs';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

@Injectable({ providedIn: 'root' })
export class SpeechService {
  private recognition: any = null;
  private interimSubject = new Subject<string>();
  private finalSubject = new Subject<string>();
  public isSupported = false;
  private currentLang = 'es-ES';

  constructor(private zone: NgZone) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = this.currentLang;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.isSupported = true;

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        this.zone.run(() => {
          let interim = '';
          let finalText = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i][0].transcript;
            if (event.results[i].isFinal) finalText += res + ' ';
            else interim += res + ' ';
          }
          if (interim) this.interimSubject.next(interim.trim());
          if (finalText) this.finalSubject.next(finalText.trim());
        });
      };
      this.recognition.onerror = (e: any) => console.error('Speech error:', e);
    }
  }

  start() { try { this.recognition?.start(); } catch {} }
  stop() { this.recognition?.stop(); }
  onInterim(): Observable<string> { return this.interimSubject.asObservable(); }
  onFinal(): Observable<string> { return this.finalSubject.asObservable(); }

  /** Cambiar idioma */
  setLanguage(lang: string) {
    const previousLang = this.currentLang;
    if (previousLang!==lang) {
        this.currentLang = lang;
        console.log(`Speech service changed current lang from ${previousLang} to ${lang}`);
        if (this.recognition) this.recognition.lang = lang;
    }
  }

  getLanguages(): {code: string, label: string}[] {
    return ([
        {code: 'ca-ES', label: 'Català'},
        {code: 'es-ES', label: 'Español (ES)'},
        {code: 'es-MX', label: 'Español (MX)'},
        {code: 'en-US', label: 'Inglés (US)'},
        {code: 'en-GB', label: 'Inglés (GB)'},
        {code: 'fr-FR', label: 'Francés'},
        {code: 'de-DE', label: 'Alemán'},
        {code: 'it-IT', label: 'Italiano'},
        {code: 'nl-BE', label: 'Neerlandés (BE)'},
        {code: 'sv-SE', label: 'Sueco'},
        {code: 'nl-NL', label: 'Neerlandés (NL)'}
    ] as {code: string, label: string}[]).sort((a,b) => {
        return a.code<b.code?-1:1;
    });
  }
}
