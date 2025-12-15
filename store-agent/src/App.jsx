import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import A2AAgent from './ai-agent';
import AP2Gateway from './ap2-gateway';
import { 
  LayoutDashboard, 
  Package, 
  History, 
  TerminalSquare, 
  Wallet, 
  CheckCircle2, 
  ShoppingCart,
  Zap,
  TrendingDown,
  Plus,
  Moon,
  Sun,
  X
} from 'lucide-react';

// 🏪 INITIAL DATA
const INITIAL_ITEMS = [
  { id: 1, name: "Basmati Rice", unit: "kg", stock: 38, threshold: 10, capacity: 50, icon: "🌾" },
  { id: 2, name: "Nataraj Pencils", unit: "box", stock: 15, threshold: 5, capacity: 100, icon: "✏️" },
  { id: 3, name: "Lays Chips", unit: "pkt", stock: 8, threshold: 20, capacity: 50, icon: "🥔" },
  { id: 4, name: "Thums Up", unit: "btl", stock: 45, threshold: 12, capacity: 60, icon: "🥤" },
  { id: 5, name: "Dairy Milk", unit: "bar", stock: 22, threshold: 15, capacity: 100, icon: "🍫" }
];

function App() {
  // --- STATE ---
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [activeView, setActiveView] = useState('dashboard');
  const [logs, setLogs] = useState([]);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [walletAddress, setWalletAddress] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isRestocking, setIsRestocking] = useState(false);
  
  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', threshold: 10, capacity: 50, unit: 'units' });

  const processingRef = useRef(false);
  const aiAgentRef = useRef(new A2AAgent());
  const ap2GatewayRef = useRef(new AP2Gateway());

  // --- LOGGING ---
  const addLog = (msg, type = 'info') => {
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'ai' ? '🧠' : '>';
    setLogs(prev => [`${icon} ${msg}`, ...prev].slice(0, 50));
  };

  // --- WALLET CONNECTION (MetaMask) ---
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        setWalletAddress(await signer.getAddress());
        addLog("🔗 MetaMask Connected successfully", "success");
      } catch (error) {
        addLog("❌ Connection rejected", "error");
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  // --- ACTIONS ---
  const simulateSale = (id) => {
    setItems(prev => prev.map(item => {
      if (item.id === id && item.stock > 0) {
        addLog(`🛒 Sold 1 ${item.unit} of ${item.name}`);
        return { ...item, stock: item.stock - 1 };
      }
      return item;
    }));
  };

  const addNewItem = () => {
    if (!newItem.name) return;
    const item = {
      id: Date.now(),
      name: newItem.name,
      stock: parseInt(newItem.capacity), // Start full
      threshold: parseInt(newItem.threshold),
      capacity: parseInt(newItem.capacity),
      unit: newItem.unit,
      icon: "📦"
    };
    setItems([...items, item]);
    setShowAddModal(false);
    addLog(`✨ Added new item: ${item.name}`, "success");
  };

  // --- AI WATCHMAN LOGIC ---
  useEffect(() => {
    if (processingRef.current) return;

    // Find the first item that is low on stock
    const lowStockItem = items.find(i => i.stock < i.threshold);

    if (lowStockItem && !isRestocking) {
      checkWithAI(lowStockItem);
    }
  }, [items, isRestocking]);

  const checkWithAI = async (item) => {
    if (processingRef.current) return;
    processingRef.current = true; // Lock
    
    addLog(`🤔 AI analyzing stock for ${item.name}...`, 'ai');
    
    try {
      // Simulate history for this specific item
      const history = Array(5).fill(0).map(() => Date.now() - Math.random() * 3600000);
      
      const recommendation = await aiAgentRef.current.analyzeStockStrategy(
        item.stock,
        history,
        { item: item.name } // Pass item name to AI
      );

      if (recommendation && recommendation.shouldRestock) {
         addLog(`🧠 AI Decision: RESTOCK ${item.name}. Reason: ${recommendation.reason}`, 'ai');
         // Auto-trigger restock
         triggerRestock(item, recommendation.recommendedQuantity || 20);
      } else {
         processingRef.current = false; // Unlock if no restock needed
      }
    } catch (e) {
      console.error(e);
      processingRef.current = false;
    }
  };

  // --- RESTOCK FUNCTION ---
  const triggerRestock = async (item, quantity) => {
    setIsRestocking(true);
    addLog(`⚡ Initiating x402 Protocol for ${item.name}...`, 'warning');

    try {
      let signer;
      // Use MetaMask if connected, otherwise try env key (as backup)
      if (walletAddress && window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
      } else if (import.meta.env.VITE_AGENT_PRIVATE_KEY) {
        const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_RPC_URL);
        signer = new ethers.Wallet(import.meta.env.VITE_AGENT_PRIVATE_KEY, provider);
      } else {
        throw new Error("No Wallet Connected! Please connect MetaMask.");
      }

      // 1. Order
      let response = await fetch('http://localhost:3000/buy-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: item.name, quantity: quantity })
      });

      // 2. Pay (402)
      if (response.status === 402) {
        const invoice = await response.json();
        const price = invoice.paymentDetails.amount;
        
        addLog(`💰 Paying ${price} ETH for ${quantity} ${item.unit}...`, 'warning');
        
        const tx = await signer.sendTransaction({
          to: invoice.paymentDetails.destination,
          value: ethers.parseEther(price)
        });
        
        addLog(`⏳ Tx Sent: ${tx.hash.slice(0,10)}...`);
        await tx.wait();
        
        // 3. Verify
        response = await fetch('http://localhost:3000/buy-stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-payment-hash': tx.hash },
          body: JSON.stringify({ item: item.name, quantity: quantity })
        });
      }

      const data = await response.json();
      if (data.success) {
        addLog(`✅ Restock Complete: ${item.name}`, 'success');
        
        // Update Inventory State
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, stock: i.stock + quantity } : i));
        
        // Add to History
        setTransactionHistory(prev => [{
          id: Date.now(),
          time: new Date().toLocaleTimeString(),
          item: item.name,
          qty: quantity,
          hash: data.trackingId || "0x...",
          status: "Success"
        }, ...prev]);
      }

    } catch (err) {
      addLog(`❌ Error: ${err.message}`, 'error');
    } finally {
      setIsRestocking(false);
      processingRef.current = false; // Unlock
    }
  };

  // --- RENDER ---
  return (
    <div className={`flex h-screen font-sans transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* SIDEBAR */}
      <aside className={`w-64 p-6 flex flex-col transition-colors ${isDarkMode ? 'bg-slate-800 border-r border-slate-700' : 'bg-indigo-900 text-white'}`}>
        <div className="flex items-center gap-3 mb-10">
          <div className="p-2 bg-indigo-600 rounded-lg"><Package size={24} className="text-white" /></div>
          <h1 className="text-xl font-bold tracking-tight">SmartShelf</h1>
        </div>
        
        <nav className="flex-1 space-y-2">
          {['Dashboard', 'Transactions', 'Agent Logs'].map(view => (
            <button 
              key={view}
              onClick={() => setActiveView(view.toLowerCase())}
              className={`flex items-center w-full gap-3 px-4 py-3 rounded-xl transition-all ${
                activeView === view.toLowerCase() 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                : 'opacity-70 hover:opacity-100 hover:bg-white/10'
              }`}
            >
              {view === 'Dashboard' ? <LayoutDashboard size={20}/> : view === 'Transactions' ? <History size={20}/> : <TerminalSquare size={20}/>}
              <span className="font-medium">{view}</span>
            </button>
          ))}
        </nav>

        {/* Theme Toggle */}
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/10 hover:bg-white/20 mb-4 transition"
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          <span className="text-sm font-medium">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        {/* Wallet Widget */}
        <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-slate-900' : 'bg-indigo-800'}`}>
          <div className="flex items-center gap-2 text-sm mb-2 opacity-80">
            <Wallet size={16} />
            <span>Connected Wallet</span>
          </div>
          {walletAddress ? (
             <div className="font-mono text-xs truncate text-emerald-400 bg-emerald-400/10 p-1.5 rounded px-2">
               {walletAddress}
             </div>
          ) : (
            <button 
              onClick={connectWallet} 
              className="w-full py-2 bg-white text-indigo-900 text-xs font-bold rounded shadow hover:bg-indigo-50 transition"
            >
              Connect MetaMask
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto">
        <header className={`p-6 border-b flex justify-between items-center sticky top-0 z-10 backdrop-blur-md ${isDarkMode ? 'bg-slate-900/80 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
          <h2 className="text-2xl font-bold capitalize">{activeView} Overview</h2>
          <div className="flex gap-4">
             <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
               <Plus size={18} /> Add New Item
             </button>
             <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-full text-sm font-bold border border-emerald-500/20">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              Base Sepolia
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          
          {/* DASHBOARD GRID */}
          {activeView === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map(item => (
                <div key={item.id} className={`p-6 rounded-2xl border transition-all hover:shadow-xl ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 shadow-sm'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-4xl">{item.icon}</div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.stock < item.threshold ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {item.stock < item.threshold ? 'LOW STOCK' : 'HEALTHY'}
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold mb-1">{item.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-black">{item.stock}</span>
                    <span className="text-sm opacity-60">{item.unit}</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mb-6 dark:bg-slate-700">
                    <div 
                      className={`h-full transition-all duration-500 ${item.stock < item.threshold ? 'bg-red-500' : 'bg-emerald-500'}`} 
                      style={{ width: `${(item.stock / item.capacity) * 100}%` }}
                    ></div>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => simulateSale(item.id)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${
                        isDarkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      <TrendingDown size={16}/> Sell
                    </button>
                    <button 
                      onClick={() => triggerRestock(item, 20)}
                      disabled={isRestocking}
                      className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-200/50"
                    >
                      <Zap size={16}/> {isRestocking ? 'Working...' : 'Restock'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* HISTORY TABLE */}
          {activeView === 'transactions' && (
            <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <table className="w-full text-left">
                <thead className={isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50'}>
                  <tr>
                    {['Time', 'Item', 'Quantity', 'Status', 'Hash'].map(h => (
                      <th key={h} className="p-4 text-sm font-bold opacity-70">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactionHistory.map((tx, i) => (
                    <tr key={i} className={`border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                      <td className="p-4 text-sm">{tx.time}</td>
                      <td className="p-4 font-bold">{tx.item}</td>
                      <td className="p-4 text-sm">{tx.qty} units</td>
                      <td className="p-4 text-emerald-500 font-bold text-xs flex items-center gap-1">
                        <CheckCircle2 size={14}/> {tx.status}
                      </td>
                      <td className="p-4 font-mono text-xs opacity-60">{tx.hash.slice(0,10)}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactionHistory.length === 0 && <div className="p-8 text-center opacity-50">No transactions yet.</div>}
            </div>
          )}
          
          {/* TERMINAL LOGS (Always visible at bottom or separate view) */}
          {(activeView === 'agent logs' || activeView === 'dashboard') && (
            <div className={`mt-8 rounded-2xl border overflow-hidden font-mono text-sm ${
              isDarkMode ? 'bg-black border-slate-800 text-green-400' : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}>
              <div className="p-3 bg-white/5 border-b border-white/10 flex items-center gap-2">
                <TerminalSquare size={16} /> <span>Agent Terminal Output</span>
              </div>
              <div className="p-4 h-48 overflow-y-auto space-y-1">
                 {logs.map((log, i) => <div key={i}>{log}</div>)}
                 {logs.length === 0 && <div className="opacity-50 text-center mt-10">System Ready. Waiting for events...</div>}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ADD ITEM MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`p-8 rounded-2xl w-96 shadow-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Add Inventory Item</h3>
              <button onClick={() => setShowAddModal(false)}><X size={24} className="opacity-50 hover:opacity-100"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold opacity-70 block mb-1">Item Name</label>
                <input 
                  className={`w-full p-3 rounded-lg border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                  placeholder="e.g. Diet Coke"
                  value={newItem.name}
                  onChange={e => setNewItem({...newItem, name: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="text-xs font-bold opacity-70 block mb-1">Threshold</label>
                  <input type="number" className={`w-full p-3 rounded-lg border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} value={newItem.threshold} onChange={e => setNewItem({...newItem, threshold: e.target.value})} />
                 </div>
                 <div>
                  <label className="text-xs font-bold opacity-70 block mb-1">Capacity</label>
                  <input type="number" className={`w-full p-3 rounded-lg border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} value={newItem.capacity} onChange={e => setNewItem({...newItem, capacity: e.target.value})} />
                 </div>
              </div>
              <button onClick={addNewItem} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 mt-2">
                Create Item
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;


























// import React, { useState, useEffect, useRef } from 'react';
// import { ethers } from 'ethers';
// import A2AAgent from './ai-agent';
// import AP2Gateway from './ap2-gateway';
// import { 
//   LayoutDashboard, 
//   Package, 
//   History, 
//   TerminalSquare, 
//   Wallet, 
//   AlertCircle, 
//   CheckCircle2, 
//   ShoppingCart,
//   Zap,
//   TrendingDown,
//   Clock
// } from 'lucide-react';

// function App() {
//   // --- STATE MANAGEMENT ---
//   const [activeView, setActiveView] = useState('dashboard'); // 'dashboard', 'transactions', 'logs'
//   const [stock, setStock] = useState(38); // Started with a higher stock for demo look
//   const [logs, setLogs] = useState([]);
//   const [isRestocking, setIsRestocking] = useState(false);
//   const [aiRecommendation, setAiRecommendation] = useState(null);
//   const [ap2Suppliers, setAp2Suppliers] = useState([]);
//   const [transactionHistory, setTransactionHistory] = useState([]); // 🆕 NEW STATE for history
//   const [walletAddress, setWalletAddress] = useState("Not Connected");

//   const processingRef = useRef(false);
//   const aiAgentRef = useRef(new A2AAgent());
//   const ap2GatewayRef = useRef(new AP2Gateway());

//   // Helper for styled logs
//   const addLog = (msg, type = 'info') => {
//     const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'ai' ? '🧠' : '>';
//     setLogs(prev => [`${icon} ${msg}`, ...prev].slice(0, 50));
//   };

//   // Add a transaction to history
//   const addTransaction = (txDetails) => {
//     setTransactionHistory(prev => [
//       { id: Date.now(), date: new Date().toLocaleString(), ...txDetails },
//       ...prev
//     ]);
//   };

//   // Get wallet address on load
//   useEffect(() => {
//     const getAddress = async () => {
//       if (import.meta.env.VITE_AGENT_PRIVATE_KEY && import.meta.env.VITE_RPC_URL) {
//         try {
//           const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_RPC_URL);
//           const wallet = new ethers.Wallet(import.meta.env.VITE_AGENT_PRIVATE_KEY, provider);
//           setWalletAddress(wallet.address);
//         } catch (e) { console.error("Wallet error:", e); }
//       }
//     };
//     getAddress();
//   }, []);

//   // --- ROBOT 1: SIMULATE CUSTOMERS BUYING ---
//   useEffect(() => {
//     const interval = setInterval(() => {
//       setStock(currentStock => {
//         if (currentStock > 0) {
//           if (Math.random() > 0.7) { // Slower sales for demo
//             addLog(`🛒 Customer purchased 1kg rice`);
//             return currentStock - 1;
//           }
//           return currentStock;
//         }
//         addLog(`❌ Out of stock! Sale missed`, 'error');
//         return currentStock;
//       });
//     }, 2000);
//     return () => clearInterval(interval);
//   }, []);

//   // --- CHECK WITH AI FUNCTION ---
//   const checkWithAI = async () => {
//     if (processingRef.current) return;
//     addLog("🤔 Consulting AI agent for strategy...", 'ai');
    
//     try {
//       // Simulated sales history for the AI call
//       const simulatedHistory = Array(5).fill(0).map(() => Date.now() - Math.random() * 3600000);
      
//       const recommendation = await aiAgentRef.current.analyzeStockStrategy(
//         stock,
//         simulatedHistory,
//         { season: "Normal", time: "Afternoon" }
//       );

//       if (recommendation) {
//         setAiRecommendation(recommendation);
//         addLog(`🧠 AI Analysis: ${recommendation.reason}`, 'ai');
//         addLog(`📊 Recommended: ${recommendation.recommendedQuantity}kg (Urgency: ${recommendation.urgencyScore}/10)`, 'ai');
        
//         if (recommendation.shouldRestock && stock < 10) {
//           setTimeout(() => { triggerRestockAgent(recommendation.recommendedQuantity); }, 1000);
//         } else if (recommendation.shouldRestock) {
//           addLog(`⏱️ AI suggests proactive restock.`, 'ai');
//         }
//       }
//     } catch (error) {
//       addLog("❌ AI analysis failed, using default logic", 'error');
//       if (stock < 10) triggerRestockAgent(50);
//     }
//   };

//   // --- ROBOT 2: THE WATCHMAN (AGENT) ---
//   useEffect(() => {
//     if (stock < 15 && !processingRef.current && stock > 0) {
//       checkWithAI();
//     }
//   }, [stock]);

//   // --- MAIN RESTOCK LOGIC ---
//   const triggerRestockAgent = async (quantity = 50) => {
//     if (processingRef.current) return;
//     processingRef.current = true;
//     setIsRestocking(true);
//     addLog(`⚠️ Stock Low! Initiating restock for ${quantity}kg...`, 'warning');

//     try {
//       const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_RPC_URL);
//       const agentWallet = new ethers.Wallet(import.meta.env.VITE_AGENT_PRIVATE_KEY, provider);
      
//       // 1. Ask Supplier
//       addLog(`📦 Requesting order from supplier...`);
//       let response = await fetch('http://localhost:3000/buy-stock', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ item: "Rice", quantity: quantity })
//       });

//       // 2. Handle 402 Payment Required
//       if (response.status === 402) {
//         const invoice = await response.json();
//         const cost = invoice.paymentDetails?.amount || "0.0001";
//         addLog(`💰 Payment Required: ${cost} ETH`, 'warning');

//         // Pay on-chain
//         const tx = await agentWallet.sendTransaction({
//           to: invoice.paymentDetails.destination,
//           value: ethers.parseEther(cost),
//         });
//         addLog(`⏳ Transaction sent! Hash: ${tx.hash.slice(0,10)}...`);
//         await tx.wait();
//         addLog(`✅ Payment confirmed on-chain`, 'success');

//         // Submit proof
//         addLog("📨 Sending payment proof to supplier...");
//         response = await fetch('http://localhost:3000/buy-stock', {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json', 'x-payment-hash': tx.hash },
//           body: JSON.stringify({ item: "Rice", quantity: quantity })
//         });
//       }

//       const data = await response.json();
//       if (data.success) {
//         addLog("✅ " + data.message, 'success');
//         setStock(prev => prev + quantity);
//         setAiRecommendation(null);
//         // 🆕 ADD TO HISTORY
//         addTransaction({ type: 'Restock', method: 'x402 Protocol', quantity: `${quantity}kg`, status: 'Success', hash: data.trackingId });
//       } else {
//         throw new Error(data.message);
//       }

//     } catch (err) {
//       addLog(`❌ Error: ${err.message}. Initiating AP2 fallback...`, 'error');
//       simulateAP2Fallback();
//     } finally {
//       processingRef.current = false;
//       setIsRestocking(false);
//     }
//   };

//   // --- AP2 FALLBACK ---
//   const simulateAP2Fallback = async () => {
//     addLog("🌐 Scanning Google AP2 network via Gateway...");
//     const suppliers = await ap2GatewayRef.current.discoverSuppliers("Rice", 50);
//     if (suppliers.length > 0) {
//         setAp2Suppliers(suppliers);
//         addLog(`✅ Found ${suppliers.length} AP2-compatible suppliers`, 'success');
//     } else {
//         addLog("⚠️ No AP2 suppliers found.", 'warning');
//     }
//   };

//   const selectAP2Supplier = async (supplier) => {
//     setSelectedSupplier(supplier);
//     addLog(`📡 Selected: ${supplier.name} via AP2`);
//     const result = await ap2GatewayRef.current.placeOrderViaAP2(supplier, { item: "Rice", quantity: 50 });

//     if (result.success) {
//         addLog(`✅ ${result.message}`, 'success');
//         setTimeout(() => {
//             setStock(prev => prev + 50);
//             addLog("📦 +50kg rice delivered via AP2", 'success');
//             setSelectedSupplier(null);
//             setAp2Suppliers([]);
//             // 🆕 ADD TO HISTORY
//             addTransaction({ type: 'Restock', method: 'AP2 Network', quantity: '50kg', status: 'Success', hash: result.orderId });
//         }, 2000);
//     }
//   };

//   // --- UI COMPONENTS ---
//   const SidebarItem = ({ icon, label, view }) => (
//     <button 
//       onClick={() => setActiveView(view)}
//       className={`flex items-center w-full gap-3 px-4 py-3 rounded-lg transition-colors ${activeView === view ? 'bg-indigo-700 text-white' : 'text-indigo-100 hover:bg-indigo-800'}`}
//     >
//       {icon}
//       <span className="font-medium">{label}</span>
//     </button>
//   );

//   const StatCard = ({ icon, label, value, subValue, color }) => (
//     <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
//       <div className={`p-4 rounded-xl bg-${color}-50 text-${color}-600`}>{icon}</div>
//       <div>
//         <h4 className="text-sm text-slate-500 font-medium">{label}</h4>
//         <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
//         {subValue && <div className={`text-xs font-medium mt-1 text-${color}-600`}>{subValue}</div>}
//       </div>
//     </div>
//   );

//   return (
//     <div className="flex h-screen bg-slate-50 font-sans">
//       {/* SIDEBAR */}
//       <aside className="w-64 bg-indigo-900 text-white p-6 flex flex-col">
//         <div className="flex items-center gap-3 mb-10">
//           <div className="p-2 bg-indigo-700 rounded-lg"><ShoppingCart size={24} /></div>
//           <h1 className="text-xl font-bold">KiranaFlow.ai</h1>
//         </div>
//         <nav className="flex-1 space-y-2">
//           <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" view="dashboard" />
//           <SidebarItem icon={<History size={20} />} label="Transactions" view="transactions" />
//           <SidebarItem icon={<TerminalSquare size={20} />} label="Agent Logs" view="logs" />
//         </nav>
//         <div className="p-4 bg-indigo-800 rounded-xl">
//           <div className="flex items-center gap-2 text-sm mb-2">
//             <Wallet size={16} className="text-indigo-300" />
//             <span className="text-indigo-200">Agent Wallet</span>
//           </div>
//           <div className="font-mono text-xs text-indigo-100 truncate">{walletAddress}</div>
//         </div>
//       </aside>

//       {/* MAIN CONTENT */}
//       <main className="flex-1 flex flex-col overflow-hidden">
//         <header className="bg-white p-6 border-b border-slate-100 flex justify-between items-center">
//           <h2 className="text-2xl font-bold text-slate-800">
//             {activeView === 'dashboard' ? 'Store Overview' : activeView === 'transactions' ? 'Transaction History' : 'System Logs'}
//           </h2>
//           <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium border border-emerald-100">
//             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
//             Base Sepolia Live
//           </div>
//         </header>

//         <div className="flex-1 overflow-y-auto p-8">
//           {activeView === 'dashboard' && (
//             <div className="space-y-8">
//               {/* STATS ROW */}
//               <div className="grid grid-cols-3 gap-6">
//                 <StatCard icon={<Package size={24} />} label="Current Stock" value={`${stock} kg`} subValue={stock < 10 ? "⚠️ Low Stock Warning" : "✅ Healthy Level"} color={stock < 10 ? "rose" : "emerald"} />
//                 <StatCard icon={<ShoppingCart size={24} />} label="Total Sales" value="1,245 kg" subValue="Simulated Data" color="blue" />
//                 <StatCard icon={<Zap size={24} />} label="Last Restock" value="2 mins ago" subValue="via x402 Protocol" color="amber" />
//               </div>

//               <div className="grid grid-cols-3 gap-6 items-start">
//                 {/* MAIN INVENTORY CARD */}
//                 <div className="col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
//                   <div className="flex justify-between items-center mb-6">
//                     <div>
//                       <h3 className="text-xl font-bold text-slate-800">Rice Inventory Base</h3>
//                       <p className="text-slate-500 text-sm">Real-time monitoring & autonomous restocking</p>
//                     </div>
//                     {aiRecommendation && (
//                       <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm flex items-center gap-2 animate-fade-in">
//                         <Zap size={16} /> 🧠 AI Info: {aiRecommendation.reason.slice(0, 30)}...
//                       </div>
//                     )}
//                   </div>

//                   <div className="flex items-end gap-4 mb-4">
//                     <div className="text-6xl font-black text-slate-800">{stock}</div>
//                     <div className="text-2xl text-slate-500 mb-1">kg</div>
//                   </div>
                  
//                   <div className="h-4 bg-slate-100 rounded-full overflow-hidden mb-2">
//                     <div className={`h-full transition-all duration-500 ${stock < 10 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (stock / 50) * 100)}%` }}></div>
//                   </div>
//                   <div className="flex justify-between text-sm text-slate-500 mb-8">
//                     <span>0 kg</span>
//                     <span>Threshold: 10 kg</span>
//                     <span>Capacity: 50 kg</span>
//                   </div>

//                   <div className="flex gap-4">
//                     <button onClick={() => setStock(s => Math.max(0, s - 5))} className="px-6 py-3 bg-rose-50 text-rose-600 font-medium rounded-xl hover:bg-rose-100 transition flex items-center gap-2">
//                       <TrendingDown size={18} /> Simulate Sale (-5kg)
//                     </button>
//                     <button onClick={() => triggerRestockAgent(50)} disabled={isRestocking || stock >= 10} className={`px-6 py-3 font-medium rounded-xl transition flex items-center gap-2 text-white ${isRestocking || stock >= 10 ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100'}`}>
//                       {isRestocking ? <Clock size={18} className="animate-spin" /> : <Zap size={18} />}
//                       {isRestocking ? 'Agent Working...' : 'Trigger Restock Agent'}
//                     </button>
//                   </div>
//                 </div>

//                 {/* AP2 SUPPLIERS SIDEBAR */}
//                 {ap2Suppliers.length > 0 && (
//                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 rounded-2xl shadow-lg animate-fade-in">
//                    <h3 className="font-bold flex items-center gap-2 mb-4"><CheckCircle2 size={20} /> AP2 Network Active</h3>
//                    <p className="text-sm opacity-90 mb-4">x402 failed. Alternative suppliers found via Google AP2.</p>
//                    <div className="space-y-3">
//                      {ap2Suppliers.map(s => (
//                        <div key={s.id} onClick={() => selectAP2Supplier(s)} className="bg-white/20 p-3 rounded-lg cursor-pointer hover:bg-white/30 transition">
//                          <div className="font-bold text-sm">{s.name}</div>
//                          <div className="text-xs opacity-90 mt-1">⚡ {s.deliveryTime} • 💎 {s.price}</div>
//                        </div>
//                      ))}
//                    </div>
//                  </div>
//                 )}
//               </div>
//             </div>
//           )}

//           {/* TRANSACTIONS VIEW */}
//           {activeView === 'transactions' && (
//             <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
//               <table className="w-full text-left">
//                 <thead className="bg-slate-50 border-b border-slate-100">
//                   <tr>
//                     <th className="p-4 text-sm font-medium text-slate-500">Time</th>
//                     <th className="p-4 text-sm font-medium text-slate-500">Type</th>
//                     <th className="p-4 text-sm font-medium text-slate-500">Method</th>
//                     <th className="p-4 text-sm font-medium text-slate-500">Details</th>
//                     <th className="p-4 text-sm font-medium text-slate-500">Status</th>
//                     <th className="p-4 text-sm font-medium text-slate-500">Reference ID</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {transactionHistory.length === 0 ? (
//                     <tr><td colSpan="6" className="p-8 text-center text-slate-500">No transactions yet. Trigger a restock to see history.</td></tr>
//                   ) : (
//                     transactionHistory.map(tx => (
//                       <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50/50">
//                         <td className="p-4 text-sm text-slate-600">{tx.date}</td>
//                         <td className="p-4 text-sm font-medium text-slate-800">{tx.type}</td>
//                         <td className="p-4"><span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">{tx.method}</span></td>
//                         <td className="p-4 text-sm text-slate-600">{tx.quantity} Rice</td>
//                         <td className="p-4"><span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"><CheckCircle2 size={14} className="text-emerald-500" /> {tx.status}</span></td>
//                         <td className="p-4 text-xs font-mono text-slate-500">{tx.hash.slice(0, 12)}...</td>
//                       </tr>
//                     ))
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           )}

//           {/* LOGS VIEW (Available on Dashboard too, but full view here) */}
//           {(activeView === 'logs' || activeView === 'dashboard') && (
//             <div className={`bg-slate-900 text-slate-300 rounded-2xl shadow-sm border border-slate-800 overflow-hidden font-mono text-sm ${activeView === 'dashboard' ? 'mt-8 h-64' : 'h-full'}`}>
//               <div className="bg-slate-800 p-4 flex items-center gap-2 border-b border-slate-700">
//                 <TerminalSquare size={18} className="text-indigo-400" />
//                 <span className="font-bold text-slate-100">Autonomous Agent Terminal</span>
//                 {isRestocking && <span className="ml-auto px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full animate-pulse">Processing...</span>}
//               </div>
//               <div className="p-4 overflow-y-auto h-full custom-scrollbar space-y-2">
//                 {logs.length === 0 ? <div className="text-slate-600 italic"> Waiting for system events...</div> : logs.map((log, i) => <div key={i}>{log}</div>)}
//               </div>
//             </div>
//           )}
//         </div>
//       </main>
//     </div>
//   );
// }

// export default App;





















// import { useState, useEffect, useRef } from 'react';
// import { ethers } from 'ethers';
// import React from 'react';
// import A2AAgent from './ai-agent';
// import AP2Gateway from './ap2-gateway'; // <--- ADD THIS LINE

// function App() {
//   const [stock, setStock] = useState(20);
//   const [logs, setLogs] = useState([]);
//   const [isRestocking, setIsRestocking] = useState(false); 
//   const [aiRecommendation, setAiRecommendation] = useState(null);
//   const [ap2Suppliers, setAp2Suppliers] = useState([]);
//   const [selectedSupplier, setSelectedSupplier] = useState(null);
//   const [salesHistory, setSalesHistory] = useState([]);
  
//   const processingRef = useRef(false);
//   const aiAgentRef = useRef(new A2AAgent());
//   const ap2GatewayRef = useRef(new AP2Gateway());

//   const addLog = (msg) => setLogs(prev => [msg, ...prev].slice(0, 10));

//   // --- ROBOT 1: SIMULATE CUSTOMERS BUYING ---
//   useEffect(() => {
//     const interval = setInterval(() => {
//       setStock(currentStock => {
//         if (currentStock > 0) {
//           setSalesHistory(prev => [...prev.slice(-9), Date.now()]);
//           addLog(`🛒 Customer purchased 1kg rice`);
//           return currentStock - 1;
//         }
//         addLog(`❌ Out of stock! Sale missed`);
//         return currentStock;
//       });
//     }, 1500);
//     return () => clearInterval(interval);
//   }, []);

//   // --- CHECK WITH AI FUNCTION (MISSING IN YOUR CODE) ---
//   const checkWithAI = async () => {
//     if (processingRef.current) return;
    
//     addLog("🤔 Consulting AI agent for strategy...");
    
//     // Calculate sales velocity
//     const now = Date.now();
//     const recentSales = salesHistory.filter(time => now - time < 3600000);
//     const salesVelocity = recentSales.length;
    
//     try {
//       const recommendation = await aiAgentRef.current.analyzeStockStrategy(
//         stock,
//         {
//           salesPerHour: salesVelocity,
//           totalSalesToday: salesHistory.length,
//           timeOfDay: new Date().getHours()
//         },
//         {
//           season: "Normal",
//           supplierRating: "Reliable",
//           marketTrend: "Stable"
//         }
//       );

//       if (recommendation) {
//         setAiRecommendation(recommendation);
//         addLog(`🧠 AI Analysis: ${recommendation.reason}`);
//         addLog(`📊 Recommended: ${recommendation.recommendedQuantity}kg (Urgency: ${recommendation.urgencyScore}/10)`);
        
//         if (recommendation.shouldRestock && stock < 10) {
//           setTimeout(() => {
//             triggerRestockAgent(recommendation.recommendedQuantity);
//           }, 1000);
//         } else if (recommendation.shouldRestock && stock >= 10) {
//           addLog(`⏱️ AI suggests early restock to avoid shortage`);
//         }
//       }
//     } catch (error) {
//       console.error("AI Agent error:", error);
//       addLog("❌ AI analysis failed, using default logic");
//       // Fallback to default logic
//       if (stock < 10) {
//         triggerRestockAgent(50);
//       }
//     }
//   };

//   // --- ROBOT 2: THE WATCHMAN (AGENT) ---
//   useEffect(() => {
//     if (stock < 15 && !processingRef.current) {
//       checkWithAI();
//     }
//   }, [stock]);

//   const triggerRestockAgent = async (quantity = 50) => {
//     if (processingRef.current || stock >= 10) return;
    
//     processingRef.current = true; 
//     setIsRestocking(true);
//     addLog("⚠️ Stock Low! Agent waking up...");

//     // Add debug info
//     addLog(`🔍 Checking environment...`);
//     addLog(`   RPC URL: ${import.meta.env.VITE_RPC_URL ? '✓ Set' : '✗ Missing'}`);
//     addLog(`   Private Key: ${import.meta.env.VITE_AGENT_PRIVATE_KEY ? '✓ Set' : '✗ Missing'}`);

//     try {
//       // Check if env vars exist
//       if (!import.meta.env.VITE_RPC_URL) {
//         throw new Error("VITE_RPC_URL not found in .env file");
//       }
      
//       if (!import.meta.env.VITE_AGENT_PRIVATE_KEY) {
//         throw new Error("VITE_AGENT_PRIVATE_KEY not found in .env file");
//       }

//       const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_RPC_URL);
      
//       // Test connection to blockchain
//       try {
//         const network = await provider.getNetwork();
//         addLog(`🔗 Connected to: ${network.name} (Chain ID: ${network.chainId})`);
//       } catch (networkError) {
//         addLog(`❌ RPC Connection failed: ${networkError.message}`);
//         throw new Error(`Invalid RPC URL: ${import.meta.env.VITE_RPC_URL}`);
//       }
      
//       const agentWallet = new ethers.Wallet(import.meta.env.VITE_AGENT_PRIVATE_KEY, provider);
      
//       // Check wallet balance
//       const balance = await provider.getBalance(agentWallet.address);
//       addLog(`🤖 Agent Wallet: ${agentWallet.address.slice(0,8)}...`);
//       addLog(`💰 Balance: ${ethers.formatEther(balance)} ETH`);
      
//       if (balance === 0n) {
//         throw new Error(`Insufficient funds! Get test ETH for ${agentWallet.address}`);
//       }

//       // 1. Ask Supplier for Order
//       addLog(`📦 Requesting ${quantity}kg rice from supplier...`);
//       let response = await fetch('http://localhost:3000/buy-stock', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ item: "Rice", quantity: quantity })
//       });

//       // Debug response
//       addLog(`📡 Response status: ${response.status}`);
      
//       // 2. Handle Payment Request (402)
//       if (response.status === 402) {
//         const invoice = await response.json();
//         const cost = invoice.paymentDetails?.amount || "0.0001";
        
//         addLog(`💰 Payment Required: ${cost} ETH`);
//         addLog(`   To: ${invoice.paymentDetails?.destination?.slice(0,8)}...`);

//         // --- THE REAL BLOCKCHAIN TRANSACTION ---
//         try {
//           const tx = await agentWallet.sendTransaction({
//             to: invoice.paymentDetails.destination,
//             value: ethers.parseEther(cost),
//             gasLimit: 21000  // Standard gas for ETH transfer
//           });

//           addLog("⏳ Transaction sent! Hash: " + tx.hash.slice(0,16) + "...");
//           addLog("⏱️ Waiting for confirmation (10-30 seconds)...");
          
//           const receipt = await tx.wait();
//           addLog(`✅ Payment confirmed in block ${receipt.blockNumber}`);
          
//           // 3. Send the Transaction Hash as Proof
//           addLog("📨 Sending payment proof to supplier...");
//           response = await fetch('http://localhost:3000/buy-stock', {
//             method: 'POST',
//             headers: { 
//               'Content-Type': 'application/json',
//               'x-payment-hash': tx.hash
//             },
//             body: JSON.stringify({ item: "Rice", quantity: quantity })
//           });
//         } catch (txError) {
//           addLog(`❌ Transaction failed: ${txError.message}`);
//           if (txError.message.includes('insufficient funds')) {
//             addLog("💡 Get test ETH from: https://sepolia-faucet.pk910.de/");
//           }
//           throw txError;
//         }
//       } else if (!response.ok) {
//         addLog(`❌ Backend error: ${response.status} ${response.statusText}`);
//         const errorText = await response.text();
//         addLog(`   Response: ${errorText}`);
//         throw new Error(`Backend error: ${response.status}`);
//       }

//       const data = await response.json();
//       if (data.success) {
//         addLog("✅ " + data.message);
//         setStock(prev => prev + quantity);
//         setAiRecommendation(null);
//       } else {
//         addLog(`❌ Order failed: ${data.message || 'Unknown error'}`);
//       }

//     } catch (err) {
//       console.error("Full error:", err);
//       addLog("❌ Error: " + (err.message || "Unknown error"));
      
//       // Try AP2 fallback
//       if (err.message.includes('insufficient') || err.message.includes('failed')) {
//         addLog("🔄 Attempting AP2 network fallback...");
//         simulateAP2Fallback();
//       }
//     }

//     processingRef.current = false;
//     setIsRestocking(false);
//   };

//   // --- AP2 FALLBACK FUNCTIONS ---
//   const simulateAP2Fallback = async () => {
//     addLog("🌐 Scanning Google AP2 network via Gateway...");
    
//     // 1. Use the Class to find suppliers
//     const suppliers = await ap2GatewayRef.current.discoverSuppliers("Rice", 50);
    
//     if (suppliers.length > 0) {
//         setAp2Suppliers(suppliers);
//         addLog(`✅ Found ${suppliers.length} AP2-compatible suppliers`);
//     } else {
//         addLog("⚠️ No AP2 suppliers found nearby.");
//     }
//   };

//   const selectAP2Supplier = async (supplier) => {
//     setSelectedSupplier(supplier);
//     addLog(`📡 Selected: ${supplier.name} via AP2`);
    
//     // 2. Use the Class to place the order
//     const result = await ap2GatewayRef.current.placeOrderViaAP2(supplier, {
//         item: "Rice",
//         quantity: 50
//     });

//     if (result.success) {
//         addLog(`✅ ${result.message}`);
//         addLog(`🆔 Protocol ID: ${result.protocolUsed.toUpperCase()}`);
        
//         // Update Inventory
//         setTimeout(() => {
//             setStock(prev => prev + 50);
//             addLog("📦 +50kg rice added via AP2 network");
//             setSelectedSupplier(null);
//             setAp2Suppliers([]);
//         }, 2000);
//     }
//   };

//   // --- MANUAL DEBUG FUNCTIONS ---
//   const checkEnvironment = () => {
//     addLog("🔍 Checking environment...");
//     addLog(`   VITE_RPC_URL: ${import.meta.env.VITE_RPC_URL ? '✓ Set' : '✗ Missing'}`);
//     addLog(`   VITE_AGENT_PRIVATE_KEY: ${import.meta.env.VITE_AGENT_PRIVATE_KEY ? '✓ Set' : '✗ Missing'}`);
//     addLog(`   Backend: http://localhost:3000`);
//   };

//   const testBackend = async () => {
//     try {
//       addLog("🔄 Testing backend connection...");
//       const response = await fetch('http://localhost:3000/buy-stock', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ item: "Test", quantity: 1 })
//       });
//       addLog(`📡 Backend status: ${response.status}`);
//       if (response.status === 402) {
//         addLog("✅ Backend working correctly (402 Payment Required)");
//       }
//     } catch (error) {
//       addLog(`❌ Backend error: ${error.message}`);
//       addLog("💡 Start backend with: node server.js");
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
//       <div className="max-w-6xl mx-auto">
//         {/* Header */}
//         <header className="text-center mb-10">
//           <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-2">
//             🏪 Autonomous <span className="text-blue-600">Kirana Store</span>
//           </h1>
//           <p className="text-gray-600">A prototype demonstrating AI agentic workflows with the x402 payment protocol.</p>
//           <div className="inline-flex items-center mt-4 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
//             <span className="w-2 h-2 bg-amber-500 rounded-full mr-2 animate-pulse"></span>
//             Live Demo - Base Sepolia Testnet
//           </div>
//         </header>

//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
//           {/* Left Column: Inventory & Controls */}
//           <div className="lg:col-span-2 space-y-8">
//             {/* Inventory Card */}
//             <div className={`bg-white rounded-2xl shadow-xl p-8 border-4 transition-all duration-500 ${stock < 10 ? 'border-red-300 bg-gradient-to-r from-white to-red-50 animate-pulse' : 'border-emerald-300 bg-gradient-to-r from-white to-emerald-50'}`}>
//               <div className="flex justify-between items-start mb-6">
//                 <div>
//                   <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
//                     <span className="p-2 bg-gray-100 rounded-lg">📦</span> Rice Inventory
//                   </h2>
//                   <p className="text-gray-600 mt-1">Real-time stock level monitoring</p>
//                 </div>
//                 <div className={`px-4 py-2 rounded-full font-semibold ${stock < 10 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
//                   {stock < 10 ? '🚨 LOW STOCK' : '✅ Healthy'}
//                 </div>
//               </div>
              
//               {/* AI Recommendation Display */}
//               {aiRecommendation && (
//                 <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
//                   <div className="flex items-center gap-2 mb-1">
//                     <span className="text-xl">🧠</span>
//                     <h3 className="font-bold text-blue-800">AI Recommendation</h3>
//                     <div className="ml-auto px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
//                       Urgency: {aiRecommendation.urgencyScore}/10
//                     </div>
//                   </div>
//                   <p className="text-blue-700 text-sm">{aiRecommendation.reason}</p>
//                 </div>
//               )}
              
//               <div className="text-center my-10">
//                 <div className="text-8xl font-black text-gray-800 mb-4">{stock}<span className="text-3xl text-gray-500"> kg</span></div>
//                 <div className="w-full bg-gray-200 rounded-full h-4">
//                   <div
//                     className={`h-4 rounded-full transition-all duration-700 ${stock < 10 ? 'bg-red-500' : 'bg-emerald-500'}`}
//                     style={{ width: `${Math.min(100, (stock / 100) * 100)}%` }}
//                   ></div>
//                 </div>
//                 <p className="text-gray-500 mt-2 text-sm">Restock threshold: <span className="font-semibold">10 kg</span></p>
//               </div>
              
//               <div className="flex flex-wrap justify-center gap-4">
//                 <button
//                   onClick={() => setStock(s => s - 5)}
//                   className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition shadow-md hover:shadow-lg"
//                 >
//                   Simulate Sale (-5kg)
//                 </button>
//                 <button
//                   onClick={() => triggerRestockAgent(50)}
//                   disabled={isRestocking || stock >= 10}
//                   className={`px-6 py-3 font-medium rounded-lg transition shadow-md hover:shadow-lg ${isRestocking || stock >= 10 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
//                 >
//                   {isRestocking ? 'Processing...' : 'Manual Restock'}
//                 </button>
//                 <button
//                   onClick={checkEnvironment}
//                   className="px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition"
//                 >
//                   Check Env
//                 </button>
//                 <button
//                   onClick={testBackend}
//                   className="px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition"
//                 >
//                   Test Backend
//                 </button>
//               </div>
//             </div>

//             {/* Agent Activity Terminal */}
//             <div className="bg-gray-900 text-gray-100 rounded-2xl shadow-xl overflow-hidden">
//               <div className="bg-gray-800 px-6 py-4 flex justify-between items-center">
//                 <h3 className="text-xl font-bold flex items-center gap-3">
//                   <span className="text-green-400">🤖</span> Autonomous Agent Terminal
//                 </h3>
//                 {isRestocking && (
//                   <div className="flex items-center gap-2 text-amber-300">
//                     <span className="flex h-3 w-3">
//                       <span className="animate-ping absolute h-3 w-3 rounded-full bg-amber-400 opacity-75"></span>
//                       <span className="relative rounded-full h-3 w-3 bg-amber-500"></span>
//                     </span>
//                     PROCESSING...
//                   </div>
//                 )}
//               </div>
//               <div className="p-6 font-mono h-96 overflow-y-auto">
//                 {logs.length === 0 ? (
//                   <div className="text-gray-500 text-center py-10">
//                     <div className="text-4xl mb-4">🤖</div>
//                     <div>{'> Waiting for agent activity...'}</div>
//                     <div className="text-sm mt-4">Click "Simulate Sale" until stock reaches 9kg</div>
//                   </div>
//                 ) : (
//                   logs.map((log, i) => (
//                     <div
//                       key={i}
//                       className={`py-3 border-b border-gray-800 ${log.includes("✅") ? 'text-green-400' : 
//                                   log.includes("❌") ? 'text-red-400' : 
//                                   log.includes("⚠️") ? 'text-amber-400' : 
//                                   log.includes("💰") ? 'text-blue-400' :
//                                   log.includes("🧠") ? 'text-purple-400' :
//                                   log.includes("🌐") ? 'text-green-300' :
//                                   'text-gray-300'}`}
//                     >
//                       {`> ${log}`}
//                     </div>
//                   ))
//                 )}
//               </div>
//             </div>
//           </div>

//           {/* Right Column: Protocol & Info */}
//           <div className="space-y-8">
//             {/* x402 Protocol Card */}
//             <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-xl p-8">
//               <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
//                 <span>⚡</span> x402 Protocol
//               </h3>
//               <p className="mb-6 opacity-90">HTTP 402 Payment Required workflow in action.</p>
//               <ul className="space-y-4">
//                 <li className="flex items-center gap-3"><div className="w-6 h-6 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold">1</div> Agent detects low stock</li>
//                 <li className="flex items-center gap-3"><div className="w-6 h-6 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold">2</div> Requests order (gets 402)</li>
//                 <li className="flex items-center gap-3"><div className="w-6 h-6 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold">3</div> Pays invoice on-chain</li>
//                 <li className="flex items-center gap-3"><div className="w-6 h-6 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold">4</div> Submits proof & completes order</li>
//               </ul>
//               <div className="mt-8 pt-6 border-t border-indigo-400">
//                 <div className="text-sm opacity-80 mb-2">Current Agent Wallet</div>
//                 <div className="font-mono bg-black/30 p-3 rounded-lg break-all text-sm">
//                   {import.meta.env.VITE_AGENT_PRIVATE_KEY ? 
//                     `${import.meta.env.VITE_AGENT_ADDRESS?.slice(0,10)}...` : 
//                     "Not Configured"}
//                 </div>
//               </div>
//             </div>

//             {/* AP2 Network Card */}
//             {ap2Suppliers.length > 0 && (
//               <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl shadow-xl p-8">
//                 <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
//                   <span>🌐</span> AP2 Network Available
//                 </h3>
//                 <p className="mb-4 opacity-90">Alternative suppliers found</p>
//                 <div className="space-y-3">
//                   {ap2Suppliers.map(supplier => (
//                     <div 
//                       key={supplier.id}
//                       onClick={() => selectAP2Supplier(supplier)}
//                       className={`p-3 rounded-lg cursor-pointer transition ${selectedSupplier?.id === supplier.id ? 'bg-white/30' : 'bg-white/20 hover:bg-white/25'}`}
//                     >
//                       <div className="font-bold">{supplier.name}</div>
//                       <div className="text-sm opacity-90">🚚 {supplier.delivery} • 💰 {supplier.price}</div>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             )}

//             {/* Debug Card */}
//             <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
//               <h3 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
//                 <span>🐛</span> Debug Panel
//               </h3>
//               <p className="text-gray-600 mb-4 text-sm">Common issues & fixes</p>
              
//               <div className="space-y-3 text-sm">
//                 <div className="p-3 bg-red-50 rounded-lg">
//                   <div className="font-bold text-red-800">❌ No Transaction?</div>
//                   <ul className="text-red-700 mt-1 ml-4 list-disc">
//                     <li>Is backend running? <code className="bg-red-100 px-1">node server.js</code></li>
//                     <li>Check .env file for RPC_URL</li>
//                     <li>Wallet needs test ETH</li>
//                   </ul>
//                 </div>
                
//                 <div className="p-3 bg-blue-50 rounded-lg">
//                   <div className="font-bold text-blue-800">🔗 Connection Issues</div>
//                   <ul className="text-blue-700 mt-1 ml-4 list-disc">
//                     <li>Test RPC: Click "Check Env"</li>
//                     <li>Test Backend: Click "Test Backend"</li>
//                     <li>Check browser console (F12)</li>
//                   </ul>
//                 </div>
                
//                 <button
//                   onClick={() => {
//                     setStock(9);
//                     addLog("🔧 Manually set stock to 9kg");
//                   }}
//                   className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
//                 >
//                   Force Trigger (Set to 9kg)
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default App;