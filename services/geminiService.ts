import { StockItem } from "../types";

export const generateInventoryInsights = async (inventory: StockItem[]): Promise<string> => {
  try {
    const response = await fetch("/api/gemini/insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inventory }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.text || "No insights generated.";
  } catch (error: any) {
    console.error("AI Insights Error:", error);
    return `Failed to generate AI insights: ${error.message || error}`;
  }
};

export interface InvoiceFile {
  data: string;
  mimeType: string;
}

export const extractInvoiceData = async (files: InvoiceFile[]) => {
  try {
    const response = await fetch("/api/gemini/extract-invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error("Invoice Extraction Error:", error);
    throw new Error(error.message || "Failed to read the invoice. Please ensure the 'Original' copy is clear and included.");
  }
};
