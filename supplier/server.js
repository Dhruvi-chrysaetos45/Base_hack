const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;


app.use(cors());
app.use(express.json());

const SUPPLIER_WALLET = process.env.SUPPLIER_WALLET_ADDRESS;

// 3. Create the "Order" endpoint
app.post('/buy-stock', (req, res) => {
    const { item, quantity } = req.body;

    // --- CHANGE IS HERE ---
    // We now look for 'x-payment-hash' (The Receipt from Blockchain)
    const paymentHash = req.headers['x-payment-hash'];

    if (!paymentHash) {
        console.log(`❌ Order blocked! Asking ${item} buyer for payment.`);
        
        // Return ERROR 402 with instructions to pay ETH
        return res.status(402).json({
            error: "Payment Required",
            message: "You must pay to restock this item.",
            paymentDetails: {
                amount: "0.0001",    // Small amount of ETH for testing
                currency: "ETH",
                chain: "Base Sepolia", 
                destination: SUPPLIER_WALLET
            }
        });
    }

    // IF HASH EXISTS (The user paid!)
    console.log(`✅ Payment Proof (Hash) Received: ${paymentHash}`);
    console.log(`📦 Shipping ${quantity} ${item}...`);
    
    res.json({ 
        success: true, 
        message: `Payment Verified on Chain! ${quantity} ${item} shipped.` 
    });
});

// 4. Start the server
app.listen(PORT, () => {
    console.log(`📦 Supplier API is running on http://localhost:${PORT}`);
});

