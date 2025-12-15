import { GoogleGenerativeAI } from "@google/generative-ai";

class A2AAgent {
  constructor() {
    // Check if key exists
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) {
      console.error("❌ MISSING API KEY: Add VITE_GOOGLE_API_KEY to .env file!");
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // ⚠️ CHANGED MODEL: 'gemini-1.5-flash' gives 404 for some keys. 
    // 'gemini-pro' is the stable standard model.
    this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
  }

  async analyzeStockStrategy(currentStock, salesHistory, context = {}) {
    const prompt = `
      You are an autonomous procurement agent for a Kirana store.
      
      CURRENT SITUATION:
      - Item: Rice
      - Current Stock: ${currentStock} kg
      - Restock Threshold: 10 kg
      - Sales History: ${JSON.stringify(salesHistory)}
      
      TASK:
      Decide if we should restock. Return ONLY valid JSON format:
      {
        "shouldRestock": boolean,
        "recommendedQuantity": number,
        "reason": "short explanation",
        "urgencyScore": number (1-10)
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();

      // 🧹 CLEANUP: Remove Markdown (```json ... ```) if AI adds it
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();

      return JSON.parse(text);
      
    } catch (error) {
      console.error("⚠️ AI Agent Error:", error);
      // Safety Fallback
      return {
        shouldRestock: currentStock < 10,
        recommendedQuantity: 50,
        reason: "AI unavailable (Network/Quota), using default logic.",
        urgencyScore: currentStock < 5 ? 10 : 5
      };
    }
  }
}

export default A2AAgent;