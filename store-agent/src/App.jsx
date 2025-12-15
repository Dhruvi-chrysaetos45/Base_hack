// App.jsx (The Fully Autonomous Shop)
import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';


function App() {
  // 1. We start with 20kg of Rice
  const [stock, setStock] = useState(20);
  const [logs, setLogs] = useState([]);
  const [isRestocking, setIsRestocking] = useState(false);
  
  // A Ref to keep track of "Do not order twice at the same time"
  const processingRef = useRef(false);

  // Helper to add messages to the screen
  const addLog = (msg) => setLogs(prev => [msg, ...prev].slice(0, 5));

  // --- ROBOT 1: SIMULATE CUSTOMERS BUYING ---
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     setStock(currentStock => {
  //       if (currentStock > 0) return currentStock - 1; // 1kg sold
  //       return currentStock;
  //     });
  //   }, 1500); // Fast speed: 1 sale every 1.5 seconds
  //   return () => clearInterval(interval);
  // }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setStock(currentStock => {
        if (currentStock>0) return currentStock-1;
        return currentStock;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);



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
      // 1. Connect to Real Blockchain (Base Sepolia Testnet)
      const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
      
      // 2. Load YOUR Wallet (The one with the money)
      // Note: We use import.meta.env to read the file we made in Step 3
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



// function App() {
//   const [status, setStatus] = useState("Idle");

//   // 1. Create a temporary "Burner Wallet" for the Agent
//   // In a real app, you would load a private key from a secure env file
//   const agentWallet = ethers.Wallet.createRandom();

//   const handleRestock = async () => {
//     setStatus("Initiating Order...");
    
//     try {
//       // --- ATTEMPT 1: Try to order normally ---
//       let response = await fetch('http://localhost:3000/buy-stock', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ item: "Rice", quantity: 50 })
//       });

//       // --- THE x402 LOGIC ---
//       if (response.status === 402) {
//         setStatus("⚠️ Payment Required! Analyzing 402 Request...");
        
//         // 1. Read the invoice from the supplier
//         const invoice = await response.json();
//         console.log("Invoice received:", invoice);

//         // 2. The Agent "Signs" the payment (Simulation)
//         // This proves the agent authorizes the spending
//         setStatus(`💸 Paying ${invoice.paymentDetails.amount} USDC...`);
//         const paymentSignature = await agentWallet.signMessage(
//             `I authorize payment of ${invoice.paymentDetails.amount} USDC to ${invoice.paymentDetails.destination}`
//         );

//         // 3. Wait 2 seconds (to look cool/realistic)
//         await new Promise(r => setTimeout(r, 2000));

//         // 4. ATTEMPT 2: Retry with the payment proof attached
//         response = await fetch('http://localhost:3000/buy-stock', {
//           method: 'POST',
//           headers: { 
//             'Content-Type': 'application/json',
//             'x-payment-token': paymentSignature // Attach the proof!
//           },
//           body: JSON.stringify({ item: "Rice", quantity: 50 })
//         });
//       }

//       // Final Success Message
//       const data = await response.json();
//       setStatus(data.message);
//       console.log("Final Success:", data);

//     } catch (error) {
//       console.error("Error:", error);
//       setStatus("System Error.");
//     }
//   };

//   return (
//     <div style={{ padding: "50px", fontFamily: "Arial", textAlign: "center" }}>
//       <h1>🏪 Kirana Store (AI Agent)</h1>
//       <div style={{ border: "2px solid #333", padding: "20px", borderRadius: "10px", display: "inline-block" }}>
//         <h3>Product: Basmati Rice</h3>
//         <p>Current Stock: <b style={{ color: "red" }}>5kg (LOW)</b></p>
//         <p style={{fontSize: "0.8rem", color: "#666"}}>Agent Wallet: {agentWallet.address.slice(0,6)}...{agentWallet.address.slice(-4)}</p>
        
//         <button 
//           onClick={handleRestock}
//           style={{ padding: "15px 30px", fontSize: "1rem", cursor: "pointer", background: "#6200ea", color: "white", border: "none", borderRadius: "5px" }}
//         >
//           🤖 Auto-Restock with x402
//         </button>
        
//         <p style={{ marginTop: "20px", fontWeight: "bold" }}>Status: {status}</p>
//       </div>
//     </div>
//   );
// }

// export default App;