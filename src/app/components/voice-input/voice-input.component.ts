import {
  Component,
  EventEmitter,
  forwardRef,
  HostBinding,
  Input,
  Output,
  ViewChild,
  ElementRef,
  signal,
  OnInit,
  NgZone
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged, Subject, Subscription, takeUntil } from 'rxjs';

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

@Component({
  selector: 'app-voice-input',
  standalone: true,                // <-- MUST be here
  imports: [CommonModule, FormsModule],
  templateUrl: './voice-input.component.html',
  styleUrls: ['./voice-input.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => VoiceInputComponent),
      multi: true
    }
  ]
})
export class VoiceInputComponent implements OnInit, ControlValueAccessor {
  
  @ViewChild('nativeInput', { static: true }) nativeInput!: ElementRef<HTMLInputElement>;

  @Input() id?: string;
  @Input() name?: string;
  @Input() placeholder?: string;
  @Input() autocomplete?: string;
  @Input() maxlength?: number | string;
  @Input() ariaLabel?: string;
  @Input() multilanguage = false;

  @Input() darkMode = false;
  @Input() inputClass = '';

  @Output() input = new EventEmitter<Event>();
  @Output() change = new EventEmitter<string>();
  @Output() focus = new EventEmitter<FocusEvent>();
  @Output() blur = new EventEmitter<FocusEvent>();

  @Input()
  currentLang = 'es-ES';

  @HostBinding('class.disabled') get hostDisabled() { return this.isDisabled; }

  value = '';
  isDisabled = false;


  recognition: any;
  listening = signal(false);
  transcript = '';

  languages: {code: string, label: string}[] = [];

  onChanged = (value: string) => {};
  onTouched = () => {};

  private inputSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  
  constructor(private ngZone: NgZone) {
    // Setup the debounced stream
    this.inputSubject
      .pipe(
        debounceTime(300),          // ⏱ wait 300ms after last keystroke
        distinctUntilChanged(),     // only emit if value changed
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        this.value = value.replace(/\s+/g, ' ').trim();
        this.onChanged(this.value);
      });
  }

  ngOnInit(): void {
    this.languages = ([
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
    this.configSpeechRecognition();
  }

  changeLanguage() {
    this.recognition.lang = this.currentLang;
  }

  configSpeechRecognition() {
    const { webkitSpeechRecognition }: any = window as any;

    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser.');
      return;
    }

    this.recognition = new webkitSpeechRecognition();
    this.recognition.continuous = false; // stop automatically when voice stops
    this.recognition.interimResults = true;
    this.recognition.lang = this.currentLang;

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptChunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          this.ngZone.run(() => {
            this.transcript += transcriptChunk + ' ';
          });
        } else {
          interimTranscript += transcriptChunk;
        }
      }
      this.value = this.transcript.replace(/\s+/g, ' ').trim();
      this.onChanged(this.value);
    };

    this.recognition.onend = () => {
      this.ngZone.run(() => {
        this.listening.set(false);
      });
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      this.ngZone.run(() => {
        this.listening.set(false);
      });
    };
  }

  writeValue(obj: any): void {
    const newVal = obj == null ? '' : String(obj);
    this.value = newVal;
    if (this.nativeInput) this.nativeInput.nativeElement.value = newVal;
  }

  toggleListen() { 
    //this.listening() ? this.recognition.stop() : this.recognition.start();
    this.listening.set(!this.listening()); 
    if (this.listening()) {
      this.transcript = '';
      this.recognition.start();
    } else {
      this.recognition.stop();
    }
  }

  getLanguageByLanguageCode(languageCode: string): string {
    const parts = languageCode.split('-');
    return parts.length === 2 ? parts[0].toLowerCase() : '';
  }

  getCountryByLanguageCode(languageCode: string): string {
    const parts = languageCode.split('-');
    return parts.length === 2 ? parts[1].toLowerCase() : '';
  }

  getCurrentLanguage() {
    return this.languages.find((_language) => _language.code===this.currentLang);
  }

  registerOnChange(fn: any): void {
    this.onChanged = fn;  // <-- Angular provides parent’s change function
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  onInput(event: Event) {
    const newValue = (event.target as HTMLInputElement).value;
    this.updateValue(newValue);
  }

  updateValue(newValue: string) {
    this.value = newValue;
    this.inputSubject.next(this.value);  // push value into debounce pipeline
    this.onChanged(this.value);  // <-- notify parent form control
  }

}
