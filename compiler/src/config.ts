/**
 * Ljos Project Configuration
 * 
 * Supports two configuration formats:
 * - ljconfig.json (JSON format, like tsconfig.json)
 * - ljconfig.lj (Ljos format, like vite.config.ts)
 * 
 * .lj files have higher priority than .json files
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { CodeGenerator } from './codegen';

// ============ Configuration Schema ============

export interface CompilerOptions {
  /** Output directory for compiled files */
  outDir?: string;
  /** Root directory of source files */
  rootDir?: string;
  /** Generate source maps */
  sourceMap?: boolean;
  /** Minify output */
  minify?: boolean;
  /** Target ECMAScript version */
  target?: 'es2020' | 'es2021' | 'es2022' | 'esnext';
  /** Module system */
  module?: 'esm' | 'commonjs';
  /** 
   * Prelude mode:
   * - 'none': No automatic imports (pure mode)
   * - 'core': Auto-import core types (Int, Float, Bool, Str, Nul, Option, Result)
   * - 'full': Auto-import core types + io (println, print)
   */
  prelude?: 'none' | 'core' | 'full';
  /** Enable strict type checking */
  strict?: boolean;
  /** Allow implicit any type */
  noImplicitAny?: boolean;
  /** Check for unused variables */
  noUnusedLocals?: boolean;
  /** Check for unused parameters */
  noUnusedParameters?: boolean;
  /** Declaration file generation */
  declaration?: boolean;
  /** Base URL for module resolution */
  baseUrl?: string;
  /** Path mappings for module resolution */
  paths?: Record<string, string[]>;
}

/** Build options for packaging */
export interface BuildOptions {
  /** 
   * Build target:
   * - 'js': Output JavaScript files (default)
   * - 'pkg': Package as standalone executable using pkg
   * - 'bundle': Bundle all files into a single JS file
   */
  target?: 'js' | 'pkg' | 'bundle';
  /** Entry point for packaging (defaults to main file) */
  entry?: string;
  /** Output executable name (for pkg target) */
  executableName?: string;
  /** Target platforms for pkg (e.g., ['node18-win-x64', 'node18-linux-x64', 'node18-macos-x64']) */
  pkgTargets?: string[];
  /** Additional pkg options */
  pkgOptions?: {
    /** Compress the executable */
    compress?: 'GZip' | 'Brotli';
    /** Include additional assets */
    assets?: string[];
  };
}

export interface LjosConfig {
  /** Compiler options */
  compilerOptions?: CompilerOptions;
  /** Build options for packaging */
  buildOptions?: BuildOptions;
  /** Files/patterns to include */
  include?: string[];
  /** Files/patterns to exclude */
  exclude?: string[];
  /** Extend another config file */
  extends?: string;
  /** Project references (for monorepo) */
  references?: Array<{ path: string }>;
}

// Default configuration
export const DEFAULT_CONFIG: LjosConfig = {
  compilerOptions: {
    outDir: './dist',
    rootDir: './src',
    sourceMap: false,
    minify: false,
    target: 'es2022',
    module: 'esm',
    prelude: 'none',
    strict: false,
  },
  include: ['**/*.lj'],
  exclude: ['node_modules', 'dist', '**/*.test.lj', '**/*.spec.lj', 'ljconfig*.lj'],
};

// ============ Config File Names ============

export const CONFIG_FILE_NAMES = [
  'ljconfig.lj',   // .lj has higher priority
  'ljconfig.json',
] as const;

// ============ Config Loading ============

/**
 * Find config file in the given directory or parent directories
 */
export function findConfigFile(startDir: string = process.cwd()): string | null {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    for (const configName of CONFIG_FILE_NAMES) {
      const configPath = path.join(currentDir, configName);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Load and parse ljconfig.json
 */
function loadJsonConfig(configPath: string): LjosConfig {
  const content = fs.readFileSync(configPath, 'utf-8');
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`Failed to parse ${configPath}: ${(e as Error).message}`);
  }
}

/**
 * Load and evaluate ljconfig.lj
 * 
 * Compiles the .lj config file to JS, executes it, and reads the exported config.
 * 
 * ```lj
 * import { defineConfig } : "/std/config"
 * 
 * export default defineConfig({
 *   compilerOptions: {
 *     outDir: "./dist",
 *     target: "es2022"
 *   },
 *   include: ["src/**//*.lj"]
 * })
 * ```
 */
function loadLjConfig(configPath: string): LjosConfig {
  const source = fs.readFileSync(configPath, 'utf-8');
  const configDir = path.dirname(path.resolve(configPath));
  
  try {
    // Parse the .lj file
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    // Get runtime std path
    const compilerDir = path.dirname(__dirname);
    let runtimeStdPath = path.join(compilerDir, 'runtime', 'std');
    if (!fs.existsSync(runtimeStdPath)) {
      runtimeStdPath = path.join(compilerDir, '..', 'runtime', 'std');
    }
    
    // Format for import (file URL for absolute path)
    const runtimeStdUrl = `file://${runtimeStdPath.replace(/\\/g, '/')}`;
    
    // Generate JavaScript code with absolute std path
    const generator = new CodeGenerator({ stdLibPath: runtimeStdUrl });
    const jsCode = generator.generate(ast);
    
    // Create temporary files in the project directory to support relative imports
    // Use a unique name to avoid conflicts
    const timestamp = Date.now();
    const tempConfigFile = path.join(configDir, `ljconfig-${timestamp}.mjs`);
    const tempRunnerFile = path.join(configDir, `ljconfig-runner-${timestamp}.mjs`);
    
    // Write config module
    fs.writeFileSync(tempConfigFile, jsCode, 'utf-8');
    
    // Write runner module that imports config and logs default export
    // We use the file name for import, which is local to the runner
    const configFileName = path.basename(tempConfigFile);
    const runnerCode = `
import config from "./${configFileName}";
console.log(JSON.stringify(config.default || config));
`;
    fs.writeFileSync(tempRunnerFile, runnerCode, 'utf-8');
    
    try {
      // Execute the runner
      const output = execSync(`node "${tempRunnerFile}"`, {
        cwd: configDir,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      
      // Parse the JSON output
      const config = JSON.parse(output.trim());
      return config;
    } finally {
      // Clean up temp files
      try {
        if (fs.existsSync(tempConfigFile)) fs.unlinkSync(tempConfigFile);
        if (fs.existsSync(tempRunnerFile)) fs.unlinkSync(tempRunnerFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (e) {
    throw new Error(`Failed to load ${configPath}: ${(e as Error).message}`);
  }
}

/**
 * Merge two configs, with override taking precedence
 */
function mergeConfigs(base: LjosConfig, override: LjosConfig): LjosConfig {
  return {
    compilerOptions: {
      ...base.compilerOptions,
      ...override.compilerOptions,
    },
    buildOptions: {
      ...base.buildOptions,
      ...override.buildOptions,
    },
    include: override.include ?? base.include,
    exclude: override.exclude ?? base.exclude,
    extends: override.extends,
    references: override.references ?? base.references,
  };
}

/**
 * Load config with inheritance (extends)
 */
function loadConfigWithExtends(configPath: string, visited: Set<string> = new Set()): LjosConfig {
  const absolutePath = path.resolve(configPath);
  
  if (visited.has(absolutePath)) {
    throw new Error(`Circular config inheritance detected: ${absolutePath}`);
  }
  visited.add(absolutePath);
  
  // Load the config file
  let config: LjosConfig;
  if (configPath.endsWith('.lj')) {
    config = loadLjConfig(configPath);
  } else {
    config = loadJsonConfig(configPath);
  }
  
  // Handle extends
  if (config.extends) {
    const baseConfigPath = path.resolve(path.dirname(configPath), config.extends);
    const baseConfig = loadConfigWithExtends(baseConfigPath, visited);
    config = mergeConfigs(baseConfig, config);
  }
  
  return config;
}

/**
 * Load configuration from file or use defaults
 */
export function loadConfig(configPath?: string): LjosConfig {
  // If explicit path provided, use it
  if (configPath) {
    const fullPath = path.resolve(configPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Config file not found: ${fullPath}`);
    }
    const config = loadConfigWithExtends(fullPath);
    return mergeConfigs(DEFAULT_CONFIG, config);
  }
  
  // Try to find config file
  const foundConfig = findConfigFile();
  if (foundConfig) {
    const config = loadConfigWithExtends(foundConfig);
    return mergeConfigs(DEFAULT_CONFIG, config);
  }
  
  // Return default config
  return DEFAULT_CONFIG;
}

/**
 * Get the project root directory (where config file is located)
 */
export function getProjectRoot(configPath?: string): string {
  if (configPath) {
    return path.dirname(path.resolve(configPath));
  }
  
  const foundConfig = findConfigFile();
  if (foundConfig) {
    return path.dirname(foundConfig);
  }
  
  return process.cwd();
}

// ============ defineConfig helper ============

/**
 * Helper function for type-safe config definition in .lj files
 * This is a no-op at runtime, just returns the config as-is
 */
export function defineConfig(config: LjosConfig): LjosConfig {
  return config;
}
