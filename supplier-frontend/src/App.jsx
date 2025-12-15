import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { 
  LayoutDashboard, Package, Moon, Sun, Wallet, 
  Copy, ExternalLink, CheckCircle2, RefreshCw, Box
} from 'lucide-react';

function App() {
  // --- STATE ---
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ revenue: 0, activeOrders: 0 });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [copiedHash, setCopiedHash] = useState(null);

  // --- 1. CONNECT WALLET ---
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        setWalletAddress(await signer.getAddress());
      } catch (error) { alert("Connection failed"); }
    } else { alert("Please install MetaMask!"); }
  };

  // --- 2. POLL ORDERS FROM BACKEND ---
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        // Fetch from the shared backend
        const res = await fetch('http://localhost:3000/supplier/orders');
        const data = await res.json();
        
        setOrders(data.orders);
        
        // Calculate Revenue
        const revenue = data.orders.reduce((acc, curr) => acc + parseFloat(curr.total), 0).toFixed(5);
        setStats({ revenue, activeOrders: data.orders.length });

      } catch (e) { console.error("Backend Offline"); }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 2000); // Refresh every 2 seconds
    return () => clearInterval(interval);
  }, []);

  // --- HELPER: COPY HASH ---
  const copyToClipboard = (hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className={`flex h-screen font-sans transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* SIDEBAR */}
      <aside className={`w-72 p-6 flex flex-col border-r transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="p-2 bg-emerald-600 rounded-lg text-white">
            <Box size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">SmartWholesale</h1>
            <div className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Supplier Portal</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          <button className={`flex items-center w-full gap-3 px-4 py-3 rounded-xl transition-all font-medium ${isDarkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-800'}`}>
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <div className="flex items-center gap-3 px-4 py-3 opacity-50 cursor-not-allowed">
            <Package size={20} /> Inventory (Coming Soon)
          </div>
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="space-y-3 mt-auto">
          {/* Theme Toggle */}
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl transition font-medium border ${isDarkMode ? 'bg-slate-900 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          {/* Connect Wallet */}
          {!walletAddress ? (
            <button 
              onClick={connectWallet} 
              className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-200/50"
            >
              Connect Wallet
            </button>
          ) : (
            <div className={`p-3 rounded-xl border flex items-center gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-emerald-50 border-emerald-100'}`}>
              <div className="p-2 bg-emerald-500/20 text-emerald-600 rounded-lg"><Wallet size={18}/></div>
              <div className="overflow-hidden">
                <div className="text-xs opacity-60 font-bold uppercase">Connected</div>
                <div className="text-xs font-mono truncate w-32">{walletAddress}</div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className={`px-8 py-6 border-b sticky top-0 z-10 backdrop-blur-md flex justify-between items-center ${isDarkMode ? 'bg-slate-900/90 border-slate-700' : 'bg-white/90 border-slate-200'}`}>
          <h2 className="text-2xl font-bold">Orders Overview</h2>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-bold border border-emerald-500/20">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            Base Sepolia Network
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-8">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-6">
            <div className={`p-8 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
               <div className="text-sm font-bold opacity-60 uppercase tracking-widest mb-2">Total Revenue</div>
               <div className="text-5xl font-black text-emerald-500">{stats.revenue} <span className="text-2xl text-slate-400">ETH</span></div>
            </div>
            <div className={`p-8 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
               <div className="text-sm font-bold opacity-60 uppercase tracking-widest mb-2">Orders Fulfilled</div>
               <div className="text-5xl font-black">{stats.activeOrders}</div>
            </div>
          </div>

          {/* Orders Table */}
          <div className={`rounded-3xl border overflow-hidden shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`px-8 py-5 border-b flex justify-between items-center ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
              <h3 className="font-bold text-lg">Incoming Orders</h3>
              <button onClick={() => window.location.reload()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition"><RefreshCw size={18}/></button>
            </div>
            
            <table className="w-full text-left">
              <thead className={isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50'}>
                <tr>
                  {['Time', 'Order ID', 'Item Details', 'Revenue', 'Transaction Hash', 'Status'].map(h => (
                    <th key={h} className="px-8 py-4 text-xs font-bold uppercase opacity-60">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-8 py-16 text-center opacity-50 italic">
                      No orders yet. Waiting for Store Agents...
                    </td>
                  </tr>
                ) : (
                  orders.map((order, i) => (
                    <tr key={i} className={`group hover:bg-slate-50 dark:hover:bg-slate-700/50 transition`}>
                      <td className="px-8 py-5 font-mono text-sm opacity-70">{order.time}</td>
                      <td className="px-8 py-5 font-mono text-xs opacity-50">{order.id.split('-')[1]}</td>
                      <td className="px-8 py-5">
                        <div className="font-bold text-lg">{order.item}</div>
                        <div className="text-xs opacity-60">{order.quantity} units</div>
                      </td>
                      <td className="px-8 py-5 font-mono font-bold text-emerald-500">+{order.total} ETH</td>
                      
                      {/* TRANSACTION COLUMN */}
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs opacity-60 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                            {order.hash.slice(0, 6)}...{order.hash.slice(-4)}
                          </span>
                          
                          {/* Copy Button */}
                          <button 
                            onClick={() => copyToClipboard(order.hash)}
                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition text-slate-500"
                            title="Copy Hash"
                          >
                             {copiedHash === order.hash ? <CheckCircle2 size={14} className="text-green-500"/> : <Copy size={14}/>}
                          </button>

                          {/* BaseScan Link */}
                          <a 
                            href={`https://sepolia.basescan.org/tx/${order.hash}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 rounded transition"
                            title="View on Explorer"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </td>

                      <td className="px-8 py-5">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-full text-xs font-bold">
                          <CheckCircle2 size={12} /> Fulfilled
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;