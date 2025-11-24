import { z } from "zod";
import { tool } from "ai";
import { Valyu } from "valyu-js";
import { track } from "@vercel/analytics/server";
import { PolarEventTracker } from '@/lib/polar-events';
import { Daytona } from '@daytonaio/sdk';
import { createClient } from '@/utils/supabase/server';
import * as db from '@/lib/db';
import { randomUUID } from 'crypto';

export const patentTools = {
  // Chart Creation Tool - Create interactive charts for patent data visualization
  createChart: tool({
    description: `Create interactive charts for patent data visualization and innovation trend analysis.

    CHART TYPES:
    1. "line" - Time series trends (patent filings over time, technology evolution, filing trends by year)
    2. "bar" - Categorical comparisons (top assignees by patent count, technology categories, inventor portfolios)
    3. "area" - Cumulative data (cumulative patent filings, technology adoption over time)
    4. "scatter" - Correlation analysis, technology landscape maps, patent positioning
    5. "quadrant" - 2x2 innovation matrices (maturity vs impact, novelty vs commercial potential)

    TIME SERIES CHARTS (line, bar, area):
    {
      "title": "Solid-State Battery Patents - Filing Trends (2015-2024)",
      "type": "line",
      "xAxisLabel": "Year",
      "yAxisLabel": "Number of Patents Filed",
      "dataSeries": [
        {
          "name": "USPTO Filings",
          "data": [
            {"x": "2015", "y": 45},
            {"x": "2018", "y": 120},
            {"x": "2021", "y": 280},
            {"x": "2024", "y": 450}
          ]
        }
      ]
    }

    SCATTER/BUBBLE CHARTS (for positioning, correlation):
    Each SERIES represents a CATEGORY (for color coding).
    Each DATA POINT represents an individual entity with x, y, size, and label.
    {
      "title": "Patent Landscape: Technology Maturity vs Commercial Impact",
      "type": "scatter",
      "xAxisLabel": "Technology Maturity Score",
      "yAxisLabel": "Commercial Impact Score",
      "dataSeries": [
        {
          "name": "Battery Technologies",
          "data": [
            {"x": 8.5, "y": 9.2, "size": 450, "label": "US11234567"},
            {"x": 7.8, "y": 8.5, "size": 320, "label": "US11234568"}
          ]
        },
        {
          "name": "Semiconductor",
          "data": [
            {"x": 9.2, "y": 8.8, "size": 280, "label": "US11234569"}
          ]
        }
      ]
    }

    QUADRANT CHARTS (2x2 innovation matrix):
    Same as scatter, but with reference lines dividing chart into 4 quadrants.
    Use for: Technology prioritization, innovation strategy, competitive positioning.

    CRITICAL: ALL REQUIRED FIELDS MUST BE PROVIDED.`,
    inputSchema: z.object({
      title: z
        .string()
        .describe('Chart title (e.g., "Solid-State Battery Patents - Filing Trends")'),
      type: z
        .enum(["line", "bar", "area", "scatter", "quadrant"])
        .describe(
          'Chart type: "line" (time series), "bar" (comparisons), "area" (cumulative), "scatter" (positioning/correlation), "quadrant" (2x2 matrix)'
        ),
      xAxisLabel: z
        .string()
        .describe('X-axis label (e.g., "Year", "Patent Count", "Technology Category")'),
      yAxisLabel: z
        .string()
        .describe(
          'Y-axis label (e.g., "Number of Patents", "Filing Year", "Citation Count", "Impact Score")'
        ),
      dataSeries: z
        .array(
          z.object({
            name: z
              .string()
              .describe(
                'Series name - For time series: technology/company name. For scatter/quadrant: category name for color coding (e.g., "Battery Technologies", "Semiconductor", "Automotive")'
              ),
            data: z
              .array(
                z.object({
                  x: z
                    .union([z.string(), z.number()])
                    .describe(
                      'X-axis value - Date/time string for time series, numeric value for scatter/quadrant'
                    ),
                  y: z
                    .number()
                    .describe(
                      "Y-axis numeric value - response rate, survival %, score, etc. REQUIRED for all chart types."
                    ),
                  size: z
                    .number()
                    .optional()
                    .describe(
                      'Bubble size for scatter/quadrant charts (e.g., patent count, citation count, market size). Larger = bigger bubble.'
                    ),
                  label: z
                    .string()
                    .optional()
                    .describe(
                      'Individual entity name for scatter/quadrant charts (e.g., "US11234567", "Tesla Inc.", "Technology A"). Displayed on/near bubble.'
                    ),
                })
              )
              .describe(
                "Array of data points. For time series: {x: date, y: value}. For scatter/quadrant: {x, y, size, label}."
              ),
          })
        )
        .describe(
          "REQUIRED: Array of data series. For scatter/quadrant: each series = category for color coding, each point = individual entity"
        ),
      description: z
        .string()
        .optional()
        .describe("Optional description explaining what the chart shows"),
    }),
    execute: async ({
      title,
      type,
      xAxisLabel,
      yAxisLabel,
      dataSeries,
      description,
    }, options) => {
      const userId = (options as any)?.experimental_context?.userId;
      const sessionId = (options as any)?.experimental_context?.sessionId;

      // Calculate metadata based on chart type
      let dateRange = null;
      if (type === 'scatter' || type === 'quadrant') {
        // For scatter/quadrant charts, show x and y axis ranges
        const allXValues = dataSeries.flatMap(s => s.data.map(d => Number(d.x)));
        const allYValues = dataSeries.flatMap(s => s.data.map(d => d.y ?? 0));
        if (allXValues.length > 0 && allYValues.length > 0) {
          dateRange = {
            start: `X: ${Math.min(...allXValues).toFixed(1)}-${Math.max(...allXValues).toFixed(1)}`,
            end: `Y: ${Math.min(...allYValues).toFixed(1)}-${Math.max(...allYValues).toFixed(1)}`,
          };
        }
      } else {
        // For time series charts, show date/label range
        if (dataSeries.length > 0 && dataSeries[0].data.length > 0) {
          dateRange = {
            start: dataSeries[0].data[0].x,
            end: dataSeries[0].data[dataSeries[0].data.length - 1].x,
          };
        }
      }

      await track('Chart Created', {
        chartType: type,
        title: title,
        seriesCount: dataSeries.length,
        totalDataPoints: dataSeries.reduce((sum, series) => sum + series.data.length, 0),
        hasDescription: !!description,
        hasScatterData: dataSeries.some(s => s.data.some(d => d.size || d.label)),
      });

      const chartData = {
        chartType: type,
        title,
        xAxisLabel,
        yAxisLabel,
        dataSeries,
        description,
        metadata: {
          totalSeries: dataSeries.length,
          totalDataPoints: dataSeries.reduce((sum, series) => sum + series.data.length, 0),
          dateRange,
        },
      };

      // Save chart to database
      let chartId: string | null = null;
      try {
        chartId = randomUUID();
        const insertData: any = {
          id: chartId,
          session_id: sessionId || null,
          chart_data: chartData,
        };

        if (userId) {
          insertData.user_id = userId;
        } else {
          insertData.anonymous_id = 'anonymous';
        }

        await db.createChart(insertData);
      } catch (error) {
        console.error('[createChart] Error saving chart:', error);
        chartId = null;
      }

      return {
        ...chartData,
        chartId: chartId || undefined,
        imageUrl: chartId ? `/api/charts/${chartId}/image` : undefined,
      };
    },
  }),

  // CSV Creation Tool - Generate downloadable CSV files for patent data
  createCSV: tool({
    description: `Create downloadable CSV files for patent data, innovation analysis, and research tables.

    USE CASES:
    - Export patent search results (patent numbers, titles, inventors, assignees, filing dates)
    - Create comparison tables (patent portfolios by company, technology categories, inventor analysis)
    - Generate time series data exports (patent filings over time, technology trends)
    - Build data tables for further analysis (citation networks, patent families, competitive landscapes)
    - Create custom research reports (patent landscape summaries, innovation trend analysis)

    REFERENCING CSVs IN MARKDOWN:
    After creating a CSV, you MUST reference it in your markdown response to display it as an inline table.

    CRITICAL - Use this EXACT format:
    ![csv](csv:csvId)

    Where csvId is the ID returned in the tool response.

    Example:
    - Tool returns: { csvId: "abc-123-def-456", ... }
    - In your response: "Here is the data:\n\n![csv](csv:abc-123-def-456)\n\n"

    The CSV will automatically render as a formatted markdown table. Do NOT use link syntax [text](csv:id), ONLY use image syntax ![csv](csv:id).

    IMPORTANT GUIDELINES:
    - Use descriptive column headers
    - Include units in headers when applicable (e.g., "Concentration (mg/L)", "Response Rate (%)")
    - Format numbers appropriately (use consistent decimal places)
    - Add a title/description to explain the data
    - Organize data logically (chronological, by treatment group, or by significance)

    EXAMPLE - Patent Comparison:
    {
      "title": "Solid-State Battery Patents - Key Innovations",
      "description": "Top patents in solid-state battery manufacturing technology",
      "headers": ["Patent Number", "Title", "Assignee", "Filing Date", "Inventors", "Citations"],
      "rows": [
        ["US11234567", "Solid-state battery with ceramic electrolyte", "Tesla Inc.", "2021-03-15", "John Doe, Jane Smith", "45"],
        ["US11234568", "Manufacturing method for solid-state cells", "Toyota Motor Corp.", "2020-11-20", "Akira Tanaka", "38"],
        ["US11234569", "Electrode structure for solid-state battery", "QuantumScape", "2022-01-10", "Robert Chen", "52"]
      ]
    }

    EXAMPLE - Patent Filing Trends:
    {
      "title": "Patent Filings by Year - Battery Technology",
      "description": "USPTO patent filings in battery technology (2015-2024)",
      "headers": ["Year", "Total Filings", "Solid-State", "Lithium-Ion", "Other"],
      "rows": [
        ["2015", "245", "45", "180", "20"],
        ["2018", "520", "120", "350", "50"],
        ["2021", "890", "280", "520", "90"],
        ["2024", "1240", "450", "680", "110"]
      ]
    }

    EXAMPLE - Assignee Portfolio Analysis:
    {
      "title": "Top Patent Assignees - Solid-State Battery Technology",
      "description": "Companies with most patents in solid-state battery field",
      "headers": ["Assignee", "Patent Count", "Earliest Filing", "Latest Filing", "Avg Citations"],
      "rows": [
        ["Tesla Inc.", "45", "2018-05-12", "2024-02-28", "32.5"],
        ["Toyota Motor Corp.", "38", "2017-11-03", "2024-01-15", "28.2"],
        ["QuantumScape", "32", "2019-02-20", "2024-03-10", "41.8"]
      ]
    }

    The CSV will be rendered as an interactive table with download capability.`,
    inputSchema: z.object({
      title: z.string().describe("Title for the CSV file (will be used as filename)"),
      description: z.string().optional().describe("Optional description of the data"),
      headers: z.array(z.string()).describe("Column headers for the CSV"),
      rows: z.array(z.array(z.string())).describe("Data rows - each row is an array matching the headers"),
    }),
    execute: async ({ title, description, headers, rows }, options) => {
      const userId = (options as any)?.experimental_context?.userId;
      const sessionId = (options as any)?.experimental_context?.sessionId;

      try {
        // Validate that all rows have the same number of columns as headers
        const headerCount = headers.length;
        const invalidRows = rows.filter(row => row.length !== headerCount);

        if (invalidRows.length > 0) {
          return {
            error: true,
            message: `❌ **CSV Validation Error**: All rows must have ${headerCount} columns to match headers. Found ${invalidRows.length} invalid row(s). Please regenerate the CSV with matching column counts.`,
            title,
            headers,
            expectedColumns: headerCount,
            invalidRowCount: invalidRows.length,
          };
        }

        // Generate CSV content
        const csvContent = [
          headers.join(','),
          ...rows.map(row =>
            row.map(cell => {
              // Escape cells that contain commas, quotes, or newlines
              if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                return `"${cell.replace(/"/g, '""')}"`;
              }
              return cell;
            }).join(',')
          )
        ].join('\n');

        // Save CSV to database
        let csvId: string | null = null;
        try {
          csvId = randomUUID();

          const insertData: any = {
            id: csvId,
            session_id: sessionId || null,
            title,
            description: description || undefined,
            headers,
            rows: rows,
          };

          if (userId) {
            insertData.user_id = userId;
          } else {
            insertData.anonymous_id = 'anonymous';
          }

          await db.createCSV(insertData);
        } catch (error) {
          console.error('[createCSV] Error saving CSV:', error);
          csvId = null;
        }

        // Track CSV creation
        await track('CSV Created', {
          title: title,
          rowCount: rows.length,
          columnCount: headers.length,
          hasDescription: !!description,
          savedToDb: !!csvId,
        });

        const result = {
          title,
          description,
          headers,
          rows,
          csvContent,
          rowCount: rows.length,
          columnCount: headers.length,
          csvId: csvId || undefined,
          csvUrl: csvId ? `/api/csvs/${csvId}` : undefined,
          _instructions: csvId
            ? `IMPORTANT: Include this EXACT line in your markdown response to display the table:\n\n![csv](csv:${csvId})\n\nDo not write [View Table] or any other text - use the image syntax above.`
            : undefined,
        };

        return result;
      } catch (error: any) {
        return {
          error: true,
          message: `❌ **CSV Creation Error**: ${error.message || 'Unknown error occurred'}`,
          title,
        };
      }
    },
  }),

  codeExecution: tool({
    description: `Execute Python code securely in a Daytona Sandbox for patent data analysis, statistical calculations, and trend analysis.

    CRITICAL: Always include print() statements to show results. Maximum 10,000 characters.

    Example for patent trend analysis:
    # Calculate patent filing growth rate
    import math
    patents_2015 = 45
    patents_2024 = 450
    years = 9
    growth_rate = ((patents_2024 / patents_2015) ** (1/years) - 1) * 100
    print(f"Annual growth rate: {growth_rate:.2f}%")
    print(f"Total growth over {years} years: {(patents_2024/patents_2015 - 1)*100:.1f}%")`,
    inputSchema: z.object({
      code: z.string().describe('Python code to execute - MUST include print() statements'),
      description: z.string().optional().describe('Brief description of the calculation'),
    }),
    execute: async ({ code, description }, options) => {
      const userId = (options as any)?.experimental_context?.userId;
      const sessionId = (options as any)?.experimental_context?.sessionId;
      const userTier = (options as any)?.experimental_context?.userTier;
      const isDevelopment = process.env.NEXT_PUBLIC_APP_MODE === 'development';

      const startTime = Date.now();

      try {
        if (code.length > 10000) {
          return '🚫 **Error**: Code too long. Please limit your code to 10,000 characters.';
        }

        const daytonaApiKey = process.env.DAYTONA_API_KEY;
        if (!daytonaApiKey) {
          return '❌ **Configuration Error**: Daytona API key is not configured.';
        }

        const daytona = new Daytona({
          apiKey: daytonaApiKey,
          serverUrl: process.env.DAYTONA_API_URL,
          target: (process.env.DAYTONA_TARGET as any) || undefined,
        });

        let sandbox: any | null = null;
        try {
          sandbox = await daytona.create({ language: 'python' });
          const execution = await sandbox.process.codeRun(code);
          const executionTime = Date.now() - startTime;

          await track('Python Code Executed', {
            success: execution.exitCode === 0,
            codeLength: code.length,
            executionTime: executionTime,
            hasDescription: !!description,
          });

          if (userId && sessionId && userTier === 'pay_per_use' && execution.exitCode === 0 && !isDevelopment) {
            try {
              const polarTracker = new PolarEventTracker();
              await polarTracker.trackDaytonaUsage(userId, sessionId, executionTime, {
                codeLength: code.length,
                success: true,
                description: description || 'Code execution'
              });
            } catch (error) {
              console.error('[CodeExecution] Failed to track usage:', error);
            }
          }

          if (execution.exitCode !== 0) {
            return `❌ **Execution Error**: ${execution.result || 'Unknown error'}`;
          }

          return `🐍 **Python Code Execution**
${description ? `**Description**: ${description}\n` : ''}

\`\`\`python
${code}
\`\`\`

**Output:**
\`\`\`
${execution.result || '(No output produced)'}
\`\`\`

⏱️ **Execution Time**: ${executionTime}ms`;

        } finally {
          try {
            if (sandbox) {
              await sandbox.delete();
            }
          } catch (cleanupError) {
            console.error('[CodeExecution] Cleanup error:', cleanupError);
          }
        }
      } catch (error: any) {
        return `❌ **Error**: ${error.message || 'Unknown error occurred'}`;
      }
    },
  }),

  patentSearch: tool({
    description: `Search USPTO patents by technology, inventor, assignee, claims, or patent number. Returns real patent data including patent numbers, titles, abstracts, filing dates, inventors, and assignees.

IMPORTANT: When users ask for "examples" or multiple patents, use maxResults=15-20 to get comprehensive coverage. For single patent lookups, maxResults=5-10 is sufficient.`,
    inputSchema: z.object({
      query: z.string().describe('Patent search query (e.g., "solid-state battery manufacturing", "Tesla autonomous driving", "US11234567")'),
      maxResults: z.coerce.number().int().min(1).max(20).optional().default(15).describe('Maximum number of results (must be an integer between 1 and 20). Use 15-20 when user asks for "examples" or multiple patents. Default: 15'),
    }),
    execute: async ({ query, maxResults }, options) => {
      const userId = (options as any)?.experimental_context?.userId;
      const sessionId = (options as any)?.experimental_context?.sessionId;
      const userTier = (options as any)?.experimental_context?.userTier;
      const isDevelopment = process.env.NEXT_PUBLIC_APP_MODE === 'development';

      try {
        const apiKey = process.env.VALYU_API_KEY;
        if (!apiKey) {
          return "❌ Valyu API key not configured.";
        }
        const valyu = new Valyu(apiKey, "https://api.valyu.network/v1");

        // Try USPTO source - Valyu may use different source names, adjust if needed
        const response = await valyu.search(query, {
          maxNumResults: maxResults || 10,
          searchType: "proprietary",
          includedSources: ["valyu/valyu-uspto"], // Verify exact source name with Valyu docs
          relevanceThreshold: 0.4,
          isToolCall: true,
        });

        await track("Valyu API Call", {
          toolType: "patentSearch",
          query: query,
          resultCount: response?.results?.length || 0,
        });

        if (userId && sessionId && userTier === 'pay_per_use' && !isDevelopment) {
          try {
            const polarTracker = new PolarEventTracker();
            const valyuCostDollars = (response as any)?.total_deduction_dollars || 0;
            await polarTracker.trackValyuAPIUsage(userId, sessionId, "patentSearch", valyuCostDollars, {
              query,
              resultCount: response?.results?.length || 0,
              success: true,
            });
          } catch (error) {
            console.error('[PatentSearch] Failed to track usage:', error);
          }
        }

        return JSON.stringify({
          type: "patents",
          query: query,
          resultCount: response?.results?.length || 0,
          results: response?.results || [],
          favicon: 'https://www.uspto.gov/favicon.ico',
          displaySource: 'USPTO (via Valyu)'
        }, null, 2);
      } catch (error) {
        return `❌ Error searching patents: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  }),

  patentAnalysis: tool({
    description: "Deep dive into specific patents for detailed analysis including citations, patent families, legal status, and related patents. Use this for comprehensive patent research and competitive intelligence.",
    inputSchema: z.object({
      query: z.string().describe('Patent analysis query (e.g., "US11234567", "patent citations for solid-state battery", "patent family US11234567")'),
      maxResults: z.coerce.number().int().min(1).max(10).optional().default(5).describe('Maximum number of results (must be an integer between 1 and 10)'),
    }),
    execute: async ({ query, maxResults }, options) => {
      const userId = (options as any)?.experimental_context?.userId;
      const sessionId = (options as any)?.experimental_context?.sessionId;
      const userTier = (options as any)?.experimental_context?.userTier;
      const isDevelopment = process.env.NEXT_PUBLIC_APP_MODE === 'development';

      try {
        const apiKey = process.env.VALYU_API_KEY;
        if (!apiKey) {
          return "❌ Valyu API key not configured.";
        }
        const valyu = new Valyu(apiKey, "https://api.valyu.network/v1");

        // Search for patent details, citations, and related patents
        const response = await valyu.search(query, {
          maxNumResults: maxResults || 5,
          searchType: "proprietary",
          includedSources: ["valyu/valyu-uspto"], // May need to combine with web search for litigation/news
          relevanceThreshold: 0.5,
          isToolCall: true,
        });

        await track("Valyu API Call", {
          toolType: "patentAnalysis",
          query: query,
          resultCount: response?.results?.length || 0,
        });

        if (userId && sessionId && userTier === 'pay_per_use' && !isDevelopment) {
          try {
            const polarTracker = new PolarEventTracker();
            const valyuCostDollars = (response as any)?.total_deduction_dollars || 0;
            await polarTracker.trackValyuAPIUsage(userId, sessionId, "patentAnalysis", valyuCostDollars, {
              query,
              resultCount: response?.results?.length || 0,
              success: true,
            });
          } catch (error) {
            console.error('[PatentAnalysis] Failed to track usage:', error);
          }
        }

        return JSON.stringify({
          type: "patent_analysis",
          query: query,
          resultCount: response?.results?.length || 0,
          results: response?.results || [],
          favicon: 'https://www.uspto.gov/favicon.ico',
          displaySource: 'USPTO (via Valyu)'
        }, null, 2);
      } catch (error) {
        return `❌ Error analyzing patents: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  }),


  webSearch: tool({
    description: "Search the web for general information on any topic",
    inputSchema: z.object({
      query: z.string().describe('Search query for any topic'),
      maxResults: z.coerce.number().int().min(1).max(20).optional().default(5).describe('Maximum number of results (must be an integer between 1 and 20)'),
    }),
    execute: async ({ query, maxResults }, options) => {
      const userId = (options as any)?.experimental_context?.userId;
      const sessionId = (options as any)?.experimental_context?.sessionId;
      const userTier = (options as any)?.experimental_context?.userTier;
      const isDevelopment = process.env.NEXT_PUBLIC_APP_MODE === 'development';

      try {
        const valyu = new Valyu(process.env.VALYU_API_KEY, "https://api.valyu.network/v1");

        const response = await valyu.search(query, {
          searchType: "all" as const,
          maxNumResults: maxResults || 5,
          isToolCall: true,
        });

        await track("Valyu API Call", {
          toolType: "webSearch",
          query: query,
          resultCount: response?.results?.length || 0,
        });

        if (userId && sessionId && userTier === 'pay_per_use' && !isDevelopment) {
          try {
            const polarTracker = new PolarEventTracker();
            const valyuCostDollars = (response as any)?.total_deduction_dollars || 0;
            await polarTracker.trackValyuAPIUsage(userId, sessionId, "webSearch", valyuCostDollars, {
              query,
              resultCount: response?.results?.length || 0,
              success: true,
            });
          } catch (error) {
            console.error('[WebSearch] Failed to track usage:', error);
          }
        }

        return JSON.stringify({
          type: "web_search",
          query: query,
          resultCount: response?.results?.length || 0,
          results: response?.results || [],
        }, null, 2);
      } catch (error) {
        return `❌ Error performing web search: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  }),
};

// Export with both names for compatibility
export const healthcareTools = patentTools;
export const biomedicalTools = patentTools;
