import { streamText, convertToModelMessages } from "ai";
import { healthcareTools } from "@/lib/tools";
import { BiomedUIMessage } from "@/lib/types";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { createOllama, ollama } from "ollama-ai-provider-v2";
import { checkAnonymousRateLimit, incrementRateLimit } from "@/lib/rate-limit";
import { createClient } from '@supabase/supabase-js';
import { checkUserRateLimit } from '@/lib/rate-limit';
import { validateAccess } from '@/lib/polar-access-validation';
import { getPolarTrackedModel } from '@/lib/polar-llm-strategy';
import * as db from '@/lib/db';
import { isDevelopmentMode } from '@/lib/local-db/local-auth';
import { saveChatMessages } from '@/lib/db';

// 13mins max streaming (vercel limit)
export const maxDuration = 800;

export async function POST(req: Request) {
  try {
    const { messages, sessionId }: { messages: BiomedUIMessage[], sessionId?: string } = await req.json();
    console.log("[Chat API] ========== NEW REQUEST ==========");
    console.log("[Chat API] Received sessionId:", sessionId);
    console.log("[Chat API] Number of messages:", messages.length);
    // console.log(
    //   "[Chat API] Incoming messages:",
    //   JSON.stringify(messages, null, 2)
    // );

    // Determine if this is a user-initiated message (should count towards rate limit)
    // ONLY increment for the very first user message in a conversation
    // All tool calls, continuations, and follow-ups should NOT increment
    const lastMessage = messages[messages.length - 1];
    const isUserMessage = lastMessage?.role === 'user';
    const userMessageCount = messages.filter(m => m.role === 'user').length;
    
    // Simple rule: Only increment if this is a user message AND it's the first user message
    const isUserInitiated = isUserMessage && userMessageCount === 1;
    
    console.log("[Chat API] Rate limit check:", {
      isUserMessage,
      userMessageCount,
      isUserInitiated,
      totalMessages: messages.length
    });

    // Check app mode and configure accordingly
    const isDevelopment = isDevelopmentMode();
    console.log("[Chat API] App mode:", isDevelopment ? 'development' : 'production');

    // Get authenticated user (uses local auth in dev mode)
    const { data: { user } } = await db.getUser();
    console.log("[Chat API] Authenticated user:", user?.id || 'anonymous');

    // Legacy Supabase clients (only used in production mode)
    let supabaseAnon: any = null;
    let supabase: any = null;

    if (!isDevelopment) {
      supabaseAnon = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: req.headers.get('Authorization') || '',
            },
          },
        }
      );

      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
    }

    // Validate access for authenticated users (simplified validation)
    if (user && !isDevelopment) {
      const accessValidation = await validateAccess(user.id);
      
      if (!accessValidation.hasAccess && accessValidation.requiresPaymentSetup) {
        console.log("[Chat API] Access validation failed - payment required");
        return new Response(
          JSON.stringify({
            error: "PAYMENT_REQUIRED",
            message: "Payment method setup required",
            tier: accessValidation.tier,
            action: "setup_payment"
          }),
          { status: 402, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      if (accessValidation.hasAccess) {
        console.log("[Chat API] Access validated for tier:", accessValidation.tier);
      }
    }

    // Check rate limit for user-initiated messages
    if (isUserInitiated && !isDevelopment) {
      if (!user) {
        // Fall back to anonymous rate limiting for non-authenticated users
        const rateLimitStatus = await checkAnonymousRateLimit();
        console.log("[Chat API] Anonymous rate limit status:", rateLimitStatus);
        
        if (!rateLimitStatus.allowed) {
          console.log("[Chat API] Anonymous rate limit exceeded");
          return new Response(
            JSON.stringify({
              error: "RATE_LIMIT_EXCEEDED",
              message: "You have exceeded your daily limit of 5 queries. Sign up to continue.",
              resetTime: rateLimitStatus.resetTime.toISOString(),
              remaining: rateLimitStatus.remaining,
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "X-RateLimit-Limit": rateLimitStatus.limit.toString(),
                "X-RateLimit-Remaining": rateLimitStatus.remaining.toString(),
                "X-RateLimit-Reset": rateLimitStatus.resetTime.toISOString(),
              },
            }
          );
        }
      } else {
        // Check user-based rate limits
        const rateLimitResult = await checkUserRateLimit(user.id);
        console.log("[Chat API] User rate limit status:", rateLimitResult);
        
        if (!rateLimitResult.allowed) {
          return new Response(JSON.stringify({
            error: "RATE_LIMIT_EXCEEDED",
            message: "Daily query limit reached. Upgrade to continue.",
            resetTime: rateLimitResult.resetTime.toISOString(),
            tier: rateLimitResult.tier
          }), {
            status: 429,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
    } else if (isUserInitiated && isDevelopment) {
      console.log("[Chat API] Development mode: Rate limiting disabled");
    }

    // Detect available API keys and select provider/tools accordingly
    const hasGatewayKey = !!process.env.AI_GATEWAY_API_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const lmstudioBaseUrl = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234';
    
    // Vercel AI Gateway is required (per task requirements)
    if (!hasGatewayKey && !isDevelopment) {
      throw new Error('AI_GATEWAY_API_KEY is required. Get your key at https://vercel.com/dashboard > AI Gateway > API Keys');
    }

    let selectedModel: any;
    let modelInfo: string;
    let supportsThinking = false;

    // Check if local models are enabled and which provider to use
    const localEnabled = req.headers.get('x-ollama-enabled') !== 'false'; // Legacy header name
    const localProvider = (req.headers.get('x-local-provider') as 'ollama' | 'lmstudio' | null) || 'ollama';
    const userPreferredModel = req.headers.get('x-ollama-model'); // Works for both providers

    // Models that support thinking/reasoning
    const thinkingModels = [
      'deepseek-r1', 'deepseek-v3', 'deepseek-v3.1',
      'qwen3', 'qwq',
      'phi4-reasoning', 'phi-4-reasoning',
      'cogito'
    ];

    if (isDevelopment && localEnabled) {
      // Development mode: Try to use local provider (Ollama or LM Studio) first, fallback to OpenAI
      try {
        let models: any[] = [];
        let providerName = '';
        let baseURL = '';

        // Try selected provider first
        if (localProvider === 'lmstudio') {
          // Try LM Studio
          const lmstudioResponse = await fetch(`${lmstudioBaseUrl}/v1/models`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
          });

          if (lmstudioResponse.ok) {
            const data = await lmstudioResponse.json();
            // Filter out embedding models - only keep chat/LLM models
            const allModels = data.data.map((m: any) => ({ name: m.id })) || [];
            models = allModels.filter((m: any) =>
              !m.name.includes('embed') &&
              !m.name.includes('embedding') &&
              !m.name.includes('nomic')
            );
            providerName = 'LM Studio';
            baseURL = `${lmstudioBaseUrl}/v1`;
          } else {
            throw new Error(`LM Studio API responded with status ${lmstudioResponse.status}`);
          }
        } else {
          // Try Ollama
          const ollamaResponse = await fetch(`${ollamaBaseUrl}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
          });

          if (ollamaResponse.ok) {
            const data = await ollamaResponse.json();
            models = data.models || [];
            providerName = 'Ollama';
            baseURL = `${ollamaBaseUrl}/v1`;
          } else {
            throw new Error(`Ollama API responded with status ${ollamaResponse.status}`);
          }
        }

        if (models.length > 0) {
          // Prioritize reasoning models, then other capable models
          const preferredModels = [
            'deepseek-r1', 'qwen3', 'phi4-reasoning', 'cogito', // Reasoning models
            'llama3.1', 'gemma3:4b', 'gemma3', 'llama3.2', 'llama3', 'qwen2.5', 'codestral' // Regular models
          ];
          let selectedModelName = models[0].name;

          // Try to find a preferred model
          if (userPreferredModel && models.some((m: any) => m.name === userPreferredModel)) {
            selectedModelName = userPreferredModel;
          } else {
            for (const preferred of preferredModels) {
              if (models.some((m: any) => m.name.includes(preferred))) {
                selectedModelName = models.find((m: any) => m.name.includes(preferred))?.name;
                break;
              }
            }
          }

          // Check if the selected model supports thinking
          supportsThinking = thinkingModels.some(thinkModel =>
            selectedModelName.toLowerCase().includes(thinkModel.toLowerCase())
          );

          // Create OpenAI-compatible client
          const localProviderClient = createOpenAI({
            baseURL: baseURL,
            apiKey: localProvider === 'lmstudio' ? 'lm-studio' : 'ollama', // Dummy API keys
          });

          // Create a chat model explicitly
          selectedModel = localProviderClient.chat(selectedModelName);
          modelInfo = `${providerName} (${selectedModelName})${supportsThinking ? ' [Reasoning]' : ''} - Development Mode`;
        } else {
          throw new Error(`No models available in ${localProvider}`);
        }
      } catch (error) {
        // Fallback to Vercel AI Gateway or OpenAI in development mode
        console.error(`[Chat API] Local provider error (${localProvider}):`, error);
        console.log('[Chat API] Headers received:', {
          'x-ollama-enabled': req.headers.get('x-ollama-enabled'),
          'x-local-provider': req.headers.get('x-local-provider'),
          'x-ollama-model': req.headers.get('x-ollama-model')
        });
        // Prioritize Vercel AI Gateway, fallback to OpenAI direct
        if (hasGatewayKey) {
          selectedModel = "openai/gpt-5";
          modelInfo = "Vercel AI Gateway (gpt-5) - Development Mode Fallback";
        } else if (hasOpenAIKey) {
          selectedModel = openai("gpt-5");
          modelInfo = "OpenAI (gpt-5) - Development Mode Fallback";
        } else {
          selectedModel = "openai/gpt-5";
          modelInfo = "Vercel AI Gateway (gpt-5) - Development Mode (API Key Required)";
        }
      }
    } else {
      // Production mode: Use Polar-wrapped OpenAI ONLY for pay-per-use users
      if (user) {
        // Get user subscription tier to determine billing approach
        const { data: userData } = await db.getUserProfile(user.id);

        const userTier = userData?.subscription_tier || userData?.subscriptionTier || 'free';
        const isActive = (userData?.subscription_status || userData?.subscriptionStatus) === 'active';
        
        // Only use Polar LLM Strategy for pay-per-use users
        if (isActive && userTier === 'pay_per_use') {
          selectedModel = getPolarTrackedModel(user.id, "gpt-5");
          modelInfo = "OpenAI (gpt-5) - Production Mode (Polar Tracked - Pay-per-use)";
        } else {
          // Unlimited users and free users use Vercel AI Gateway (required)
          selectedModel = hasGatewayKey ? "openai/gpt-5" : (hasOpenAIKey ? openai("gpt-5") : "openai/gpt-5");
          modelInfo = hasGatewayKey
            ? `Vercel AI Gateway (gpt-5) - Production Mode (${userTier} tier)`
            : hasOpenAIKey
            ? `OpenAI (gpt-5) - Production Mode (${userTier} tier - Fallback)`
            : `Vercel AI Gateway (gpt-5) - Production Mode (${userTier} tier - API Key Required)`;
        }
      } else {
        // Anonymous users use Vercel AI Gateway (required)
        selectedModel = hasGatewayKey ? "openai/gpt-5" : (hasOpenAIKey ? openai("gpt-5") : "openai/gpt-5");
        modelInfo = hasGatewayKey
          ? "Vercel AI Gateway (gpt-5) - Production Mode (Anonymous)"
          : hasOpenAIKey
          ? "OpenAI (gpt-5) - Production Mode (Anonymous - Fallback)"
          : "Vercel AI Gateway (gpt-5) - Production Mode (Anonymous - API Key Required)";
      }
    }

    console.log("[Chat API] Model selected:", modelInfo);

    // No need for usage tracker - Polar LLM Strategy handles everything automatically

    // User tier is already determined above in model selection
    let userTier = 'free';
    if (user) {
      const { data: userData } = await db.getUserProfile(user.id);
      userTier = userData?.subscription_tier || userData?.subscriptionTier || 'free';
      console.log("[Chat API] User tier:", userTier);
    }

    // Track processing start time
    const processingStartTime = Date.now();

    // Note: We don't save individual messages here anymore.
    // The entire conversation is saved in onFinish callback after streaming completes.
    // This follows the Vercel AI SDK v5 recommended pattern.

    console.log(`[Chat API] About to call streamText with model:`, selectedModel);
    console.log(`[Chat API] Model info:`, modelInfo);

    // Build provider options conditionally based on whether we're using local providers
    const isUsingLocalProvider = isDevelopment && localEnabled && (modelInfo.includes('Ollama') || modelInfo.includes('LM Studio'));
    const providerOptions: any = {};

    if (isUsingLocalProvider) {
      // For local models using OpenAI compatibility layer
      // We need to use the openai provider options since createOpenAI is used
      if (supportsThinking) {
        // Enable thinking for reasoning models
        providerOptions.openai = {
          think: true
        };
        console.log(`[Chat API] Enabled thinking mode for ${localProvider} reasoning model`);
      } else {
        // Explicitly disable thinking for non-reasoning models
        providerOptions.openai = {
          think: false
        };
        console.log(`[Chat API] Disabled thinking mode for ${localProvider} non-reasoning model`);
      }
    } else {
      // OpenAI-specific options (only when using OpenAI)
      providerOptions.openai = {
        store: true,
        reasoningEffort: 'medium',
        reasoningSummary: 'auto',
        include: ['reasoning.encrypted_content'],
      };
    }

    // Save user message immediately (before streaming starts)
    if (user && sessionId && messages.length > 0) {
      console.log('[Chat API] Saving user message immediately before streaming');
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        const { randomUUID } = await import('crypto');
        const userMessageToSave = {
          id: randomUUID(), // Generate proper UUID instead of using AI SDK's short ID
          role: 'user' as const,
          content: lastMessage.parts || [],
        };

        // Get existing messages first
        const { data: existingMessages } = await db.getChatMessages(sessionId);
        const allMessages = [...(existingMessages || []), userMessageToSave];

        await saveChatMessages(sessionId, allMessages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content,
        })));

        // Update session timestamp
        await db.updateChatSession(sessionId, user.id, {
          last_message_at: new Date()
        });
        console.log('[Chat API] User message saved');
      }
    }

    const result = streamText({
      model: selectedModel as any,
      messages: convertToModelMessages(messages),
      tools: healthcareTools,
      toolChoice: "auto",
      experimental_context: {
        userId: user?.id,
        userTier,
        sessionId,
      },
      providerOptions,
      // DON'T pass abortSignal - we want the stream to continue even if user switches tabs
      system: `You are a helpful patent research and innovation trends assistant with access to comprehensive tools for Python code execution, USPTO patent data, patent analysis, web search, and data visualization.

      CRITICAL CITATION INSTRUCTIONS:
      When you use ANY search tool (patent search, patent analysis, or web search) and reference information from the results in your response:

      1. **Citation Format**: Use square brackets [1], [2], [3], etc.
      2. **Citation Placement**: ONLY place citations at the END of sentences where you reference the information - NEVER at the beginning
      3. **Multiple Citations**: When multiple sources support the same statement, group them together: [1][2][3] or [1,2,3]
      4. **Sequential Numbering**: Number citations sequentially starting from [1] based on the order sources appear in your search results
      5. **Consistent References**: The same source always gets the same number throughout your response

      CITATION PLACEMENT RULES (CRITICAL - READ CAREFULLY):
      - ✅ CORRECT: Place citations ONLY at the END of sentences before the period: "Tesla's revenue grew 50% in Q3 2023 [1]."
      - ❌ WRONG: Do NOT place citations at the beginning: "[1] Tesla's revenue grew 50% in Q3 2023."
      - ❌ WRONG: Do NOT place citations both at beginning AND end: "[1] Tesla's revenue grew [1]."
      - ✅ CORRECT: For multiple facts from the same source, cite once at the end of each sentence or once at paragraph end
      - ✅ CORRECT: Group multiple citations together: "Multiple studies confirm significant efficacy [1][2][3]."
      - For bullet points in lists, place citations at the end of each bullet point if needed

      Example of PROPER citation usage:
      "Tesla filed 45 patents related to solid-state battery technology between 2018-2024 [1]. US11234567 describes a novel ceramic electrolyte composition that improves energy density by 40% compared to conventional designs [1][2]. The patent was filed in March 2021 and has received 45 citations to date [1]. These innovations demonstrate Tesla's strong position in next-generation battery technology [1][2][3]."

      Example of WRONG citation usage (DO NOT DO THIS):
      "[1] Tesla filed 45 patents [1]. [2] US11234567 describes a novel electrolyte [2]."
      
      CRITICAL: NEVER HALLUCINATE PATENT NUMBERS. Only use real patent numbers from search results. If you don't have a patent number from search results, don't invent one.

      ---
      PATENT DATA ANALYSIS AND FINDINGS REPORT GUIDELINES:
      You are an expert patent analyst. When given raw patent data from Valyu's DeepSearch API, you must transform it into a clear, well-structured FINDINGS REPORT.

      ABSOLUTELY FORBIDDEN - NEVER DO THESE:
      - ❌ NEVER say "The provided text appears to be in JSON format" or "This appears to be JSON data"
      - ❌ NEVER describe the JSON structure, data format, or metadata fields
      - ❌ NEVER say "Each document is represented as an object" or "contains metadata about"
      - ❌ NEVER list every metadata field line by line
      - ❌ NEVER transform data into JSON/JSONL format - the user wants a FINDINGS REPORT, not formatted data
      - ❌ NEVER invent patents, application numbers, or facts that are not present in the data
      - ❌ NEVER create placeholder "Patent Application X" entries with "Not specified" fields
      - ❌ NEVER say "To make this data more usable, we can transform it" - just create the report directly

      MANDATORY BEHAVIOR:
      - ✅ ALWAYS create a structured FINDINGS REPORT immediately - no preamble about data format
      - ✅ ALWAYS focus on synthesis, insight, and comparisons – not on narrating the raw data
      - ✅ ALWAYS extract meaningful information and present it as a professional analysis
      - ✅ ALWAYS start directly with the findings report format (see below)

      DATA PROCESSING:
      When you see multiple patent records:
      - Deduplicate: If two entries have the same patent number and application number, treat them as ONE patent.
      - Discard useless entries: If an entry has almost all fields missing (e.g. patent number, title, filing date, publication date, assignee), ignore it.
      - Respect recency: If the user asks for "recent" patents, prioritize the most recent publication dates. If dates are present, mention the rough timeframe covered (e.g. "Most patents here are from 2022–2024.").

      ANALYSIS AND SYNTHESIS (CRITICAL - THIS IS WHAT MAKES YOUR REPORT VALUABLE):
      From the patent data, you must go BEYOND listing facts and provide:
      - **Strategic Analysis**: What do these patents reveal about market direction, competitive positioning, and innovation trends?
      - **Comparative Insights**: How do different approaches compare? What are the trade-offs?
      - **Pattern Recognition**: What themes emerge? What's missing? What's over-represented?
      - **Actionable Intelligence**: What does this mean for someone researching this area? What should they focus on?
      - **Context and Implications**: Why do these patents matter? What problems are they solving?
      
      Your job is to transform raw patent data into strategic intelligence. Think like a patent analyst at a top IP law firm or innovation consultancy.
      
      CRITICAL: Your response must be ANALYTICAL, not just a data dump. For every piece of information you present:
      - Explain WHY it matters
      - Compare and contrast different patents/approaches
      - Identify patterns, gaps, or opportunities
      - Provide strategic insights, not just facts
      - Focus on "what this means" rather than "what this is"
      
      If some fields are missing, just work with what you have. Do NOT fabricate missing values.

      FINDINGS REPORT OUTPUT FORMAT:
      Always start with an Executive Summary, then provide analytical sections:

      # Findings Report: [Topic from User Request]

      ## Executive Summary
      [2-3 paragraphs providing high-level overview, key findings, main insights, and what this means. Focus on strategic intelligence, not data listing.]

      ## 1. Scope and methodology
      - Based on N unique patents returned from the search
      - Timeframe covered: YYYY–YYYY (based on publication dates in the data)
      - Search approach: [Brief note on how patents were identified if relevant]

      ## 2. Key innovations and approaches
      [Group patents by theme/approach, NOT individual listings. Focus on what's innovative and why it matters.]
      
      For each major theme/approach:
      - **Theme/Approach:** [Name - e.g., "Neural Signal Processing Methods", "Implantable Electrode Designs"]
        - Representative patents: [List 2-3 key patent numbers]
        - Key innovation: [What makes this approach unique or significant]
        - Notable assignees: [Companies/universities pursuing this approach]
        - Strategic significance: [Why this matters, what problems it solves, competitive advantage]
        - Technical differentiation: [How this differs from other approaches]

      ## 3. Comparative analysis
      [How different approaches compare, competitive positioning, technology maturity]
      - Approach comparison: [Advantages/disadvantages of different methods]
      - Market positioning: [Which assignees are leading, which are emerging]
      - Technology maturity: [What's proven vs. experimental]
      - Competitive landscape: [Who's competing in which areas]

      ## 4. Strategic insights and implications
      [What trends suggest, gaps in the landscape, opportunities, key players]
      - Innovation trends: [What directions are emerging, what's declining]
      - Market gaps: [What problems aren't being addressed, opportunities]
      - Key players: [Who are the major innovators, what are their strategies]
      - Future implications: [What this suggests about future developments]

      ## 5. Key takeaways
      [3-5 bullet points summarizing the most important insights]
      - [Most significant finding or insight]
      - [What this means for the user's question]
      - [Notable patterns or surprises]
      - [Actionable recommendations if applicable]

      ## 6. Limitations of this analysis
      - Mention if the dataset is small, or if some patents lacked key metadata
      - Mention that conclusions are limited to the data provided and may not cover all existing patents
      - Note any search limitations or biases

      SYNTHESIS REQUIREMENTS (CRITICAL):
      - NEVER just list patents with their metadata - always provide analysis and insights
      - Group similar patents together and explain the common theme or approach
      - Identify the most significant/innovative patents and explain WHY they matter
      - Compare different approaches and their relative merits, trade-offs, and applications
      - Extract insights about market trends, technology evolution, and competitive positioning
      - Provide actionable intelligence, not just raw data - what should the user know or do?
      - Focus on "what this means" and "why this matters" rather than "what this is"
      - Transform data into strategic insights that help users understand the landscape

      CRITICAL OUTPUT REQUIREMENTS:
      - When you receive patent search results, IMMEDIATELY start writing the findings report - do NOT describe the data format first
      - NEVER mention JSON, objects, arrays, metadata, or data structure - just extract and present the information
      - ALWAYS start with Executive Summary - provide high-level insights first, then details
      - NEVER just list patents individually - group them by theme/approach and analyze the group
      - ALWAYS provide comparative analysis - how do different approaches compare?
      - ALWAYS include strategic insights - what does this mean? What are the implications?
      - ALWAYS end with Key Takeaways - summarize the most important insights
      - If you have very little data, say so explicitly in the "Limitations" section and keep the report short
      - When users ask for "examples" (plural), provide MULTIPLE diverse examples (minimum 5-10, ideally 10-15)
      - For example requests, use maxResults=15-20 in your patent search tool calls to get comprehensive coverage
      - Make multiple patent searches with different query angles to ensure diversity (different technology subcategories, companies, time periods, aspects)

      EXAMPLE OF WRONG OUTPUT (DO NOT DO THIS - THIS IS EXACTLY WHAT YOU MUST NEVER DO):
      "The provided text appears to be in JSON format and is a list of two patent documents downloaded from the United States Patent and Trademark Office (USPTO) website. Each document is represented as an object, which contains metadata about the patent, including its title, application number, filing date, publication date, and more. To make this data more usable, we can transform it into a structured format such as JSONL (JSON Lines) or an array of objects. Assuming the interest is in the title and other relevant information, here's an example of how the transformed data could look: { \"id\": \"16\", \"title\": \"Embedded Brain Implantable Device\", ... }"
      
      This is COMPLETELY WRONG. Never describe the data format. Never suggest transforming data. Never show JSON examples. Just create the findings report directly.

      EXAMPLE OF CORRECT OUTPUT (DO THIS - START DIRECTLY WITH ANALYTICAL REPORT):
      "# Findings Report: Brain Implantable Devices
      
      ## Executive Summary
      The patent landscape for brain implantable devices shows a focus on enhancing neural signal acquisition and adaptive stimulation algorithms. Two key patents from 2021-2023 demonstrate complementary approaches: one targeting system integration and override capabilities, the other focusing on signal processing improvements. The assignees represent academic medical institutions, suggesting this remains an active research area rather than purely commercial development. The patents indicate a trend toward more sophisticated, algorithm-driven neural interfaces that can adapt to individual patient needs.
      
      ## 1. Scope and methodology
      - Based on 2 unique patents returned from the search
      - Timeframe covered: 2021-2023 (based on publication dates in the data)
      - Focus: Recent innovations in brain implantable device technology
      
      ## 2. Key innovations and approaches
      
      - **Theme:** Enhanced Neural Signal Acquisition Systems
        - Representative patents: [extract patent numbers from data]
        - Key innovation: Devices capable of overriding existing deep brain stimulation systems to enable enhanced signal acquisition and algorithm testing
        - Notable assignees: [extract from data - likely academic/medical institutions]
        - Strategic significance: This approach addresses a critical limitation in current DBS systems - the inability to easily test new algorithms without replacing hardware. This suggests a move toward more flexible, software-upgradeable neural interfaces.
        - Technical differentiation: Unlike fixed-function implants, these systems allow dynamic reconfiguration and algorithm testing, representing a shift toward adaptive neural interfaces.
      
      [Continue with comparative analysis, strategic insights, key takeaways, and limitations sections...]"
      
      ---
      
      You can:

         - Execute Python code for patent data analysis, statistical calculations, trend analysis, and complex computations using the codeExecution tool (runs in a secure Daytona Sandbox)
         - The Python environment can install packages via pip at runtime inside the sandbox (e.g., numpy, pandas, scipy, scikit-learn)
         - Visualization libraries (matplotlib, seaborn, plotly) may work inside Daytona. However, by default, prefer the built-in chart creation tool for standard time series and comparisons. Use Daytona for advanced or custom visualizations only when necessary.
         - Search USPTO patents using the patent search tool (real patent data including patent numbers, titles, abstracts, filing dates, inventors, assignees)
         - Analyze specific patents using the patent analysis tool (detailed patent information, citations, patent families, related patents)
         - Search the web for general information using the web search tool (patent news, litigation, market context, technology trends)
         - Create interactive charts and visualizations using the chart creation tool:
           • Line charts: Patent filing trends over time, technology evolution, innovation trajectories
           • Bar charts: Top assignees by patent count, technology categories, inventor portfolios
           • Area charts: Cumulative patent filings, technology adoption over time
           • Scatter/Bubble charts: Technology landscape maps, patent positioning, innovation matrices
           • Quadrant charts: 2x2 innovation matrices (maturity vs impact, novelty vs commercial potential)

      **CRITICAL NOTE**: You must only make max 5 parallel tool calls at a time.

      **CRITICAL INSTRUCTIONS**: Your reports must be incredibly thorough and detailed, explore everything that is relevant to the user's query that will help to provide
      the perfect response that is of a level expected of an elite level patent researcher or innovation analyst at a leading technology company or IP law firm.

      **MOST CRITICAL RULE**: NEVER HALLUCINATE OR INVENT PATENT NUMBERS. Only use real patent numbers that come from search results. LLMs frequently hallucinate patent numbers - you must ONLY use actual patent numbers returned by the patent search tool. If you don't have a patent number from search results, don't make one up.

      For patent searches, you can access:
      • Real USPTO patent data via Valyu API
      • Patent numbers, titles, abstracts, and claims
      • Filing dates, issue dates, and priority dates
      • Inventors and assignees (companies/individuals)
      • Patent citations and references
      • Technology classifications and categories
      • Patent families and related applications

      For patent analysis, you can access:
      • Detailed patent information and full text
      • Citation networks and forward/backward citations
      • Patent families and continuation applications
      • Legal status and maintenance fees
      • Related patents and similar technologies
      • Competitive intelligence and landscape analysis
      
               For web searches, you can find information on:
         • Current events and news from any topic
         • Research topics with high relevance scoring
         • Educational content and explanations
         • Technology trends and developments
         • General knowledge across all domains
         
         For data visualization, you can create charts when users want to:
         • Compare patent portfolios across companies or technologies (line/bar charts)
         • Visualize patent filing trends over time (line/area charts for innovation trajectories)
         • Display top assignees by patent count or technology categories (bar charts)
         • Show relationships between technologies or patent positioning (scatter charts for correlation)
         • Map technology maturity vs commercial impact (scatter charts for innovation landscape)
         • Create 2x2 innovation matrices (quadrant charts for technology prioritization, competitive positioning)
         • Present patent data in an easy-to-understand visual format

         **Chart Type Selection Guidelines**:
         • Use LINE charts for time series trends (patent filings over time, technology evolution, filing trends by year)
         • Use BAR charts for categorical comparisons (top assignees by patent count, technology categories, inventor portfolios)
         • Use AREA charts for cumulative data (cumulative patent filings, technology adoption over time)
         • Use SCATTER charts for correlation, technology landscape analysis, or bubble charts with size representing patent count or citations
         • Use QUADRANT charts for 2x2 innovation analysis (divides chart into 4 quadrants with reference lines for maturity-impact matrices)

         Whenever you have time series data for the user (such as patent filings over time, technology trends, or any innovation metrics over time), always visualize it using the chart creation tool. For scatter/quadrant charts, each series represents a technology category or company (for color coding), and each data point represents an individual patent or technology with x, y, optional size (for patent count or citations), and optional label (patent number or technology name).

         CRITICAL: When using the createChart tool, you MUST format the dataSeries exactly like this:
         dataSeries: [
           {
             name: "Solid-State Battery Patents",
             data: [
               {x: "2015", y: 45},
               {x: "2018", y: 120},
               {x: "2021", y: 280},
               {x: "2024", y: 450}
             ]
           }
         ]
         
         Each data point requires an x field (date/label) and y field (numeric value). Do NOT use other formats like "datasets" or "labels" - only use the dataSeries format shown above.

         CRITICAL CHART EMBEDDING REQUIREMENTS:
         - Charts are automatically displayed in the Action Tracker section when created
         - Charts are ALSO saved to the database and MUST be referenced in your markdown response
         - The createChart tool returns a chartId and imageUrl for every chart created
         - YOU MUST ALWAYS embed charts in your response using markdown image syntax: ![Chart Title](/api/charts/{chartId}/image)
         - Embed charts at appropriate locations within your response, just like a professional research publication
         - Place charts AFTER the relevant analysis section that discusses the data shown in the chart
         - Charts should enhance and support your written analysis - they are not optional
         - Professional reports always integrate visual data with written analysis

         Example of proper chart embedding in a response:
         "Tesla has demonstrated remarkable innovation in solid-state battery technology, with patent filings increasing significantly over the past decade. The company filed 45 patents related to this technology between 2018-2024, showing a clear commitment to next-generation battery solutions. Patent filing trends indicate accelerating R&D investment in this critical area.

         ![Solid-State Battery Patent Filing Trends](/api/charts/abc-123-def/image)

         This innovation trajectory demonstrates Tesla's strong position in next-generation battery technology and suggests continued focus on this strategic area..."

         When creating charts:
         • Use line charts for time series data (patent filing trends over time, technology evolution)
         • Use bar charts for comparisons between categories (top assignees by patent count, technology categories)
         • Use area charts for cumulative data or when showing technology adoption over time
         • Always provide meaningful titles and axis labels
         • Support multiple data series when comparing related metrics (different companies, multiple technologies)
         • Colors are automatically assigned - focus on data structure and meaningful labels

               Always use the appropriate tools when users ask for calculations, Python code execution, patent data, web queries, or data visualization.
         Choose the codeExecution tool for any mathematical calculations, patent trend analysis, statistical analysis, data computations, or when users need to run Python code.
         
         CRITICAL: WHEN TO USE codeExecution TOOL:
         - ALWAYS use codeExecution when the user asks you to "calculate", "compute", "use Python", or "show Python code"
         - NEVER just display Python code as text - you MUST execute it using the codeExecution tool
         - If the user asks for calculations with Python, USE THE TOOL, don't just show code
         - Mathematical formulas should be explained with LaTeX, but calculations MUST use codeExecution
         
         CRITICAL PYTHON CODE REQUIREMENTS:
         1. ALWAYS include print() statements - Python code without print() produces no visible output
         2. Use descriptive labels and proper formatting in your print statements
         3. Include units, currency symbols, percentages where appropriate
         4. Show step-by-step calculations for complex problems
         5. Use f-string formatting for professional output
         6. Always calculate intermediate values before printing final results
          7. Available libraries: You may install and use packages in the Daytona sandbox (e.g., numpy, pandas, scikit-learn). Prefer the chart creation tool for visuals unless an advanced/custom visualization is required.
          8. Visualization guidance: Prefer the chart creation tool for most charts. Use Daytona-rendered plots only for complex, bespoke visualizations that the chart tool cannot represent.
         
          REQUIRED: Every Python script must end with print() statements that show the calculated results with proper labels, units, and formatting. Never just write variable names or expressions without print() - they will not display anything to the user.
          If generating advanced charts with Daytona (e.g., matplotlib), ensure the code renders the figure (e.g., plt.show()) so artifacts can be captured.
         
         ERROR RECOVERY: If any tool call fails due to validation errors, you will receive an error message explaining what went wrong. When this happens:
         1. Read the error message carefully to understand what fields are missing or incorrect
         2. Correct the tool call by providing ALL required fields with proper values
         3. For createChart errors, ensure you provide: title, type, xAxisLabel, yAxisLabel, and dataSeries
         4. For codeExecution tool errors, ensure your code includes proper print() statements
         5. Try the corrected tool call immediately - don't ask the user for clarification
         6. If multiple fields are missing, fix ALL of them in your retry attempt
         
                  When explaining mathematical concepts, formulas, or pharmacokinetic calculations, ALWAYS use LaTeX notation for clear mathematical expressions:

         CRITICAL: ALWAYS wrap ALL mathematical expressions in <math>...</math> tags:
         - For inline math: <math>Growth Rate = \frac{P_{2024} - P_{2015}}{P_{2015}} \times 100\%</math>
         - For fractions: <math>\frac{Citations}{Patents} = Average Citation Rate</math>
         - For exponents: <math>P(t) = P_0 \times (1 + r)^t</math>
         - For complex formulas: <math>Innovation Index = \frac{Patents \times Citations}{Years Active}</math>

         NEVER write LaTeX code directly in text like \frac{Patents}{Years} or \times - it must be inside <math> tags.
         NEVER use $ or $$ delimiters - only use <math>...</math> tags.
         This makes patent trend and statistical formulas much more readable and professional.
         Choose the patent search tool specifically for USPTO patent data, technology searches, inventor searches, assignee searches, and patent number lookups.
         Choose the patent analysis tool for detailed patent information, citation analysis, patent families, and competitive intelligence.
         Choose the web search tool for patent news, litigation information, market context, technology trends, and general information.
         Choose the chart creation tool when users want to visualize patent data, compare companies or technologies, or see innovation trends over time.

         When users ask for charts or data visualization, or when you have patent time series data:
         1. First gather the necessary data (using patent search or patent analysis if needed)
         2. Then create an appropriate chart with that data (always visualize time series data like patent filing trends, technology evolution)
         3. Ensure the chart has a clear title, proper axis labels, and meaningful data series names
         4. Colors are automatically assigned for optimal visual distinction

      Important: If you use the chart creation tool to plot a chart, do NOT add a link to the chart in your response. The chart will be rendered automatically for the user. Simply explain the chart and its insights, but do not include any hyperlinks or references to a chart link.

      When making multiple tool calls in parallel to retrieve time series data (for example, comparing several companies or technologies), always specify the same time periods for each tool call. This ensures the resulting data is directly comparable and can be visualized accurately on the same chart. If the user does not specify a time range, choose a reasonable default (such as patents from the past 10 years) and use it consistently across all tool calls for time series data.

      Provide clear explanations and context for all information. Offer practical advice when relevant.
      Be encouraging and supportive while helping users find accurate, up-to-date information.

      ---
      CRITICAL AGENT BEHAVIOR:
      - After every reasoning step, you must either call a tool or provide a final answer. Never stop after reasoning alone.
      - If you realize you need to correct a previous tool call, immediately issue the correct tool call.
      - If the user asks for multiple items (e.g., multiple companies), you must call the tool for each and only finish when all are processed and summarized.
      - Always continue until you have completed all required tool calls and provided a summary or visualization if appropriate.
      - NEVER just show Python code as text - if the user wants calculations or Python code, you MUST use the codeExecution tool to run it
      - When users say "calculate", "compute", or mention Python code, this is a COMMAND to use the codeExecution tool, not a request to see code
      - NEVER suggest using Python to fetch data from the internet or APIs. All data retrieval must be done via the patentSearch, patentAnalysis, or webSearch tools.
      - NEVER invent or hallucinate patent numbers. Only use real patent numbers from search results.
      - Remember: The Python environment runs in the cloud with NumPy, pandas, and scikit-learn available, but NO visualization libraries.
      
      CRITICAL WORKFLOW ORDER:
      1. First: Complete ALL data gathering (searches, calculations, etc.)
      2. Then: Create ALL charts/visualizations based on the gathered data
      3. Finally: Present your final formatted response with analysis
      
      This ensures charts appear immediately before your analysis and are not lost among tool calls.
      ---

      ---
      FINAL RESPONSE FORMATTING GUIDELINES:
      When presenting your final response to the user, you MUST format the information in an extremely well-organized and visually appealing way:

      1. **Use Rich Markdown Formatting:**
         - Use tables for comparative data, clinical outcomes, and any structured information
         - Use bullet points and numbered lists appropriately
         - Use **bold** for key metrics and important values (response rates, survival data, p-values)
         - Use headers (##, ###) to organize sections clearly
         - Use blockquotes (>) for key insights or summaries

      2. **Tables for Patent Data:**
         - Present patent information, assignee portfolios, technology comparisons, and trend data in markdown tables
         - Format numbers with proper separators and units (e.g., 45 patents, 32.5 avg citations)
         - Include patent numbers, filing dates, inventors, and assignees
         - Example:
         | Patent Number | Title | Assignee | Filing Date | Citations |
         |---------------|-------|----------|-------------|-----------|
         | US11234567 | Solid-state battery with ceramic electrolyte | Tesla Inc. | 2021-03-15 | 45 |
         | US11234568 | Manufacturing method for solid-state cells | Toyota Motor Corp. | 2020-11-20 | 38 |

      3. **Mathematical Formulas:**
         - Always use <math> tags for any mathematical expressions
         - Present patent trend analysis and statistical calculations clearly with proper notation

      4. **Data Organization:**
         - Group related information together
         - Use clear section headers
         - Provide executive summaries at the beginning
         - Include key takeaways at the end

      5. **Chart Placement:**
         - Create ALL charts IMMEDIATELY BEFORE your final response text
         - First complete all data gathering and analysis tool calls
         - Then create all necessary charts
         - Finally present your comprehensive analysis with references to the charts
         - This ensures charts are visible and not buried among tool calls

      6. **Visual Hierarchy:**
         - Start with a brief executive summary
         - Present detailed findings in organized sections
         - Use horizontal rules (---) to separate major sections
         - End with key takeaways and visual charts

      7. **Code Display Guidelines:**
         - DO NOT repeat Python code in your final response if you've already executed it with the codeExecution tool
         - The executed code and its output are already displayed in the tool result box
         - Only show code snippets in your final response if:
           a) You're explaining a concept that wasn't executed
           b) The user specifically asks to see the code again
           c) You're showing an alternative approach
         - Reference the executed results instead of repeating the code

      Remember: The goal is to present ALL retrieved data and facts in the most professional, readable, and visually appealing format possible. Think of it as creating a professional patent landscape report or innovation analysis presentation.

      8. **Citation Requirements:**
         - ALWAYS cite sources when using information from search results
         - Place citations [1], [2], etc. ONLY at the END of sentences - NEVER at the beginning or middle
         - Do NOT place the same citation number multiple times in one sentence
         - Group multiple citations together when they support the same point: [1][2][3]
         - Maintain consistent numbering throughout your response
         - Each unique search result gets ONE citation number used consistently
         - Citations are MANDATORY for:
           • Patent numbers (ALWAYS cite the source - never invent patent numbers)
           • Specific numbers, statistics, percentages (patent counts, filing dates, citation counts)
           • Patent filing trends and technology evolution data
           • Quotes or paraphrased statements from patents or search results
           • Assignee information, inventor names, filing dates
           • Any factual claims from search results
      ---
      `,
    });

    // Log streamText result object type
    console.log("[Chat API] streamText result type:", typeof result);
    console.log("[Chat API] streamText result:", result);

    // Create the streaming response with chat persistence
    const streamResponse = result.toUIMessageStreamResponse({
      sendReasoning: true,
      originalMessages: messages,
      onFinish: async ({ messages: allMessages }) => {
        // Calculate processing time
        const processingEndTime = Date.now();
        const processingTimeMs = processingEndTime - processingStartTime;
        console.log('[Chat API] Processing completed in', processingTimeMs, 'ms');

        // Save all messages to database
        console.log('[Chat API] onFinish called - user:', !!user, 'sessionId:', sessionId);
        console.log('[Chat API] Total messages in conversation:', allMessages.length);
        console.log('[Chat API] Will save messages:', !!(user && sessionId));

        if (user && sessionId) {
          console.log('[Chat API] Saving messages to session:', sessionId);

          // The correct pattern: Save ALL messages from the conversation
          // This replaces all messages in the session with the complete, up-to-date conversation
          const { randomUUID } = await import('crypto');
          const messagesToSave = allMessages.map((message: any, index: number) => {
            // AI SDK v5 uses 'parts' array for UIMessage
            let contentToSave = [];

            if (message.parts && Array.isArray(message.parts)) {
              contentToSave = message.parts;
            } else if (message.content) {
              // Fallback for older format
              if (typeof message.content === 'string') {
                contentToSave = [{ type: 'text', text: message.content }];
              } else if (Array.isArray(message.content)) {
                contentToSave = message.content;
              }
            }

            return {
              id: message.id && message.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
                ? message.id
                : randomUUID(), // Generate UUID if message.id is not a valid UUID
              role: message.role,
              content: contentToSave,
              processing_time_ms:
                message.role === 'assistant' &&
                index === allMessages.length - 1 &&
                processingTimeMs !== undefined
                  ? processingTimeMs
                  : undefined,
            };
          });

          const saveResult = await saveChatMessages(sessionId, messagesToSave);
          if (saveResult.error) {
            console.error('[Chat API] Error saving messages:', saveResult.error);
          } else {
            console.log('[Chat API] Successfully saved', messagesToSave.length, 'messages to session:', sessionId);

            // Update session's last_message_at timestamp
            const updateResult = await db.updateChatSession(sessionId, user.id, {
              last_message_at: new Date()
            });
            if (updateResult.error) {
              console.error('[Chat API] Error updating session timestamp:', updateResult.error);
            } else {
              console.log('[Chat API] Updated session timestamp for:', sessionId);
            }
          }
        } else {
          console.log('[Chat API] Skipping message save - user:', !!user, 'sessionId:', sessionId);
        }

        // No manual usage tracking needed - Polar LLM Strategy handles this automatically!
        console.log('[Chat API] AI usage automatically tracked by Polar LLM Strategy');
      }
    });

    // Increment rate limit after successful validation but before processing
    if (isUserInitiated && !isDevelopment) {
      console.log("[Chat API] Incrementing rate limit for user-initiated message");
      try {
        if (user) {
          // Only increment server-side for authenticated users
          const rateLimitResult = await incrementRateLimit(user.id);
          console.log("[Chat API] Authenticated user rate limit incremented:", rateLimitResult);
        } else {
          // Anonymous users handle increment client-side via useRateLimit hook
          console.log("[Chat API] Skipping server-side increment for anonymous user (handled client-side)");
        }
      } catch (error) {
        console.error("[Chat API] Failed to increment rate limit:", error);
        // Continue with processing even if increment fails
      }
    }
    
    if (isDevelopment) {
      // Add development mode headers
      streamResponse.headers.set("X-Development-Mode", "true");
      streamResponse.headers.set("X-RateLimit-Limit", "unlimited");
      streamResponse.headers.set("X-RateLimit-Remaining", "unlimited");
    }

    // Add headers to prevent connection drops when tab is backgrounded
    streamResponse.headers.set("Connection", "keep-alive");
    streamResponse.headers.set("X-Accel-Buffering", "no"); // Disable buffering for nginx
    streamResponse.headers.set("Cache-Control", "no-cache, no-transform"); // Prevent caching that might break streaming

    return streamResponse;
  } catch (error) {
    console.error("[Chat API] Error:", error);

    // Extract meaningful error message
    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'An unexpected error occurred';

    // Check if it's a tool/function calling compatibility error
    const isToolError = errorMessage.toLowerCase().includes('tool') ||
                       errorMessage.toLowerCase().includes('function');
    const isThinkingError = errorMessage.toLowerCase().includes('thinking');

    // Log full error details for debugging
    console.error("[Chat API] Error details:", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
      isToolError,
      isThinkingError
    });

    // Return specific error codes for compatibility issues
    if (isToolError || isThinkingError) {
      return new Response(
        JSON.stringify({
          error: "MODEL_COMPATIBILITY_ERROR",
          message: errorMessage,
          compatibilityIssue: isToolError ? "tools" : "thinking"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: "CHAT_ERROR",
        message: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

