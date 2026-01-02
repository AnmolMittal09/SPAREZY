import { GoogleGenAI, Type } from "@google/genai";
import { StockItem } from "../types";

export const generateInventoryInsights = async (inventory: StockItem[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "No insights generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate AI insights. Please try again later.";
  }
};

export const extractInvoiceData = async (base64File: string, mimeType: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const filePart = {
      inlineData: {
        data: base64File,
        mimeType: mimeType,
      },
    };

    const prompt = `
      Extract details from this car spare parts invoice. 
      
      1. Identify the Dealer/Vendor Name (The company selling the parts).
      2. Identify the Invoice Date.
      3. Extract all line items with these specific fields:
         - Part Number (alphanumeric SKU)
         - Part Name/Description (the full descriptive name of the part)
         - Quantity (Qty)
         - MRP (Maximum Retail Price before discount)
         - B.DC % (Basic Discount percentage, typically around 12%)
         - Printed Net Unit Price (Final price for one unit shown on the bill)

      Ensure numerical values are clean numbers. 
      Return the data strictly as a JSON object.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [filePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            dealerName: { type: Type.STRING, description: "Name of the supplier/dealer" },
            invoiceDate: { type: Type.STRING, description: "Date on the invoice" },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  partNumber: { type: Type.STRING },
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
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Invoice Extraction Error:", error);
    throw new Error("Failed to read the invoice. Please ensure the document is clear.");
  }
};