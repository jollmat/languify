import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DiaryComponent } from './app/components/diary/diary.component';
import { provideHttpClient } from '@angular/common/http';

bootstrapApplication(DiaryComponent, {
  providers: [
    importProvidersFrom(FormsModule),
    provideHttpClient()
  ]
}).catch(err => console.error(err));
