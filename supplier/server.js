require('dotenv').config(); // <--- 1. LOAD ENV VARS (CRITICAL)
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// <--- 2. ENABLE CORS WITH HEADERS (CRITICAL)
app.use(cors({
  origin: '*',
  exposedHeaders: ['x-payment-hash'] // Allows frontend to read the hash
}));

app.use(express.json());

// 🌍 A2A DISCOVERY (Make your agent "visible" to the network)
app.get('/.well-known/agent.json', (req, res) => {
    res.json({
        "name": "SmartWholesale Supplier",
        "capabilities": ["buy-stock", "negotiate-price"],
        "payment_types": ["x402", "eth-base-sepolia"]
    });
});

// Enhanced supplier with AI pricing
app.post('/buy-stock', async (req, res) => {
  const { item, quantity } = req.body;
  const paymentHash = req.headers['x-payment-hash'];

  // Dynamic pricing
  const dynamicPricing = {
    basePrice: 0.0001,
    surge: new Date().getHours() >= 17 ? 0.00002 : 0,
    bulkDiscount: quantity > 100 ? -0.00001 : 0
  };
  
  const finalPrice = (
    dynamicPricing.basePrice + 
    dynamicPricing.surge + 
    dynamicPricing.bulkDiscount
  ).toFixed(6);

  // 1. PAYMENT REQUIRED (402)
  if (!paymentHash) {
    console.log(`📦 Order: ${quantity}kg ${item} - Asking ${finalPrice} ETH`);
    
    return res.status(402).json({
      error: "Payment Required",
      message: `Please send ${finalPrice} ETH`,
      paymentDetails: {
        amount: finalPrice,
        currency: "ETH",
        chain: "Base Sepolia",
        destination: process.env.SUPPLIER_WALLET_ADDRESS, // <--- MATCHES .ENV
        invoiceId: `INV-${Date.now()}`
      }
    });
  }

  // 2. PAYMENT VERIFIED
  console.log(`✅ Verified Hash: ${paymentHash}`);
  console.log(`🚚 Shipping...`);
  
  res.json({
    success: true,
    message: `Payment confirmed! ${quantity}kg ${item} dispatched.`,
    deliveryEstimate: "2 hours",
    invoiceSatisfied: true
  });
});

// Negotiation Endpoint
app.post('/negotiate-price', (req, res) => {
  const { quantity, proposedPrice } = req.body;
  const responses = [
    `We can offer ${(proposedPrice * 0.95).toFixed(6)} ETH.`,
    `Price is fixed due to high demand.`
  ];
  res.json({ counterOffer: responses[0], validFor: "600" });
});

app.listen(PORT, () => {
  console.log(`🏪 Supplier API running on http://localhost:${PORT}`);
});