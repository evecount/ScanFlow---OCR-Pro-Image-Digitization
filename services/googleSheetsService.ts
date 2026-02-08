
/**
 * Service to interact with the Google Sheets API
 */

export async function appendToGoogleSheet(
  spreadsheetId: string,
  accessToken: string,
  rowData: string[]
): Promise<boolean> {
  if (!spreadsheetId || !accessToken) {
    throw new Error("Missing Spreadsheet ID or Access Token");
  }

  // We append to the first sheet by default. 
  // 'USER_ENTERED' allows Google Sheets to parse strings as dates/numbers automatically.
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [rowData],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("Google Sheets API Error:", errorBody);
    return false;
  }

  return true;
}
