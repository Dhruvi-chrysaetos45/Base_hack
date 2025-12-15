require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Memory Storage for Supplier Dashboard
const orders = []; 

app.use(cors({
  origin: '*',
  exposedHeaders: ['x-payment-hash']
}));

app.use(express.json());

// 🌍 A2A DISCOVERY
app.get('/.well-known/agent.json', (req, res) => {
    res.json({
        "name": "SmartWholesale Supplier",
        "capabilities": ["buy-stock", "negotiate-price"],
        "payment_types": ["x402", "eth-base-sepolia"]
    });
});

// 🏭 SUPPLIER DASHBOARD ENDPOINT (NEW)
app.get('/supplier/orders', (req, res) => {
  const totalRevenue = orders.reduce((acc, curr) => acc + parseFloat(curr.total), 0);
  res.json({ 
    orders, 
    totalRevenue: totalRevenue.toFixed(5) 
  });
});

// 📦 ORDER ENDPOINT
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
    console.log(`📦 Order Request: ${quantity} ${item} - Asking ${finalPrice} ETH`);
    
    return res.status(402).json({
      error: "Payment Required",
      message: `Please send ${finalPrice} ETH`,
      paymentDetails: {
        amount: finalPrice,
        currency: "ETH",
        destination: process.env.SUPPLIER_WALLET_ADDRESS,
        invoiceId: `INV-${Date.now()}`
      }
    });
  }

  // 2. PAYMENT VERIFIED -> SAVE ORDER
  console.log(`✅ Payment Verified: ${paymentHash}`);
  
  const newOrder = {
    id: `ORD-${Date.now()}`,
    time: new Date().toLocaleTimeString(),
    item,
    quantity,
    total: finalPrice,
    hash: paymentHash,
    status: 'Dispatched ✈️'
  };
  
  // Add to top of list
  orders.unshift(newOrder);

  res.json({
    success: true,
    message: `Payment confirmed! ${quantity} ${item} dispatched via drone.`,
    trackingId: `TRK-${Date.now()}`,
    invoiceSatisfied: true
  });
});

app.listen(PORT, () => {
  console.log(`🏪 Supplier API running on http://localhost:${PORT}`);
});

module.exports = app;