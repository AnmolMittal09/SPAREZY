
import { StockItem, ShopSettings } from "../types";

// Generic interface that fits both Transaction and CartItem
export interface InvoiceItem {
  partNumber: string;
  quantity: number;
  price: number;
  customerName?: string;
}

export const generateInvoice = (
  items: InvoiceItem[], 
  inventory: StockItem[], 
  shopSettings: ShopSettings
) => {
  if (items.length === 0) return;

  // Grouping / Metadata
  const customerName = items[0].customerName || 'Walk-in Customer';
  const date = new Date().toLocaleDateString();
  const time = new Date().toLocaleTimeString();
  const invoiceId = `INV-${Date.now().toString().slice(-6)}`;

  // Calculate Totals and Map Details
  let grandTotal = 0;
  const rows = items.map((tx, index) => {
    const stockItem = inventory.find(i => i.partNumber.toLowerCase() === tx.partNumber.toLowerCase());
    const name = stockItem ? stockItem.name : 'Unknown Part';
    const amount = tx.quantity * tx.price;
    grandTotal += amount;

    return `
      <tr class="item-row">
        <td>${index + 1}</td>
        <td>${tx.partNumber}</td>
        <td>${name}</td>
        <td class="text-center">${tx.quantity}</td>
        <td class="text-right">₹${tx.price.toFixed(2)}</td>
        <td class="text-right">₹${amount.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  // Calculate Tax (using shop default or 18%)
  const taxRate = (shopSettings.defaultTaxRate || 18) / 100;
  // Assuming the price stored is inclusive or exclusive based on business logic. 
  // For this template, we'll treat the total as subtotal + tax breakdown visually.
  const subTotal = grandTotal / (1 + taxRate);
  const taxAmount = grandTotal - subTotal;

  // Invoice HTML Template
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice ${invoiceId}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
        .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.15); }
        .header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px; border-bottom: 2px solid #002c5f; padding-bottom: 20px; }
        .logo-text { font-size: 28px; font-weight: 900; color: #002c5f; text-transform: uppercase; line-height: 1; }
        .company-details { text-align: right; font-size: 12px; color: #666; line-height: 1.5; }
        
        .info-section { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .info-block h3 { margin: 0 0 5px; font-size: 14px; color: #888; text-transform: uppercase; }
        .info-block p { margin: 0; font-weight: bold; font-size: 16px; }

        table { width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }
        table th { background: #f8f9fa; color: #444; font-weight: bold; padding: 12px; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #ddd; }
        table td { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        
        .total-section { margin-top: 30px; text-align: right; }
        .total-row { display: flex; justify-content: flex-end; gap: 20px; margin-bottom: 5px; }
        .total-label { font-size: 12px; color: #666; width: 100px; }
        .total-val { font-size: 14px; font-weight: bold; width: 100px; }
        .grand-total { font-size: 24px; color: #002c5f; margin-top: 10px; }
        
        .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #aaa; border-top: 1px solid #eee; padding-top: 20px; }
        
        @media print {
          body { padding: 0; }
          .invoice-box { box-shadow: none; border: 0; max-width: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-box">
        <div class="header">
          <div class="logo-section">
             <div class="logo-text">${shopSettings.name || 'SPAREZY'}</div>
             <div style="font-size: 10px; color: #888; margin-top: 5px;">GENUINE SPARE PARTS</div>
          </div>
          <div class="company-details">
            <strong>${shopSettings.name || 'My Shop'}</strong><br>
            ${shopSettings.address || 'Address Not Configured'}<br>
            Phone: ${shopSettings.phone || 'N/A'}<br>
            GSTIN: ${shopSettings.gst || 'N/A'}
          </div>
        </div>

        <div class="info-section">
          <div class="info-block">
            <h3>Bill To</h3>
            <p>${customerName}</p>
          </div>
          <div class="info-block" style="text-align: right;">
            <h3>Invoice Details</h3>
            <p>Invoice #: ${invoiceId}</p>
            <p>Date: ${date}</p>
            <p style="font-size: 12px; color: #666; font-weight: normal;">${time}</p>
          </div>
        </div>

        <table cellpadding="0" cellspacing="0">
          <thead>
            <tr>
              <th width="5%">#</th>
              <th width="20%">Part No</th>
              <th width="35%">Description</th>
              <th width="10%" class="text-center">Qty</th>
              <th width="15%" class="text-right">Rate</th>
              <th width="15%" class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-row">
             <div class="total-label">Subtotal</div>
             <div class="total-val">₹${subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="total-row">
             <div class="total-label">Tax (${shopSettings.defaultTaxRate}%)</div>
             <div class="total-val">₹${taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="total-row">
             <div class="total-label" style="font-weight:bold; font-size: 14px;">Grand Total</div>
             <div class="total-val grand-total">₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div class="footer">
          Thank you for your business!<br>
          Goods once sold will not be taken back.
        </div>
      </div>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  // Open Window and Print
  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    alert("Popup blocked! Please allow popups to print invoices.");
  }
};
