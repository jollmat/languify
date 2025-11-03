import { Component, OnInit, OnDestroy, signal, ViewChild, ElementRef, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { DiaryService } from '../../services/diary.service';
import { SpeechService } from '../../services/speech.service';
import { debounceTime, Subject, Subscription } from 'rxjs';
import { Entry } from '../../model/interfaces/entry.interface';
import { TranslationService } from '../../services/translation.service';
import { VoiceNavComponent } from "../voice-nav/voice-nav.component";
import { VoiceInputComponent } from '../voice-input/voice-input.component';
import { DeviceService } from '../../services/device.service';

@Component({
  selector: 'app-diary',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModule, VoiceNavComponent, VoiceInputComponent],
  templateUrl: './diary.component.html',
  styleUrls: ['./diary.component.scss']
})
export class DiaryComponent implements OnInit, OnDestroy {

  @ViewChild('text1') textarea1!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('text2') textarea2!: ElementRef<HTMLTextAreaElement>;

  @ViewChild('entryModalTemplate', { static: true }) entryModalTempl!: TemplateRef<any>;

  selectedLang = 'es-ES';
  showEditor = signal(false); 
  darkMode = signal(true);

  entries: Entry[] = [];
  selected?: Entry;
  title = '';
  content = '';
  contentTranslated = '';
  language = this.selectedLang;
  query = '';
  listening = signal(false);
  speaking = signal(false);
  paused = signal(false);
  interim = '';
  subs: Subscription[] = [];

  columns: {
    title: {visible: boolean},
    content: {visible: boolean},
    language: {visible: boolean},
    voice: {visible: boolean},
    created: {visible: boolean},
    updated: {visible: boolean}
  } = {
    title: {visible: true},
    content: {visible: true},
    language: {visible: true},
    voice: {visible: true},
    created: {visible: false},
    updated: {visible: false}
  };
  columnsTemp: {
    title: {visible: boolean},
    content: {visible: boolean},
    language: {visible: boolean},
    voice: {visible: boolean},
    created: {visible: boolean},
    updated: {visible: boolean}
  } = JSON.parse(JSON.stringify(this.columns));

  private contentSubject = new Subject<string>();
  private contentSubscription!: Subscription;

  voiceSpeedRate = 1;
  selectedVoiceUri = '';
  selectedVoice?: SpeechSynthesisVoice = undefined;
  voicesAll: SpeechSynthesisVoice[] = [];
  voices: SpeechSynthesisVoice[] = [];

  spokenText: string = '[]';

  sortBy: 'created' | 'updated' | 'language' | 'title' | any = 'created';
  sortAsc = false;

  languages: {code: string, label: string}[] = [];

  isTablet = signal(false);
  isDesktop = signal(false);

  constructor(
    private readonly diary: DiaryService, 
    public readonly speech: SpeechService, 
    private readonly modalService: NgbModal,
    private readonly deviceService: DeviceService,
    private readonly translationService: TranslationService) {
      this.languages = this.speech.getLanguages();
      this.loadVoices();
      // Algunos navegadores requieren este evento
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
  }

  ngOnInit() {
    this.refresh();
    if (this.speech.isSupported) {
      this.subs.push(this.speech.onInterim().subscribe(t => this.interim = t));
      this.subs.push(this.speech.onFinal().subscribe(t => this.content += (this.content ? ' ' : '') + t));

      this.subs.push(this.contentSubject.pipe(debounceTime(500)).subscribe(value => {
        this.content = value;
        this.translate();
      }));
    }

    this.deviceService.tablet$.subscribe(val => this.isTablet.set(val));
    this.deviceService.desktop$.subscribe(val => this.isDesktop.set(val));
  }

  ngOnDestroy() { 
    this.subs.forEach(s => s.unsubscribe()); 
    this.stopSpeech();
  }

  refresh() { 
    this.stopSpeech();
    this.entries = this.diary.list(); 

    if (this.darkMode()) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
  }

  onTextChange(value: string) {
    this.contentSubject.next(value);
  }

  cleanEntrySelection() {
    this.stopSpeech();
    this.contentTranslated = '';
    this.selected = undefined; 
    this.title = ''; 
    this.content = '';
    this.language = this.selectedLang;
    this.selectedVoiceUri = '';
  }

  stopSpeech() {
    this.speaking.set(false);
    window.speechSynthesis.cancel();
  }

  newEntry(templateRef: any) { 
    this.cleanEntrySelection();
    this.showEditor.set(true);
    this.modalService.open(templateRef, { 
      centered: false, 
      size: 'lg',
      windowClass: this.darkMode() ? 'dark-modal' : 'dark-modal'
    });
  }
  save() {
    this.modalService.dismissAll();
    if (!this.title && !this.content) return;
    if (this.selected) this.diary.update(this.selected.id, { title: this.title, content: this.content, language: this.selectedLang, voice: this.selectedVoiceUri });
    else this.diary.create(this.title || new Date().toLocaleString(), this.content, this.selectedLang, this.selectedVoiceUri);
    this.cleanEntrySelection(); 
    this.refresh();
  }

  translate() {
    this.translationService.translate(this.content, this.getLanguageByLanguageCode(this.selectedLang), 'es').subscribe({
      next: (res) => {
        this.contentTranslated = res;
      },
      error: (e) => {
        if (this.getLanguageByLanguageCode(this.language)==='es') {
          this.contentTranslated = this.content;
        } else {
          this.contentTranslated = 'Error on translating text';
        }
      }
    });
  }

  togglePlayEntry(e: Entry) {
    if (this.speaking() && this.selected && e.id===this.selected.id) {
      this.toggleSpeak();
    } else {
      this.speaking.set(false);
      this.stopSpeech();

      this.selected = e; 
      this.title = e.title; 
      this.content = e.content; 
      this.language = e.language;
      this.selectedLang = e.language;

      this.updateVoicesByLanguage();
      this.showEditor.set(true);

      if (e.voice && e.voice.length>0) {
        this.selectedVoiceUri = e.voice;
        this.changeVoice();
      }
      this.toggleSpeak();
    }
    
  }

  edit(templateRef: any, e: Entry) { 
    
    this.speaking.set(false);
    this.stopSpeech();

    this.selected = e; 
    this.title = e.title; 
    this.content = e.content; 
    this.language = e.language;
    this.selectedLang = e.language;

    this.updateVoicesByLanguage();
    this.showEditor.set(true);

    if (e.voice && e.voice.length>0) {
      this.selectedVoiceUri = e.voice;
      this.changeVoice();
    }

    this.contentTranslated = 'Traduciendo...';

    this.translate();

    this.modalService.open(templateRef, { 
      centered: true, 
      size: 'lg',
      windowClass: this.darkMode() ? 'dark-modal' : 'dark-modal'
    });
  }
  remove(id: string) { this.diary.delete(id); this.refresh(); }
  toggleListening() { 
    if (!this.speech.isSupported) return alert('Reconocimiento de voz no soportado.');
    this.listening() ? this.speech.stop() : this.speech.start();
    this.listening.set(!this.listening()); 
    this.interim = '';
  }
  search() { this.entries = this.diary.search(this.query); }
  export() {
    const data = this.diary.exportJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `languify-backup-${new Date().toISOString()}.json`;
    a.click();
  }
  importFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { this.diary.importJSON(String(reader.result)); this.refresh(); alert('Importación completa'); }
      catch(err) { alert('Error importando: ' + (err as any).message); }
    };
    reader.readAsText(file);
  }
  importFileEvent(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.importFile(file);
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0'); // Mes de 0 a 11
    const year = String(d.getFullYear()).padStart(4, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} - ${hour}:${min}h`;
  }

  formatLanguage(code: string): string {
    return this.languages.find((_langItem) => _langItem.code===code)?.label || `${code}?`;
  }

  getCountryByLanguageCode(languageCode: string): string {
    const parts = languageCode.split('-');
    return parts.length === 2 ? parts[1].toLowerCase() : '';
  }

  getLanguageByLanguageCode(languageCode: string): string {
    const parts = languageCode.split('-');
    return parts.length === 2 ? parts[0].toLowerCase() : '';
  }

  changeLanguage(language?: string) {
    this.speech.setLanguage(language || this.selectedLang);
    this.selectedLang = language || this.selectedLang;
    this.updateVoicesByLanguage();
  }

  toggleDarkMode() {
    this.darkMode.set(!this.darkMode());

    if (this.darkMode()) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
  }

  togglePause() {
    this.paused.set(!this.paused());
    if (this.paused()) {
      window.speechSynthesis.pause();
    } else {
      window.speechSynthesis.resume();
    }
  }

  focusContent() {
    const sourceTextarea: HTMLTextAreaElement | null = document.querySelector<HTMLTextAreaElement>('#source-textarea');
    if (sourceTextarea) {
      sourceTextarea.focus();
    }
  }

  utterance!: SpeechSynthesisUtterance;
  toggleSpeak() {
    this.speaking.set(!this.speaking());

    if (this.speaking()) {
      if (!this.content) return;

      const sourceTextarea: HTMLTextAreaElement | null = document.querySelector<HTMLTextAreaElement>('#source-textarea');

      let selectedText = '';
      if (sourceTextarea) {
        selectedText = sourceTextarea.value.substring(sourceTextarea.selectionStart, sourceTextarea.selectionEnd);
      }
      
      this.paused.set(false);

      this.spokenText = ''; 

      this.utterance = new SpeechSynthesisUtterance(selectedText.length>0?selectedText:this.content);
      this.utterance.voice = this.selectedVoice || null;
      this.utterance.rate = this.voiceSpeedRate;
      this.utterance.pitch = 1;   // tono

      // Palabra a palabra
      this.utterance.onboundary = (event: any) => {
        console.log('utterance.onboundary()', event.name, event.charIndex);
        if (event.name === 'word' || event.name === 'sentence') {
          //console.log(event.target.text.substring(event.charIndex, event.charLength));
          //this.spokenText = event.target.text.substring(event.charIndex, event.charLength);
          //console.log(this.spokenText);
          //console.log(event);
        }
      };

      // Cuando termina la pronunciación
      this.utterance.onend = () => {
        console.log('utterance.onboundary()');
        this.speaking.set(false);
        setTimeout(() => {
          this.focusContent();
        },200);
      };

      this.utterance.onpause = () => {
        setTimeout(() => {
          this.focusContent()
        },200);
      };

      // Cuando inicia la pronunciación
      this.utterance.onstart = () => {
        console.log('utterance.onstart()');
        this.spokenText = '';
      };

      window.speechSynthesis.speak(this.utterance);
      
    } else {
      this.stopSpeech();
    }
  }

  updateVoicesByLanguage() {
    this.voices = this.voicesAll.filter((_voice) => {
      return _voice.lang===this.selectedLang;
    });
    if(this.voices.length>0) {
      let googleVoice: SpeechSynthesisVoice | undefined = this.voices.find((_voice) => _voice.name.startsWith('Google'));
      if (!googleVoice) {
        googleVoice = this.voices.find((_voice) => !_voice.name.includes('('));
      }
      this.selectedVoice = googleVoice || this.voices[0];
      this.selectedVoiceUri = this.selectedVoice.voiceURI;
    }
  }
  changeVoice() {
    this.selectedVoice = this.voices.find((_voiceItem) => _voiceItem.voiceURI===this.selectedVoiceUri);
  }

  loadVoices() {
    this.voicesAll = window.speechSynthesis.getVoices();
    if (this.voicesAll.length > 0 && !this.selectedVoice) {
      this.updateVoicesByLanguage();
      this.selectedVoice = this.voices[0];
    }
  }

  sort(by: 'created' | 'updated' | 'language' | 'title' | 'voice' | string) {
    if (this.sortBy === by) {
      this.sortAsc = !this.sortAsc; // alterna asc/desc
    } else {
      this.sortBy = by;
      this.sortAsc = true;
    }
    this.refreshSorted();
  }

  refreshSorted() {
    this.entries = this.diary.getSorted(this.sortBy, this.sortAsc, this.languages);
  }

  trackById(index: number, item: any): number {
    return item.id;
  }

  private isSyncing = false;
  // syncScroll receives the source and target textareas as template references
  syncScroll(source: HTMLTextAreaElement, target: HTMLTextAreaElement, event: Event) {
    if (this.isSyncing) return;
    this.isSyncing = true;

    target.scrollTop = source.scrollTop;
    target.scrollLeft = source.scrollLeft; // optional

    setTimeout(() => (this.isSyncing = false), 0);
  }

  copyToClipboard(id: string) {
    const textarea = document.getElementById(id) as HTMLTextAreaElement | null;
    if (!textarea) {
      console.error(`❌ Textarea with id "${id}" not found.`);
      return;
    }

    const text = textarea.value;

    navigator.clipboard.writeText(text)
      .then(() => console.log('✅ Copied to clipboard!'))
      .catch(err => console.error('❌ Failed to copy:', err));
  }

  openTableConfig(templateRef: any) {
    this.columnsTemp = JSON.parse(JSON.stringify(this.columns));
    this.modalService.open(templateRef, { 
      centered: false, 
      size: 'lg',
      windowClass: this.darkMode() ? 'dark-modal' : 'dark-modal'
    });
  }

  saveTableConfig() {
    this.columns = JSON.parse(JSON.stringify(this.columnsTemp));
  }

  closeTableConfig() {
    if (JSON.stringify(this.columns)!==JSON.stringify(this.columnsTemp)) {
      if (confirm('Hay cambios pendientes de guardar. Cerrar de todos modos?')) {
        this.modalService.dismissAll();
      }
    } else {
      this.modalService.dismissAll();
    }
  }

  onVoiceNav(voiceNavOrder: string) {
    if (voiceNavOrder.startsWith('sort by ') || voiceNavOrder.startsWith('order by ')) {
      this.sort(voiceNavOrder.replace('sort by ','').replace('order by ','').trim());
    } else if (voiceNavOrder.startsWith('create')) {
      this.newEntry(this.entryModalTempl);
    } else if (voiceNavOrder.startsWith('export')) {
      this.export();
    }
  }

}
