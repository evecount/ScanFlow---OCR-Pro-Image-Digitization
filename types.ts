
export interface Point {
  x: number;
  y: number;
}

export interface Region {
  id: string;
  name: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 0-100
  height: number; // percentage 0-100
}

export interface MappingTemplate {
  id: string;
  name: string;
  regions: Region[];
  instructions: string;
  createdAt: string;
}

export type SyncStatus = 'unsynced' | 'syncing' | 'synced' | 'failed';

export interface ScannedFile {
  id: string;
  file: File;
  displayName?: string;
  preview: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  syncStatus: SyncStatus;
  extractedData?: Record<string, string>;
  error?: string;
}

export interface OCRResult {
  [key: string]: string;
}
