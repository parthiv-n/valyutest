# Marketing Content

## Reddit Post Draft

**Title:** Built a patent search chatbot that uses real patent data (no hallucinations)

**Subreddit:** r/MachineLearning, r/Entrepreneur, r/patents

**Post:**

I built an AI chatbot for patent search and innovation analysis that solves a critical problem: LLMs hallucinate patent numbers all the time.

**The Problem:**
When you ask ChatGPT or Claude about patents, they'll confidently give you patent numbers that don't exist. This is a huge issue for researchers, inventors, IP lawyers, and startups who need accurate patent data.

**The Solution:**
I built Patent Explorer - an AI chatbot that uses retrieval-augmented generation (RAG) with Valyu's patent API to access real USPTO patent data. It only returns actual patent numbers from search results, never invents them.

**What it does:**
- Search USPTO patents by technology, inventor, assignee, or patent number
- Analyze patent trends and innovation landscapes
- Visualize patent filing trends over time
- Export patent data as CSV for further analysis
- Run Python code for patent data analysis

**Tech Stack:**
- Next.js 15 + Vercel AI SDK for the chat interface
- Valyu API for USPTO patent data retrieval
- OpenAI GPT-5 (or local models via Ollama/LM Studio)
- Daytona for secure Python code execution
- Recharts for interactive visualizations

**Try it:**
[Link to demo]

**Fork it:**
[GitHub repo link]

The code is open source and forkable - you can adapt it for any domain. The key is using Valyu's API for real data retrieval instead of relying on the LLM's training data.

**Why this matters:**
Retrieval-augmented generation fixes the hallucination problem. By connecting the LLM to real data sources (like Valyu's patent database), you get accurate, verifiable results instead of made-up patent numbers.

What do you think? Have you run into the patent hallucination problem before?

---

## Twitter/X Post Draft

**Post:**

LLMs hallucinate patent numbers constantly. Built a chatbot that fixes this using retrieval-augmented generation.

🔍 Patent Explorer uses @ValyuNetwork API for real USPTO patent data
✅ Only returns actual patent numbers (never invents them)
📊 Analyzes innovation trends & competitive landscapes
📈 Visualizes patent filing trends over time

Built with:
- @vercel AI SDK
- Next.js 15
- Valyu API (patent data)

Try it: [demo link]
Fork it: [repo link]

#AI #Patents #Innovation #DevRel #RAG

---

## Demo Video Script (Optional)

**30-90 seconds screen recording:**

1. **Opening (5s):** "LLMs hallucinate patent numbers all the time. Here's how retrieval fixes it."

2. **Demo Query (10s):** Type: "Show me key patents related to solid-state battery manufacturing"

3. **Show Results (20s):** 
   - Show real patent results with actual patent numbers
   - Highlight: "These are real patents from USPTO via Valyu API"
   - Point out patent numbers, filing dates, inventors, assignees

4. **Show Chart (15s):**
   - Show patent filing trends chart
   - "We can visualize innovation trends over time"

5. **Key Message (10s):**
   - "No hallucinated patent numbers - only real data from Valyu API"
   - "Built with Vercel AI SDK + Valyu - fork the repo to adapt for your domain"

6. **Closing (5s):**
   - "Link in description - try it or fork it"

**Total: ~65 seconds**

