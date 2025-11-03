import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { SpeechService } from '../../services/speech.service';
import { debounceTime, Subject, Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-voice-nav',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './voice-nav.component.html',
  styleUrl: './voice-nav.component.scss'
})
export class VoiceNavComponent implements OnInit, OnDestroy {

  @Input()
  noListeningText?: string;
  @Input()
  listeningText?: string;
  @Input() 
  inputElement!: HTMLInputElement;
  @Input()
  currentLang = 'es-ES';
  
  @Output()
  onTextListened = new EventEmitter<string>();

  @Output()
  onLanguageChanged = new EventEmitter<string>();

  languages: {code: string, label: string}[] = [];

  subs: Subscription[] = [];
  
  listening = signal(false);
  interim = '';

  constructor(public speech: SpeechService) {}

  toggleListen() {
    if (!this.speech.isSupported) return alert('Reconocimiento de voz no soportado.');
    if(!this.listening()) {
      this.changeLanguage();
    }
    this.listening() ? this.speech.stop() : this.speech.start();
    this.listening.set(!this.listening());
    if (this.listening()) {
      this.interim = '';
    }
  }

  /** Update the input’s value and trigger an input event */
  private updateInputValue(value: string) {
    this.inputElement.value = value;

    console.log('updateInputValue()', this.inputElement, value);

    // Dispatch an input event so Angular forms or listeners can react
    const event = new Event('input', { bubbles: true });
    this.inputElement.dispatchEvent(event);
  }

  changeLanguage() {
    this.speech.setLanguage(this.currentLang);
    this.onLanguageChanged.emit(this.currentLang);
  }

  getLanguageByLanguageCode(languageCode: string): string {
    const parts = languageCode.split('-');
    return parts.length === 2 ? parts[0].toLowerCase() : '';
  }

  getCountryByLanguageCode(languageCode: string): string {
    const parts = languageCode.split('-');
    return parts.length === 2 ? parts[1].toLowerCase() : '';
  }

  ngOnInit() {
    this.languages = this.speech.getLanguages();
    this.speech.setLanguage(this.currentLang);
    this.subs.push(this.speech.onInterim().subscribe(t => {
      this.interim = t;
    }));
    this.subs.push(this.speech.onFinal().subscribe(t => {
      if (this.listening()) {

        this.onTextListened.emit(this.interim.replace(/\s+/g, ' '));

        if(this.inputElement) {
          this.updateInputValue(this.interim.replace(/\s+/g, ' '));
        }

        this.interim = '';
        this.speech.stop();
        
        this.toggleListen();
      }
    }));
    
  }

  ngOnDestroy() { 
    this.subs.forEach(s => s.unsubscribe()); 
  }

}
