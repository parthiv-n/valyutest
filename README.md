# Patent Explorer

> **AI-powered patent search and innovation trends assistant** - Search USPTO patents, analyze innovation trends, and explore technology landscapes through natural language. Powered by Valyu's patent data API with real patent numbers (no hallucinations).

Fork this repo and use it yourself!

## Why Patent Explorer?

LLMs hallucinate patent numbers all the time - retrieval fixes this critical issue. Patent Explorer provides:

- **🔍 Real Patent Data** - Access to USPTO patents via Valyu API with actual patent numbers, titles, abstracts, filing dates, inventors, and assignees
- **🚫 No Hallucinations** - Only uses real patent numbers from search results, never invents them
- **📊 Innovation Trends** - Analyze patent filing trends, technology evolution, and competitive landscapes
- **🐍 Advanced Analytics** - Execute Python code in secure Daytona sandboxes for patent data analysis and trend calculations
- **📈 Interactive Visualizations** - Beautiful charts and dashboards for patent trends, technology landscapes, and innovation matrices
- **🌐 Market Context** - Web search integration for patent news, litigation, and technology trends
- **🏠 Local AI Models** - Run with Ollama or LM Studio for unlimited, private queries using your own hardware
- **🎯 Natural Language** - Just ask questions like "Show me key patents related to solid-state battery manufacturing"

## Key Features

### 🔥 Powerful Patent Tools

- **USPTO Patent Search** - Search patents by technology, inventor, assignee, claims, or patent number
- **Patent Analysis** - Deep dive into specific patents including citations, patent families, and related patents
- **Analytical Reports** - Professional findings reports with executive summaries, strategic insights, and comparative analysis (not raw data dumps)
- **Innovation Trends** - Analyze patent filing trends over time, technology evolution, and competitive intelligence
- **Interactive Charts** - Visualize patent trends, technology landscapes, assignee portfolios, and innovation matrices
- **Python Code Execution** - Run patent data analysis, trend calculations, and statistical computations
- **CSV Export** - Download patent data tables for further analysis
- **Dual Mode System** - Switch between Valyu + LLM mode (with real patent data) and LLM-only mode (for comparison)

### 🎛️ Dual Mode System

Patent Explorer offers two distinct modes:

**Valyu + LLM Mode** (Default)
- Uses Valyu API to retrieve real USPTO patent data
- Generates structured findings reports with citations
- Includes strategic analysis and comparative insights
- All tools available (patent search, analysis, charts, code execution)

**LLM-Only Mode**
- Pure LLM responses without external data retrieval
- Minimal formatting - natural conversational responses
- No tools - direct LLM wrapper
- Useful for comparing responses with and without real data

Switch between modes using the toggle in the sidebar or prompt bar to see the difference between retrieval-augmented generation and pure LLM responses.

### 🛠️ Advanced Tool Calling

- **Patent Search** - Search USPTO patents with real patent numbers via Valyu API
- **Patent Analysis** - Comprehensive patent research including citations and patent families
- **Python Code Execution** - Run complex patent data analysis, trend calculations, and statistical tests
- **Interactive Charts** - Create publication-ready visualizations of patent trends and innovation landscapes
- **Web Search** - Find patent news, litigation information, and market context
- **Export & Share** - Download results, share analyses, and collaborate

## 🚀 Quick Start

### Two Modes: Production vs Development

Patent Explorer supports two distinct operating modes:

**💻 Development Mode** (default)
- **No Supabase required** - Uses local SQLite database
- **No authentication needed** - Auto-login as dev user
- **Unlimited queries** - No rate limits
- **No billing/tracking** - Polar integration disabled
- **Works offline** - Complete local development
- **Ollama/LM Studio integration** - Use local LLMs for privacy and unlimited usage

### Prerequisites

**For Production Mode:**
- Node.js 18+
- npm or yarn
- OpenAI API key
- Valyu API key (get one at [platform.valyu.ai](https://platform.valyu.ai))
- Daytona API key (for code execution)
- Supabase account and project
- Polar account (for billing)

**For Development Mode (Recommended for getting started):**
- Node.js 18+
- npm or yarn
- Vercel AI Gateway API key (get one at [vercel.com/dashboard](https://vercel.com/dashboard) → AI Gateway → API Keys)
- Valyu API key (get one at [platform.valyu.ai](https://platform.valyu.ai))
- Daytona API key (for code execution)
- [Ollama](https://ollama.com) or [LM Studio](https://lmstudio.ai) installed (optional but recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yorkeccak/bio.git
   cd bio
   ```
   
   **Note**: The repository name is still "bio" (legacy from the original biomedical chatbot), but the app is now "Patent Explorer".

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root directory:

   **For Development Mode (Easy Setup):**
   ```env
   # Enable Development Mode (No Supabase, No Auth, No Billing)
   NEXT_PUBLIC_APP_MODE=development

   # Vercel AI Gateway Configuration (Required)
   # Get your API key at: https://vercel.com/dashboard → AI Gateway → API Keys
   AI_GATEWAY_API_KEY=your-vercel-ai-gateway-api-key

   # Valyu API Configuration (Required)
   VALYU_API_KEY=your-valyu-api-key

   # Daytona Configuration (Required for Python execution)
   DAYTONA_API_KEY=your-daytona-api-key
   DAYTONA_API_URL=https://api.daytona.io  # Optional
   DAYTONA_TARGET=latest  # Optional

   # Local LLM Configuration (Optional - for unlimited, private queries)
   OLLAMA_BASE_URL=http://localhost:11434   # Default Ollama URL
   LMSTUDIO_BASE_URL=http://localhost:1234  # Default LM Studio URL

   # OpenAI Configuration (Optional - fallback if Vercel AI Gateway unavailable)
   OPENAI_API_KEY=your-openai-api-key
   ```

4. **Get your Vercel AI Gateway API Key** (Required)

   This app uses Vercel AI SDK with Vercel AI Gateway for LLM access. To get your API key:

   1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
   2. Navigate to the **"AI Gateway"** tab
   3. Click **"API Keys"** in the sidebar
   4. Click **"Create Key"** to generate a new API key
   5. Copy the key and add it to your `.env.local` file as `AI_GATEWAY_API_KEY`

   **Note**: The API key will only be shown once, so make sure to save it securely.

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

   - **Development Mode**: You'll be automatically logged in as `dev@localhost`
   - **Production Mode**: You'll need to sign up/sign in

## 🏠 Development Mode Guide

### What is Development Mode?

Development mode provides a complete local development environment without any external dependencies beyond the core APIs (Valyu, Daytona). It's perfect for:

- **Local Development** - No Supabase setup required
- **Offline Work** - All data stored locally in SQLite
- **Testing Features** - Unlimited queries without billing
- **Privacy** - Use local Ollama models, no cloud LLM needed
- **Quick Prototyping** - No authentication or rate limits

### How It Works

When `NEXT_PUBLIC_APP_MODE=development`:

1. **Local SQLite Database** (`/.local-data/dev.db`)
   - Automatically created on first run
   - Stores chat sessions, messages, charts, and CSVs
   - Full schema matching production Supabase tables
   - Easy to inspect with `sqlite3 .local-data/dev.db`

2. **Mock Authentication**
   - Auto-login as dev user (`dev@localhost`)
   - No sign-up/sign-in required
   - Unlimited tier access with all features

3. **No Rate Limits**
   - Unlimited chat queries
   - No usage tracking
   - No billing integration

4. **LLM Selection**
   - **Ollama models** (if installed) - Used first, unlimited and free
   - **LM Studio models** (if installed) - Alternative local option with GUI
   - **OpenAI** (if API key provided) - Fallback if no local models available
   - See local models indicator in top-right corner with provider switching

### Choosing Between Ollama and LM Studio

Patent Explorer supports both **Ollama** and **LM Studio** for running local LLMs. Both are free, private, and work offline - choose based on your preference.

**💡 You can use both!** Patent Explorer detects both automatically and lets you switch between them with a provider selector in the UI.

### Setting Up Ollama

Ollama provides unlimited, private LLM inference on your local machine - completely free and runs offline!

**🚀 Quick Setup (No Terminal Required):**

1. **Download Ollama App**
   - Visit [ollama.com](https://ollama.com) and download the app for your OS
   - Install and open the Ollama app
   - It runs in your menu bar (macOS) or system tray (Windows/Linux)

2. **Download a Model**
   - Open Ollama app and browse available models
   - Download `qwen2.5:7b` (recommended - excellent tool support for patent research)
   - Or choose from: `llama3.1`, `mistral`, `deepseek-r1`, `qwen3`
   - That's it! Patent Explorer will automatically detect and use it

3. **Use in Patent Explorer**
   - Start the app in development mode
   - Ollama status indicator appears in top-right corner
   - Shows your available models
   - Click to select which model to use
   - Icons show capabilities: 🔧 (tools) and 🧠 (reasoning)

**⚡ Advanced Setup (Terminal):**

If you prefer using the terminal:

```bash
# Install Ollama
brew install ollama              # macOS
# OR
curl -fsSL https://ollama.com/install.sh | sh  # Linux

# Start Ollama service
ollama serve

# Download recommended models
ollama pull qwen2.5:7b          # Recommended - excellent tool support for patent research
ollama pull qwen3:7b            # Alternative - newer model with improved capabilities
ollama pull llama3.1:8b         # Alternative - good performance and tool support
ollama pull mistral:7b          # Alternative - fast inference
ollama pull deepseek-r1:7b      # For reasoning/thinking mode - shows step-by-step analysis
```

**💡 It Just Works:**
- Patent Explorer automatically detects Ollama when it's running
- No configuration needed
- Automatically falls back to OpenAI/Vercel AI Gateway if Ollama is unavailable
- Switch between models anytime via the local models popup

### Setting Up LM Studio (Alternative)

LM Studio provides a beautiful GUI for running local LLMs - perfect if you prefer visual interfaces over terminal commands!

**🎨 Easy Setup with GUI:**

1. **Download LM Studio**
   - Visit [lmstudio.ai](https://lmstudio.ai) and download for your OS
   - Install and open LM Studio
   - The app provides a full GUI for managing models

2. **Download Models**
   - Click on the 🔍 Search icon in LM Studio
   - Browse available models or search for:
     - `qwen/qwen3-14b` (recommended - excellent tool support)
     - `openai/gpt-oss-20b` (OpenAI's open source model with reasoning)
     - `google/gemma-3-12b` (Google's model with good performance)
     - `qwen/qwen3-4b-thinking-2507` (reasoning model)
   - Click download and wait for it to complete
   - Models are cached locally for offline use

3. **Start the Server**
   - Click the LM Studio logo in your macOS menu bar (top-right corner)
   - Select **"Start Server on Port 1234..."**

   ![LM Studio Start Server](public/lmstudio-start.png)

   - Server starts immediately - you'll see the status change to "Running"
   - That's it! Patent Explorer will automatically detect it

4. **Important: Configure Context Window**
   - ⚠️ **CRITICAL**: This app uses extensive tool descriptions that require adequate context length
   - In LM Studio, when loading a model:
     - Click on the model settings (gear icon)
     - Set **Context Length** to **at least 8192 tokens** (16384+ recommended)
     - If you see errors like "tokens to keep is greater than context length", your context window is too small
   - Without sufficient context length, you'll get errors when the AI tries to use tools
   - This applies to all models in LM Studio - configure each model individually

5. **Use in Patent Explorer**
   - Start the app in development mode
   - Local models indicator appears in top-right corner
   - If both Ollama and LM Studio are running, you'll see a provider switcher
   - Click to select which provider and model to use
   - Icons show capabilities: 🔧 (tools) and 🧠 (reasoning)

**⚙️ Configuration:**
- Default URL: `http://localhost:1234`
- Can be customized in `.env.local`:
  ```env
  LMSTUDIO_BASE_URL=http://localhost:1234
  ```

**💡 LM Studio Features:**
- Real-time GPU/CPU usage monitoring
- Easy model comparison and testing
- Visual prompt builder
- Chat history within LM Studio
- No terminal commands needed

### Switching Between Providers

If you have both Ollama and LM Studio running, Patent Explorer automatically detects both and shows a beautiful provider switcher in the local models popup:

- **Visual Selection**: Click provider buttons with logos
- **Seamless Switching**: Switch between providers without reloading
- **Independent Models**: Each provider shows its own model list
- **Automatic Detection**: No manual configuration needed

The provider switcher appears automatically when multiple providers are detected!

### Model Capabilities

Not all models support all features. Here's what works:

**Tool Calling Support** (Execute Python, search patents, create charts):
- ✅ qwen2.5, qwen3, deepseek-r1, deepseek-v3
- ✅ llama3.1, llama3.2, llama3.3
- ✅ mistral, mistral-nemo, mistral-small
- ✅ See full list in Ollama popup (wrench icon)

**Thinking/Reasoning Support** (Show reasoning steps):
- ✅ deepseek-r1, deepseek-v3, qwen3
- ✅ gpt-oss, cogito, magistral
- ✅ See full list in Ollama popup (brain icon)

**What happens if model lacks tool support?**
- You'll see a friendly dialog explaining limitations
- Can continue with text-only responses
- Or switch to a different model that supports tools

## 📊 Analytical Reports & Insights

Patent Explorer generates **professional analytical reports** rather than raw data dumps:

- **Executive Summary** - High-level insights and key findings
- **Strategic Analysis** - Market trends, competitive positioning, innovation patterns
- **Comparative Analysis** - How different approaches compare
- **Key Takeaways** - Actionable intelligence and recommendations
- **Grouped by Themes** - Patents organized by innovation approach, not just listed

The AI synthesizes patent data into strategic intelligence, focusing on "what this means" rather than "what this is".

### Development Mode Features

✅ **Full Chat History**
- All conversations saved to local SQLite
- Persists across restarts
- View/delete old sessions

✅ **Charts & Visualizations**
- Created charts saved locally
- Retrievable via markdown syntax
- Rendered from local database

✅ **CSV Data Tables**
- Generated CSVs stored in SQLite
- Inline table rendering
- Full data persistence

✅ **No Hidden Costs**
- No OpenAI API usage (when using Ollama)
- No Supabase database costs
- No authentication service costs

### Managing Local Database

**View Database:**
```bash
sqlite3 .local-data/dev.db
# Then run SQL queries
SELECT * FROM chat_sessions;
SELECT * FROM charts;
```

**Reset Database:**
```bash
rm -rf .local-data/
# Database recreated on next app start
```

**Backup Database:**
```bash
cp -r .local-data/ .local-data-backup/
```

### Switching Between Modes

**Development → Production:**
1. Remove/comment `NEXT_PUBLIC_APP_MODE=development`
2. Add all Supabase and Polar environment variables
3. Restart server

**Production → Development:**
1. Add `NEXT_PUBLIC_APP_MODE=development`
2. Restart server
3. Local database automatically created

**Note:** Your production Supabase data and local SQLite data are completely separate. Switching modes doesn't migrate data.

### Troubleshooting Development Mode

**Sidebar won't open on homepage:**
- Fixed! Sidebar now respects dock setting even on homepage

**Local models not detected:**
- **Ollama**: Make sure Ollama is running: `ollama serve`
  - Check Ollama URL in `.env.local` (default: `http://localhost:11434`)
  - Verify models are installed: `ollama list`
- **LM Studio**: Click LM Studio menu bar icon → "Start Server on Port 1234..."
  - Check LM Studio URL in `.env.local` (default: `http://localhost:1234`)
  - Verify at least one model is downloaded in LM Studio
  - Server must be running for Patent Explorer to detect it

**Database errors:**
- Delete and recreate: `rm -rf .local-data/`
- Check file permissions in `.local-data/` directory

**Auth errors:**
- Verify `NEXT_PUBLIC_APP_MODE=development` is set
- Clear browser localStorage and cache
- Restart dev server

## Production Deployment Guide

This guide walks you through setting up Patent Explorer for production with full authentication, billing, and database functionality.

### 1. Get API Keys

#### Valyu API (Required)

Valyu provides USPTO patent data - real patent numbers, titles, abstracts, filing dates, inventors, and assignees. Without this API key, the app cannot access patent data.

1. Go to [platform.valyu.ai](https://platform.valyu.ai)
2. Sign up for an account
3. Navigate to API Keys section
4. Create a new API key
5. Copy your API key (starts with `valyu_`)

#### Vercel AI Gateway API Key (Required)

Used for LLM access via Vercel AI Gateway. This is required for the chat functionality.

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Navigate to **"AI Gateway"** tab
3. Click **"API Keys"** in the sidebar
4. Click **"Create Key"** to generate a new API key
5. Copy the key (starts with `vg_`)

#### OpenAI API (Optional - Fallback)

Used as fallback if Vercel AI Gateway is unavailable. Can also be used directly instead of Vercel AI Gateway.

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an account or sign in
3. Navigate to API keys
4. Create a new secret key
5. Copy the key (starts with `sk-`)

#### Daytona API (Required)

Used for secure Python code execution, enabling data analysis, visualizations, and statistical calculations.

1. Go to [daytona.io](https://daytona.io)
2. Sign up for an account
3. Get your API key from the dashboard
4. Copy the key

### 2. Set Up Supabase Database

#### Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the project to be provisioned (2-3 minutes)
4. Go to Project Settings → API
5. Copy these values:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

#### Create Database Tables

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the contents of [`supabase/schema.sql`](supabase/schema.sql) and run it

#### Set Up Row Level Security

1. In the SQL Editor, create another new query
2. Copy the contents of [`supabase/policies.sql`](supabase/policies.sql) and run it

#### Configure Authentication

1. Go to **Authentication** → **Providers** in Supabase
2. Enable **Email** provider (enabled by default)
3. **Optional:** Enable OAuth providers (Google, GitHub, etc.)
   - For Google: Add OAuth credentials from Google Cloud Console
   - For GitHub: Add OAuth app credentials from GitHub Settings

4. Go to **Authentication** → **URL Configuration**
5. Add your site URL and redirect URLs:
   - Site URL: `https://yourdomain.com` (or `http://localhost:3000` for testing)
   - Redirect URLs: `https://yourdomain.com/auth/callback`

### 3. Set Up Polar Billing (Optional)

Polar provides subscription billing and payments.

1. Go to [polar.sh](https://polar.sh)
2. Create an account
3. Create your products:
   - **Pay Per Use** plan (e.g., $9.99/month)
   - **Unlimited** plan (e.g., $49.99/month)
4. Copy the Product IDs
5. Go to Settings → Webhooks
6. Create a webhook:
   - URL: `https://yourdomain.com/api/webhooks/polar`
   - Events: Select all `customer.*` and `subscription.*` events
7. Copy the webhook secret

**If you don't want billing:**
- Skip this section
- Remove billing UI from the codebase
- All users will have unlimited access

### 4. Configure Environment Variables

Create `.env.local` in your project root:

```env
# App Configuration
NEXT_PUBLIC_APP_MODE=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Vercel AI Gateway Configuration (Required)
# Get your API key at: https://vercel.com/dashboard → AI Gateway → API Keys
AI_GATEWAY_API_KEY=vg_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# OpenAI Configuration (Optional - fallback if Vercel AI Gateway unavailable)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Valyu API (Required - powers all patent data)
# Get yours at: https://platform.valyu.ai
VALYU_API_KEY=valyu_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Daytona Configuration (Code Execution)
DAYTONA_API_KEY=your-daytona-api-key
DAYTONA_API_URL=https://api.daytona.io
DAYTONA_TARGET=latest

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Polar Billing (Optional - remove if not using billing)
POLAR_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
POLAR_UNLIMITED_PRODUCT_ID=prod_xxxxxxxxxxxxxxxxxxxxx
```

### 5. Deploy to Production

#### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add all environment variables from `.env.local`
5. Deploy!

**Important Vercel Settings:**
- Framework Preset: Next.js
- Node.js Version: 18.x or higher
- Build Command: `npm run build`
- Output Directory: `.next`

#### Other Deployment Options

- **Netlify**: Similar to Vercel
- **Railway**: Good for full-stack apps
- **Self-hosted**: Use Docker with PM2 or similar

### 6. Post-Deployment Setup

1. **Test Authentication:**
   - Visit your site
   - Try signing up with email
   - Check that user appears in Supabase Users table

2. **Test Polar Webhooks:**
   - Subscribe to a plan
   - Check Supabase users table for `subscription_tier` update
   - Check Polar dashboard for webhook delivery

3. **Test Patent Data:**
   - Ask a question like "Show me key patents related to solid-state battery manufacturing"
   - Verify Valyu API is returning patent data
   - Check that charts and CSVs are saving to database
   - Verify the response is an analytical report, not raw data

### 7. Troubleshooting

**Authentication Issues:**
- Verify Supabase URL and keys are correct
- Check redirect URLs in Supabase dashboard
- Clear browser cookies/localStorage and try again

**Database Errors:**
- Verify all tables were created successfully
- Check RLS policies are enabled
- Review Supabase logs for detailed errors

**Billing Not Working:**
- Verify Polar webhook secret is correct
- Check Polar dashboard for webhook delivery status
- Review app logs for webhook processing errors

**No Patent Data:**
- Verify Valyu API key is set correctly in environment variables
- Check Valyu dashboard for API usage/errors
- Test API key with a curl request to Valyu
- Verify you're using the correct source: `valyu/valyu-uspto`

**Rate Limiting:**
- Check `user_rate_limits` table in Supabase
- Verify user's subscription tier is set correctly
- Review rate limit logic in `/api/rate-limit`

### 8. Security Best Practices

**Do:**
- Keep `SUPABASE_SERVICE_ROLE_KEY` secret (never expose client-side)
- Use environment variables for all secrets
- Enable RLS on all Supabase tables
- Regularly rotate API keys
- Use HTTPS in production
- Enable Supabase Auth rate limiting

**Don't:**
- Commit `.env.local` to git (add to `.gitignore`)
- Expose service role keys in client-side code
- Disable RLS policies
- Use the same API keys for dev and production

### 9. Monitoring & Maintenance

**Supabase:**
- Monitor database usage in Supabase dashboard
- Set up database backups (automatic in paid plan)
- Review auth logs for suspicious activity

**Polar:**
- Monitor subscription metrics
- Handle failed payments
- Review webhook logs

**Application:**
- Set up error tracking (Sentry, LogRocket, etc.)
- Monitor API usage (Valyu, OpenAI, Daytona)
- Set up uptime monitoring (UptimeRobot, Better Uptime)

## 💡 Example Queries

Try these powerful queries to see what Patent Explorer can do:

- "Show me key patents related to solid-state battery manufacturing"
- "Find patents by Tesla in autonomous driving technology"
- "Analyze patent trends in CRISPR technology over the past 10 years"
- "What are the top assignees for quantum computing patents?"
- "Show me patents related to AI chip architecture"
- "Create a chart showing patent filing trends for electric vehicle batteries"
- "What are recent innovations in solid-state battery technology?"
- "Compare different approaches to autonomous driving sensors across leading companies"

**What to Expect:**
- **Analytical Reports** - Not raw data dumps, but strategic insights and analysis
- **Grouped by Themes** - Patents organized by innovation approach
- **Comparative Analysis** - How different approaches compare
- **Strategic Insights** - Market trends, gaps, and opportunities

**With Local Models (Ollama/LM Studio):**
- Run unlimited queries without API costs
- Keep all your patent research completely private
- Perfect for sensitive competitive intelligence
- Choose your preferred interface: terminal (Ollama) or GUI (LM Studio)

## 🏗️ Architecture

- **Frontend**: Next.js 15 with App Router, React 19, Tailwind CSS, shadcn/ui
- **AI Framework**: Vercel AI SDK v5 with streaming, tool calling, and message management
- **LLM Access**: Vercel AI Gateway (required) + OpenAI GPT-5 + Ollama/LM Studio for local models
- **Data Retrieval**: Valyu API for USPTO patent data (real patent numbers, no hallucinations)
- **Code Execution**: Daytona sandboxes for secure Python execution
- **Visualizations**: Recharts for interactive charts
- **Real-time**: Streaming responses with incremental token rendering
- **Local Models**: Ollama and LM Studio integration for private, unlimited queries
- **Analytics**: Analytical report generation with strategic insights and synthesis
- **Database**: Supabase (production) or SQLite (development) for chat persistence

## 🔒 Security

- Secure API key management
- Sandboxed code execution via Daytona
- No storage of sensitive patent data
- HTTPS encryption for all API calls
- Privacy-focused architecture (when self-hosted)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

- Built with [Valyu](https://platform.valyu.ai) - Patent data API (no hallucinated patent numbers!)
- Powered by [Vercel AI SDK](https://sdk.vercel.ai) - Chat experience, streaming, and tool calling
- Powered by [Daytona](https://daytona.io) - Secure code execution
- UI components from [shadcn/ui](https://ui.shadcn.com)

## 🔧 How It Works: Vercel AI SDK Integration

Patent Explorer leverages the Vercel AI SDK for a complete AI chat experience:

### Backend (`/api/chat/route.ts`)
- Uses `streamText()` to generate streaming responses
- Integrates tool calling for patent search, analysis, and code execution
- Supports multiple LLM providers (OpenAI, Ollama, LM Studio) via provider abstraction
- Handles message persistence and conversation state
- Implements dual mode system (Valyu + LLM vs LLM-only) with conditional tool availability

### Frontend (`chat-interface.tsx`)
- Uses `useChat()` hook for message management and streaming
- Custom `DefaultChatTransport` for request configuration
- Automatic tool result handling with `sendAutomaticallyWhen`
- Real-time UI updates as tokens stream in
- Supports reasoning steps for compatible models

### Key Features Enabled
- **Streaming Responses**: Tokens appear in real-time as they're generated
- **Tool Calling**: Model automatically decides when to use patent search, analysis, or code execution tools
- **Multi-turn Conversations**: Full conversation history maintained automatically
- **Message Persistence**: All conversations saved to database with tool calls and results
- **Error Handling**: Graceful fallbacks and user-friendly error messages

The SDK abstracts away the complexity of streaming, tool calling, and message management, allowing the app to focus on domain-specific logic (patent search, analysis, visualization).

---

## Shortcuts & Assumptions

**Shortcuts Made:**
- Kept existing database schema (generic, works for patents)
- Kept authentication/rate limiting system (can simplify for demo)
- Reused chart/CSV rendering components (generic, work for any data)
- Kept code execution tool (useful for patent analysis)
- Used development mode for demo (no Supabase needed)

**Assumptions:**
- Valyu has patent source: `"valyu/valyu-uspto"` (verify exact name with Valyu docs)
- Patent data structure from Valyu includes: number, title, abstract, claims, dates, inventors, assignees
- Can use development mode for demo (no Supabase needed)
- Focus on USPTO patents (US market) - can expand to other jurisdictions later

**What to Verify:**
- Exact Valyu source identifier for patents (check Valyu documentation)
- Patent data fields returned by Valyu API
- Whether Valyu supports patent citation analysis

---

## Domain Choice: Why Patents?

**Patents** was chosen as the domain because:

1. **Valyu's Strength** - Valyu explicitly markets patent datasets as a core strength
2. **Hallucination Problem** - LLMs frequently hallucinate patent numbers - retrieval fixes this critical issue
3. **High Value Use Case** - Researchers, inventors, IP lawyers, and startups need accurate patent data
4. **Clear Differentiation** - Different from the biomedical example, showcases Valyu's versatility
5. **Engaging Demo** - Users can explore innovation trends, competitive landscapes, and technology evolution

**Demo Query:** "Show me key patents related to solid-state battery manufacturing"

---

<p align="center">
  Made with ❤️ for patent researchers and innovators
</p>

<p align="center">
  <a href="https://twitter.com/ValyuNetwork">Twitter</a> •
  <a href="https://www.linkedin.com/company/valyu-ai">LinkedIn</a> •
  <a href="https://github.com/yorkeccak/bio">GitHub</a>
</p>
