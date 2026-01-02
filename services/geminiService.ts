import { GoogleGenAI, Type } from "@google/genai";
import { StockItem } from "../types";

export const generateInventoryInsights = async (inventory: StockItem[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    const filePart = {
      inlineData: {
        data: base64File,
        mimeType: mimeType,
      },
    };

    const prompt = `
      Extract line items from this car spare parts invoice (likely Hyundai or Mahindra). 
      For each item, identify:
      1. Part Number
      2. Name/Description
      3. Quantity (Qty)
      4. MRP (Maximum Retail Price before any discount)
      5. B.DC or Basic Discount Percentage (look for "B.DC", "Disc%", or "Discount")
      6. Printed Net Unit Price (The price shown on the bill AFTER discount)

      Ensure numerical values are clean numbers. If a discount isn't explicitly listed for an item, use 0.
      Return the data strictly as a JSON array.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [filePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              partNumber: { type: Type.STRING },
              name: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              mrp: { type: Type.NUMBER },
              discountPercent: { type: Type.NUMBER, description: "B.DC or Discount %" },
              printedUnitPrice: { type: Type.NUMBER, description: "The unit price shown on the bill after discount" }
            },
            required: ["partNumber", "quantity", "mrp", "discountPercent", "printedUnitPrice"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Invoice Extraction Error:", error);
    throw new Error("Failed to read the invoice. Please ensure the document is clear.");
  }
};