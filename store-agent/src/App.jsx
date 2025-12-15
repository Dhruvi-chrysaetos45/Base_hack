import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';


function App() {
  const [stock, setStock] = useState(20);
  const [logs, setLogs] = useState([]);
  const [isRestocking, setIsRestocking] = useState(false); 
  const processingRef = useRef(false);

  const addLog = (msg) => setLogs(prev => [msg, ...prev].slice(0, 5));

  // --- ROBOT 1: SIMULATE CUSTOMERS BUYING ---
  useEffect(() => {
    const interval = setInterval(() => {
      setStock(currentStock => {
        if (currentStock>0) return currentStock-1;
        return currentStock;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [])



  // --- ROBOT 2: THE WATCHMAN (AGENT) ---
  useEffect(() => {
    // If stock is low AND we aren't already ordering...
    if (stock < 10 && !processingRef.current) {
      triggerRestockAgent();
    }
  }, [stock]);

  const triggerRestockAgent = async () => {
    processingRef.current = true; 
    setIsRestocking(true);
    addLog("⚠️ Stock Low! Agent waking up...");

    try {
      const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_RPC_URL);
      
      const privateKey = import.meta.env.VITE_AGENT_PRIVATE_KEY;
      if (!privateKey) throw new Error("No Private Key found in .env file!");
      
      const agentWallet = new ethers.Wallet(privateKey, provider);
      addLog(`🤖 Agent Wallet Loaded: ${agentWallet.address.slice(0,6)}...`);

      // 3. Ask Supplier for Order
      let response = await fetch('http://localhost:3000/buy-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: "Rice", quantity: 50 })
      });

      // 4. Handle Payment Request (402)
      if (response.status === 402) {
        const invoice = await response.json();
        const cost = "0.0001"; // Small amount for testing (Real ETH!)
        
        addLog(`💰 Payment Required. Sending ${cost} ETH on Base Sepolia...`);

        // --- THE REAL BLOCKCHAIN TRANSACTION ---
        const tx = await agentWallet.sendTransaction({
            to: invoice.paymentDetails.destination, // The Supplier's Address
            value: ethers.parseEther(cost)          // Convert string to Wei
        });

        addLog("⏳ Transaction Sent! Waiting for confirmation...");
        await tx.wait(); // Wait for block to be mined (approx 2-5 seconds)
        
        addLog(`✅ Payment Confirmed! Hash: ${tx.hash.slice(0,10)}...`);

        // 5. Send the Transaction Hash as Proof
        response = await fetch('http://localhost:3000/buy-stock', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-payment-hash': tx.hash // Send the receipt
          },
          body: JSON.stringify({ item: "Rice", quantity: 50 })
        });
      }

      const data = await response.json();
      if (data.success) {
        addLog("✅ " + data.message);
        setStock(prev => prev + 50);
      }

    } catch (err) {
      console.error(err);
      addLog("❌ Transaction Failed: " + (err.message || "Unknown error"));
    }

    processingRef.current = false;
    setIsRestocking(false);
};

  return (
    <div style={{ padding: "40px", fontFamily: "monospace", maxWidth: "600px", margin: "0 auto" }}>
      <h1>🏪 Autonomous Kirana Store</h1>
      
      {/* INVENTORY PANEL */}
      <div style={{ border: "4px solid #333", padding: "20px", borderRadius: "10px", textAlign: "center", background: stock < 10 ? "#ffebee" : "#e8f5e9" }}>
        <h3>📦 RICE INVENTORY</h3>
        <h1 style={{ fontSize: "4rem", margin: "10px 0" }}>{stock} kg</h1>
        <p>{stock < 10 ? "🚨 LOW STOCK CRITICAL" : "✅ Stock Healthy"}</p>
      </div>

      {/* AGENT ACTIVITY LOG */}
      <div style={{ marginTop: "20px", background: "#000", color: "#0f0", padding: "20px", borderRadius: "10px", minHeight: "200px" }}>
        <h3>🤖 Agent Terminal</h3>
        {logs.map((log, i) => (
          <div key={i} style={{ borderBottom: "1px solid #333", padding: "5px 0" }}>{`> ${log}`}</div>
        ))}
        {isRestocking && <div className="blink">_ PROCESSING PAYMENT...</div>}
      </div>
    </div>
  );
}

export default App;