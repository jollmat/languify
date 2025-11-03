export interface Entry {
  id: string;
  title: string;
  content: string;
  createdAt: string; // ISO
  updatedAt?: string; // ISO
  language: string;
  voice?: string;
}