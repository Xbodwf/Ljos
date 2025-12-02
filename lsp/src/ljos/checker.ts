import { Token, TokenType, KEYWORDS } from './tokens';
import { Lexer, LexerError } from './lexer';
import { ErrorCode, LjosError, createError, formatError } from './errors';
import {
  LjosType, SymbolInfo, MemberInfo, ModuleInfo,
  typeToString, createPrimitive, createUnknown, createVoid, createNull,
  createArray, createFunction, createClass, isAssignable, BUILTIN_TYPES,
  ClassType, FunctionType, ParameterInfo, PrimitiveType, ObjectLiteralType,
  getClassMember, getAllClassMembers, createObjectLiteral
} from './types';

export interface DiagnosticInfo {
  message: string;
  code: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  severity: 'error' | 'warning' | 'info';
}

export interface HoverInfo {
  content: string;
  line: number;
  column: number;
  endColumn: number;
}

export interface Scope {
  parent?: Scope;
  symbols: Map<string, SymbolInfo>;
}

export class ParserError extends Error {
  constructor(
    public code: ErrorCode,
    public token: Token,
    public args: string[] = []
  ) {
    super(formatError(code, ...args));
    this.name = 'ParserError';
  }
}

export class SyntaxChecker {
  private tokens: Token[] = [];
  private current = 0;
  private diagnostics: DiagnosticInfo[] = [];
  private globalScope: Scope = { symbols: new Map() };
  private currentScope: Scope = this.globalScope;
  private hoverInfos: HoverInfo[] = [];
  private classTypes: Map<string, ClassType> = new Map();
  private modules: Map<string, ModuleInfo> = new Map();
  private currentFile?: string;
  private resolvedModules: Map<string, ModuleInfo> = new Map();
  private symbolLocations: Map<string, { file: string; line: number; column: number }> = new Map();
  private symbolReferences: Map<string, { file: string; line: number; column: number }[]> = new Map();

  check(source: string, filePath?: string): DiagnosticInfo[] {
    this.diagnostics = [];
    this.hoverInfos = [];
    this.current = 0;
    this.currentFile = filePath;
    this.globalScope = { symbols: new Map() };
    this.currentScope = this.globalScope;
    this.classTypes.clear();

    // Add built-in symbols
    this.addBuiltins();

    try {
      const lexer = new Lexer(source);
      this.tokens = lexer.tokenize();
    } catch (error) {
      if (error instanceof LexerError) {
        this.addDiagnostic(
          ErrorCode.UNEXPECTED_CHARACTER,
          error.line, error.column,
          error.line, error.column + 1,
          'error',
          error.message
        );
      }
      return this.diagnostics;
    }

    // First pass: collect declarations
    this.collectDeclarations();

    // Second pass: type check
    this.current = 0;
    try {
      this.program();
    } catch (error) {
      if (error instanceof ParserError) {
        this.addDiagnosticFromError(error);
      }
    }

    return this.diagnostics;
  }

  getHoverInfo(line: number, column: number): HoverInfo | undefined {
    return this.hoverInfos.find(h =>
      h.line === line && column >= h.column && column <= h.endColumn
    );
  }

  getSymbols(): SymbolInfo[] {
    return Array.from(this.globalScope.symbols.values());
  }

  // Get definition location for a symbol at the given position
  getDefinition(line: number, column: number): { file: string; line: number; column: number } | undefined {
    // Find the token at this position
    const token = this.tokens.find(t => 
      t.line === line && column >= t.column && column < t.column + t.value.length
    );
    
    if (!token || token.type !== TokenType.IDENTIFIER) {
      return undefined;
    }

    // Look up the symbol
    const symbol = this.lookupSymbolByName(token.value);
    if (symbol && symbol.declarationLine > 0) {
      return {
        file: this.currentFile || '',
        line: symbol.declarationLine,
        column: symbol.declarationColumn
      };
    }

    // Check symbol locations map (for cross-module definitions)
    const location = this.symbolLocations.get(token.value);
    if (location) {
      return location;
    }

    return undefined;
  }

  // Get all references to a symbol at the given position
  getReferences(line: number, column: number): { file: string; line: number; column: number }[] {
    // Find the token at this position
    const token = this.tokens.find(t => 
      t.line === line && column >= t.column && column < t.column + t.value.length
    );
    
    if (!token || token.type !== TokenType.IDENTIFIER) {
      return [];
    }

    const references: { file: string; line: number; column: number }[] = [];
    const symbolName = token.value;

    // Find all occurrences of this identifier in the tokens
    for (const t of this.tokens) {
      if (t.type === TokenType.IDENTIFIER && t.value === symbolName) {
        references.push({
          file: this.currentFile || '',
          line: t.line,
          column: t.column
        });
      }
    }

    // Also check stored references
    const storedRefs = this.symbolReferences.get(symbolName);
    if (storedRefs) {
      references.push(...storedRefs);
    }

    return references;
  }

  // Helper to look up symbol by name
  private lookupSymbolByName(name: string): SymbolInfo | undefined {
    let scope: Scope | undefined = this.currentScope;
    while (scope) {
      const symbol = scope.symbols.get(name);
      if (symbol) return symbol;
      scope = scope.parent;
    }
    return this.globalScope.symbols.get(name);
  }

  private addBuiltins(): void {
    // Built-in functions
    this.globalScope.symbols.set('println', {
      name: 'println',
      type: createFunction([{ name: 'value', type: createPrimitive('any'), optional: false }], createVoid()),
      kind: 'function',
      isConst: true,
      declarationLine: 0,
      declarationColumn: 0,
      documentation: '打印值并换行'
    });
    this.globalScope.symbols.set('print', {
      name: 'print',
      type: createFunction([{ name: 'value', type: createPrimitive('any'), optional: false }], createVoid()),
      kind: 'function',
      isConst: true,
      declarationLine: 0,
      declarationColumn: 0,
      documentation: '打印值'
    });

    // Built-in values
    this.globalScope.symbols.set('NaN', {
      name: 'NaN',
      type: createPrimitive('float'),
      kind: 'variable',
      isConst: true,
      declarationLine: 0,
      declarationColumn: 0
    });
    this.globalScope.symbols.set('Infinity', {
      name: 'Infinity',
      type: createPrimitive('float'),
      kind: 'variable',
      isConst: true,
      declarationLine: 0,
      declarationColumn: 0
    });
  }

  private collectDeclarations(): void {
    const savedPos = this.current;
    
    // First pass: collect all class names (without processing body)
    while (!this.isAtEnd()) {
      try {
        this.collectClassName();
      } catch {
        this.synchronize();
      }
    }
    this.current = savedPos;
    
    // Second pass: collect all declarations with full type info
    while (!this.isAtEnd()) {
      try {
        this.collectTopLevelDeclaration();
      } catch {
        this.synchronize();
      }
    }
    this.current = savedPos;
  }

  // First pass: only collect class names to allow forward references
  private collectClassName(): void {
    // Skip decorators
    while (this.checkType(TokenType.AT)) {
      this.advance();
      if (this.checkType(TokenType.IDENTIFIER)) this.advance();
      if (this.match(TokenType.LPAREN)) {
        let depth = 1;
        while (depth > 0 && !this.isAtEnd()) {
          if (this.match(TokenType.LPAREN)) depth++;
          else if (this.match(TokenType.RPAREN)) depth--;
          else this.advance();
        }
      }
    }

    if (this.checkType(TokenType.EXPORT)) {
      this.advance();
      if (this.match(TokenType.DEFAULT)) {
        this.skipExpression();
        return;
      }
      this.collectClassName();
      return;
    }

    if (this.checkType(TokenType.ABSTRACT) || this.checkType(TokenType.CLASS)) {
      const isAbstract = this.match(TokenType.ABSTRACT);
      this.advance(); // consume 'class'
      
      if (!this.checkType(TokenType.IDENTIFIER)) {
        this.advance();
        return;
      }
      const nameToken = this.advance();
      const className = nameToken.value;

      // Pre-register class type (without members yet)
      if (!this.classTypes.has(className)) {
        const classType = createClass(className, isAbstract);
        this.classTypes.set(className, classType);
        this.globalScope.symbols.set(className, {
          name: className,
          type: classType,
          kind: 'class',
          isConst: true,
          declarationLine: nameToken.line,
          declarationColumn: nameToken.column,
          documentation: isAbstract ? `抽象类 ${className}` : `类 ${className}`
        });
      }

      // Skip rest of class declaration
      while (!this.checkType(TokenType.LBRACE) && !this.isAtEnd()) {
        this.advance();
      }
      this.skipBlock();
    } else {
      this.advance();
    }
  }

  private collectTopLevelDeclaration(): void {
    // Skip decorators
    while (this.checkType(TokenType.AT)) {
      this.advance();
      if (this.checkType(TokenType.IDENTIFIER)) this.advance();
      if (this.match(TokenType.LPAREN)) {
        let depth = 1;
        while (depth > 0 && !this.isAtEnd()) {
          if (this.match(TokenType.LPAREN)) depth++;
          else if (this.match(TokenType.RPAREN)) depth--;
          else this.advance();
        }
      }
    }

    if (this.checkType(TokenType.IMPORT)) {
      this.collectImport();
    } else if (this.checkType(TokenType.EXPORT)) {
      this.advance();
      if (this.match(TokenType.DEFAULT)) {
        this.skipExpression();
      } else {
        this.collectTopLevelDeclaration();
      }
    } else if (this.checkType(TokenType.ABSTRACT) || this.checkType(TokenType.CLASS)) {
      this.collectClass();
    } else if (this.checkType(TokenType.ENUM)) {
      this.collectEnum();
    } else if (this.checkType(TokenType.FN)) {
      this.collectFunction();
    } else if (this.checkType(TokenType.CONST) || this.checkType(TokenType.MUT)) {
      this.collectVariable();
    } else if (this.checkType(TokenType.TYPE)) {
      this.collectTypeAlias();
    } else {
      this.advance();
    }
  }

  private collectImport(): void {
    this.advance(); // consume 'import'
    
    const specifiers: { imported: string; local: string; token?: Token }[] = [];
    let isNamespace = false;
    let defaultImport: string | undefined;
    let defaultImportToken: Token | undefined;

    if (this.checkType(TokenType.LBRACE)) {
      this.advance();
      do {
        if (this.checkType(TokenType.IDENTIFIER)) {
          const token = this.advance();
          const imported = token.value;
          let local = imported;
          if (this.match(TokenType.AS)) {
            if (this.checkType(TokenType.IDENTIFIER)) {
              local = this.advance().value;
            }
          }
          specifiers.push({ imported, local, token });
        }
      } while (this.match(TokenType.COMMA));
      if (this.checkType(TokenType.RBRACE)) this.advance();
    } else if (this.checkType(TokenType.STAR)) {
      this.advance();
      isNamespace = true;
      if (this.match(TokenType.AS)) {
        if (this.checkType(TokenType.IDENTIFIER)) {
          defaultImportToken = this.advance();
          defaultImport = defaultImportToken.value;
        }
      }
    } else if (this.checkType(TokenType.IDENTIFIER)) {
      defaultImportToken = this.advance();
      defaultImport = defaultImportToken.value;
    }

    if (this.match(TokenType.COLON)) {
      if (this.checkType(TokenType.STRING)) {
        const modulePathToken = this.advance();
        const modulePath = modulePathToken.value;
        
        // Try to resolve the module and get its exports
        const moduleInfo = this.resolveModule(modulePath);
        
        // Register imports as symbols with resolved types
        for (const spec of specifiers) {
          let importType: LjosType = createUnknown();
          let documentation = `从 '${modulePath}' 导入`;
          
          if (moduleInfo && moduleInfo.exports.has(spec.imported)) {
            const exportedSymbol = moduleInfo.exports.get(spec.imported)!;
            importType = exportedSymbol.type;
            documentation = exportedSymbol.documentation || documentation;
            
            // If it's a class, also register in classTypes
            if (importType.kind === 'class') {
              this.classTypes.set(spec.local, importType);
            }
          }
          
          this.globalScope.symbols.set(spec.local, {
            name: spec.local,
            type: importType,
            kind: 'import',
            isConst: true,
            declarationLine: spec.token?.line || this.previous().line,
            declarationColumn: spec.token?.column || this.previous().column,
            documentation
          });
        }
        
        if (defaultImport) {
          let importType: LjosType = createUnknown();
          let documentation = isNamespace ? `从 '${modulePath}' 导入的命名空间` : `从 '${modulePath}' 导入的默认导出`;
          
          if (moduleInfo) {
            if (isNamespace) {
              // Create a class-like type for namespace
              const nsType = createClass(defaultImport, false);
              for (const [name, sym] of moduleInfo.exports) {
                nsType.members.set(name, {
                  name,
                  type: sym.type,
                  isMethod: sym.kind === 'function',
                  isStatic: true,
                  isAbstract: false,
                  isReadonly: sym.isConst,
                  visibility: 'public'
                });
              }
              importType = nsType;
            } else if (moduleInfo.defaultExport) {
              importType = moduleInfo.defaultExport.type;
              documentation = moduleInfo.defaultExport.documentation || documentation;
              
              // If it's a class, also register in classTypes
              if (importType.kind === 'class') {
                this.classTypes.set(defaultImport, importType);
              }
            }
          }
          
          this.globalScope.symbols.set(defaultImport, {
            name: defaultImport,
            type: importType,
            kind: 'import',
            isConst: true,
            declarationLine: defaultImportToken?.line || this.previous().line,
            declarationColumn: defaultImportToken?.column || this.previous().column,
            documentation
          });
        }
      }
    }
  }

  // Resolve a module path and return its exports
  private resolveModule(modulePath: string): ModuleInfo | undefined {
    // Check cache first
    if (this.resolvedModules.has(modulePath)) {
      return this.resolvedModules.get(modulePath);
    }

    // Try to resolve the module file
    const resolvedPath = this.resolveModulePath(modulePath);
    if (!resolvedPath) {
      return undefined;
    }

    // Try to read and parse the module
    try {
      const fs = require('fs');
      const path = require('path');
      
      if (!fs.existsSync(resolvedPath)) {
        return undefined;
      }

      const source = fs.readFileSync(resolvedPath, 'utf-8');
      
      // Create a new checker for the module (avoid circular dependencies)
      const moduleChecker = new SyntaxChecker();
      moduleChecker.check(source, resolvedPath);
      
      // Collect exports from the module
      const exports = new Map<string, SymbolInfo>();
      let defaultExport: SymbolInfo | undefined;
      
      // Get all symbols that were exported
      for (const [name, sym] of moduleChecker.globalScope.symbols) {
        // In Ljos, exported symbols are tracked during parsing
        // For now, assume all top-level declarations are exported
        exports.set(name, sym);
      }
      
      // Also copy class types
      for (const [name, classType] of moduleChecker.classTypes) {
        if (!this.classTypes.has(name)) {
          this.classTypes.set(name, classType);
        }
      }

      const moduleInfo: ModuleInfo = {
        path: resolvedPath,
        exports,
        defaultExport,
        isResolved: true
      };

      this.resolvedModules.set(modulePath, moduleInfo);
      return moduleInfo;
    } catch {
      return undefined;
    }
  }

  // Resolve module path to absolute file path
  private resolveModulePath(modulePath: string): string | undefined {
    if (!this.currentFile) return undefined;

    try {
      const path = require('path');
      const fs = require('fs');
      
      const currentDir = path.dirname(this.currentFile);
      
      // Handle relative paths
      if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
        let resolved = path.resolve(currentDir, modulePath);
        
        // Try with .lj extension
        if (!resolved.endsWith('.lj')) {
          if (fs.existsSync(resolved + '.lj')) {
            return resolved + '.lj';
          }
          // Try as directory with index.lj
          if (fs.existsSync(path.join(resolved, 'index.lj'))) {
            return path.join(resolved, 'index.lj');
          }
        }
        
        if (fs.existsSync(resolved)) {
          return resolved;
        }
      }
      
      // Handle standard library imports (e.g., "std/io")
      if (modulePath.startsWith('std/')) {
        // Standard library paths would be resolved here
        return undefined;
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  private collectClass(): void {
    const isAbstract = this.match(TokenType.ABSTRACT);
    this.advance(); // consume 'class'
    
    if (!this.checkType(TokenType.IDENTIFIER)) return;
    const nameToken = this.advance();
    const className = nameToken.value;

    // Get existing class type from first pass, or create new one
    let classType = this.classTypes.get(className);
    if (!classType) {
      classType = createClass(className, isAbstract);
      this.classTypes.set(className, classType);
    } else {
      // Update isAbstract in case it wasn't set correctly in first pass
      classType.isAbstract = isAbstract;
    }
    
    // Superclass - now all class names are already registered from first pass
    if (this.match(TokenType.EXTENDS)) {
      if (this.checkType(TokenType.IDENTIFIER)) {
        const superName = this.advance().value;
        const superType = this.classTypes.get(superName);
        if (superType) {
          classType.superClass = superType;
        }
      }
    }

    // Skip implements
    if (this.match(TokenType.IMPLEMENTS)) {
      do {
        if (this.checkType(TokenType.IDENTIFIER)) this.advance();
      } while (this.match(TokenType.COMMA));
    }

    // Parse class body for members
    if (this.match(TokenType.LBRACE)) {
      while (!this.checkType(TokenType.RBRACE) && !this.isAtEnd()) {
        // Skip decorators
        while (this.match(TokenType.AT)) {
          if (this.checkType(TokenType.IDENTIFIER)) this.advance();
          if (this.match(TokenType.LPAREN)) {
            let depth = 1;
            while (depth > 0 && !this.isAtEnd()) {
              if (this.match(TokenType.LPAREN)) depth++;
              else if (this.match(TokenType.RPAREN)) depth--;
              else this.advance();
            }
          }
        }

        const isStatic = this.match(TokenType.STATIC);
        const memberIsAbstract = this.match(TokenType.ABSTRACT);

        if (this.checkType(TokenType.FN)) {
          this.advance();
          if (this.checkType(TokenType.IDENTIFIER)) {
            const methodName = this.advance().value;
            const params = this.collectParams();
            let returnType: LjosType = createUnknown();
            if (this.match(TokenType.COLON)) {
              returnType = this.parseTypeAnnotation();
            }
            classType.members.set(methodName, {
              name: methodName,
              type: createFunction(params, returnType),
              isMethod: true,
              isStatic,
              isAbstract: memberIsAbstract,
              isReadonly: false,
              visibility: 'public'
            });
            this.skipBlock();
          }
        } else if (this.checkType(TokenType.CONST) || this.checkType(TokenType.MUT)) {
          const isConst = this.peek().type === TokenType.CONST;
          this.advance();
          if (this.checkType(TokenType.IDENTIFIER)) {
            const fieldName = this.advance().value;
            let fieldType: LjosType = createUnknown();
            if (this.match(TokenType.COLON)) {
              fieldType = this.parseTypeAnnotation();
            }
            classType.members.set(fieldName, {
              name: fieldName,
              type: fieldType,
              isMethod: false,
              isStatic,
              isAbstract: false,
              isReadonly: isConst,
              visibility: 'public'
            });
            if (this.match(TokenType.ASSIGN)) {
              this.skipExpression();
            }
          }
        } else if (this.checkType(TokenType.CONSTRUCTOR)) {
          this.advance();
          this.collectParams();
          this.skipBlock();
        } else {
          this.advance();
        }
      }
      if (this.checkType(TokenType.RBRACE)) this.advance();
    }

    // Update symbol with full class info
    this.globalScope.symbols.set(className, {
      name: className,
      type: classType,
      kind: 'class',
      isConst: true,
      declarationLine: nameToken.line,
      declarationColumn: nameToken.column,
      documentation: isAbstract ? `抽象类 ${className}` : `类 ${className}`
    });
  }

  private collectParams(): ParameterInfo[] {
    const params: ParameterInfo[] = [];
    if (!this.match(TokenType.LPAREN)) return params;
    
    if (!this.checkType(TokenType.RPAREN)) {
      do {
        if (this.checkType(TokenType.IDENTIFIER)) {
          const name = this.advance().value;
          let type: LjosType = createUnknown();
          let optional = false;
          if (this.match(TokenType.COLON)) {
            type = this.parseTypeAnnotation();
          }
          if (this.match(TokenType.ASSIGN)) {
            optional = true;
            this.skipExpression();
          }
          params.push({ name, type, optional });
        }
      } while (this.match(TokenType.COMMA));
    }
    
    if (this.checkType(TokenType.RPAREN)) this.advance();
    return params;
  }

  private collectEnum(): void {
    this.advance(); // consume 'enum'
    if (!this.checkType(TokenType.IDENTIFIER)) return;
    const nameToken = this.advance();
    
    this.globalScope.symbols.set(nameToken.value, {
      name: nameToken.value,
      type: createUnknown(),
      kind: 'enum',
      isConst: true,
      declarationLine: nameToken.line,
      declarationColumn: nameToken.column,
      documentation: `枚举 ${nameToken.value}`
    });

    this.skipBlock();
  }

  private collectFunction(): void {
    this.advance(); // consume 'fn'
    if (!this.checkType(TokenType.IDENTIFIER)) return;
    const nameToken = this.advance();
    
    const params = this.collectParams();
    let returnType: LjosType = createUnknown();
    if (this.match(TokenType.COLON)) {
      returnType = this.parseTypeAnnotation();
    }

    this.globalScope.symbols.set(nameToken.value, {
      name: nameToken.value,
      type: createFunction(params, returnType),
      kind: 'function',
      isConst: true,
      declarationLine: nameToken.line,
      declarationColumn: nameToken.column,
      documentation: `函数 ${nameToken.value}`
    });

    this.skipBlock();
  }

  private collectVariable(): void {
    const isConst = this.peek().type === TokenType.CONST;
    this.advance();
    if (!this.checkType(TokenType.IDENTIFIER)) return;
    const nameToken = this.advance();
    
    let varType: LjosType = createUnknown();
    if (this.match(TokenType.COLON)) {
      varType = this.parseTypeAnnotation();
    }
    if (this.match(TokenType.ASSIGN)) {
      this.skipExpression();
    }

    this.globalScope.symbols.set(nameToken.value, {
      name: nameToken.value,
      type: varType,
      kind: 'variable',
      isConst,
      declarationLine: nameToken.line,
      declarationColumn: nameToken.column
    });
  }

  private collectTypeAlias(): void {
    this.advance(); // consume 'type'
    if (!this.checkType(TokenType.IDENTIFIER)) return;
    const nameToken = this.advance();
    
    this.globalScope.symbols.set(nameToken.value, {
      name: nameToken.value,
      type: createUnknown(),
      kind: 'type',
      isConst: true,
      declarationLine: nameToken.line,
      declarationColumn: nameToken.column,
      documentation: `类型别名 ${nameToken.value}`
    });

    if (this.match(TokenType.ASSIGN)) {
      this.parseTypeAnnotation();
    }
  }

  private parseTypeAnnotation(): LjosType {
    if (this.checkType(TokenType.IDENTIFIER)) {
      const name = this.advance().value;
      
      // Check built-in types
      if (BUILTIN_TYPES[name]) {
        return BUILTIN_TYPES[name];
      }
      
      // Check class types
      const classType = this.classTypes.get(name);
      if (classType) {
        return classType;
      }
      
      // Generic type
      if (this.match(TokenType.LT)) {
        const typeArgs: LjosType[] = [];
        do {
          typeArgs.push(this.parseTypeAnnotation());
        } while (this.match(TokenType.COMMA));
        if (this.checkType(TokenType.GT)) this.advance();
        return { kind: 'generic', name, typeArguments: typeArgs };
      }
      
      return { kind: 'generic', name, typeArguments: [] };
    }
    
    // Array type: [T]
    if (this.match(TokenType.LBRACKET)) {
      const elementType = this.parseTypeAnnotation();
      if (this.checkType(TokenType.RBRACKET)) this.advance();
      return createArray(elementType);
    }
    
    // Tuple or function type: (T1, T2) or (T1) => R
    if (this.match(TokenType.LPAREN)) {
      const types: LjosType[] = [];
      if (!this.checkType(TokenType.RPAREN)) {
        do {
          types.push(this.parseTypeAnnotation());
        } while (this.match(TokenType.COMMA));
      }
      if (this.checkType(TokenType.RPAREN)) this.advance();
      
      // Function type
      if (this.match(TokenType.COLON)) {
        const returnType = this.parseTypeAnnotation();
        return createFunction(types.map((t, i) => ({ name: `arg${i}`, type: t, optional: false })), returnType);
      }
      
      return { kind: 'tuple', elementTypes: types };
    }
    
    return createUnknown();
  }

  private skipBlock(): void {
    if (!this.match(TokenType.LBRACE)) return;
    let depth = 1;
    while (depth > 0 && !this.isAtEnd()) {
      if (this.match(TokenType.LBRACE)) depth++;
      else if (this.match(TokenType.RBRACE)) depth--;
      else this.advance();
    }
  }

  private skipExpression(): void {
    let depth = 0;
    while (!this.isAtEnd()) {
      if (this.checkType(TokenType.LPAREN) || this.checkType(TokenType.LBRACE) || this.checkType(TokenType.LBRACKET)) {
        depth++;
        this.advance();
      } else if (this.checkType(TokenType.RPAREN) || this.checkType(TokenType.RBRACE) || this.checkType(TokenType.RBRACKET)) {
        if (depth === 0) break;
        depth--;
        this.advance();
      } else if (depth === 0 && (this.checkType(TokenType.COMMA) || this.checkType(TokenType.SEMICOLON))) {
        break;
      } else if (depth === 0 && this.isDeclarationStart()) {
        // Stop at declaration keywords to avoid consuming next statement
        break;
      } else {
        this.advance();
      }
    }
  }

  private isDeclarationStart(): boolean {
    return this.checkType(TokenType.CLASS) ||
           this.checkType(TokenType.FN) ||
           this.checkType(TokenType.CONST) ||
           this.checkType(TokenType.MUT) ||
           this.checkType(TokenType.ENUM) ||
           this.checkType(TokenType.TYPE) ||
           this.checkType(TokenType.IMPORT) ||
           this.checkType(TokenType.EXPORT) ||
           this.checkType(TokenType.ABSTRACT) ||
           this.checkType(TokenType.IF) ||
           this.checkType(TokenType.FOR) ||
           this.checkType(TokenType.WHILE) ||
           this.checkType(TokenType.RETURN) ||
           this.checkType(TokenType.THROW) ||
           this.checkType(TokenType.TRY);
  }

  private addDiagnostic(
    code: ErrorCode,
    line: number,
    column: number,
    endLine: number,
    endColumn: number,
    severity: 'error' | 'warning' | 'info',
    ...args: string[]
  ): void {
    this.diagnostics.push({
      message: formatError(code, ...args),
      code: `${code}`,
      line,
      column,
      endLine,
      endColumn,
      severity
    });
  }

  private addDiagnosticFromError(error: ParserError): void {
    this.diagnostics.push({
      message: error.message,
      code: `${error.code}`,
      line: error.token.line,
      column: error.token.column,
      endLine: error.token.line,
      endColumn: error.token.column + error.token.value.length,
      severity: 'error'
    });
  }

  private addHoverInfo(token: Token, type: LjosType, doc?: string): void {
    let content = this.formatHoverContent(token.value, type);
    if (doc) {
      content += `\n\n${doc}`;
    }
    this.hoverInfos.push({
      content,
      line: token.line,
      column: token.column,
      endColumn: token.column + token.value.length
    });
  }

  private formatHoverContent(name: string, type: LjosType): string {
    // Use code block with ljos syntax highlighting
    switch (type.kind) {
      case 'function': {
        const params = type.params.map(p => {
          let paramStr = `${p.name}: ${typeToString(p.type)}`;
          if (p.optional) {
            paramStr += ' = ...';
          }
          return paramStr;
        }).join(', ');
        const returnTypeStr = typeToString(type.returnType);
        return `\`\`\`ljos\nfn ${name}(${params}): ${returnTypeStr}\n\`\`\``;
      }
      case 'class': {
        // Show class info with inherited members
        const allMembers = getAllClassMembers(type);
        const members: string[] = [];
        
        // Show superclass if exists
        let header = type.isAbstract ? 'abstract ' : '';
        header += `class ${name}`;
        if (type.superClass) {
          header += ` extends ${type.superClass.name}`;
        }
        
        allMembers.forEach((member, memberName) => {
          const visibility = member.visibility !== 'public' ? `${member.visibility} ` : '';
          const staticMod = member.isStatic ? 'static ' : '';
          
          if (member.isMethod) {
            const fnType = member.type as FunctionType;
            const params = fnType.params.map(p => `${p.name}: ${typeToString(p.type)}`).join(', ');
            members.push(`  ${visibility}${staticMod}fn ${memberName}(${params}): ${typeToString(fnType.returnType)}`);
          } else {
            const readonly = member.isReadonly ? 'const' : 'mut';
            members.push(`  ${visibility}${staticMod}${readonly} ${memberName}: ${typeToString(member.type)}`);
          }
        });
        
        // Limit display to 6 lines, then fold
        const maxLines = 6;
        let memberStr: string;
        if (members.length === 0) {
          memberStr = ' ';
        } else if (members.length <= maxLines) {
          memberStr = `\n${members.join('\n')}\n`;
        } else {
          memberStr = `\n${members.slice(0, maxLines - 1).join('\n')}\n  ... (${members.length - maxLines + 1} more)\n`;
        }
        
        return `\`\`\`ljos\n${header} {${memberStr}}\n\`\`\``;
      }
      case 'map': {
        // Format object/map type with expanded keys
        return `\`\`\`ljos\n${name}: {${typeToString(type.keyType)}: ${typeToString(type.valueType)}}\n\`\`\``;
      }
      case 'array':
        return `\`\`\`ljos\n${name}: [${typeToString(type.elementType)}]\n\`\`\``;
      case 'tuple': {
        const elements = type.elementTypes.map(t => typeToString(t)).join(', ');
        return `\`\`\`ljos\n${name}: (${elements})\n\`\`\``;
      }
      case 'union': {
        const types = type.types.map(t => typeToString(t)).join(' | ');
        return `\`\`\`ljos\n${name}: ${types}\n\`\`\``;
      }
      case 'object': {
        // Format object literal type with expanded properties
        return this.formatObjectTypeHover(name, type.properties);
      }
      case 'primitive':
      case 'generic':
      default:
        return `\`\`\`ljos\n${name}: ${typeToString(type)}\n\`\`\``;
    }
  }

  // Format object literal type for hover display
  private formatObjectTypeHover(name: string, properties: Map<string, LjosType>): string {
    const lines: string[] = [];
    const maxLines = 4;
    let count = 0;
    
    for (const [key, valueType] of properties) {
      if (count >= maxLines) {
        lines.push(`  ... (${properties.size - count} more)`);
        break;
      }
      
      // Recursively format nested objects
      if (valueType.kind === 'object' && valueType.properties.size > 0) {
        const nestedStr = this.formatNestedObject(valueType.properties, 1);
        lines.push(`  ${key}: ${nestedStr}`);
      } else if (valueType.kind === 'class' && valueType.members.size > 0) {
        const nestedProps = new Map<string, LjosType>();
        for (const [memberName, member] of valueType.members) {
          nestedProps.set(memberName, member.type);
        }
        const nestedStr = this.formatNestedObject(nestedProps, 1);
        lines.push(`  ${key}: ${nestedStr}`);
      } else {
        lines.push(`  ${key}: ${typeToString(valueType)}`);
      }
      count++;
    }
    
    if (lines.length === 0) {
      return `\`\`\`ljos\n${name}: {}\n\`\`\``;
    }
    
    return `\`\`\`ljos\n${name}: {\n${lines.join(',\n')}\n}\n\`\`\``;
  }

  private formatNestedObject(properties: Map<string, LjosType>, depth: number): string {
    if (depth > 2) {
      return '{...}'; // Limit nesting depth
    }
    
    const indent = '  '.repeat(depth + 1);
    const lines: string[] = [];
    const maxLines = 4;
    let count = 0;
    
    for (const [key, valueType] of properties) {
      if (count >= maxLines) {
        lines.push(`${indent}...`);
        break;
      }
      
      if (valueType.kind === 'object' && valueType.properties.size > 0) {
        lines.push(`${indent}${key}: ${this.formatNestedObject(valueType.properties, depth + 1)}`);
      } else if (valueType.kind === 'class' && valueType.members.size > 0) {
        const nestedProps = new Map<string, LjosType>();
        for (const [memberName, member] of valueType.members) {
          nestedProps.set(memberName, member.type);
        }
        lines.push(`${indent}${key}: ${this.formatNestedObject(nestedProps, depth + 1)}`);
      } else {
        lines.push(`${indent}${key}: ${typeToString(valueType)}`);
      }
      count++;
    }
    
    const closeIndent = '  '.repeat(depth);
    return `{\n${lines.join(',\n')}\n${closeIndent}}`;
  }

  // ==================== Parser Methods ====================

  private program(): void {
    while (!this.isAtEnd()) {
      try {
        this.declaration();
      } catch (error) {
        if (error instanceof ParserError) {
          this.addDiagnosticFromError(error);
          this.synchronize();
        } else {
          throw error;
        }
      }
    }
  }

  private declaration(): void {
    if (this.checkType(TokenType.AT)) {
      this.decorators();
    }

    if (this.checkType(TokenType.IMPORT)) {
      this.importStatement();
    } else if (this.checkType(TokenType.EXPORT)) {
      this.exportStatement();
    } else if (this.checkType(TokenType.ABSTRACT) || this.checkType(TokenType.CLASS)) {
      this.classDeclaration();
    } else if (this.checkType(TokenType.ENUM)) {
      this.enumDeclaration();
    } else if (this.checkType(TokenType.FN)) {
      this.functionDeclaration();
    } else if (this.checkType(TokenType.CONST) || this.checkType(TokenType.MUT)) {
      this.variableDeclaration();
    } else if (this.checkType(TokenType.TYPE)) {
      this.typeAliasDeclaration();
    } else {
      this.statement();
    }
  }

  private decorators(): void {
    while (this.match(TokenType.AT)) {
      this.consume(ErrorCode.EXPECTED_DECORATOR_NAME, TokenType.IDENTIFIER);
      if (this.match(TokenType.LPAREN)) {
        if (!this.checkType(TokenType.RPAREN)) {
          do {
            this.expression();
          } while (this.match(TokenType.COMMA));
        }
        this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
      }
    }
  }

  private importStatement(): void {
    this.advance(); // consume 'import'
    
    if (this.checkType(TokenType.LBRACE)) {
      this.advance();
      do {
        const importedToken = this.consume(ErrorCode.EXPECTED_IDENTIFIER, TokenType.IDENTIFIER);
        if (this.match(TokenType.AS)) {
          this.consume(ErrorCode.EXPECTED_IDENTIFIER, TokenType.IDENTIFIER);
        }
        // Add hover info for import
        const symbol = this.lookupSymbol(importedToken.value);
        if (symbol) {
          this.addHoverInfo(importedToken, symbol.type, symbol.documentation);
        }
      } while (this.match(TokenType.COMMA));
      this.consume(ErrorCode.EXPECTED_RBRACE, TokenType.RBRACE);
    } else if (this.checkType(TokenType.STAR)) {
      this.advance();
      this.consume(ErrorCode.EXPECTED_AS, TokenType.AS);
      this.consume(ErrorCode.EXPECTED_IDENTIFIER, TokenType.IDENTIFIER);
    } else {
      this.consume(ErrorCode.EXPECTED_IDENTIFIER, TokenType.IDENTIFIER);
    }

    this.consume(ErrorCode.EXPECTED_COLON, TokenType.COLON);
    const pathToken = this.consume(ErrorCode.UNEXPECTED_TOKEN, TokenType.STRING);
    
    // Check if module exists (simplified check)
    const modulePath = pathToken.value;
    if (!this.isValidModulePath(modulePath)) {
      this.addDiagnostic(
        ErrorCode.MODULE_NOT_FOUND,
        pathToken.line, pathToken.column,
        pathToken.line, pathToken.column + pathToken.value.length + 2,
        'error',
        modulePath
      );
    }
  }

  private isValidModulePath(path: string): boolean {
    // Standard library paths are always valid
    if (path.startsWith('/std/')) return true;
    // Relative paths - would need file system access to verify
    if (path.startsWith('./') || path.startsWith('../')) return true;
    return true; // For now, accept all paths
  }

  private exportStatement(): void {
    this.advance(); // consume 'export'

    if (this.match(TokenType.DEFAULT)) {
      this.expression();
    } else if (this.match(TokenType.STAR)) {
      this.consume(ErrorCode.EXPECTED_COLON, TokenType.COLON);
      this.consume(ErrorCode.UNEXPECTED_TOKEN, TokenType.STRING);
    } else {
      this.declaration();
    }
  }

  private classDeclaration(): void {
    const isAbstract = this.match(TokenType.ABSTRACT);
    this.consume(ErrorCode.UNEXPECTED_TOKEN, TokenType.CLASS);
    const nameToken = this.consume(ErrorCode.EXPECTED_CLASS_NAME, TokenType.IDENTIFIER);

    const classType = this.classTypes.get(nameToken.value);
    if (classType) {
      this.addHoverInfo(nameToken, classType, isAbstract ? `抽象类 ${nameToken.value}` : `类 ${nameToken.value}`);
    }

    if (this.match(TokenType.EXTENDS)) {
      const superToken = this.consume(ErrorCode.EXPECTED_SUPERCLASS_NAME, TokenType.IDENTIFIER);
      const superType = this.classTypes.get(superToken.value);
      if (!superType) {
        this.addDiagnostic(
          ErrorCode.CANNOT_RESOLVE_SYMBOL,
          superToken.line, superToken.column,
          superToken.line, superToken.column + superToken.value.length,
          'error',
          superToken.value
        );
      }
    }

    if (this.match(TokenType.IMPLEMENTS)) {
      do {
        this.consume(ErrorCode.EXPECTED_INTERFACE_NAME, TokenType.IDENTIFIER);
      } while (this.match(TokenType.COMMA));
    }

    this.consume(ErrorCode.EXPECTED_LBRACE, TokenType.LBRACE);

    // Create class scope
    const classScope: Scope = { parent: this.currentScope, symbols: new Map() };
    if (classType) {
      classScope.symbols.set('this', {
        name: 'this',
        type: classType,
        kind: 'variable',
        isConst: true,
        declarationLine: nameToken.line,
        declarationColumn: nameToken.column
      });
    }
    this.currentScope = classScope;

    while (!this.checkType(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.checkType(TokenType.AT)) {
        this.decorators();
      }

      // Parse access modifier (public, private, protected)
      let accessibility: 'public' | 'private' | 'protected' = 'public';
      if (this.match(TokenType.PUBLIC)) {
        accessibility = 'public';
      } else if (this.match(TokenType.PRIVATE)) {
        accessibility = 'private';
      } else if (this.match(TokenType.PROTECTED)) {
        accessibility = 'protected';
      }

      // Parse readonly modifier
      const isReadonly = this.match(TokenType.READONLY);

      const isStatic = this.match(TokenType.STATIC);
      const memberIsAbstract = this.match(TokenType.ABSTRACT);

      if (this.checkType(TokenType.FN)) {
        this.methodDeclaration(isStatic, memberIsAbstract, accessibility);
      } else if (this.checkType(TokenType.CONST) || this.checkType(TokenType.MUT)) {
        this.fieldDeclaration(isStatic, isReadonly, accessibility);
      } else if (this.checkType(TokenType.CONSTRUCTOR)) {
        this.constructorDeclaration(accessibility);
      } else {
        throw new ParserError(ErrorCode.UNEXPECTED_TOKEN_IN_CLASS_BODY, this.peek());
      }
    }

    this.currentScope = classScope.parent!;
    this.consume(ErrorCode.EXPECTED_RBRACE, TokenType.RBRACE);
  }

  private methodDeclaration(isStatic: boolean, isAbstract: boolean, accessibility: 'public' | 'private' | 'protected' = 'public'): void {
    this.advance(); // consume 'fn'
    const nameToken = this.consume(ErrorCode.EXPECTED_FUNCTION_NAME, TokenType.IDENTIFIER);
    
    this.consume(ErrorCode.EXPECTED_LPAREN, TokenType.LPAREN);
    this.parameterList();
    this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);

    if (this.match(TokenType.COLON)) {
      this.typeAnnotation();
    }

    if (isAbstract) {
      // Abstract methods don't have body
      return;
    }

    this.blockStatement();
  }

  private fieldDeclaration(isStatic: boolean, isReadonly: boolean = false, accessibility: 'public' | 'private' | 'protected' = 'public'): void {
    const isConst = this.peek().type === TokenType.CONST;
    this.advance();
    const nameToken = this.consume(ErrorCode.EXPECTED_VARIABLE_NAME, TokenType.IDENTIFIER);

    let hasType = false;
    if (this.match(TokenType.COLON)) {
      this.typeAnnotation();
      hasType = true;
    }

    if (this.match(TokenType.ASSIGN)) {
      this.expression();
    } else if (!hasType) {
      throw new ParserError(ErrorCode.EXPECTED_INITIALIZER_OR_TYPE, this.peek());
    }
  }

  private constructorDeclaration(accessibility: 'public' | 'private' | 'protected' = 'public'): void {
    this.advance(); // consume 'constructor'
    this.consume(ErrorCode.EXPECTED_LPAREN, TokenType.LPAREN);
    this.parameterList();
    this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
    this.blockStatement();
  }

  private enumDeclaration(): void {
    this.advance(); // consume 'enum'
    this.consume(ErrorCode.EXPECTED_ENUM_NAME, TokenType.IDENTIFIER);
    this.consume(ErrorCode.EXPECTED_LBRACE, TokenType.LBRACE);

    while (!this.checkType(TokenType.RBRACE) && !this.isAtEnd()) {
      this.consume(ErrorCode.EXPECTED_IDENTIFIER, TokenType.IDENTIFIER);
      if (!this.match(TokenType.COMMA)) break;
    }

    this.consume(ErrorCode.EXPECTED_RBRACE, TokenType.RBRACE);
  }

  private functionDeclaration(): void {
    this.advance(); // consume 'fn'
    const nameToken = this.consume(ErrorCode.EXPECTED_FUNCTION_NAME, TokenType.IDENTIFIER);

    // Add hover info
    const symbol = this.lookupSymbol(nameToken.value);
    if (symbol) {
      this.addHoverInfo(nameToken, symbol.type, symbol.documentation);
    }

    // Generic type parameters
    if (this.match(TokenType.LT)) {
      do {
        this.consume(ErrorCode.EXPECTED_IDENTIFIER, TokenType.IDENTIFIER);
      } while (this.match(TokenType.COMMA));
      this.consume(ErrorCode.EXPECTED_GT, TokenType.GT);
    }

    this.consume(ErrorCode.EXPECTED_LPAREN, TokenType.LPAREN);
    
    // Create function scope
    const fnScope: Scope = { parent: this.currentScope, symbols: new Map() };
    this.currentScope = fnScope;
    
    this.parameterList();
    this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);

    if (this.match(TokenType.COLON)) {
      this.typeAnnotation();
    }

    this.blockStatement();
    this.currentScope = fnScope.parent!;
  }

  private parameterList(): void {
    if (!this.checkType(TokenType.RPAREN)) {
      do {
        const paramToken = this.consume(ErrorCode.EXPECTED_PARAMETER_NAME, TokenType.IDENTIFIER);
        let paramType: LjosType = createUnknown();
        
        if (this.match(TokenType.COLON)) {
          paramType = this.parseTypeAnnotation();
          // Skip the type annotation parsing in the checker (already done in parseTypeAnnotation)
        }
        
        // Register parameter in current scope
        this.currentScope.symbols.set(paramToken.value, {
          name: paramToken.value,
          type: paramType,
          kind: 'parameter',
          isConst: true,
          declarationLine: paramToken.line,
          declarationColumn: paramToken.column
        });
        
        this.addHoverInfo(paramToken, paramType);
        
        if (this.match(TokenType.ASSIGN)) {
          this.expression();
        }
      } while (this.match(TokenType.COMMA));
    }
  }

  private variableDeclaration(noSemicolon: boolean = false): void {
    const isConst = this.peek().type === TokenType.CONST;
    this.advance();
    const nameToken = this.consume(ErrorCode.EXPECTED_VARIABLE_NAME, TokenType.IDENTIFIER);

    let varType: LjosType = createUnknown();
    let hasType = false;
    
    if (this.match(TokenType.COLON)) {
      varType = this.parseTypeAnnotation();
      hasType = true;
    }

    if (this.match(TokenType.ASSIGN)) {
      const exprType = noSemicolon ? this.expressionNoSemicolon() : this.expressionWithType();
      if (!hasType) {
        varType = exprType;
      }
    } else if (!hasType) {
      throw new ParserError(ErrorCode.EXPECTED_INITIALIZER_OR_TYPE, this.peek());
    }

    // Register in current scope
    this.currentScope.symbols.set(nameToken.value, {
      name: nameToken.value,
      type: varType,
      kind: 'variable',
      isConst,
      declarationLine: nameToken.line,
      declarationColumn: nameToken.column
    });

    this.addHoverInfo(nameToken, varType);
  }

  private typeAliasDeclaration(): void {
    this.advance(); // consume 'type'
    this.consume(ErrorCode.EXPECTED_TYPE_NAME, TokenType.IDENTIFIER);
    this.consume(ErrorCode.EXPECTED_ASSIGN, TokenType.ASSIGN);
    this.typeAnnotation();
  }

  private statement(): void {
    if (this.checkType(TokenType.IF)) {
      this.ifStatement();
    } else if (this.checkType(TokenType.FOR)) {
      this.forStatement();
    } else if (this.checkType(TokenType.WHILE)) {
      this.whileStatement();
    } else if (this.checkType(TokenType.DO)) {
      this.doWhileStatement();
    } else if (this.checkType(TokenType.WHEN)) {
      this.whenStatement();
    } else if (this.checkType(TokenType.RETURN)) {
      this.returnStatement();
    } else if (this.checkType(TokenType.BREAK)) {
      this.breakStatement();
    } else if (this.checkType(TokenType.CONTINUE)) {
      this.advance();
    } else if (this.checkType(TokenType.THROW)) {
      this.throwStatement();
    } else if (this.checkType(TokenType.TRY)) {
      this.tryStatement();
    } else if (this.checkType(TokenType.DEFER)) {
      this.deferStatement();
    } else if (this.checkType(TokenType.USING)) {
      this.usingStatement();
    } else if (this.checkType(TokenType.LBRACE)) {
      this.blockStatement();
    } else {
      this.expression();
    }
  }

  private ifStatement(): void {
    this.advance(); // consume 'if'
    this.consume(ErrorCode.EXPECTED_LPAREN, TokenType.LPAREN);
    this.expression();
    this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
    this.blockStatement();

    if (this.match(TokenType.ELSE)) {
      if (this.checkType(TokenType.LPAREN)) {
        this.consume(ErrorCode.EXPECTED_LPAREN, TokenType.LPAREN);
        this.expression();
        this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
        this.blockStatement();
        if (this.match(TokenType.ELSE)) {
          if (this.checkType(TokenType.IF)) {
            this.ifStatement();
          } else {
            this.blockStatement();
          }
        }
      } else if (this.checkType(TokenType.IF)) {
        this.ifStatement();
      } else {
        this.blockStatement();
      }
    }
  }

  private forStatement(): void {
    this.advance(); // consume 'for'

    if (this.checkType(TokenType.LBRACE)) {
      this.blockStatement();
      return;
    }

    this.consume(ErrorCode.EXPECTED_LPAREN, TokenType.LPAREN);

    // For-in loop
    if (this.checkType(TokenType.IDENTIFIER) && this.peekNext()?.type === TokenType.IN) {
      this.advance();
      this.consume(ErrorCode.EXPECTED_IN, TokenType.IN);
      this.expression();
      this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
      this.blockStatement();
      return;
    }

    // Traditional for loop - use noSemicolon expressions to avoid consuming ; as logical OR
    if (this.checkType(TokenType.CONST) || this.checkType(TokenType.MUT)) {
      this.variableDeclaration(true);
    } else if (!this.checkType(TokenType.SEMICOLON)) {
      this.expressionNoSemicolon();
      if (this.checkType(TokenType.RPAREN)) {
        this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
        this.blockStatement();
        return;
      }
    }

    this.consume(ErrorCode.EXPECTED_SEMICOLON, TokenType.SEMICOLON);
    if (!this.checkType(TokenType.SEMICOLON)) {
      this.expressionNoSemicolon();
    }
    this.consume(ErrorCode.EXPECTED_SEMICOLON, TokenType.SEMICOLON);
    if (!this.checkType(TokenType.RPAREN)) {
      this.expressionNoSemicolon();
    }
    this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
    this.blockStatement();
  }

  private whileStatement(): void {
    this.advance(); // consume 'while'
    this.consume(ErrorCode.EXPECTED_LPAREN, TokenType.LPAREN);
    this.expression();
    this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
    this.blockStatement();
  }

  private doWhileStatement(): void {
    this.advance(); // consume 'do'
    this.blockStatement();
    this.consume(ErrorCode.EXPECTED_WHILE, TokenType.WHILE);
    this.consume(ErrorCode.EXPECTED_LPAREN, TokenType.LPAREN);
    this.expression();
    this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
  }

  private whenStatement(): void {
    this.advance(); // consume 'when'

    if (this.match(TokenType.LPAREN)) {
      this.expression();
      this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
    }

    this.consume(ErrorCode.EXPECTED_LBRACE, TokenType.LBRACE);

    while (!this.checkType(TokenType.RBRACE) && !this.isAtEnd()) {
      if (!this.match(TokenType.ELSE)) {
        // Use expressionNoComma to avoid consuming comma as logical AND
        this.expressionNoComma();
      }
      
      if (this.checkType(TokenType.LBRACE)) {
        this.blockStatement();
      } else {
        this.consume(ErrorCode.EXPECTED_ARROW, TokenType.ARROW);
        if (this.checkType(TokenType.LBRACE)) {
          this.blockStatement();
        } else {
          // Use expressionNoComma for result expression as well
          this.expressionNoComma();
        }
      }
      // Consume optional comma separator between branches
      this.match(TokenType.COMMA);
    }

    this.consume(ErrorCode.EXPECTED_RBRACE, TokenType.RBRACE);
  }

  private returnStatement(): void {
    this.advance();
    if (!this.checkType(TokenType.RBRACE) && !this.isAtEnd()) {
      this.expression();
    }
  }

  private breakStatement(): void {
    this.advance();
    if (!this.checkType(TokenType.RBRACE) && !this.checkType(TokenType.CASE) && !this.isAtEnd()) {
      // Don't try to parse expression if at block end
    }
  }

  private throwStatement(): void {
    this.advance();
    this.expression();
  }

  private tryStatement(): void {
    this.advance();
    this.blockStatement();

    while (this.match(TokenType.CATCH)) {
      if (this.match(TokenType.LPAREN)) {
        this.consume(ErrorCode.EXPECTED_PARAMETER_NAME, TokenType.IDENTIFIER);
        if (this.match(TokenType.COLON)) {
          this.typeAnnotation();
        }
        this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
      }
      this.blockStatement();
    }

    if (this.match(TokenType.FINALLY)) {
      this.blockStatement();
    }
  }

  private deferStatement(): void {
    this.advance(); // consume 'defer'
    if (this.checkType(TokenType.LBRACE)) {
      this.blockStatement();
    } else {
      this.expression();
    }
  }

  private usingStatement(): void {
    this.advance(); // consume 'using'
    this.consume(ErrorCode.EXPECTED_LPAREN, TokenType.LPAREN);
    this.consume(ErrorCode.EXPECTED_IDENTIFIER, TokenType.IDENTIFIER);
    this.consume(ErrorCode.EXPECTED_ASSIGN, TokenType.ASSIGN);
    this.expression();
    this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
    this.blockStatement();
  }

  private blockStatement(): void {
    this.consume(ErrorCode.EXPECTED_LBRACE, TokenType.LBRACE);
    
    const blockScope: Scope = { parent: this.currentScope, symbols: new Map() };
    this.currentScope = blockScope;
    
    while (!this.checkType(TokenType.RBRACE) && !this.isAtEnd()) {
      this.declaration();
    }
    
    this.currentScope = blockScope.parent!;
    this.consume(ErrorCode.EXPECTED_RBRACE, TokenType.RBRACE);
  }

  private expression(): void {
    this.expressionWithType();
  }

  private expressionWithType(): LjosType {
    return this.assignment();
  }

  // Expression without treating semicolon as logical OR (for for-loop contexts)
  private expressionNoSemicolon(): LjosType {
    return this.assignmentNoSemicolon();
  }

  private assignmentNoSemicolon(): LjosType {
    const type = this.logicalOrNoSemicolon();

    if (this.match(TokenType.ASSIGN, TokenType.PLUS_ASSIGN, TokenType.MINUS_ASSIGN,
                   TokenType.STAR_ASSIGN, TokenType.SLASH_ASSIGN, TokenType.PERCENT_ASSIGN)) {
      this.assignmentNoSemicolon();
    }

    return type;
  }

  private logicalOrNoSemicolon(): LjosType {
    let type = this.logicalAnd();
    while (this.match(TokenType.PIPE)) {
      this.logicalAnd();
      type = createPrimitive('bool');
    }
    return type;
  }

  // Expression without treating comma as logical AND (for when-expression contexts)
  private expressionNoComma(): LjosType {
    return this.assignmentNoComma();
  }

  private assignmentNoComma(): LjosType {
    const type = this.logicalOrNoComma();

    if (this.match(TokenType.ASSIGN, TokenType.PLUS_ASSIGN, TokenType.MINUS_ASSIGN,
                   TokenType.STAR_ASSIGN, TokenType.SLASH_ASSIGN, TokenType.PERCENT_ASSIGN)) {
      this.assignmentNoComma();
    }

    return type;
  }

  private logicalOrNoComma(): LjosType {
    let type = this.logicalAndNoComma();
    while (this.match(TokenType.PIPE, TokenType.SEMICOLON)) {
      this.logicalAndNoComma();
      type = createPrimitive('bool');
    }
    return type;
  }

  private logicalAndNoComma(): LjosType {
    let type = this.equality();
    while (this.match(TokenType.AMP)) {
      this.equality();
      type = createPrimitive('bool');
    }
    return type;
  }

  private assignment(): LjosType {
    const type = this.logicalOr();

    if (this.match(TokenType.ASSIGN, TokenType.PLUS_ASSIGN, TokenType.MINUS_ASSIGN,
                   TokenType.STAR_ASSIGN, TokenType.SLASH_ASSIGN, TokenType.PERCENT_ASSIGN)) {
      this.assignment();
    }

    return type;
  }

  private logicalOr(): LjosType {
    let type = this.logicalAnd();
    while (this.match(TokenType.PIPE, TokenType.SEMICOLON)) {
      this.logicalAnd();
      type = createPrimitive('bool');
    }
    return type;
  }

  private logicalAnd(): LjosType {
    let type = this.equality();
    while (this.match(TokenType.AMP, TokenType.COMMA)) {
      this.equality();
      type = createPrimitive('bool');
    }
    return type;
  }

  private equality(): LjosType {
    let type = this.comparison();
    while (this.match(TokenType.EQ, TokenType.NE)) {
      this.comparison();
      type = createPrimitive('bool');
    }
    return type;
  }

  private comparison(): LjosType {
    let type = this.term();
    while (this.match(TokenType.LT, TokenType.GT, TokenType.LE, TokenType.GE)) {
      this.term();
      type = createPrimitive('bool');
    }
    return type;
  }

  private term(): LjosType {
    let type = this.factor();
    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      this.factor();
    }
    return type;
  }

  private factor(): LjosType {
    let type = this.unary();
    while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
      this.unary();
    }
    return type;
  }

  private unary(): LjosType {
    if (this.match(TokenType.BANG, TokenType.MINUS)) {
      return this.unary();
    }

    // typeof
    if (this.match(TokenType.TYPEOF)) {
      if (this.match(TokenType.LPAREN)) {
        this.expression();
        this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
      } else {
        this.unary();
      }
      return createPrimitive('Str');
    }

    // void
    if (this.match(TokenType.VOID)) {
      if (this.match(TokenType.LPAREN)) {
        this.expression();
        this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
      } else {
        this.unary();
      }
      return createNull();
    }

    // delete
    if (this.match(TokenType.DELETE)) {
      this.unary();
      return createPrimitive('Bool');
    }

    // yield
    if (this.match(TokenType.YIELD)) {
      this.match(TokenType.STAR);
      if (!this.checkType(TokenType.SEMICOLON) && !this.checkType(TokenType.RBRACE) && !this.isAtEnd()) {
        this.expression();
      }
      return createUnknown();
    }

    return this.postfix();
  }

  private postfix(): LjosType {
    let type = this.call();

    if (this.match(TokenType.IS)) {
      this.typeAnnotation();
      return createPrimitive('Bool');
    } else if (this.match(TokenType.OF)) {
      return this.parseTypeAnnotation();
    } else if (this.match(TokenType.INSTANCEOF)) {
      this.unary();
      return createPrimitive('Bool');
    }

    return type;
  }

  private call(): LjosType {
    let type = this.primary();
    const startToken = this.previous();

    while (true) {
      if (this.match(TokenType.LPAREN)) {
        this.argumentList();
        this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
        // Get return type if function
        if (type.kind === 'function') {
          type = type.returnType;
        } else if (type.kind !== 'unknown') {
          // Report error: not callable
          this.addDiagnostic(
            ErrorCode.NOT_CALLABLE,
            startToken.line, startToken.column,
            startToken.line, startToken.column + startToken.value.length,
            'error',
            typeToString(type)
          );
          type = createUnknown();
        } else {
          type = createUnknown();
        }
      } else if (this.match(TokenType.DOT, TokenType.SAFE_DOT)) {
        const propToken = this.consume(ErrorCode.EXPECTED_PROPERTY_NAME, TokenType.IDENTIFIER);
        
        // Look up member type (including inherited members)
        if (type.kind === 'class') {
          const member = getClassMember(type, propToken.value);
          if (member) {
            this.addHoverInfo(propToken, member.type);
            type = member.type;
          } else {
            this.addDiagnostic(
              ErrorCode.PROPERTY_NOT_EXIST,
              propToken.line, propToken.column,
              propToken.line, propToken.column + propToken.value.length,
              'error',
              propToken.value, type.name
            );
            type = createUnknown();
          }
        } else {
          type = createUnknown();
        }
      } else if (this.match(TokenType.LBRACKET)) {
        this.expression();
        this.consume(ErrorCode.EXPECTED_RBRACKET, TokenType.RBRACKET);
        if (type.kind === 'array') {
          type = type.elementType;
        } else {
          type = createUnknown();
        }
      } else if (this.match(TokenType.RANGE)) {
        this.expression();
        type = createArray(createPrimitive('int'));
      } else if (this.match(TokenType.SEND)) {
        this.expression();
        type = createUnknown();
      } else {
        break;
      }
    }

    return type;
  }

  private argumentList(): void {
    if (!this.checkType(TokenType.RPAREN)) {
      do {
        this.expression();
      } while (this.match(TokenType.COMMA));
    }
  }

  private primary(): LjosType {
    if (this.checkType(TokenType.AT)) {
      this.decorators();
      return createUnknown();
    }

    if (this.match(TokenType.NUL, TokenType.NULL)) {
      return createNull();
    }

    if (this.match(TokenType.TRUE, TokenType.FALSE)) {
      return createPrimitive('Bool');
    }

    if (this.match(TokenType.NUMBER)) {
      const value = this.previous().value;
      if (value.includes('.') || value.includes('e') || value.includes('E')) {
        return createPrimitive('Float');
      }
      return createPrimitive('Int');
    }

    if (this.match(TokenType.STRING, TokenType.RAW_STRING)) {
      return createPrimitive('Str');
    }

    if (this.match(TokenType.THIS)) {
      const thisSymbol = this.lookupSymbol('this');
      return thisSymbol?.type || createUnknown();
    }

    if (this.match(TokenType.SUPER)) {
      return createUnknown();
    }

    if (this.checkType(TokenType.IDENTIFIER)) {
      const token = this.advance();
      const symbol = this.lookupSymbol(token.value);
      
      if (symbol) {
        this.addHoverInfo(token, symbol.type, symbol.documentation);
        return symbol.type;
      } else {
        this.addDiagnostic(
          ErrorCode.CANNOT_RESOLVE_SYMBOL,
          token.line, token.column,
          token.line, token.column + token.value.length,
          'error',
          token.value
        );
        return createUnknown();
      }
    }

    if (this.match(TokenType.LPAREN)) {
      // Check for arrow function
      if (this.checkType(TokenType.RPAREN)) {
        this.advance();
        this.consume(ErrorCode.EXPECTED_ARROW, TokenType.ARROW);
        if (this.checkType(TokenType.LBRACE)) {
          this.blockStatement();
        } else {
          this.expression();
        }
        return createFunction([], createUnknown());
      }

      const savedPos = this.current;
      let isArrow = false;
      let depth = 1;
      
      while (depth > 0 && !this.isAtEnd()) {
        if (this.peek().type === TokenType.LPAREN) depth++;
        else if (this.peek().type === TokenType.RPAREN) depth--;
        this.current++;
      }
      
      if (!this.isAtEnd() && this.peek().type === TokenType.ARROW) {
        isArrow = true;
      }
      
      this.current = savedPos;

      if (isArrow) {
        const params = this.collectParams();
        this.consume(ErrorCode.EXPECTED_ARROW, TokenType.ARROW);
        if (this.checkType(TokenType.LBRACE)) {
          this.blockStatement();
        } else {
          this.expression();
        }
        return createFunction(params, createUnknown());
      } else {
        const type = this.expressionWithType();
        this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
        return type;
      }
    }

    if (this.match(TokenType.LBRACKET)) {
      let elementType: LjosType = createUnknown();
      if (!this.checkType(TokenType.RBRACKET)) {
        do {
          elementType = this.expressionWithType();
        } while (this.match(TokenType.COMMA, TokenType.SEMICOLON));
      }
      this.consume(ErrorCode.EXPECTED_RBRACKET, TokenType.RBRACKET);
      return createArray(elementType);
    }

    if (this.match(TokenType.LBRACE)) {
      const startToken = this.previous();
      const properties = new Map<string, LjosType>();
      
      if (!this.checkType(TokenType.RBRACE)) {
        do {
          // Object key can be: identifier, string literal, or computed [expr]
          let keyName: string | undefined;
          let keyToken: Token | undefined;
          
          if (this.checkType(TokenType.IDENTIFIER)) {
            keyToken = this.advance(); // consume identifier as key (don't look it up)
            keyName = keyToken.value;
          } else if (this.checkType(TokenType.STRING)) {
            keyToken = this.advance(); // consume string as key
            keyName = keyToken.value;
          } else if (this.match(TokenType.LBRACKET)) {
            this.expression(); // computed key
            this.consume(ErrorCode.EXPECTED_RBRACKET, TokenType.RBRACKET);
          } else {
            this.primary(); // fallback
          }
          
          let valueType: LjosType = createUnknown();
          if (this.match(TokenType.COLON)) {
            valueType = this.expressionNoComma();
          } else {
            this.consume(ErrorCode.EXPECTED_ARROW, TokenType.ARROW);
            valueType = this.expressionNoComma();
          }
          
          // Store property type
          if (keyName) {
            properties.set(keyName, valueType);
            // Add hover info for the key
            if (keyToken) {
              this.addHoverInfo(keyToken, valueType);
            }
          }
        } while (this.match(TokenType.COMMA));
      }
      this.consume(ErrorCode.EXPECTED_RBRACE, TokenType.RBRACE);
      
      const objectType = createObjectLiteral(properties);
      return objectType;
    }

    if (this.match(TokenType.GO)) {
      this.expression();
      return createUnknown();
    }

    if (this.match(TokenType.AWAIT)) {
      this.expression();
      return createUnknown();
    }

    if (this.match(TokenType.NEW)) {
      const classToken = this.consume(ErrorCode.EXPECTED_CLASS_NAME, TokenType.IDENTIFIER);
      const classType = this.classTypes.get(classToken.value);
      
      if (!classType) {
        this.addDiagnostic(
          ErrorCode.CANNOT_RESOLVE_SYMBOL,
          classToken.line, classToken.column,
          classToken.line, classToken.column + classToken.value.length,
          'error',
          classToken.value
        );
      } else if (classType.isAbstract) {
        this.addDiagnostic(
          ErrorCode.CANNOT_INSTANTIATE_ABSTRACT,
          classToken.line, classToken.column,
          classToken.line, classToken.column + classToken.value.length,
          'error',
          classToken.value
        );
      }

      if (this.match(TokenType.LT)) {
        do {
          this.typeAnnotation();
        } while (this.match(TokenType.COMMA));
        this.consume(ErrorCode.EXPECTED_GT, TokenType.GT);
      }

      if (this.match(TokenType.LPAREN)) {
        this.argumentList();
        this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
      }

      return classType || createUnknown();
    }

    if (this.match(TokenType.CHAN)) {
      if (!this.checkType(TokenType.LPAREN)) {
        this.typeAnnotation();
      }
      if (this.match(TokenType.LPAREN)) {
        if (!this.checkType(TokenType.RPAREN)) {
          this.expression();
        }
        this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
      }
      return createUnknown();
    }

    if (this.match(TokenType.IF)) {
      this.consume(ErrorCode.EXPECTED_LPAREN, TokenType.LPAREN);
      this.expression();
      this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
      const consequent = this.expressionWithType();
      this.consume(ErrorCode.EXPECTED_ELSE, TokenType.ELSE);
      this.expression();
      return consequent;
    }

    if (this.match(TokenType.WHEN)) {
      if (this.match(TokenType.LPAREN)) {
        this.expression();
        this.consume(ErrorCode.EXPECTED_RPAREN, TokenType.RPAREN);
      }
      this.consume(ErrorCode.EXPECTED_LBRACE, TokenType.LBRACE);
      while (!this.checkType(TokenType.RBRACE) && !this.isAtEnd()) {
        if (!this.match(TokenType.ELSE)) {
          // Use expressionNoComma to avoid consuming comma as logical AND
          this.expressionNoComma();
        }
        this.consume(ErrorCode.EXPECTED_ARROW, TokenType.ARROW);
        if (this.checkType(TokenType.LBRACE)) {
          this.blockStatement();
        } else {
          // Use expressionNoComma for result expression as well
          this.expressionNoComma();
        }
        // Consume optional comma separator between branches
        this.match(TokenType.COMMA);
      }
      this.consume(ErrorCode.EXPECTED_RBRACE, TokenType.RBRACE);
      return createUnknown();
    }

    throw new ParserError(ErrorCode.UNEXPECTED_TOKEN, this.peek(), [this.peek().value]);
  }

  private typeAnnotation(): void {
    this.parseTypeAnnotation();
  }

  private lookupSymbol(name: string): SymbolInfo | undefined {
    let scope: Scope | undefined = this.currentScope;
    while (scope) {
      const symbol = scope.symbols.get(name);
      if (symbol) return symbol;
      scope = scope.parent;
    }
    return undefined;
  }

  // Utility methods
  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.checkType(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private checkType(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private peekNext(): Token | undefined {
    if (this.current + 1 >= this.tokens.length) return undefined;
    return this.tokens[this.current + 1];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(errorCode: ErrorCode, type: TokenType): Token {
    if (this.checkType(type)) return this.advance();
    throw new ParserError(errorCode, this.peek());
  }

  private synchronize(): void {
    this.advance();

    while (!this.isAtEnd()) {
      switch (this.peek().type) {
        case TokenType.FN:
        case TokenType.CONST:
        case TokenType.MUT:
        case TokenType.FOR:
        case TokenType.WHILE:
        case TokenType.IF:
        case TokenType.WHEN:
        case TokenType.RETURN:
        case TokenType.IMPORT:
        case TokenType.EXPORT:
        case TokenType.CLASS:
        case TokenType.ENUM:
        case TokenType.TYPE:
          return;
      }
      this.advance();
    }
  }
}
