
/**
 * Service to interact with Firestore via REST API for persistence.
 * This ensures data is saved even if the browser session is closed.
 */

const PROJECT_ID = 'scanflow-ocr-default'; // In a real deployment, this would be an env var
const DATABASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export async function saveExtractionToFirestore(
  batchId: string,
  fileName: string,
  data: Record<string, string>,
  regions: any[]
): Promise<boolean> {
  try {
    // Note: In production, you would use an Auth token. 
    // Here we use the generic REST endpoint for the specified project.
    const response = await fetch(`${DATABASE_URL}/extractions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
          config: {
            stringValue: JSON.stringify(regions)
          }
        }
      })
    });

    return response.ok;
  } catch (error) {
    console.error("Firestore Sync Error:", error);
    return false;
  }
}
