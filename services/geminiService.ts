
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Region, OCRResult } from "../types";

// Always use the process.env.API_KEY directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function extractDataFromImage(
  base64Image: string,
  regions: Region[]
): Promise<OCRResult> {
  const model = 'gemini-3-flash-preview';
  
  // Convert regions to a descriptive prompt
  const regionsDescription = regions.map(r => 
    `- Field Name: "${r.name}". Location (approximate percentages of image): x=${r.x}%, y=${r.y}%, width=${r.width}%, height=${r.height}%`
  ).join('\n');

  const prompt = `
    You are a professional OCR extraction engine. 
    I have provided an image of a document and defined specific regions to extract text from.
    
    DEFINED REGIONS:
    ${regionsDescription}
    
    TASK:
    1. Look at the image.
    2. Locate the specific areas described by the percentages above.
    3. Extract the exact text found within those areas.
    4. Return the data as a JSON object where keys are the Field Names and values are the extracted text.
    5. If a field is empty or not found, return an empty string for that key.
  `;

  // Use ai.models.generateContent as per guidelines
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
    // Access .text property directly as per guidelines (getter, not a method)
    const jsonStr = response.text || "{}";
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Failed to parse Gemini response as JSON:", error);
    return {};
  }
}
