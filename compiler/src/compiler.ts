import * as fs from 'node:fs';
import * as path from 'node:path';
import { Lexer, LexerError } from './lexer';
import { Parser, ParserError } from './parser';
import { CodeGenerator } from './codegen';
import { Program } from './ast';
import { TypeChecker } from './typechecker';

export interface CompilerOptions {
  outDir?: string;
  sourceMap?: boolean;
  minify?: boolean;
  target?: 'es2020' | 'es2021' | 'es2022';
  /** 
   * Prelude mode:
   * - 'none': No automatic imports (pure mode, like Nyalang)
   * - 'core': Auto-import core types (Int, Float, Bool, Str, Nul, Option, Result)
   * - 'full': Auto-import core types + io (println, print)
   * Default: 'none'
   */
  prelude?: 'none' | 'core' | 'full';
}

export interface CompileResult {
  success: boolean;
  code?: string;
  ast?: Program;
  errors: CompilerError[];
  warnings: CompilerWarning[];
}

export interface CompilerError {
  message: string;
  line: number;
  column: number;
  file?: string;
}

export interface CompilerWarning {
  message: string;
  line: number;
  column: number;
  file?: string;
}

interface ModuleInfo {
  exports: Set<string>;
  hasDefault: boolean;
  // If default export is `export default Identifier`, record its name for stricter checking
  defaultIdentifierName?: string;
}

export class Compiler {
  private options: CompilerOptions;
  private moduleCache: Map<string, ModuleInfo> = new Map();

  constructor(options: CompilerOptions = {}) {
    this.options = {
      outDir: options.outDir || './dist',
      sourceMap: options.sourceMap ?? false,
      minify: options.minify ?? false,
      target: options.target || 'es2020',
      prelude: options.prelude || 'none',
    };
  }

  /**
   * Get prelude source code based on prelude mode
   */
  private getPreludeSource(): string {
    const prelude = this.options.prelude;
    
    if (prelude === 'none') {
      return '';
    }
    
    let source = '';
    
    if (prelude === 'core' || prelude === 'full') {
      // Core types (using new : syntax)
      source += 'import { Int, Float, Bool, Str, Nul, Option, Result, Error, TypeError, ValueError, IndexError } : "/std/core"\n';
      source += 'import { isInt, isFloat, isStr, isBool, isNul, toInt, toFloat, toStr, toBool } : "/std/core"\n';
      source += 'import { abs, min, max, clamp, range, rangeInclusive, assert, unreachable } : "/std/core"\n';
    }
    
    if (prelude === 'full') {
      // IO functions
      source += 'import { println, print, readln, dbg } : "/std/io"\n';
    }
    
    return source;
  }

  compile(source: string, filename?: string): CompileResult {
    const errors: CompilerError[] = [];
    const warnings: CompilerWarning[] = [];

    try {
      // Prepend prelude if enabled
      const preludeSource = this.getPreludeSource();
      const fullSource = preludeSource + source;
      
      // Lexical analysis
      const lexer = new Lexer(fullSource);
      const tokens = lexer.tokenize();

      // Parsing
      const parser = new Parser(tokens);
      const ast = parser.parse();

      // Static module/import checks (no full type system yet)
      if (filename) {
        this.checkImports(ast, filename, errors);
        if (errors.length > 0) {
          return {
            success: false,
            errors,
            warnings,
          };
        }
      }

      // Basic static type checking (symbol existence + simple literal assignment checks)
      const typeChecker = new TypeChecker();
      typeChecker.check(ast, filename, errors);
      if (errors.length > 0) {
        return {
          success: false,
          errors,
          warnings,
        };
      }

      // Code generation
      const generator = new CodeGenerator();
      const code = generator.generate(ast);

      return {
        success: true,
        code,
        ast,
        errors,
        warnings,
      };
    } catch (error) {
      if (error instanceof LexerError) {
        errors.push({
          message: error.message,
          line: error.line,
          column: error.column,
          file: filename,
        });
      } else if (error instanceof ParserError) {
        errors.push({
          message: error.message,
          line: error.token.line,
          column: error.token.column,
          file: filename,
        });
      } else if (error instanceof Error) {
        errors.push({
          message: error.message,
          line: 0,
          column: 0,
          file: filename,
        });
      }

      return {
        success: false,
        errors,
        warnings,
      };
    }
  }

  compileFile(filePath: string): CompileResult {
    const absolutePath = path.resolve(filePath);
    
    if (!fs.existsSync(absolutePath)) {
      return {
        success: false,
        errors: [{
          message: `File not found: ${absolutePath}`,
          line: 0,
          column: 0,
          file: absolutePath,
        }],
        warnings: [],
      };
    }

    const source = fs.readFileSync(absolutePath, 'utf-8');
    return this.compile(source, absolutePath);
  }

  compileToFile(inputPath: string, outputPath?: string): CompileResult {
    const result = this.compileFile(inputPath);

    if (result.success && result.code) {
      const outPath = outputPath || this.getOutputPath(inputPath);
      const outDir = path.dirname(outPath);

      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      fs.writeFileSync(outPath, result.code, 'utf-8');
    }

    return result;
  }

  private getOutputPath(inputPath: string): string {
    const parsed = path.parse(inputPath);
    const relativePath = path.relative(process.cwd(), parsed.dir);
    return path.join(this.options.outDir!, relativePath, `${parsed.name}.js`);
  }

  // ===== Module / Import Static Checks =====

  private checkImports(ast: Program, filename: string, errors: CompilerError[]): void {
    const dir = path.dirname(filename);

    for (const stmt of ast.body) {
      if (stmt.type !== 'ImportStatement') continue;

      const source = stmt.source;
      const resolved = this.resolveModulePath(source, dir);

      if (!resolved) {
        errors.push({
          message: `Cannot resolve module '${source}'`,
          line: 0,
          column: 0,
          file: filename,
        });
        continue;
      }

      if (!fs.existsSync(resolved)) {
        errors.push({
          message: `Module not found: ${resolved} (from '${source}')`,
          line: 0,
          column: 0,
          file: filename,
        });
        continue;
      }

      // Only .lj modules participate in export-name checking for now
      if (resolved.endsWith('.lj')) {
        const info = this.loadModuleExports(resolved, errors);
        if (!info) continue;

        for (const spec of stmt.specifiers) {
          if (spec.type === 'default') {
            if (!info.hasDefault) {
              errors.push({
                message: `Module '${source}' has no default export`,
                line: 0,
                column: 0,
                file: filename,
              });
            } else if (info.defaultIdentifierName && spec.local !== info.defaultIdentifierName) {
              errors.push({
                message: `Module '${source}' default export is '${info.defaultIdentifierName}', not '${spec.local}'`,
                line: 0,
                column: 0,
                file: filename,
              });
            }
          } else if (spec.type === 'named') {
            if (!info.exports.has(spec.imported)) {
              errors.push({
                message: `Module '${source}' has no exported member '${spec.imported}'`,
                line: 0,
                column: 0,
                file: filename,
              });
            }
          } else {
            // namespace import: import * as ns from 'mod' - nothing to validate now
          }
        }
      }
    }
  }

  private resolveModulePath(source: string, baseDir: string): string | null {
    // std modules: /std/... -> runtime JS modules (relative to compiler installation)
    if (source.startsWith('/std/')) {
      const compilerDir = path.dirname(__dirname); // compiler root (dist -> compiler)
      const moduleName = source.slice(5); // remove '/std/'
      const jsPath = path.resolve(compilerDir, 'runtime', 'std', `${moduleName}.js`);
      return jsPath;
    }

    // Relative or bare path
    let candidate = path.resolve(baseDir, source);

    if (fs.existsSync(candidate)) {
      return candidate;
    }

    // Try with .lj then .js
    const withLj = candidate.endsWith('.lj') ? candidate : `${candidate}.lj`;
    if (fs.existsSync(withLj)) return withLj;

    const withJs = candidate.endsWith('.js') ? candidate : `${candidate}.js`;
    if (fs.existsSync(withJs)) return withJs;

    return withLj; // return first guess even if not existing; caller will check
  }

  private loadModuleExports(modulePath: string, errors: CompilerError[]): ModuleInfo | null {
    const cached = this.moduleCache.get(modulePath);
    if (cached) return cached;

    let source: string;
    try {
      source = fs.readFileSync(modulePath, 'utf-8');
    } catch (e) {
      errors.push({
        message: `Failed to read module '${modulePath}': ${(e as Error).message}`,
        line: 0,
        column: 0,
        file: modulePath,
      });
      return null;
    }

    try {
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      const info: ModuleInfo = {
        exports: new Set<string>(),
        hasDefault: false,
        defaultIdentifierName: undefined,
      };

      for (const stmt of ast.body) {
        if (stmt.type !== 'ExportStatement') continue;

        if (stmt.isDefault) {
          info.hasDefault = true;
        }

        if (stmt.declaration) {
          const decl = stmt.declaration;
          switch (decl.type) {
            case 'FunctionDeclaration':
              info.exports.add(decl.name);
              break;
            case 'ClassDeclaration':
              info.exports.add(decl.name);
              if (stmt.isDefault) {
                info.defaultIdentifierName = decl.name;
              }
              break;
            case 'EnumDeclaration':
              info.exports.add(decl.name);
              break;
            case 'VariableDeclaration':
              info.exports.add(decl.name);
              if (stmt.isDefault) {
                info.defaultIdentifierName = decl.name;
              }
              break;
            case 'TypeAliasDeclaration':
              info.exports.add(decl.name);
              break;
            case 'ExpressionStatement': {
              // Handle `export default Identifier` where parser wraps the expression
              if (stmt.isDefault && decl.expression.type === 'Identifier') {
                info.defaultIdentifierName = decl.expression.name;
              }
              break;
            }
            default:
              break;
          }
        }
      }

      this.moduleCache.set(modulePath, info);
      return info;
    } catch (e) {
      const err = e as Error;
      errors.push({
        message: `Failed to parse module '${modulePath}': ${err.message}`,
        line: 0,
        column: 0,
        file: modulePath,
      });
      return null;
    }
  }
}

// Configuration file handling
export interface LjosConfig {
  compilerOptions?: CompilerOptions;
  include?: string[];
  exclude?: string[];
  extends?: string;
}

export function loadConfig(configPath?: string): LjosConfig {
  const possiblePaths = configPath
    ? [configPath]
    : ['.ljconfig.json', '.ljconfig.lj'];

  for (const p of possiblePaths) {
    const fullPath = path.resolve(p);
    if (fs.existsSync(fullPath)) {
      if (p.endsWith('.json')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        return JSON.parse(content);
      } else if (p.endsWith('.lj')) {
        // For .lj config, we need to compile and evaluate it
        // For now, just return default config
        console.warn('Note: .lj config files are not yet fully supported');
        return {};
      }
    }
  }

  return {};
}
