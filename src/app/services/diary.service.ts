import { Injectable } from '@angular/core';
import { Entry } from '../model/interfaces/entry.interface';

@Injectable({ providedIn: 'root' })
export class DiaryService {
  private entries: Entry[] = [];
  private LS_KEY = 'diary_entries_v1';

  constructor() { this.load(); }

  private load() {
    const data = localStorage.getItem(this.LS_KEY);
    this.entries = data ? JSON.parse(data) : [];

    if (this.entries.length>0) {
      console.log(`Se han cargado datos guardados del localStorage (${this.formatStringSize(JSON.stringify(this.entries))} de 10Mb)`);
    }
  }

  private save() {
    localStorage.setItem(this.LS_KEY, JSON.stringify(this.entries));
  }

  list(): Entry[] {
    return [...this.entries].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }

  get(id: string): Entry | undefined {
    return this.entries.find(e => e.id === id);
  }

  create(title: string, content: string, language: string, voice: string): Entry {
    const entry: Entry = {
      id: crypto.randomUUID(),
      title,
      content,
      createdAt: new Date().toISOString(),
      language,
      voice
    };
    this.entries.push(entry);
    this.save();
    return entry;
  }

  update(id: string, fields: Partial<Entry>) {
    const entry = this.get(id);
    if (!entry) return;
    Object.assign(entry, fields);
    entry.updatedAt = new Date().toISOString();
    this.save();
  }

  delete(id: string) {
    this.entries = this.entries.filter(e => e.id !== id);
    this.save();
  }

  search(query: string): Entry[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.list();
    return this.entries.filter(e => (e.title + ' ' + e.content).toLowerCase().includes(q));
  }

  exportJSON(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  importJSON(json: string) {
    try {
      const arr = JSON.parse(json) as Entry[];
      if (!Array.isArray(arr)) throw new Error('Formato inválido');
      this.entries = arr;
      this.save();
    } catch (err) {
      throw new Error('Importación fallida: ' + (err as any).message);
    }
  }

  getStringSizeKB(str: string): number {
    const bytes = new Blob([str]).size;
    return Math.round((bytes / 1024) * 100) / 100;
  }

  formatStringSize(str: string): string {
    // Obtener bytes del string
    const bytes = new TextEncoder().encode(str).length;

    if (bytes === 0) return '0 B';

    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);

    // Formato con coma como decimal
    const formatted = size.toFixed(2).replace('.', ',');

    return `${formatted} ${sizes[i]}`;
  }

  getSorted(by: 'created' | 'updated' | 'language' | 'title' | 'voice', asc: boolean = true, languages: {code: string, label: string}[]): Entry[] {
    const sorted = [...this.entries];
    sorted.sort((a, b) => {
        let valA: string | number = '';
        let valB: string | number = '';

        switch(by) {
        case 'created':
            valA = new Date(a.createdAt).getTime();
            valB = new Date(b.createdAt).getTime();
            break;
        case 'updated':
            valA = a.updatedAt?new Date(a.updatedAt).getTime():'';
            valB = b.updatedAt?new Date(b.updatedAt).getTime():'';
            break;
        case 'language':
            const aLanguage: {code: string, label: string} | undefined = languages.find((_language) => _language.code.toLowerCase()===a.language.toLowerCase());
            const bLanguage: {code: string, label: string} | undefined = languages.find((_language) => _language.code.toLowerCase()===b.language.toLowerCase());
            if (aLanguage && bLanguage) {
                valA = aLanguage.label;
                valB = bLanguage.label;
            } else {
                valA = a.language.toLowerCase();
                valB = b.language.toLowerCase();
            }
            break;
        case 'title':
            valA = a.title.toLowerCase();
            valB = b.title.toLowerCase();
            break;
        case 'voice':
            valA = (a.voice) ? a.voice.toLowerCase() : '';
            valB = (b.voice) ? b.voice.toLowerCase() : '';
            break;
        }

        if (valA < valB) return asc ? -1 : 1;
        if (valA > valB) return asc ? 1 : -1;
        return 0;
    });
    return sorted;
    }
}
