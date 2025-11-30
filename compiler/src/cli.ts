#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Compiler, loadConfig, CompilerOptions } from './compiler';

interface CliOptions {
  input?: string;
  output?: string;
  watch?: boolean;
  help?: boolean;
  version?: boolean;
  config?: string;
  prelude?: 'none' | 'core' | 'full';
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;
      case '-o':
      case '--output':
        options.output = args[++i];
        break;
      case '-w':
      case '--watch':
        options.watch = true;
        break;
      case '-c':
      case '--config':
        options.config = args[++i];
        break;
      case '-p':
      case '--prelude':
        const preludeValue = args[++i];
        if (preludeValue === 'none' || preludeValue === 'core' || preludeValue === 'full') {
          options.prelude = preludeValue;
        } else {
          console.error(`Invalid prelude value: ${preludeValue}. Use 'none', 'core', or 'full'.`);
          process.exit(1);
        }
        break;
      case '--no-prelude':
        options.prelude = 'none';
        break;
      default:
        if (!arg.startsWith('-')) {
          options.input = arg;
        }
    }
  }
  
  return options;
}

function printHelp(): void {
  console.log(`
Ljos Compiler (ljc) v1.0.0

Usage: ljc [options] <input-file>

Options:
  -h, --help              Show this help message
  -v, --version           Show version number
  -o, --output <file>     Output file path
  -w, --watch             Watch mode (recompile on changes)
  -c, --config <file>     Path to config file (.ljconfig.json or .ljconfig.lj)
  -p, --prelude <mode>    Prelude mode: 'none', 'core', or 'full' (default: none)
      --no-prelude        Disable prelude (same as -p none)

Prelude Modes:
  none    No automatic imports - all types and functions must be explicitly imported
  core    Auto-import core types: Int, Float, Bool, Str, Nul, Option, Result, etc.
  full    Auto-import core types + IO functions: println, print, readln, dbg

Examples:
  ljc main.lj                    Compile main.lj to dist/main.js
  ljc main.lj -o out.js          Compile main.lj to out.js
  ljc -w main.lj                 Watch and recompile main.lj on changes

Configuration:
  The compiler looks for .ljconfig.json or .ljconfig.lj in the current directory.
  
  Example .ljconfig.json:
  {
    "compilerOptions": {
      "outDir": "./dist",
      "sourceMap": true,
      "target": "es2020"
    },
    "include": ["src/**/*.lj"],
    "exclude": ["node_modules"]
  }
`);
}

function printVersion(): void {
  console.log('ljc v1.0.0');
}

function formatError(error: { message: string; line: number; column: number; file?: string }): string {
  const location = error.file ? `${error.file}:${error.line}:${error.column}` : `${error.line}:${error.column}`;
  return `\x1b[31mError\x1b[0m at ${location}: ${error.message}`;
}

function compileFile(inputPath: string, outputPath?: string, compilerOptions?: CompilerOptions): boolean {
  const compiler = new Compiler(compilerOptions);
  const result = compiler.compileToFile(inputPath, outputPath);

  if (result.success) {
    console.log(`\x1b[32m✓\x1b[0m Compiled ${inputPath}`);
    return true;
  } else {
    for (const error of result.errors) {
      console.error(formatError(error));
    }
    return false;
  }
}

function watchFile(inputPath: string, outputPath?: string, compilerOptions?: CompilerOptions): void {
  console.log(`Watching ${inputPath} for changes...`);
  
  // Initial compile
  compileFile(inputPath, outputPath, compilerOptions);
  
  // Watch for changes
  fs.watch(inputPath, (eventType) => {
    if (eventType === 'change') {
      console.log(`\nFile changed, recompiling...`);
      compileFile(inputPath, outputPath, compilerOptions);
    }
  });
}

function main(): void {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.version) {
    printVersion();
    process.exit(0);
  }

  if (!options.input) {
    console.error('Error: No input file specified');
    console.log('Use --help for usage information');
    process.exit(1);
  }

  // Load config
  const config = loadConfig(options.config);
  const compilerOptions: CompilerOptions = {
    ...config.compilerOptions,
    // CLI options override config file
    ...(options.prelude && { prelude: options.prelude }),
  };

  // Resolve input path
  const inputPath = path.resolve(options.input);
  
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  // Determine output path
  let outputPath = options.output;
  if (!outputPath && compilerOptions.outDir) {
    const parsed = path.parse(inputPath);
    outputPath = path.join(compilerOptions.outDir, `${parsed.name}.js`);
  }

  if (options.watch) {
    watchFile(inputPath, outputPath, compilerOptions);
  } else {
    const success = compileFile(inputPath, outputPath, compilerOptions);
    process.exit(success ? 0 : 1);
  }
}

main();
