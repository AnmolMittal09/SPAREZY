import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON middleware with high body limit for base64 files
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Initialize Gemini client on the server securely
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // REST API: Get Inventory Insights
  app.post("/api/gemini/insights", async (req, res) => {
    try {
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required but missing");
      }
      const { inventory } = req.body;
      if (!inventory || !Array.isArray(inventory)) {
        return res.status(400).json({ error: "Inventory array is required" });
      }

      const summary = inventory
        .map(
          (i: any) =>
            `- ${i.partNumber || "Unknown"} (${i.brand || "Unknown"}): ${i.quantity ?? 0} units (Threshold: ${i.minStockThreshold ?? 0})`
        )
        .join("\n");

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
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      res.json({ text: response.text || "No insights generated." });
    } catch (error: any) {
      console.error("Insights Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate AI insights." });
    }
  });

  // REST API: Extract Invoice Data
  app.post("/api/gemini/extract-invoice", async (req, res) => {
    try {
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required but missing");
      }
      const { files } = req.body;
      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "Files are required" });
      }

      const fileParts = files.map((f: any) => ({
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

        DATA TO EXTRACT:
        1. Identify the Dealer/Vendor Name (The company selling the parts).
        2. Identify the Invoice Date.
        3. Identify the Invoice Number / Bill Number (The invoice reference e.g., INV-1234, etc.).
        4. Extract line items strictly from the ORIGINAL pages with these fields:
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
        model: "gemini-3.5-flash",
        contents: { parts: [...fileParts, { text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              dealerName: { type: Type.STRING, description: "Name of the supplier/dealer" },
              invoiceDate: { type: Type.STRING, description: "Date on the invoice" },
              invoiceNumber: { type: Type.STRING, description: "Invoice number or Bill reference number" },
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
                    printedUnitPrice: { type: Type.NUMBER, description: "The unit price shown on the bill after discount" },
                  },
                  required: ["partNumber", "name", "quantity", "mrp", "discountPercent", "printedUnitPrice"],
                },
              },
            },
            required: ["dealerName", "items"],
          },
        },
      });

      const textOutput = response.text || "{}";
      const parsed = JSON.parse(textOutput);
      res.json(parsed);
    } catch (error: any) {
      console.error("Invoice extraction server error:", error);
      res.status(500).json({ error: error.message || "Failed to read the invoice." });
    }
  });

  // Serve static assets / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
