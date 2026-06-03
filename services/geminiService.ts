import { StockItem } from "../types";

export interface InvoiceFile {
  data: string;
  mimeType: string;
}

/**
 * Sends current inventory status to our backend service to fetch strategic AI recommendations.
 */
export const generateInventoryInsights = async (inventory: StockItem[]): Promise<string> => {
  try {
    const response = await fetch("/api/gemini/insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inventory }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || "Server returned an error status.");
    }

    return result.text || "No insights generated.";
  } catch (error: any) {
    console.error("Client generateInventoryInsights Error:", error);
    return `AI Insights currently unavailable: ${error.message || "Please check your system connection."}`;
  }
};

/**
 * Sends base64 formatted invoice image/pdf fragments to our backend service for OCR and structuring.
 */
export const extractInvoiceData = async (files: InvoiceFile[]) => {
  try {
    console.log("[Gemini Client Service] Dispatching extraction payload to backend proxy...");
    const response = await fetch("/api/gemini/extract-invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || "Failed to read the invoice successfully.");
    }

    return result.data || {};
  } catch (error: any) {
    console.error("Client extractInvoiceData Error:", error);
    throw new Error(error.message || "Failed to scan the invoice. Make sure files are clear and API credentials are set.");
  }
};
