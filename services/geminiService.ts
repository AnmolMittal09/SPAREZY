import { GoogleGenAI } from "@google/genai";
import { StockItem } from "../types";

const API_KEY = process.env.API_KEY || ''; // In a real app, ensure this is set

export const generateInventoryInsights = async (inventory: StockItem[]): Promise<string> => {
  if (!API_KEY) {
    return "API Key is missing. Cannot generate insights.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    // Summarize data to send to Gemini to avoid token limits with huge inventories
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
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No insights generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate AI insights. Please try again later.";
  }
};
