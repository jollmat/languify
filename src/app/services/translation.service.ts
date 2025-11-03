import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {

  private apiUrl = 'https://apertium.org/apy/translate'; // public API

  constructor(private http: HttpClient) {}

  translate(text: string, sourceLang: string, targetLang: string) {
    const url = `${this.apiUrl}?langpair=${sourceLang}|${targetLang}&q=${encodeURIComponent(text)}`;

    return this.http.get<any>(url).pipe(
      map(res => res.responseData.translatedText || '')
    );
  }
}
