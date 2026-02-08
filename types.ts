
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

export interface ScannedFile {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  extractedData?: Record<string, string>;
}

export interface OCRResult {
  [key: string]: string;
}
