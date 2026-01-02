import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import fs from "fs";

// Response type interfaces
interface SuccessResponse {
  ok: true;
  stock: string;
  event: string;
  impact: string;
  confidence: number;
  analysis?: string;
  sentiment?: string;
  sentiment_score?: number;
  timestamp?: string;
  [key: string]: any;
}

interface ErrorResponse {
  ok: false;
  error: string;
  details?: string;
  stdout?: string;
  stderr?: string;
  path?: string;
  cwd?: string;
}

type ApiResponse = SuccessResponse | ErrorResponse;

// Configuration
const CONFIG = {
  TIMEOUT_MS: 30000, // 30 seconds
  MAX_OUTPUT_SIZE: 1024 * 1024, // 1MB
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
): void {
  // Only allow POST requests
  if (req.method !== "POST") {
    res.status(405).json({ 
      ok: false, 
      error: "Method not allowed",
      details: "Only POST requests are supported"
    });
    return;
  }

  const { stock, event } = req.body;

  // Validate inputs
  if (!stock || !event) {
    res.status(400).json({ 
      ok: false, 
      error: "Missing required parameters",
      details: "Both 'stock' and 'event' are required"
    });
    return;
  }

  // Sanitize inputs
  const sanitizedStock = stock.toString().trim().toUpperCase();
  const sanitizedEvent = event.toString().trim();

  // Additional validation
  if (!sanitizedStock || !sanitizedEvent) {
    res.status(400).json({
      ok: false,
      error: "Invalid input",
      details: "Stock and event cannot be empty"
    });
    return;
  }

  if (sanitizedEvent.length < 5) {
    res.status(400).json({
      ok: false,
      error: "Event description too short",
      details: "Event description must be at least 5 characters"
    });
    return;
  }

  // Build script path
  const scriptPath = path.join(
    process.cwd(),
    "..",
    "backend",
    "app",
    "services",
    "ml",
    "event_impact_predict.py"
  );

  const backendDir = path.join(process.cwd(), "..", "backend");

  console.log("=== EVENT IMPACT API ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Stock:", sanitizedStock);
  console.log("Event:", sanitizedEvent.substring(0, 50) + "...");
  console.log("CWD:", process.cwd());
  console.log("Script path:", scriptPath);
  console.log("Backend dir:", backendDir);
  console.log("File exists:", fs.existsSync(scriptPath));
  console.log("========================");

  // Check if script exists
  if (!fs.existsSync(scriptPath)) {
    console.error("ERROR: Python script not found at:", scriptPath);
    
    // Try to provide helpful debugging info
    const mlDir = path.join(process.cwd(), "..", "backend", "app", "services", "ml");
    let mlContents = "Directory not found";
    
    if (fs.existsSync(mlDir)) {
      try {
        mlContents = fs.readdirSync(mlDir).join(", ");
      } catch (e) {
        mlContents = "Error reading directory";
      }
    }

    res.status(500).json({
      ok: false,
      error: "Python script not found",
      path: scriptPath,
      cwd: process.cwd(),
      details: `ML directory contents: ${mlContents}`
    });
    return;
  }

  // Determine Python command
  const pythonCommand = process.platform === "win32" ? "python" : "python3";

  let py: ChildProcess;
  let stdout = "";
  let stderr = "";
  let isComplete = false;
  let timeoutId: NodeJS.Timeout;

  try {
    // Spawn Python process
    py = spawn(pythonCommand, [scriptPath, sanitizedStock, sanitizedEvent], {
      shell: true,
      cwd: backendDir,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1", // Disable Python output buffering
      },
    });

    // Set timeout
    timeoutId = setTimeout(() => {
      if (!isComplete) {
        console.error("ERROR: Python process timeout");
        isComplete = true;
        py.kill("SIGTERM");

        // Force kill after 2 seconds
        setTimeout(() => {
          if (!py.killed) {
            py.kill("SIGKILL");
          }
        }, 2000);

        res.status(500).json({
          ok: false,
          error: "Analysis timeout",
          details: `Process exceeded ${CONFIG.TIMEOUT_MS / 1000} seconds`,
        });
      }
    }, CONFIG.TIMEOUT_MS);

    // Handle stdout
    py.stdout?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      
      // Prevent memory issues
      if (stdout.length + chunk.length > CONFIG.MAX_OUTPUT_SIZE) {
        if (!isComplete) {
          console.error("ERROR: Output size exceeded");
          isComplete = true;
          clearTimeout(timeoutId);
          py.kill("SIGTERM");
          
          res.status(500).json({
            ok: false,
            error: "Output size exceeded",
            details: "Python script produced too much output",
          });
        }
        return;
      }
      
      stdout += chunk;
      console.log("[Python STDOUT]:", chunk.trim());
    });

    // Handle stderr
    py.stderr?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      console.log("[Python STDERR]:", chunk.trim());
    });

    // Handle process errors
    py.on("error", (error: Error) => {
      if (isComplete) return;
      
      console.error("ERROR: Failed to spawn Python process:", error);
      isComplete = true;
      clearTimeout(timeoutId);
      
      res.status(500).json({
        ok: false,
        error: "Failed to execute Python script",
        details: error.message,
      });
    });

    // Handle process completion
    py.on("close", (code: number | null, signal: string | null) => {
      if (isComplete) return;
      
      isComplete = true;
      clearTimeout(timeoutId);

      console.log("=== PYTHON EXECUTION COMPLETE ===");
      console.log("Exit code:", code);
      console.log("Signal:", signal);
      console.log("STDOUT length:", stdout.length);
      console.log("STDERR length:", stderr.length);
      console.log("=================================");

      // Check for abnormal termination
      if (signal) {
        console.error("ERROR: Process terminated by signal:", signal);
        res.status(500).json({
          ok: false,
          error: "Process terminated unexpectedly",
          details: `Signal: ${signal}`,
          stderr: stderr.substring(0, 500),
        });
        return;
      }

      if (code !== 0) {
        console.error("ERROR: Python script failed with exit code:", code);
        res.status(500).json({
          ok: false,
          error: `Python script exited with code ${code}`,
          stdout: stdout.substring(0, 500),
          stderr: stderr.substring(0, 500),
        });
        return;
      }

      // Parse output
      try {
        const trimmed = stdout.trim();
        
        if (!trimmed) {
          console.error("ERROR: Empty output from Python script");
          res.status(500).json({
            ok: false,
            error: "Empty output from Python script",
            stderr: stderr.substring(0, 500),
          });
          return;
        }

        console.log("Parsing JSON output...");
        const parsed: ApiResponse = JSON.parse(trimmed);

        console.log("SUCCESS: Analysis complete");
        console.log("Result:", {
          ok: parsed.ok,
          stock: parsed.ok ? parsed.stock : undefined,
          impact: parsed.ok ? parsed.impact : undefined,
          confidence: parsed.ok ? parsed.confidence : undefined,
        });

        const statusCode = parsed.ok ? 200 : 500;
        res.status(statusCode).json(parsed);

      } catch (parseError: any) {
        console.error("ERROR: Failed to parse Python output:", parseError.message);
        console.log("Raw output:", stdout.substring(0, 200));
        
        res.status(500).json({
          ok: false,
          error: "Failed to parse Python output",
          details: parseError.message,
          stdout: stdout.substring(0, 500),
          stderr: stderr.substring(0, 500),
        });
      }
    });

  } catch (error: any) {
    console.error("ERROR: Unexpected error in handler:", error);
    
    if (!isComplete) {
      res.status(500).json({
        ok: false,
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
}

// API route configuration
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
    responseLimit: "2mb",
    externalResolver: true, // Prevents timeout warnings
  },
};
