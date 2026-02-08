
/**
 * Service to interact with Firestore via REST API for persistence.
 */

const PROJECT_ID = 'scanflow-ocr-default';
const DATABASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export async function saveExtractionToFirestore(
  batchId: string,
  fileName: string,
  data: Record<string, string>,
  regions: any[]
): Promise<boolean> {
  try {
    const response = await fetch(`${DATABASE_URL}/extractions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          batchId: { stringValue: batchId },
          fileName: { stringValue: fileName },
          extractedAt: { timestampValue: new Date().toISOString() },
          data: {
            mapValue: {
              fields: Object.entries(data).reduce((acc, [key, value]) => {
                acc[key] = { stringValue: value };
                return acc;
              }, {} as any)
            }
          },
          config: { stringValue: JSON.stringify(regions) }
        }
      })
    });
    return response.ok;
  } catch (error) {
    console.error("Firestore Sync Error:", error);
    return false;
  }
}
