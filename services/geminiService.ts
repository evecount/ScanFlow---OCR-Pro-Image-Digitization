
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Region, OCRResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Extracts specific text from predefined regions, incorporating custom user hints for better accuracy.
 */
export async function extractDataFromImage(
  base64Image: string,
  regions: Region[],
  customInstructions?: string
): Promise<OCRResult> {
  const model = 'gemini-3-flash-preview';
  const regionsDescription = regions.map(r => 
    `- Field Name: "${r.name}". Location: x=${r.x}%, y=${r.y}%, width=${r.width}%, height=${r.height}%`
  ).join('\n');

  const prompt = `
    Extract text from the following regions of this document:
    ${regionsDescription}
    
    ${customInstructions ? `SPECIAL USER INSTRUCTIONS: ${customInstructions}` : ''}
    
    Return a JSON object where keys are the Field Names and values are the extracted text.
  `;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image.split(',')[1] || base64Image,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: regions.reduce((acc, r) => {
          acc[r.name] = { type: Type.STRING };
          return acc;
        }, {} as any),
        required: regions.map(r => r.name),
      },
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Extraction parse error:", error);
    return {};
  }
}

/**
 * Automatically detects potential data fields in an image using Gemini's layout intelligence,
 * prioritized by user-provided NLP instructions.
 */
export async function detectRegionsFromImage(
  base64Image: string, 
  userHints?: string
): Promise<Region[]> {
  const model = 'gemini-3-flash-preview';
  const prompt = `
    Analyze this document and identify key data fields for structured extraction.
    
    ${userHints ? `USER PRIORITIES & HINTS: "${userHints}"` : 'Standard fields to look for: Invoice Number, Date, Total, Vendor Name, Due Date, Tax.'}
    
    For each field identified, provide:
    1. A short, unique name for the field.
    2. A bounding box defined as percentages (0-100) of the image's width and height.
    
    IMPORTANT: If user hints specify certain information, prioritize finding those specific areas accurately.
    
    Return the result as a list of fields with their name and coordinates (x, y, width, height).
  `;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image.split(',')[1] || base64Image,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            x: { type: Type.NUMBER },
            y: { type: Type.NUMBER },
            width: { type: Type.NUMBER },
            height: { type: Type.NUMBER },
          },
          required: ["name", "x", "y", "width", "height"],
        },
      },
    },
  });

  try {
    const jsonStr = response.text || "[]";
    const detected = JSON.parse(jsonStr);
    return detected.map((d: any) => ({
      ...d,
      id: crypto.randomUUID()
    }));
  } catch (error) {
    console.error("Failed to detect regions:", error);
    return [];
  }
}
