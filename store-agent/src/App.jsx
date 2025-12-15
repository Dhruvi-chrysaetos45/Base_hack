import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import React from 'react';
import A2AAgent from './ai-agent';
import AP2Gateway from './ap2-gateway'; // <--- ADD THIS LINE

function App() {
  const [stock, setStock] = useState(20);
  const [logs, setLogs] = useState([]);
  const [isRestocking, setIsRestocking] = useState(false); 
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [ap2Suppliers, setAp2Suppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [salesHistory, setSalesHistory] = useState([]);
  
  const processingRef = useRef(false);
  const aiAgentRef = useRef(new A2AAgent());
  const ap2GatewayRef = useRef(new AP2Gateway());

  const addLog = (msg) => setLogs(prev => [msg, ...prev].slice(0, 10));

  // --- ROBOT 1: SIMULATE CUSTOMERS BUYING ---
  useEffect(() => {
    const interval = setInterval(() => {
      setStock(currentStock => {
        if (currentStock > 0) {
          setSalesHistory(prev => [...prev.slice(-9), Date.now()]);
          addLog(`🛒 Customer purchased 1kg rice`);
          return currentStock - 1;
        }
        addLog(`❌ Out of stock! Sale missed`);
        return currentStock;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // --- CHECK WITH AI FUNCTION (MISSING IN YOUR CODE) ---
  const checkWithAI = async () => {
    if (processingRef.current) return;
    
    addLog("🤔 Consulting AI agent for strategy...");
    
    // Calculate sales velocity
    const now = Date.now();
    const recentSales = salesHistory.filter(time => now - time < 3600000);
    const salesVelocity = recentSales.length;
    
    try {
      const recommendation = await aiAgentRef.current.analyzeStockStrategy(
        stock,
        {
          salesPerHour: salesVelocity,
          totalSalesToday: salesHistory.length,
          timeOfDay: new Date().getHours()
        },
        {
          season: "Normal",
          supplierRating: "Reliable",
          marketTrend: "Stable"
        }
      );

      if (recommendation) {
        setAiRecommendation(recommendation);
        addLog(`🧠 AI Analysis: ${recommendation.reason}`);
        addLog(`📊 Recommended: ${recommendation.recommendedQuantity}kg (Urgency: ${recommendation.urgencyScore}/10)`);
        
        if (recommendation.shouldRestock && stock < 10) {
          setTimeout(() => {
            triggerRestockAgent(recommendation.recommendedQuantity);
          }, 1000);
        } else if (recommendation.shouldRestock && stock >= 10) {
          addLog(`⏱️ AI suggests early restock to avoid shortage`);
        }
      }
    } catch (error) {
      console.error("AI Agent error:", error);
      addLog("❌ AI analysis failed, using default logic");
      // Fallback to default logic
      if (stock < 10) {
        triggerRestockAgent(50);
      }
    }
  };

  // --- ROBOT 2: THE WATCHMAN (AGENT) ---
  useEffect(() => {
    if (stock < 15 && !processingRef.current) {
      checkWithAI();
    }
  }, [stock]);

  const triggerRestockAgent = async (quantity = 50) => {
    if (processingRef.current || stock >= 10) return;
    
    processingRef.current = true; 
    setIsRestocking(true);
    addLog("⚠️ Stock Low! Agent waking up...");

    // Add debug info
    addLog(`🔍 Checking environment...`);
    addLog(`   RPC URL: ${import.meta.env.VITE_RPC_URL ? '✓ Set' : '✗ Missing'}`);
    addLog(`   Private Key: ${import.meta.env.VITE_AGENT_PRIVATE_KEY ? '✓ Set' : '✗ Missing'}`);

    try {
      // Check if env vars exist
      if (!import.meta.env.VITE_RPC_URL) {
        throw new Error("VITE_RPC_URL not found in .env file");
      }
      
      if (!import.meta.env.VITE_AGENT_PRIVATE_KEY) {
        throw new Error("VITE_AGENT_PRIVATE_KEY not found in .env file");
      }

      const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_RPC_URL);
      
      // Test connection to blockchain
      try {
        const network = await provider.getNetwork();
        addLog(`🔗 Connected to: ${network.name} (Chain ID: ${network.chainId})`);
      } catch (networkError) {
        addLog(`❌ RPC Connection failed: ${networkError.message}`);
        throw new Error(`Invalid RPC URL: ${import.meta.env.VITE_RPC_URL}`);
      }
      
      const agentWallet = new ethers.Wallet(import.meta.env.VITE_AGENT_PRIVATE_KEY, provider);
      
      // Check wallet balance
      const balance = await provider.getBalance(agentWallet.address);
      addLog(`🤖 Agent Wallet: ${agentWallet.address.slice(0,8)}...`);
      addLog(`💰 Balance: ${ethers.formatEther(balance)} ETH`);
      
      if (balance === 0n) {
        throw new Error(`Insufficient funds! Get test ETH for ${agentWallet.address}`);
      }

      // 1. Ask Supplier for Order
      addLog(`📦 Requesting ${quantity}kg rice from supplier...`);
      let response = await fetch('http://localhost:3000/buy-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: "Rice", quantity: quantity })
      });

      // Debug response
      addLog(`📡 Response status: ${response.status}`);
      
      // 2. Handle Payment Request (402)
      if (response.status === 402) {
        const invoice = await response.json();
        const cost = invoice.paymentDetails?.amount || "0.0001";
        
        addLog(`💰 Payment Required: ${cost} ETH`);
        addLog(`   To: ${invoice.paymentDetails?.destination?.slice(0,8)}...`);

        // --- THE REAL BLOCKCHAIN TRANSACTION ---
        try {
          const tx = await agentWallet.sendTransaction({
            to: invoice.paymentDetails.destination,
            value: ethers.parseEther(cost),
            gasLimit: 21000  // Standard gas for ETH transfer
          });

          addLog("⏳ Transaction sent! Hash: " + tx.hash.slice(0,16) + "...");
          addLog("⏱️ Waiting for confirmation (10-30 seconds)...");
          
          const receipt = await tx.wait();
          addLog(`✅ Payment confirmed in block ${receipt.blockNumber}`);
          
          // 3. Send the Transaction Hash as Proof
          addLog("📨 Sending payment proof to supplier...");
          response = await fetch('http://localhost:3000/buy-stock', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-payment-hash': tx.hash
            },
            body: JSON.stringify({ item: "Rice", quantity: quantity })
          });
        } catch (txError) {
          addLog(`❌ Transaction failed: ${txError.message}`);
          if (txError.message.includes('insufficient funds')) {
            addLog("💡 Get test ETH from: https://sepolia-faucet.pk910.de/");
          }
          throw txError;
        }
      } else if (!response.ok) {
        addLog(`❌ Backend error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        addLog(`   Response: ${errorText}`);
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        addLog("✅ " + data.message);
        setStock(prev => prev + quantity);
        setAiRecommendation(null);
      } else {
        addLog(`❌ Order failed: ${data.message || 'Unknown error'}`);
      }

    } catch (err) {
      console.error("Full error:", err);
      addLog("❌ Error: " + (err.message || "Unknown error"));
      
      // Try AP2 fallback
      if (err.message.includes('insufficient') || err.message.includes('failed')) {
        addLog("🔄 Attempting AP2 network fallback...");
        simulateAP2Fallback();
      }
    }

    processingRef.current = false;
    setIsRestocking(false);
  };

  // --- AP2 FALLBACK FUNCTIONS ---
  const simulateAP2Fallback = async () => {
    addLog("🌐 Scanning Google AP2 network via Gateway...");
    
    // 1. Use the Class to find suppliers
    const suppliers = await ap2GatewayRef.current.discoverSuppliers("Rice", 50);
    
    if (suppliers.length > 0) {
        setAp2Suppliers(suppliers);
        addLog(`✅ Found ${suppliers.length} AP2-compatible suppliers`);
    } else {
        addLog("⚠️ No AP2 suppliers found nearby.");
    }
  };

  const selectAP2Supplier = async (supplier) => {
    setSelectedSupplier(supplier);
    addLog(`📡 Selected: ${supplier.name} via AP2`);
    
    // 2. Use the Class to place the order
    const result = await ap2GatewayRef.current.placeOrderViaAP2(supplier, {
        item: "Rice",
        quantity: 50
    });

    if (result.success) {
        addLog(`✅ ${result.message}`);
        addLog(`🆔 Protocol ID: ${result.protocolUsed.toUpperCase()}`);
        
        // Update Inventory
        setTimeout(() => {
            setStock(prev => prev + 50);
            addLog("📦 +50kg rice added via AP2 network");
            setSelectedSupplier(null);
            setAp2Suppliers([]);
        }, 2000);
    }
  };

  // --- MANUAL DEBUG FUNCTIONS ---
  const checkEnvironment = () => {
    addLog("🔍 Checking environment...");
    addLog(`   VITE_RPC_URL: ${import.meta.env.VITE_RPC_URL ? '✓ Set' : '✗ Missing'}`);
    addLog(`   VITE_AGENT_PRIVATE_KEY: ${import.meta.env.VITE_AGENT_PRIVATE_KEY ? '✓ Set' : '✗ Missing'}`);
    addLog(`   Backend: http://localhost:3000`);
  };

  const testBackend = async () => {
    try {
      addLog("🔄 Testing backend connection...");
      const response = await fetch('http://localhost:3000/buy-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: "Test", quantity: 1 })
      });
      addLog(`📡 Backend status: ${response.status}`);
      if (response.status === 402) {
        addLog("✅ Backend working correctly (402 Payment Required)");
      }
    } catch (error) {
      addLog(`❌ Backend error: ${error.message}`);
      addLog("💡 Start backend with: node server.js");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-2">
            🏪 Autonomous <span className="text-blue-600">Kirana Store</span>
          </h1>
          <p className="text-gray-600">A prototype demonstrating AI agentic workflows with the x402 payment protocol.</p>
          <div className="inline-flex items-center mt-4 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
            <span className="w-2 h-2 bg-amber-500 rounded-full mr-2 animate-pulse"></span>
            Live Demo - Base Sepolia Testnet
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Inventory & Controls */}
          <div className="lg:col-span-2 space-y-8">
            {/* Inventory Card */}
            <div className={`bg-white rounded-2xl shadow-xl p-8 border-4 transition-all duration-500 ${stock < 10 ? 'border-red-300 bg-gradient-to-r from-white to-red-50 animate-pulse' : 'border-emerald-300 bg-gradient-to-r from-white to-emerald-50'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <span className="p-2 bg-gray-100 rounded-lg">📦</span> Rice Inventory
                  </h2>
                  <p className="text-gray-600 mt-1">Real-time stock level monitoring</p>
                </div>
                <div className={`px-4 py-2 rounded-full font-semibold ${stock < 10 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {stock < 10 ? '🚨 LOW STOCK' : '✅ Healthy'}
                </div>
              </div>
              
              {/* AI Recommendation Display */}
              {aiRecommendation && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🧠</span>
                    <h3 className="font-bold text-blue-800">AI Recommendation</h3>
                    <div className="ml-auto px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      Urgency: {aiRecommendation.urgencyScore}/10
                    </div>
                  </div>
                  <p className="text-blue-700 text-sm">{aiRecommendation.reason}</p>
                </div>
              )}
              
              <div className="text-center my-10">
                <div className="text-8xl font-black text-gray-800 mb-4">{stock}<span className="text-3xl text-gray-500"> kg</span></div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full transition-all duration-700 ${stock < 10 ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, (stock / 100) * 100)}%` }}
                  ></div>
                </div>
                <p className="text-gray-500 mt-2 text-sm">Restock threshold: <span className="font-semibold">10 kg</span></p>
              </div>
              
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={() => setStock(s => s - 5)}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition shadow-md hover:shadow-lg"
                >
                  Simulate Sale (-5kg)
                </button>
                <button
                  onClick={() => triggerRestockAgent(50)}
                  disabled={isRestocking || stock >= 10}
                  className={`px-6 py-3 font-medium rounded-lg transition shadow-md hover:shadow-lg ${isRestocking || stock >= 10 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
                >
                  {isRestocking ? 'Processing...' : 'Manual Restock'}
                </button>
                <button
                  onClick={checkEnvironment}
                  className="px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition"
                >
                  Check Env
                </button>
                <button
                  onClick={testBackend}
                  className="px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition"
                >
                  Test Backend
                </button>
              </div>
            </div>

            {/* Agent Activity Terminal */}
            <div className="bg-gray-900 text-gray-100 rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-gray-800 px-6 py-4 flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <span className="text-green-400">🤖</span> Autonomous Agent Terminal
                </h3>
                {isRestocking && (
                  <div className="flex items-center gap-2 text-amber-300">
                    <span className="flex h-3 w-3">
                      <span className="animate-ping absolute h-3 w-3 rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative rounded-full h-3 w-3 bg-amber-500"></span>
                    </span>
                    PROCESSING...
                  </div>
                )}
              </div>
              <div className="p-6 font-mono h-96 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-gray-500 text-center py-10">
                    <div className="text-4xl mb-4">🤖</div>
                    <div>{'> Waiting for agent activity...'}</div>
                    <div className="text-sm mt-4">Click "Simulate Sale" until stock reaches 9kg</div>
                  </div>
                ) : (
                  logs.map((log, i) => (
                    <div
                      key={i}
                      className={`py-3 border-b border-gray-800 ${log.includes("✅") ? 'text-green-400' : 
                                  log.includes("❌") ? 'text-red-400' : 
                                  log.includes("⚠️") ? 'text-amber-400' : 
                                  log.includes("💰") ? 'text-blue-400' :
                                  log.includes("🧠") ? 'text-purple-400' :
                                  log.includes("🌐") ? 'text-green-300' :
                                  'text-gray-300'}`}
                    >
                      {`> ${log}`}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Protocol & Info */}
          <div className="space-y-8">
            {/* x402 Protocol Card */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <span>⚡</span> x402 Protocol
              </h3>
              <p className="mb-6 opacity-90">HTTP 402 Payment Required workflow in action.</p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3"><div className="w-6 h-6 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold">1</div> Agent detects low stock</li>
                <li className="flex items-center gap-3"><div className="w-6 h-6 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold">2</div> Requests order (gets 402)</li>
                <li className="flex items-center gap-3"><div className="w-6 h-6 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold">3</div> Pays invoice on-chain</li>
                <li className="flex items-center gap-3"><div className="w-6 h-6 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold">4</div> Submits proof & completes order</li>
              </ul>
              <div className="mt-8 pt-6 border-t border-indigo-400">
                <div className="text-sm opacity-80 mb-2">Current Agent Wallet</div>
                <div className="font-mono bg-black/30 p-3 rounded-lg break-all text-sm">
                  {import.meta.env.VITE_AGENT_PRIVATE_KEY ? 
                    `${import.meta.env.VITE_AGENT_ADDRESS?.slice(0,10)}...` : 
                    "Not Configured"}
                </div>
              </div>
            </div>

            {/* AP2 Network Card */}
            {ap2Suppliers.length > 0 && (
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl shadow-xl p-8">
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <span>🌐</span> AP2 Network Available
                </h3>
                <p className="mb-4 opacity-90">Alternative suppliers found</p>
                <div className="space-y-3">
                  {ap2Suppliers.map(supplier => (
                    <div 
                      key={supplier.id}
                      onClick={() => selectAP2Supplier(supplier)}
                      className={`p-3 rounded-lg cursor-pointer transition ${selectedSupplier?.id === supplier.id ? 'bg-white/30' : 'bg-white/20 hover:bg-white/25'}`}
                    >
                      <div className="font-bold">{supplier.name}</div>
                      <div className="text-sm opacity-90">🚚 {supplier.delivery} • 💰 {supplier.price}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Debug Card */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                <span>🐛</span> Debug Panel
              </h3>
              <p className="text-gray-600 mb-4 text-sm">Common issues & fixes</p>
              
              <div className="space-y-3 text-sm">
                <div className="p-3 bg-red-50 rounded-lg">
                  <div className="font-bold text-red-800">❌ No Transaction?</div>
                  <ul className="text-red-700 mt-1 ml-4 list-disc">
                    <li>Is backend running? <code className="bg-red-100 px-1">node server.js</code></li>
                    <li>Check .env file for RPC_URL</li>
                    <li>Wallet needs test ETH</li>
                  </ul>
                </div>
                
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="font-bold text-blue-800">🔗 Connection Issues</div>
                  <ul className="text-blue-700 mt-1 ml-4 list-disc">
                    <li>Test RPC: Click "Check Env"</li>
                    <li>Test Backend: Click "Test Backend"</li>
                    <li>Check browser console (F12)</li>
                  </ul>
                </div>
                
                <button
                  onClick={() => {
                    setStock(9);
                    addLog("🔧 Manually set stock to 9kg");
                  }}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
                >
                  Force Trigger (Set to 9kg)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;