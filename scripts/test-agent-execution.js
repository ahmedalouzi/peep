var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// packages/agent/src/tools/definitions.ts
var OPENAI_TOOLS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the full contents of a project file. Path is relative to project root or absolute.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path e.g. lib/main.dart" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "List files and directories at a path within the project.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: 'Directory path, use "." for project root' }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search for files by name within the project.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Filename search query" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_content",
      description: "Search for text content across project source files.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Text to search for" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "propose_file_edit",
      description: "Propose an edit to a file. Provide the complete new file content. User must approve before changes are applied.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to project root" },
          content: { type: "string", description: "Complete new file content" },
          description: { type: "string", description: "Brief description of the change" }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Run a shell/terminal command in the project root directory. Safe dev commands (flutter pub get, flutter analyze, npm install, etc.) run automatically. Destructive commands (rm -rf, git push --force, etc.) will require user confirmation. Returns stdout and stderr.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The exact shell command line string to execute" }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a single file from the project. Requires user confirmation for irreversible deletion.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to project root" },
          reason: { type: "string", description: "Why this file is being deleted" }
        },
        required: ["path", "reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "rename_file",
      description: "Rename or move a file within the project workspace.",
      parameters: {
        type: "object",
        properties: {
          oldPath: { type: "string", description: "Current file path relative to project root" },
          newPath: { type: "string", description: "New file path relative to project root" }
        },
        required: ["oldPath", "newPath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_design_manifest",
      description: "Create or update the project Design Manifest (.peep/design.json). Use this to establish or evolve the project's visual DNA (colors, typography, spacing, component styles, brand personality). Always call this before generating major UI for the first time.",
      parameters: {
        type: "object",
        properties: {
          manifest: {
            type: "object",
            description: "Full or partial DesignManifest object to merge into the existing manifest"
          }
        },
        required: ["manifest"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_plan",
      description: "Manage the structured execution plan for the current task. Always initialize a plan at the start of a complex task. Use this tool to track progress.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["init", "update_step", "add_step", "remove_step"], description: "The action to perform on the plan." },
          goal: { type: "string", description: "Overall goal (required for init)." },
          complexity: { type: "string", enum: ["simple", "medium", "complex"], description: "Task complexity (required for init)." },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                description: { type: "string" },
                status: { type: "string", enum: ["pending", "in_progress", "completed", "failed"] }
              },
              required: ["id", "description", "status"]
            },
            description: "List of initial steps (required for init)."
          },
          stepId: { type: "string", description: "ID of the step to update or remove." },
          status: { type: "string", enum: ["pending", "in_progress", "completed", "failed"], description: "New status for the step (for update_step)." },
          step: {
            type: "object",
            properties: {
              id: { type: "string" },
              description: { type: "string" },
              status: { type: "string", enum: ["pending", "in_progress", "completed", "failed"] }
            },
            description: "New step object (for add_step)."
          }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_memory",
      description: "Manage persistent long-term project memory. Use this to remember stable architectural decisions, design rules, or project conventions. Do NOT store temporary debugging details or specific tool calls.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["read", "add", "update", "remove"], description: "Action to perform." },
          category: { type: "string", enum: ["architecture", "conventions", "design", "preferences", "decisions"], description: "Category (for add)." },
          key: { type: "string", description: "Memory key or identifier (for add, update, remove)." },
          value: { type: "string", description: "Memory value (for add, update)." }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "validate_project",
      description: "Validate the project to verify compilation, lint rules, and types. Automatically runs tsc or flutter analyze based on framework. Call this to check if your code edits are correct.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "bootstrap_project",
      description: "Initialize a new project in an empty folder. Scaffolds framework templates in-place.",
      parameters: {
        type: "object",
        properties: {
          framework: { type: "string", enum: ["react-native", "flutter"], description: "Framework choice" },
          environment: { type: "string", enum: ["managed", "local"], description: "Environment type" },
          template: { type: "string", description: "Template identifier" }
        },
        required: ["framework", "environment"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "install_dependencies",
      description: "Install npm or pub packages automatically. Resolves packages in the workspace.",
      parameters: {
        type: "object",
        properties: {
          packages: {
            type: "array",
            items: { type: "string" },
            description: "List of packages to install"
          }
        },
        required: ["packages"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "build_project",
      description: "Build the application using the framework builder. Resolves platform output (e.g. apk, dist).",
      parameters: {
        type: "object",
        properties: {
          platform: { type: "string", enum: ["android", "ios", "web"], description: "Platform target to build" }
        },
        required: ["platform"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_tests",
      description: "Run the project test suite if configured. Automatically runs flutter test or npm run test.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "start_app",
      description: "Start the application preview in the background. Returns the process identifier and local preview url.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "stop_app",
      description: "Stop the active application process started by Synkro.",
      parameters: {
        type: "object",
        properties: {
          processId: { type: "number", description: "Process identifier to kill" }
        },
        required: ["processId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_process_status",
      description: "Get the status (running, crashed, stopped) and started metrics of an active process.",
      parameters: {
        type: "object",
        properties: {
          processId: { type: "number", description: "Process identifier to query" }
        },
        required: ["processId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_runtime_logs",
      description: "Fetch process logs (stdout/stderr) and check for errors or crash stacks.",
      parameters: {
        type: "object",
        properties: {
          processId: { type: "number", description: "Process identifier to fetch logs from" }
        },
        required: ["processId"]
      }
    }
  }
];

// packages/agent/src/models/registry.ts
var ModelRegistry = class {
  models = /* @__PURE__ */ new Map();
  constructor() {
    this.registerDefaults();
  }
  registerDefaults() {
    this.register({
      provider: "openai",
      modelId: "gpt-4o",
      capabilities: { reasoning: 9, coding: 9, debugging: 9, ui_generation: 8, vision: 9, speed: 6 },
      contextWindow: 128e3,
      costInput: 5,
      costOutput: 15,
      tier: "strong"
    });
    this.register({
      provider: "openai",
      modelId: "gpt-4o-mini",
      capabilities: { reasoning: 6, coding: 5, debugging: 5, ui_generation: 4, vision: 7, speed: 9 },
      contextWindow: 128e3,
      costInput: 0.15,
      costOutput: 0.6,
      tier: "fast"
    });
    this.register({
      provider: "google",
      modelId: "gemini-1.5-pro",
      capabilities: { reasoning: 9, coding: 9, debugging: 9, ui_generation: 8, vision: 9, speed: 6 },
      contextWindow: 2e6,
      costInput: 1.25,
      costOutput: 5,
      tier: "strong"
    });
    this.register({
      provider: "google",
      modelId: "gemini-1.5-flash",
      capabilities: { reasoning: 7, coding: 6, debugging: 6, ui_generation: 5, vision: 8, speed: 9 },
      contextWindow: 1e6,
      costInput: 0.075,
      costOutput: 0.3,
      tier: "fast"
    });
    this.register({
      provider: "anthropic",
      modelId: "claude-3-5-sonnet",
      capabilities: { reasoning: 10, coding: 10, debugging: 10, ui_generation: 9, vision: 8, speed: 7 },
      contextWindow: 2e5,
      costInput: 3,
      costOutput: 15,
      tier: "strong"
    });
  }
  register(profile) {
    this.models.set(profile.modelId.toLowerCase(), profile);
  }
  get(modelId) {
    return this.models.get(modelId.toLowerCase());
  }
  findBestModel(provider, requirements) {
    const available = Array.from(this.models.values()).filter((m) => m.provider === provider);
    if (available.length === 0) {
      throw new Error(`No models registered for provider: ${provider}`);
    }
    let candidates = available;
    if (requirements.tier) {
      candidates = available.filter((m) => m.tier === requirements.tier || requirements.tier === "strong" && m.tier === "ultra");
    }
    if (candidates.length === 0) candidates = available;
    candidates.sort((a, b) => {
      const costA = a.costInput + a.costOutput;
      const costB = b.costInput + b.costOutput;
      return costA - costB;
    });
    return candidates[0];
  }
};

// packages/agent/src/models/classifier.ts
var TaskClassifier = class {
  /**
   * Extremely fast heuristic-based classifier for the current agent iteration step.
   * This determines what model should handle the current sequence of messages.
   */
  static classify(messages, isInitialPlanning) {
    if (isInitialPlanning) {
      return { category: "architecture_planning", complexity: "high" };
    }
    const recent = messages.slice(-5);
    const recentContent = recent.map((m) => m.content || "").join(" ").toLowerCase();
    if (recentContent.includes("error:") || recentContent.includes("exception") || recentContent.includes("failed to compile")) {
      if (recentContent.includes("build failed") || recentContent.includes("compile error")) {
        return { category: "build_error_analysis", complexity: "high" };
      }
      return { category: "runtime_error_analysis", complexity: "high" };
    }
    const recentToolCalls = recent.filter((m) => m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0);
    if (recentToolCalls.length > 0) {
      const lastTools = recentToolCalls[recentToolCalls.length - 1].tool_calls || [];
      const hasEdits = lastTools.some((t) => t.function.name === "propose_file_edit" || t.function.name === "multi_replace_file_content");
      if (hasEdits) {
        if (lastTools.length > 2) return { category: "multi_file_refactor", complexity: "high" };
        return { category: "code_generation", complexity: "medium" };
      }
      const hasSearch = lastTools.some((t) => t.function.name === "search_files" || t.function.name === "search_content" || t.function.name === "list_dir");
      if (hasSearch) {
        return { category: "code_search", complexity: "low" };
      }
    }
    return { category: "project_exploration", complexity: "low" };
  }
};

// packages/agent/src/models/router.ts
var ModelOrchestrator = class {
  registry;
  constructor() {
    this.registry = new ModelRegistry();
  }
  route(context) {
    if (context.isManualMode && context.manualModel) {
      const selected = context.manualModel;
      const profile = this.registry.get(selected);
      return {
        selectedModel: selected,
        actualModel: selected,
        provider: context.provider,
        isFallback: false,
        reason: "Manual mode explicitly requested this model.",
        estimatedCostMultiplier: profile ? profile.costInput + profile.costOutput : 1
      };
    }
    let targetTier = "fast";
    if (context.task.complexity === "high" || context.task.complexity === "critical" || context.task.category === "architecture_planning" || context.task.category === "multi_file_refactor" || context.task.category === "build_error_analysis" || context.task.category === "runtime_error_analysis") {
      targetTier = "strong";
    }
    const selectedProfile = this.registry.findBestModel(context.provider, { tier: targetTier });
    return {
      selectedModel: "auto",
      actualModel: selectedProfile.modelId,
      provider: context.provider,
      isFallback: false,
      reason: `Auto-routed to ${selectedProfile.modelId} based on task category [${context.task.category}] and complexity [${context.task.complexity}]. Tier chosen: ${targetTier}.`,
      estimatedCostMultiplier: selectedProfile.costInput + selectedProfile.costOutput
    };
  }
};

// packages/agent/src/models/auth.ts
var import_crypto = __toESM(require("crypto"), 1);
var import_util = require("util");
var scryptAsync = (0, import_util.promisify)(import_crypto.default.scrypt);
var randomBytesAsync = (0, import_util.promisify)(import_crypto.default.randomBytes);

// packages/agent/src/design/task-state.ts
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
async function loadAgentTaskState(projectRoot) {
  try {
    const filePath = (0, import_node_path.join)(projectRoot, ".peep", "task-state.json");
    const raw = await (0, import_promises.readFile)(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function saveAgentTaskState(projectRoot, state) {
  try {
    const dirPath = (0, import_node_path.join)(projectRoot, ".peep");
    await (0, import_promises.mkdir)(dirPath, { recursive: true });
    const filePath = (0, import_node_path.join)(dirPath, "task-state.json");
    await (0, import_promises.writeFile)(filePath, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
  }
}

// packages/agent/src/design/design-reviewer.ts
var DesignReviewer = class {
  static evaluateUI(fileContent, filepath, manifest) {
    const faults = [];
    const lines = fileContent.split("\n");
    const hexRegex = /#([0-9a-fA-F]{3,6})\b/g;
    const allowedColors = [
      manifest.colors.primary.toLowerCase(),
      manifest.colors.secondary.toLowerCase(),
      manifest.colors.accent.toLowerCase(),
      manifest.colors.background.toLowerCase(),
      manifest.colors.surface.toLowerCase(),
      "#ffffff",
      "#000000",
      "#fff",
      "#000",
      "transparent"
    ];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || "";
      let match;
      while ((match = hexRegex.exec(line)) !== null) {
        const hex = match[0].toLowerCase();
        if (!allowedColors.includes(hex)) {
          faults.push({
            severity: "medium",
            category: "color_consistency",
            file: filepath,
            line: i + 1,
            description: `Hardcoded color '${hex}' detected. Use manifest color tokens instead: primary ('${manifest.colors.primary}'), accent ('${manifest.colors.accent}'), background ('${manifest.colors.background}').`,
            suggestedFix: `Replace '${hex}' with Design DNA token references.`
          });
        }
      }
    }
    const contentLower = fileContent.toLowerCase();
    if (filepath.endsWith("App.tsx") || filepath.includes("screen") || filepath.includes("page")) {
      if (!contentLower.includes("load") && !contentLower.includes("activityindicator") && !contentLower.includes("spinner")) {
        faults.push({
          severity: "high",
          category: "missing_states",
          file: filepath,
          description: "No loading state handler (e.g. ActivityIndicator or 'loading' variable) detected in user-facing view.",
          suggestedFix: "Inject a 'loading' visual state handler or spinner."
        });
      }
      if (!contentLower.includes("error") && !contentLower.includes("fail") && !contentLower.includes("wrong")) {
        faults.push({
          severity: "high",
          category: "missing_states",
          file: filepath,
          description: "No error state boundaries or descriptive warning visuals found.",
          suggestedFix: "Implement error handling states in visual composition."
        });
      }
      if (!contentLower.includes("empty") && !contentLower.includes("no reservation") && !contentLower.includes("none")) {
        faults.push({
          severity: "medium",
          category: "missing_states",
          file: filepath,
          description: "Missing empty states handling for collections or lists.",
          suggestedFix: "Add a placeholder screen or conditional view for empty datasets."
        });
      }
    }
    const spacingRegex = /(?:margin|padding)(?:Top|Bottom|Left|Right|Horizontal|Vertical)?\s*:\s*(\d+)/g;
    const allowedScale = manifest.spacing.scale;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || "";
      let match;
      while ((match = spacingRegex.exec(line)) !== null) {
        const val = parseInt(match[1] || "0", 10);
        if (val > 0 && !allowedScale.includes(val)) {
          faults.push({
            severity: "low",
            category: "spacing_scale",
            file: filepath,
            line: i + 1,
            description: `Spacing value '${val}' does not match Design DNA scale: [${allowedScale.join(", ")}].`,
            suggestedFix: `Adjust spacing value to the nearest scale unit (e.g. 8, 12, 16, 24).`
          });
        }
      }
    }
    return faults;
  }
};

// packages/agent/src/design/design-retrieval.ts
var import_promises2 = require("node:fs/promises");
var import_node_path2 = require("node:path");
async function loadDesignManifest(projectRoot) {
  try {
    const filePath = (0, import_node_path2.join)(projectRoot, ".peep", "design.json");
    const raw = await (0, import_promises2.readFile)(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// packages/agent/src/orchestrator.ts
var getApiUrl = (config) => {
  if (config.provider === "google") {
    return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  }
  return "https://api.openai.com/v1/chat/completions";
};
var modelOrchestrator = new ModelOrchestrator();
function estimateTokens(text) {
  return Math.ceil((text || "").length / 4);
}
function calculateCost(model, inputTokens, outputTokens) {
  let inputRate = 0;
  let outputRate = 0;
  const m = model.toLowerCase();
  if (m.includes("gemini-3.5-flash") || m.includes("gemini-1.5-flash")) {
    inputRate = 0.075 / 1e6;
    outputRate = 0.3 / 1e6;
  } else if (m.includes("gemini-1.5-pro")) {
    inputRate = 1.25 / 1e6;
    outputRate = 5 / 1e6;
  } else if (m.includes("gpt-4o-mini")) {
    inputRate = 0.15 / 1e6;
    outputRate = 0.6 / 1e6;
  } else if (m.includes("gpt-4o")) {
    inputRate = 5 / 1e6;
    outputRate = 15 / 1e6;
  } else {
    inputRate = 0.15 / 1e6;
    outputRate = 0.6 / 1e6;
  }
  const cost = inputTokens * inputRate + outputTokens * outputRate;
  return { inputTokens, outputTokens, cost };
}
async function callOpenAI(config, messages, signal, decision) {
  const model = decision.actualModel;
  if (config.gateway) {
    const tier = model.includes("pro") || model.includes("sonnet") ? "premium" : model.includes("gpt-4o") ? "reasoning" : "fast";
    const prompt = messages[messages.length - 1]?.content || "";
    const systemPrompt = messages.find((m) => m.role === "system")?.content || "";
    const history = messages.slice(0, messages.length - 1).map((m) => ({ role: m.role, content: m.content }));
    const response2 = await config.gateway.generate({
      tier,
      prompt,
      systemPrompt,
      history,
      tools: OPENAI_TOOLS
    }, { signal });
    const assistantMessage2 = {
      role: "assistant",
      content: response2.content,
      tool_calls: response2.toolCalls?.map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.name,
          arguments: typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments)
        }
      }))
    };
    const usage2 = {
      inputTokens: response2.usage?.inputTokens || 0,
      outputTokens: response2.usage?.outputTokens || 0,
      cost: response2.cost?.cost || 0
    };
    return { message: assistantMessage2, usage: usage2, model };
  }
  const cleanKey = (config.apiKey || "").replace(/[^\x20-\x7E]/g, "");
  console.log(`[AGENT_DEBUG] available tools: [${OPENAI_TOOLS.map((t) => t.function.name).join(", ")}]`);
  const response = await fetch(getApiUrl(config), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cleanKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => {
        if (m.role === "tool") {
          return { role: "tool", content: m.content, tool_call_id: m.tool_call_id, name: m.name || "tool_name" };
        }
        if (m.role === "assistant" && m.tool_calls) {
          return { role: "assistant", content: m.content || null, tool_calls: m.tool_calls };
        }
        return { role: m.role, content: m.content };
      }),
      tools: OPENAI_TOOLS,
      tool_choice: "auto"
    }),
    signal
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `${config.provider} API error ${response.status}`);
  }
  const data = await response.json();
  const assistantMessage = data.choices[0]?.message ?? { role: "assistant", content: "No response." };
  const isToolCall = assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0;
  console.log(`[AGENT_DEBUG] model response type: ${isToolCall ? "tool_call" : "text"}`);
  let inputTokens = data.usage?.prompt_tokens;
  let outputTokens = data.usage?.completion_tokens;
  if (inputTokens === void 0 || outputTokens === void 0) {
    const promptText = JSON.stringify(messages);
    const completionText = assistantMessage.content || JSON.stringify(assistantMessage.tool_calls || "");
    inputTokens = estimateTokens(promptText);
    outputTokens = estimateTokens(completionText);
  }
  const usage = calculateCost(model, inputTokens, outputTokens);
  return { message: assistantMessage, usage, model };
}
async function streamOpenAISummary(config, messages, callbacks, signal, decision) {
  const model = decision.actualModel;
  if (config.gateway) {
    const tier = model.includes("pro") || model.includes("sonnet") ? "premium" : model.includes("gpt-4o") ? "reasoning" : "fast";
    const prompt = messages[messages.length - 1]?.content || "";
    const systemPrompt = messages.find((m) => m.role === "system")?.content || "";
    const history = messages.slice(0, messages.length - 1).map((m) => ({ role: m.role, content: m.content }));
    const stream = config.gateway.stream({
      tier,
      prompt,
      systemPrompt,
      history
    }, { signal });
    let fullText2 = "";
    for await (const event of stream) {
      if (event.type === "delta" && event.content) {
        fullText2 += event.content;
        callbacks.onDelta(event.content);
      }
    }
    return fullText2;
  }
  const cleanKey = (config.apiKey || "").replace(/[^\x20-\x7E]/g, "");
  const response = await fetch(getApiUrl(config), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cleanKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => {
        if (m.role === "tool") {
          return { role: "tool", content: m.content, tool_call_id: m.tool_call_id, name: m.name || "tool_name" };
        }
        if (m.role === "assistant" && m.tool_calls) {
          return { role: "assistant", content: m.content || null, tool_calls: m.tool_calls };
        }
        return { role: m.role, content: m.content };
      }),
      stream: true
    }),
    signal
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `OpenAI API error ${response.status}`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response stream");
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          callbacks.onDelta(delta);
        }
      } catch {
      }
    }
  }
  const promptText = JSON.stringify(messages);
  const inputTokens = estimateTokens(promptText);
  const outputTokens = estimateTokens(fullText);
  const usage = calculateCost(model, inputTokens, outputTokens);
  if (callbacks.onActivity) {
    callbacks.onActivity({
      provider: decision.provider,
      selectedModel: decision.selectedModel,
      actualModel: decision.actualModel,
      task: "Summarizing",
      iteration: 1,
      maxIterations: 1,
      inputTokens,
      outputTokens,
      estimatedCost: usage.cost
    });
  }
  return fullText;
}
async function executeToolCalls(toolCalls, executor, callbacks) {
  const results = [];
  for (const call of toolCalls) {
    const name = call.function.name;
    let args = {};
    try {
      args = JSON.parse(call.function.arguments);
    } catch {
    }
    let statusMsg = `Running ${name}\u2026`;
    if (name === "read_file") {
      statusMsg = `Reading: ${args.path || ""}`;
    } else if (name === "propose_file_edit") {
      statusMsg = `Editing: ${args.path || ""}`;
    } else if (name === "search_files") {
      statusMsg = `Searching files: "${args.query || ""}"`;
    } else if (name === "search_content") {
      statusMsg = `Searching codebase: "${args.query || ""}"`;
    } else if (name === "list_dir") {
      statusMsg = `Exploring: ${args.path || "."}`;
    } else if (name === "run_command") {
      statusMsg = `Running: ${args.command || ""}`;
    } else if (name === "delete_file") {
      statusMsg = `Deleting: ${args.path || ""}`;
    } else if (name === "rename_file") {
      statusMsg = `Renaming: ${args.oldPath || ""} \u2192 ${args.newPath || ""}`;
    } else if (name === "update_design_manifest") {
      statusMsg = `Updating Design Manifest\u2026`;
    } else if (name === "manage_memory") {
      statusMsg = `Memory ${args.action}: ${args.key || args.category || ""}`;
    }
    callbacks.onStatus(statusMsg);
    console.log(`[AGENT_DEBUG] tool requested: ${name}`);
    console.log(`[AGENT_DEBUG] executing tool: ${name}`);
    try {
      const output = await executor.execute(name, args);
      console.log(`[AGENT_DEBUG] tool result: ${output.substring(0, 150).replace(/\n/g, " ")}...`);
      results.push({ role: "tool", tool_call_id: call.id, name, content: output });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[AGENT_DEBUG] tool result: Error: ${message.substring(0, 150)}`);
      results.push({ role: "tool", tool_call_id: call.id, name, content: `Error: ${message}` });
    }
  }
  return results;
}
function getDiffStats(original, proposed) {
  const origLines = (original || "").split(/\r?\n/);
  const propLines = (proposed || "").split(/\r?\n/);
  let added = 0;
  let removed = 0;
  const origSet = new Set(origLines);
  for (const line of propLines) {
    if (line.trim() && !origSet.has(line)) added++;
  }
  const propSet = new Set(propLines);
  for (const line of origLines) {
    if (line.trim() && !propSet.has(line)) removed++;
  }
  return { added, removed };
}
async function runAgentLoop(config, systemContext, initialMessages, executor, callbacks, signal, isComplex, projectPath) {
  if (config.provider !== "openai" && config.provider !== "google") {
    throw new Error("Only OpenAI and Google Gemini providers are supported in this version. Set provider in Settings.");
  }
  const startTime = Date.now();
  let toolLogs = "";
  let maxIterations = isComplex ? 30 : 15;
  let totalCost = 0;
  const MAX_COST = 0.5;
  let previousToolCallsString = "";
  let repeatedToolCount = 0;
  let consecutiveErrors = 0;
  let lastValidationErrorSignature = "";
  let lastRuntimeErrorSignature = "";
  let consecutiveRuntimeErrors = 0;
  let taskState = {
    taskId: Math.random().toString(36).substring(7),
    currentState: "UNDERSTAND",
    modifiedFiles: [],
    retryCount: 0,
    lastUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (projectPath) {
    const loadedState = await loadAgentTaskState(projectPath);
    if (loadedState) {
      taskState = loadedState;
      taskState.retryCount++;
    } else {
      await saveAgentTaskState(projectPath, taskState);
    }
  }
  let activeContext = systemContext;
  if (isComplex) {
    activeContext += `

[PLANNING MODE ACTIVE] You are faced with a complex software engineering task.
Before calling any other tools, you MUST invoke \`manage_plan\` with action="init" to create a structured execution plan.
As you progress, use \`manage_plan\` (update_step, add_step, remove_step) to keep the plan synchronized with your actual progress.
The plan must be adaptive. If you discover new information, update the plan before continuing.`;
  }
  activeContext += `

[TASK STATE MACHINE] The current lifecycle state is: **${taskState.currentState}**. Use the appropriate tools for this state.`;
  const messages = [
    { role: "system", content: activeContext },
    ...initialMessages
  ];
  for (let i = 0; i < maxIterations; i++) {
    if (signal.aborted) throw new Error("Cancelled");
    if (totalCost > MAX_COST) throw new Error(`Budget exceeded (max $${MAX_COST} per task). Stopping to prevent run-away costs.`);
    const taskClass = TaskClassifier.classify(messages, i === 0);
    const decision = modelOrchestrator.route({
      task: taskClass,
      availableBudget: MAX_COST - totalCost,
      isManualMode: !!(config.model && config.model.toLowerCase() !== "auto"),
      manualModel: config.model,
      provider: config.provider
    });
    callbacks.onStatus(i === 0 ? `Thinking\u2026 [${decision.actualModel}]` : `Continuing\u2026 [${decision.actualModel}]`);
    const { message: assistantMessage, usage } = await callOpenAI(config, messages, signal, decision);
    totalCost += usage.cost;
    if (callbacks.onActivity) {
      callbacks.onActivity({
        provider: config.provider,
        selectedModel: decision.selectedModel,
        actualModel: decision.actualModel,
        task: `[${taskClass.category}] (${taskClass.complexity})`,
        iteration: i + 1,
        maxIterations,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimatedCost: totalCost
      });
    }
    const currentToolCallsString = JSON.stringify(assistantMessage.tool_calls || []);
    if (currentToolCallsString !== "[]" && currentToolCallsString === previousToolCallsString) {
      repeatedToolCount++;
      if (repeatedToolCount >= 2) {
        throw new Error("Agent appears to be stuck in a loop repeating the exact same action. Stopping for safety.");
      }
    } else {
      repeatedToolCount = 0;
      previousToolCallsString = currentToolCallsString;
    }
    if (assistantMessage.content) {
      callbacks.onStatus(assistantMessage.content.trim());
    }
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      for (const call of assistantMessage.tool_calls) {
        const name = call.function.name;
        let args = {};
        try {
          args = JSON.parse(call.function.arguments);
        } catch {
        }
        if (name === "read_file") {
          toolLogs += `Reading <code>${args.path || ""}</code>.<br/>`;
        } else if (name === "propose_file_edit") {
          toolLogs += `Editing <code>${args.path || ""}</code> \u2014 ${args.description || "applying changes"}.<br/>`;
        } else if (name === "search_files") {
          toolLogs += `Searching files: <code>"${args.query || ""}"</code>.<br/>`;
        } else if (name === "list_dir") {
          toolLogs += `Exploring directory: <code>${args.path || "."}</code>.<br/>`;
        } else if (name === "search_content") {
          toolLogs += `Searching codebase: <code>"${args.query || ""}"</code>.<br/>`;
        } else if (name === "run_command") {
          toolLogs += `Running command: <code>${args.command || ""}</code>.<br/>`;
        } else if (name === "delete_file") {
          toolLogs += `Deleting file: <code>${args.path || ""}</code>.<br/>`;
        } else if (name === "rename_file") {
          toolLogs += `Renaming: <code>${args.oldPath || ""}</code> \u2192 <code>${args.newPath || ""}</code>.<br/>`;
        } else if (name === "update_design_manifest") {
          toolLogs += `Updating Design Manifest (Design DNA).<br/>`;
        } else if (name === "manage_plan") {
          toolLogs += `Managing execution plan (${args.action}).<br/>`;
        } else if (name === "validate_project") {
          toolLogs += `Validating project workspace...<br/>`;
        } else if (name === "build_project") {
          toolLogs += `Building project for platform: <code>${args.platform || ""}</code>...<br/>`;
        } else if (name === "run_tests") {
          toolLogs += `Running unit test suite...<br/>`;
        } else if (name === "start_app") {
          toolLogs += `Starting application instance...<br/>`;
        } else if (name === "stop_app") {
          toolLogs += `Stopping application process <code>${args.processId || ""}</code>...<br/>`;
        } else if (name === "get_process_status") {
          toolLogs += `Querying status of process <code>${args.processId || ""}</code>...<br/>`;
        } else if (name === "get_runtime_logs") {
          toolLogs += `Fetching runtime logs of process <code>${args.processId || ""}</code>...<br/>`;
        }
      }
      messages.push(assistantMessage);
      const toolResults = await executeToolCalls(assistantMessage.tool_calls, executor, callbacks);
      messages.push(...toolResults);
      let validationErrorSignature = "";
      let hasValidationFailure = false;
      let runtimeErrorSignature = "";
      let hasRuntimeFailure = false;
      for (const res of toolResults) {
        if (res.name === "validate_project") {
          try {
            const parsed = JSON.parse(res.content || "{}");
            if (parsed && parsed.success === false) {
              hasValidationFailure = true;
              const errorMsgs = (parsed.checks || []).flatMap(
                (c) => (c.errors || []).map((e) => e.message || "")
              );
              validationErrorSignature = errorMsgs.join("|") || parsed.message || "unknown";
            }
          } catch {
          }
        } else if (res.name === "get_runtime_logs") {
          try {
            const parsed = JSON.parse(res.content || "{}");
            if (parsed && parsed.detectedErrors && parsed.detectedErrors.length > 0) {
              hasRuntimeFailure = true;
              const errorMsgs = parsed.detectedErrors.map((e) => e.message || "");
              runtimeErrorSignature = errorMsgs.join("|");
            }
          } catch {
          }
        } else if (res.name && ["start_app", "install_dependencies", "build_project", "run_tests", "bootstrap_project"].includes(res.name)) {
          try {
            const parsed = JSON.parse(res.content || "{}");
            if (parsed && parsed.success === false) {
              hasRuntimeFailure = true;
              runtimeErrorSignature = parsed.message || `Failed to execute ${res.name}`;
            }
          } catch {
          }
        }
      }
      const resultString = toolResults.map((r) => r.content || "").join("\n");
      if (resultString.includes("Active compilation/analysis diagnostics after this change:") || resultString.includes("Active React Native TS/ESLint diagnostics") || hasValidationFailure) {
        if (hasValidationFailure && validationErrorSignature && validationErrorSignature === lastValidationErrorSignature) {
          consecutiveErrors++;
        } else if (hasValidationFailure) {
          consecutiveErrors = 1;
          lastValidationErrorSignature = validationErrorSignature;
        } else {
          consecutiveErrors++;
        }
        if (consecutiveErrors >= 3) {
          throw new Error("I attempted to automatically fix the issue, but the same validation error persists. Stopping for user review.");
        }
      } else {
        consecutiveErrors = 0;
        lastValidationErrorSignature = "";
      }
      if (assistantMessage.tool_calls) {
        for (const call of assistantMessage.tool_calls) {
          const name = call.function.name;
          let args = {};
          try {
            args = JSON.parse(call.function.arguments);
          } catch {
          }
          if (name === "manage_plan" && args.action === "init") {
            taskState.currentState = "PLAN";
          } else if (name === "bootstrap_project") {
            taskState.currentState = "DESIGN";
          } else if (name === "update_design_manifest") {
            taskState.currentState = "IMPLEMENT";
          } else if (name === "propose_file_edit") {
            taskState.currentState = "IMPLEMENT";
            const filePath = String(args.path);
            if (!taskState.modifiedFiles.includes(filePath)) {
              taskState.modifiedFiles.push(filePath);
            }
          } else if (name === "install_dependencies") {
            taskState.currentState = "INSTALL";
          } else if (name === "start_app") {
            taskState.currentState = "RUN";
          } else if (name === "validate_project") {
            taskState.currentState = "VALIDATE";
          }
        }
      }
      if (hasValidationFailure || hasRuntimeFailure) {
        taskState.currentState = "DEBUG";
      } else if (taskState.currentState === "VALIDATE") {
        if (taskState.modifiedFiles.length > 0) {
          taskState.currentState = "UI_REVIEW";
        } else {
          taskState.currentState = "FINAL_VERIFY";
        }
      }
      if (hasRuntimeFailure) {
        toolLogs += `\u26A0\uFE0F Runtime error detected! Message: <code>${runtimeErrorSignature}</code>. Analyzing stack trace...<br/>`;
        if (runtimeErrorSignature && runtimeErrorSignature === lastRuntimeErrorSignature) {
          consecutiveRuntimeErrors++;
        } else {
          consecutiveRuntimeErrors = 1;
          lastRuntimeErrorSignature = runtimeErrorSignature;
        }
        if (consecutiveRuntimeErrors >= 3) {
          throw new Error("I attempted to automatically fix the runtime issue, but the same runtime error persists. Stopping for user review.");
        }
      } else {
        consecutiveRuntimeErrors = 0;
        lastRuntimeErrorSignature = "";
      }
      if (projectPath) {
        await saveAgentTaskState(projectPath, taskState);
      }
      if (projectPath && taskState.currentState === "UI_REVIEW") {
        const manifest = await loadDesignManifest(projectPath);
        if (manifest) {
          let allFaults = [];
          for (const file of taskState.modifiedFiles) {
            try {
              const content = await executor.execute("read_file", { path: file });
              if (content && !content.startsWith("Error:")) {
                const faults = DesignReviewer.evaluateUI(content, file, manifest);
                allFaults.push(...faults);
              }
            } catch {
            }
          }
          const criticalHighFaults = allFaults.filter((f) => f.severity === "critical" || f.severity === "high");
          if (criticalHighFaults.length > 0) {
            taskState.currentState = "IMPROVE";
            await saveAgentTaskState(projectPath, taskState);
            toolLogs += `\u{1F3A8} UI Review detected ${criticalHighFaults.length} high-severity design faults. Injected into context for improvements.<br/>`;
            messages.push({
              role: "user",
              content: `[UI QUALITY REVIEW FAULT] The UI Quality Reviewer detected the following faults that violate our Design DNA:
` + criticalHighFaults.map((f) => `- [${f.severity.toUpperCase()}] ${f.category} in ${f.file}${f.line ? ":" + f.line : ""}: ${f.description} (Suggested Fix: ${f.suggestedFix})`).join("\n") + `
Please modify the code files to resolve these issues. Do not claim the task is complete until these are fixed.`
            });
            continue;
          } else {
            taskState.currentState = "FINAL_VERIFY";
            await saveAgentTaskState(projectPath, taskState);
          }
        } else {
          taskState.currentState = "FINAL_VERIFY";
          await saveAgentTaskState(projectPath, taskState);
        }
      }
      for (let j = 0; j < assistantMessage.tool_calls.length; j++) {
        const call = assistantMessage.tool_calls[j];
        const name = call.function.name;
        let args = {};
        try {
          args = JSON.parse(call.function.arguments);
        } catch {
        }
        if (name === "read_file") {
          toolLogs += `Explored 1 file &gt;<br/><br/>`;
        } else if (name === "propose_file_edit") {
          const original = executor.lastOriginalContent ?? "";
          const proposed = args.content ? String(args.content) : "";
          const stats = getDiffStats(original, proposed);
          const filename = String(args.path).split(/[\\/]/).pop() || "";
          toolLogs += `Edited <strong>TS</strong> <code>${filename}</code> <span style="color:#3fb950">+${stats.added}</span> <span style="color:#f85149">-${stats.removed}</span><br/><br/>`;
        }
      }
      toolLogs += "Working.<br/><br/>";
      continue;
    }
    const text = assistantMessage.content?.trim();
    if (text) {
      if (toolLogs) {
        const duration = ((Date.now() - startTime) / 1e3).toFixed(1);
        const logsBlock = `<details class="agent-activity-dropdown" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; outline: none; display: block; width: 100%;">
<summary style="cursor: pointer; font-weight: 600; font-size: 12.5px; color: var(--gold); user-select: none; outline: none; list-style: none; display: flex; align-items: center; gap: 6px;">
  <span>\u25B6</span> Worked for ${duration}s
</summary>
<div style="margin-top: 8px; font-size: 11.5px; line-height: 1.6; color: #8b949e; border-left: 2px solid var(--border); padding-left: 8px;">
  ${toolLogs}
</div>
</details>

`;
        callbacks.onDelta(logsBlock + text);
        callbacks.onDone();
        return logsBlock + text;
      } else {
        callbacks.onDelta(text);
        callbacks.onDone();
        return text;
      }
    }
    break;
  }
  let prefix = "";
  if (toolLogs) {
    const duration = ((Date.now() - startTime) / 1e3).toFixed(1);
    prefix = `<details class="agent-activity-dropdown" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; outline: none; display: block; width: 100%;">
<summary style="cursor: pointer; font-weight: 600; font-size: 12.5px; color: var(--gold); user-select: none; outline: none; list-style: none; display: flex; align-items: center; gap: 6px;">
  <span>\u25B6</span> Worked for ${duration}s
</summary>
<div style="margin-top: 8px; font-size: 11.5px; line-height: 1.6; color: #8b949e; border-left: 2px solid var(--border); padding-left: 8px;">
  ${toolLogs}
</div>
</details>

`;
    callbacks.onDelta(prefix);
  }
  callbacks.onStatus("Summarizing changes\u2026");
  const summary = await streamOpenAISummary(
    config,
    [
      ...messages,
      {
        role: "user",
        content: "Summarize what you did and what the user should review. Be concise."
      }
    ],
    callbacks,
    signal,
    modelOrchestrator.route({
      task: { category: "summarization", complexity: "low" },
      availableBudget: MAX_COST - totalCost,
      isManualMode: !!(config.model && config.model.toLowerCase() !== "auto"),
      manualModel: config.model,
      provider: config.provider
    })
  );
  callbacks.onDone();
  return prefix + summary;
}

// scripts/test-agent-execution.ts
var import_node_fs = require("node:fs");
async function runTest() {
  console.log("--- Starting Agent Execution Test ---");
  const storePath = "C:\\Users\\Administrator\\AppData\\Roaming\\@peep\\desktop\\peep-store.json";
  let apiKey = process.env.GEMINI_API_KEY || "";
  let provider = "google";
  let model = "gemini-3.5-flash";
  try {
    const raw = (0, import_node_fs.readFileSync)(storePath, "utf8");
    const data = JSON.parse(raw);
    if (data.settings) {
      if (data.settings.apiKey) {
        apiKey = data.settings.apiKey;
      }
      if (data.settings.apiProvider) provider = data.settings.apiProvider;
      if (data.settings.apiModel) model = data.settings.apiModel;
    }
  } catch (err) {
    console.log("Could not load peep-store.json", err);
  }
  if (!apiKey) {
    console.error("No API key found in peep-store.json. Please ensure it is set.");
    return;
  }
  console.log(`Using provider: ${provider}, model: ${model}`);
  const executor = {
    execute: async (name, args) => {
      console.log(`[TEST_EXECUTOR] Executing tool: ${name} with args:`, args);
      if (name === "run_command") {
        const { execSync } = require("child_process");
        try {
          const out = execSync(args.command, { cwd: args.cwd || process.cwd() });
          return out.toString();
        } catch (e) {
          return e.message;
        }
      }
      return "Mock success";
    }
  };
  const callbacks = {
    onStatus: (msg) => console.log(`[STATUS] ${msg}`),
    onDelta: (msg) => process.stdout.write(msg),
    onError: (msg) => console.log(`
[ERROR] ${msg}`),
    onDone: () => console.log("\n[DONE] Agent finished."),
    onActivity: (activity) => console.log("\n[ACTIVITY]", activity)
  };
  const config = {
    provider,
    apiKey,
    model
    // explicitly NO gateway, testing direct local key mode
  };
  const messages = [
    { role: "user", content: "Run node -v using the command execution tool." }
  ];
  try {
    const result = await runAgentLoop(
      config,
      "You are a testing agent. You must execute commands using run_command.",
      messages,
      executor,
      callbacks,
      new AbortController().signal,
      false,
      process.cwd()
    );
    console.log("\n--- Final Agent Response ---");
    console.log(result);
  } catch (err) {
    console.error("Test failed:", err);
  }
}
runTest();
