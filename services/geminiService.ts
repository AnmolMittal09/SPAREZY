import { GoogleGenAI, Type } from "@google/genai";
import { StockItem } from "../types";

const getApiKey = (): string => {
  let key = "";
  try {
    // Try process.env
    if (typeof process !== "undefined" && process.env) {
      key = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
    }
  } catch (e) {}

  if (!key) {
    try {
      // @ts-ignore
      key = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY || "";
    } catch (e) {}
  }

  if (!key) {
    try {
      // @ts-ignore
      key = window.process?.env?.API_KEY || window.process?.env?.GEMINI_API_KEY || "";
    } catch (e) {}
  }
  return key ? key.trim() : "";
};

export const generateInventoryInsights = async (inventory: StockItem[]): Promise<string> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("Gemini API Key is missing. Please ensure GEMINI_API_KEY is configured in your Environment / Settings.");
    }
    const ai = new GoogleGenAI({ apiKey });
    const summary = inventory.map(i => 
      `- ${i.partNumber} (${i.brand}): ${i.quantity} units (Threshold: ${i.minStockThreshold})`
    ).join('\n');

    const prompt = `
      You are an inventory analyst for a car spare parts shop named "Sparezy".
      We stock Hyundai and Mahindra parts.
      
      Here is the current stock list status:
      ${summary}

      Please provide a concise strategic summary for the Business Owner.
      1. Identify critical shortages (Zero stock).
      2. Highlight low stock risks.
      3. Suggest which brand needs more immediate attention.
      4. Provide a short "Health Score" of the inventory out of 10.
      
      Keep it professional, actionable, and under 200 words.
    `;

    // Try gemini-2.5-flash first since it's the most stable multimodal/text model
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text || "No insights generated.";
    } catch (firstError) {
      console.warn("Retrying insights generation with gemini-3.5-flash...", firstError);
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });
      return response.text || "No insights generated.";
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return `Failed to generate AI insights. ${error.message || ""}`;
  }
};

export interface InvoiceFile {
  data: string;
  mimeType: string;
}

export const extractInvoiceData = async (files: InvoiceFile[]) => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("Gemini API Key is missing. Please ensure GEMINI_API_KEY is configured in your Environment / Settings.");
    }
    const ai = new GoogleGenAI({ apiKey });
    
    // Convert multiple files into inlineData parts
    const fileParts = files.map(f => ({
      inlineData: {
        data: f.data,
        mimeType: f.mimeType,
      },
    }));

    const prompt = `
      Analyze these car spare parts invoice pages. 
      
      IMPORTANT FILTERING RULES:
      1. ONLY PROCESS THE ORIGINAL COPY: Invoices often contain 'Original', 'Duplicate', 'Triplicate', and 'Quadruplicate' pages. 
      2. You MUST ONLY extract data from the page(s) explicitly marked as "ORIGINAL" or "ORIGINAL FOR RECIPIENT/BUYER".
      3. IGNORE ALL OTHER COPIES: Do not process or extract items from pages marked as 'DUPLICATE', 'TRIPLICATE', 'QUADRUPLICATE', 'EXTRA COPY', 'TRANSPORT COPY', or 'OFFICE COPY'.
      4. CONSOLIDATE: If the "Original" invoice itself spans multiple pages (e.g. Page 1 of 2, Page 2 of 2), extract and combine all items from those original pages.
      5. DE-DUPLICATION: If the user provides multiple images of the same "Original" page, only extract those items once.

      CRITICAL VALIDATION RULES FOR METADATA:
      - INVOICE DATE VS INVOICE NUMBER: Do NOT mistake the Invoice Date for the Invoice Number. The Invoice/Bill Number MUST NOT be a date (e.g., if you extract a date value like "29/01/2026", that is NOT the invoice number).
      - If the invoice number cannot be confidently found, set it to null or empty string, but NEVER populate it with the invoice date or invoice timestamp.

      DATA TO EXTRACT:
      1. Identify the Dealer/Vendor Name (The company selling the parts).
      2. Identify the Invoice Date.
      3. Identify the Invoice Number/Bill Number (This is usually labeled 'Invoice No.', 'Inv No.', 'Bill No.', 'Tax Invoice No.' etc., e.g. "INV-2024-001" or "GST/1293").
      4. Extract line items strictly from the ORIGINAL pages with these fields:
         - Part Number: The actual manufacturer alphanumeric spare part number/SKU.
           * CRITICAL: Do NOT extract S.No/Sl.No (like 1, 2, 3...) which represent row numbers.
           * CRITICAL: Do NOT extract HSN / SAC Codes (like 8708, 4016, 87089900, 87082990) which represent GST tax classification categories.
           * Hyundai part numbers are typically alphanumeric strings often formatted with hyphens (e.g. "95430-1W000", "58101-1RA00", "28510-2B000", "551001RA00"). Mahindra part numbers are typically multi-character alphanumeric sequences, often without standard hyphens or with slash indicators (e.g. "0305AP0071N", "0114CD0021N", "0313AP0120N").
           * Look for columns titled "Part No", "Part Number", "Item Code", "Catalog No", or "Item ID".
           * If the Part Number is joined inside the description or part name field (e.g., "95430-1W000 CHASSIS BUSH"), parse and separate them so that the Part Number field receives only the clean alphanumeric code ("95430-1W000") and the Name field receives the text ("CHASSIS BUSH").
         - Part Name/Description (the full descriptive name of the part)
         - Quantity (Qty)
         - MRP (Maximum Retail Price before discount)
         - B.DC % (Basic Discount percentage, typically around 12%)
         - Printed Net Unit Price (Final price for one unit shown on the bill)

      Ensure numerical values are clean numbers. 
      Return the data strictly as a JSON object.
    `;

    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          dealerName: { type: Type.STRING, description: "Name of the supplier/dealer" },
          invoiceDate: { type: Type.STRING, description: "Date on the invoice" },
          invoiceNumber: { type: Type.STRING, description: "The unique invoice number or bill number (e.g. GST-1293). This MUST NOT be a date format like 'DD/MM/YYYY'." },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                partNumber: { type: Type.STRING, description: "The true manufacturer alphanumeric part number (SKU/Catalog ID). DO NOT use HSN/SAC codes or row Sl. No. numbers here." },
                name: { type: Type.STRING, description: "Descriptive name of the part" },
                quantity: { type: Type.NUMBER },
                mrp: { type: Type.NUMBER },
                discountPercent: { type: Type.NUMBER, description: "B.DC percentage" },
                printedUnitPrice: { type: Type.NUMBER, description: "The unit price shown on the bill after discount" }
              },
              required: ["partNumber", "name", "quantity", "mrp", "discountPercent", "printedUnitPrice"]
            }
          }
        },
        required: ["dealerName", "items"]
      }
    };

    let response;
    // Primary try with gemini-2.5-flash (fully featured multimodal model with reliable JSON schema support)
    try {
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [...fileParts, { text: prompt }] },
        config,
      });
    } catch (firstError: any) {
      console.warn("Extraction with gemini-2.5-flash failed. Retrying with gemini-3.5-flash...", firstError);
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: { parts: [...fileParts, { text: prompt }] },
          config,
        });
      } catch (secondError: any) {
        console.error("Extraction failed for both models.", secondError);
        throw new Error(`Failed to read the invoice using Gemini AI. Secondary Error: ${secondError.message || secondError}`);
      }
    }

    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Invoice Extraction Error:", error);
    throw new Error(error.message || "Failed to read the invoice. Please ensure the 'Original' copy is clear and included.");
  }
};