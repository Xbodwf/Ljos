#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import { Compiler } from './compiler';
import { loadConfig, CompilerOptions } from './config';
import { ProjectCompiler, initProject, isLjosProject } from './project';

interface CliOptions {
  input?: string;
  output?: string;
  watch?: boolean;
  help?: boolean;
  version?: boolean;
  config?: string;
  prelude?: 'none' | 'core' | 'full';
  init?: boolean;
  initFormat?: 'json' | 'lj';
  project?: boolean; // Compile entire project
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
      case '--init':
        options.init = true;
        break;
      case '--init-lj':
        options.init = true;
        options.initFormat = 'lj';
        break;
      case '-b':
      case '--build':
      case '--project':
        options.project = true;
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

Usage: 
  ljc [options] <input-file>     Compile a single file
  ljc -b [options]               Compile entire project (project mode)
  ljc --init                     Initialize a new project

Options:
  -h, --help              Show this help message
  -v, --version           Show version number
  -o, --output <file>     Output file path (single file mode)
  -w, --watch             Watch mode (recompile on changes)
  -c, --config <file>     Path to config file (ljconfig.json or ljconfig.lj)
  -p, --prelude <mode>    Prelude mode: 'none', 'core', or 'full' (default: none)
      --no-prelude        Disable prelude (same as -p none)
  -b, --build, --project  Compile entire project based on ljconfig
      --init              Initialize a new project with ljconfig.json
      --init-lj           Initialize a new project with ljconfig.lj

Prelude Modes:
  none    No automatic imports - all types and functions must be explicitly imported
  core    Auto-import core types: Int, Float, Bool, Str, Nul, Option, Result, etc.
  full    Auto-import core types + IO functions: println, print, readln, dbg

Examples:
  ljc main.lj                    Compile main.lj to dist/main.js
  ljc main.lj -o out.js          Compile main.lj to out.js
  ljc -w main.lj                 Watch and recompile main.lj on changes
  ljc -b                         Compile entire project
  ljc -b -w                      Watch and compile entire project
  ljc --init                     Create ljconfig.json and src/main.lj
  ljc --init-lj                  Create ljconfig.lj and src/main.lj

Configuration Files:
  ljconfig.lj   (higher priority) - Ljos format, like vite.config.ts
  ljconfig.json                   - JSON format, like tsconfig.json
  
  Example ljconfig.json:
  {
    "compilerOptions": {
      "outDir": "./dist",
      "rootDir": "./src",
      "target": "es2022",
      "sourceMap": true
    },
    "include": ["src/**/*.lj"],
    "exclude": ["node_modules"]
  }

  Example ljconfig.lj:
  import { defineConfig } : "/std/config"
  
  export default defineConfig({
    compilerOptions: {
      outDir: "./dist",
      rootDir: "./src"
    },
    include: ["src/**/*.lj"]
  })
`);
}

function printVersion(): void {
  console.log('ljc v1.0.0');
}

function formatError(error: { message: string; line: number; column: number; file?: string }, source?: string): string {
  const location = error.file ? `${error.file}:${error.line}:${error.column}` : `${error.line}:${error.column}`;
  let result = `${chalk.red('Error')} at ${chalk.cyan(location)}: ${error.message}`;
  
  // If source is provided, show the error line with highlighting
  if (source && error.line > 0) {
    const lines = source.split('\n');
    const errorLine = lines[error.line - 1];
    if (errorLine) {
      result += '\n  ' + chalk.gray(`${error.line} |`) + ' ';
      // Highlight the error portion (from column to end of word/token)
      const col = error.column - 1;
      const before = errorLine.substring(0, col);
      // Find the end of the error token
      let endCol = col;
      while (endCol < errorLine.length && !/\s/.test(errorLine[endCol])) {
        endCol++;
      }
      const errorPart = errorLine.substring(col, endCol) || errorLine.substring(col, col + 1);
      const after = errorLine.substring(endCol);
      result += before + chalk.red.bold(errorPart) + after;
    }
  }
  
  return result;
}

function compileFile(inputPath: string, outputPath?: string, compilerOptions?: CompilerOptions): boolean {
  const compiler = new Compiler(compilerOptions);
  const result = compiler.compileToFile(inputPath, outputPath);

  if (result.success) {
    console.log(`${chalk.green('✓')} Compiled ${inputPath}`);
    return true;
  } else {
    // Read source for error highlighting
    let source: string | undefined;
    try {
      source = fs.readFileSync(inputPath, 'utf-8');
    } catch {
      // Ignore read errors
    }
    for (const error of result.errors) {
      console.error(formatError(error, source));
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

  // Handle --init
  if (options.init) {
    try {
      initProject(process.cwd(), options.initFormat || 'json');
      process.exit(0);
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(1);
    }
  }

  // Handle project mode (-b, --build, --project)
  if (options.project) {
    try {
      const projectCompiler = new ProjectCompiler(options.config);
      
      if (options.watch) {
        projectCompiler.watch((result) => {
          if (result.success) {
            console.log(`\n✓ Compiled ${result.filesCompiled} file(s) in ${result.duration}ms`);
          } else {
            console.log(`\n✗ ${result.filesFailed} file(s) failed to compile`);
          }
        });
      } else {
        // Use build() instead of compile() to support pkg/bundle targets
        const result = projectCompiler.build();
        
        console.log('');
        if (result.success) {
          // Show detailed timing information
          let timeInfo = `${chalk.cyan(result.ljcDuration + 'ms')} ljc`;
          if (result.thirdPartyDuration > 0) {
            timeInfo += ` + ${chalk.yellow(result.thirdPartyDuration + 'ms')} third-party`;
            timeInfo += ` = ${chalk.green(result.duration + 'ms')} total`;
          }
          console.log(`${chalk.green('✓')} Compiled ${result.filesCompiled} file(s) in ${timeInfo}`);
          process.exit(0);
        } else {
          console.log(`${chalk.red('✗')} ${result.filesFailed} file(s) failed to compile`);
          process.exit(1);
        }
      }
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(1);
    }
    return;
  }

  // Single file mode
  if (!options.input) {
    // Check if we're in a project directory
    if (isLjosProject()) {
      console.log('Hint: Use -b to compile the entire project');
    }
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
