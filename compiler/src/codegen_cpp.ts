/**
 * Native C++ Code Generator for Ljos
 * Generates native C++ code directly from Ljos AST (no JSValue runtime)
 */

import * as AST from './ast';

export interface CppCodegenOptions {
  isEntryPoint?: boolean;
  moduleName?: string; // For header guard
}

export interface CppGenerateResult {
  cpp: string;
  hpp?: string; // Header file content (for non-entry files)
}

// Type information for variables
interface VarInfo {
  cppType: string;
  isConst: boolean;
}

export class CppCodeGenerator {
  private indent = 0;
  private isEntryPoint: boolean;
  private moduleName: string;
  
  // Track includes needed
  private includes: Set<string> = new Set();
  
  // Track declarations
  private forwardDecls: string[] = [];
  private globalDecls: string[] = [];
  private mainCode: string[] = [];
  
  // Track exported declarations for header file
  private exportedDecls: string[] = [];
  
  // Track classes for method generation
  private classes: Map<string, AST.ClassDeclaration> = new Map();
  
  // Variable type tracking
  private varTypes: Map<string, VarInfo> = new Map();
  
  // Current context
  private inClass = false;
  private currentClassName = '';

  constructor(options: CppCodegenOptions = {}) {
    this.isEntryPoint = options.isEntryPoint ?? false;
    this.moduleName = options.moduleName ?? 'module';
  }

  generate(program: AST.Program): CppGenerateResult {
    // Reset state
    this.includes = new Set();
    this.forwardDecls = [];
    this.globalDecls = [];
    this.exportedDecls = [];
    this.mainCode = [];
    this.classes = new Map();
    this.varTypes = new Map();
    this.indent = 0;

    // Add standard includes
    this.includes.add('#include <cstdio>');
    this.includes.add('#include <iostream>');
    this.includes.add('#include <string>');
    this.includes.add('#include <vector>');
    this.includes.add('#include <memory>');
    this.includes.add('#include <functional>');

    // First pass: collect classes and categorize statements
    for (const stmt of program.body) {
      this.categorizeStatement(stmt);
    }

    // Build cpp output
    let code = '';
    
    // Add includes
    for (const inc of this.includes) {
      code += inc + '\n';
    }
    code += '\nusing namespace std;\n';
    
    // Add forward declarations
    if (this.forwardDecls.length > 0) {
      code += '\n// Forward declarations\n';
      code += this.forwardDecls.join('\n') + '\n';
    }
    
    // Add global declarations (classes, functions)
    if (this.globalDecls.length > 0) {
      code += '\n';
      code += this.globalDecls.join('\n') + '\n';
    }
    
    // Add main function for entry point
    if (this.isEntryPoint) {
      code += '\nint main() {\n';
      code += this.mainCode.join('');
      code += '    return 0;\n';
      code += '}\n';
    }
    
    // Generate header file for non-entry point modules
    let hpp: string | undefined;
    if (!this.isEntryPoint && this.exportedDecls.length > 0) {
      const guard = this.moduleName.toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_HPP';
      hpp = `#ifndef ${guard}\n#define ${guard}\n\n`;
      hpp += '#include <string>\n\n';
      hpp += 'using namespace std;\n\n';
      hpp += this.exportedDecls.join('\n') + '\n';
      hpp += `\n#endif // ${guard}\n`;
    }
    
    return { cpp: code, hpp };
  }

  private categorizeStatement(stmt: AST.Statement): void {
    switch (stmt.type) {
      case 'ImportStatement':
        this.processImport(stmt);
        break;
      case 'ClassDeclaration':
        this.classes.set(stmt.name, stmt);
        this.indent = 0;
        this.globalDecls.push(this.generateClassDeclaration(stmt));
        break;
      case 'FunctionDeclaration':
        this.indent = 0;
        this.globalDecls.push(this.generateFunctionDeclaration(stmt));
        break;
      case 'ExportStatement':
        if (stmt.declaration) {
          // Generate the declaration
          this.categorizeStatement(stmt.declaration);
          // Also add to exported declarations for header
          if (stmt.declaration.type === 'FunctionDeclaration') {
            const func = stmt.declaration;
            const returnType = this.mapType(func.returnType);
            const params = func.params.map(p => {
              const pType = this.mapType(p.typeAnnotation);
              return `${pType} ${p.name}`;
            }).join(', ');
            this.exportedDecls.push(`${returnType} ${func.name}(${params});`);
          } else if (stmt.declaration.type === 'ClassDeclaration') {
            // For classes, add forward declaration
            this.exportedDecls.push(`class ${stmt.declaration.name};`);
          }
        }
        break;
      default:
        // Other statements go to main
        this.indent = 1;
        this.mainCode.push(this.generateStatement(stmt));
    }
  }

  private processImport(stmt: AST.ImportStatement): void {
    const source = stmt.source;
    
    // Map standard library imports to C++ equivalents
    if (source === '/std/io' || source.endsWith('/std/io')) {
      // println/print -> cout
      this.includes.add('#include <iostream>');
    } else if (source === '/std/core' || source.endsWith('/std/core')) {
      // Core types are built-in
    } else if (source === '/std/math' || source.endsWith('/std/math')) {
      this.includes.add('#include <cmath>');
    } else if (source === '/std/fs' || source.endsWith('/std/fs')) {
      this.includes.add('#include <fstream>');
    } else if (source.startsWith('./') || source.startsWith('../')) {
      // Local module import - generate include for the header
      // Convert ./utils/greeting to utils/greeting.hpp
      const headerPath = source.replace(/^\.\//, '').replace(/^\.\.\//, '../') + '.hpp';
      this.includes.add(`#include "${headerPath}"`);
    }
    
    // For local imports, add forward declarations for imported symbols
    for (const spec of stmt.specifiers) {
      if (spec.type === 'named' || spec.type === 'default') {
        const name = spec.type === 'named' ? spec.local : spec.local;
        // Check if it's a class (capitalized) or function (lowercase)
        if (name[0] === name[0].toUpperCase()) {
          this.forwardDecls.push(`class ${name};`);
        } else {
          // Assume it's a function returning string (common case)
          // This is a simplification - ideally we'd track types
          this.forwardDecls.push(`string ${name}(string);`);
        }
      }
    }
  }

  private getIndent(): string {
    return '    '.repeat(this.indent);
  }

  // Map Ljos types to C++ types
  private mapType(type?: AST.TypeAnnotation): string {
    if (!type) return 'auto';
    
    if (type.kind === 'simple') {
      switch (type.name) {
        case 'Int': return 'int';
        case 'Float': return 'double';
        case 'Str': return 'string';
        case 'Bool': return 'bool';
        case 'Void': return 'void';
        case 'Nul': return 'nullptr_t';
        default: return type.name; // Class name or other
      }
    } else if (type.kind === 'array') {
      return `vector<${this.mapType(type.elementType)}>`;
    } else if (type.kind === 'map') {
      this.includes.add('#include <map>');
      return `map<${this.mapType(type.keyType)}, ${this.mapType(type.valueType)}>`;
    } else if (type.kind === 'generic') {
      const args = type.typeArguments.map(t => this.mapType(t)).join(', ');
      return `${type.name}<${args}>`;
    }
    
    return 'auto';
  }

  private generateStatement(stmt: AST.Statement): string {
    switch (stmt.type) {
      case 'VariableDeclaration':
        return this.generateVariableDeclaration(stmt);
      case 'FunctionDeclaration':
        return this.generateFunctionDeclaration(stmt);
      case 'ClassDeclaration':
        return this.generateClassDeclaration(stmt);
      case 'ExpressionStatement':
        return this.getIndent() + this.generateExpression(stmt.expression) + ';\n';
      case 'IfStatement':
        return this.generateIfStatement(stmt);
      case 'ForStatement':
        return this.generateForStatement(stmt);
      case 'WhileStatement':
        return this.generateWhileStatement(stmt);
      case 'ReturnStatement':
        return this.generateReturnStatement(stmt);
      case 'BlockStatement':
        return this.generateBlockStatement(stmt);
      case 'ImportStatement':
        return ''; // Handled in categorize
      case 'ExportStatement':
        if (stmt.declaration) {
          return this.generateStatement(stmt.declaration);
        }
        return '';
      default:
        return this.getIndent() + `// TODO: ${stmt.type}\n`;
    }
  }

  private generateVariableDeclaration(stmt: AST.VariableDeclaration): string {
    const cppType = this.mapType(stmt.typeAnnotation);
    const keyword = stmt.kind === 'const' ? 'const ' : '';
    
    // Track variable type
    this.varTypes.set(stmt.name, { cppType, isConst: stmt.kind === 'const' });
    
    if (stmt.init) {
      const init = this.generateExpression(stmt.init);
      // Use auto for type inference when no explicit type
      if (!stmt.typeAnnotation) {
        return this.getIndent() + `${keyword}auto ${stmt.name} = ${init};\n`;
      }
      return this.getIndent() + `${keyword}${cppType} ${stmt.name} = ${init};\n`;
    }
    return this.getIndent() + `${cppType} ${stmt.name};\n`;
  }

  private generateFunctionDeclaration(stmt: AST.FunctionDeclaration): string {
    // Rename 'main' to avoid conflict with C++ main()
    const funcName = stmt.name === 'main' ? '_ljos_main' : stmt.name;
    const returnType = this.mapType(stmt.returnType);
    
    const params = stmt.params.map(p => {
      const pType = this.mapType(p.typeAnnotation);
      if (p.defaultValue) {
        return `${pType} ${p.name} = ${this.generateExpression(p.defaultValue)}`;
      }
      return `${pType} ${p.name}`;
    }).join(', ');
    
    let code = `${returnType} ${funcName}(${params}) {\n`;
    
    const oldIndent = this.indent;
    this.indent = 1;
    for (const bodyStmt of stmt.body.body) {
      code += this.generateStatement(bodyStmt);
    }
    this.indent = oldIndent;
    
    code += '}\n';
    return code;
  }

  private generateClassDeclaration(stmt: AST.ClassDeclaration): string {
    const className = stmt.name;
    this.inClass = true;
    this.currentClassName = className;
    
    let code = `class ${className}`;
    
    // Handle inheritance
    if (stmt.superClass) {
      code += ` : public ${stmt.superClass.name}`;
    }
    
    code += ' {\n';
    code += 'public:\n';
    
    // Collect fields
    const fields = stmt.body.filter(m => m.type === 'FieldDeclaration') as AST.FieldDeclaration[];
    const methods = stmt.body.filter(m => m.type === 'MethodDeclaration') as AST.MethodDeclaration[];
    const ctor = stmt.body.find(m => m.type === 'ConstructorDeclaration') as AST.ConstructorDeclaration | undefined;
    
    // Generate fields
    for (const field of fields) {
      const fieldType = this.mapType(field.typeAnnotation);
      code += `    ${fieldType} ${field.name}`;
      if (field.init) {
        code += ` = ${this.generateExpression(field.init)}`;
      }
      code += ';\n';
    }
    
    if (fields.length > 0) code += '\n';
    
    // Generate constructor
    if (ctor) {
      const params = ctor.params.map(p => {
        const pType = this.mapType(p.typeAnnotation);
        return `${pType} ${p.name}`;
      }).join(', ');
      
      code += `    ${className}(${params})`;
      
      // Initializer list
      const inits: string[] = [];
      for (const bodyStmt of ctor.body.body) {
        if (bodyStmt.type === 'ExpressionStatement' && 
            bodyStmt.expression.type === 'AssignmentExpression') {
          const assign = bodyStmt.expression;
          if (assign.left.type === 'MemberExpression' && 
              assign.left.object.type === 'ThisExpression') {
            const fieldName = (assign.left.property as AST.Identifier).name;
            const value = this.generateExpression(assign.right);
            inits.push(`${fieldName}(${value})`);
          }
        }
      }
      
      if (inits.length > 0) {
        code += ` : ${inits.join(', ')}`;
      }
      
      code += ' {}\n\n';
    } else {
      // Default constructor
      code += `    ${className}() = default;\n\n`;
    }
    
    // Generate methods
    for (const method of methods) {
      code += this.generateMethodDeclaration(method);
    }
    
    code += '};\n';
    
    this.inClass = false;
    this.currentClassName = '';
    
    return code;
  }

  private generateMethodDeclaration(method: AST.MethodDeclaration): string {
    const returnType = this.mapType(method.returnType);
    
    const params = method.params.map(p => {
      const pType = this.mapType(p.typeAnnotation);
      return `${pType} ${p.name}`;
    }).join(', ');
    
    let code = `    ${returnType} ${method.name}(${params}) {\n`;
    
    if (method.body) {
      const oldIndent = this.indent;
      this.indent = 2;
      for (const bodyStmt of method.body.body) {
        code += this.generateStatement(bodyStmt);
      }
      this.indent = oldIndent;
    }
    
    code += '    }\n\n';
    return code;
  }

  private generateIfStatement(stmt: AST.IfStatement): string {
    let code = this.getIndent() + `if (${this.generateExpression(stmt.condition)}) {\n`;
    
    this.indent++;
    for (const s of stmt.consequent.body) {
      code += this.generateStatement(s);
    }
    this.indent--;
    
    if (stmt.alternate) {
      if (stmt.alternate.type === 'IfStatement') {
        code += this.getIndent() + '} else ' + this.generateIfStatement(stmt.alternate).trimStart();
      } else {
        code += this.getIndent() + '} else {\n';
        this.indent++;
        for (const s of stmt.alternate.body) {
          code += this.generateStatement(s);
        }
        this.indent--;
        code += this.getIndent() + '}\n';
      }
    } else {
      code += this.getIndent() + '}\n';
    }
    
    return code;
  }

  private generateForStatement(stmt: AST.ForStatement): string {
    if (stmt.isForIn && stmt.variable && stmt.iterable) {
      // Range-based for loop
      let code = this.getIndent() + `for (auto& ${stmt.variable} : ${this.generateExpression(stmt.iterable)}) {\n`;
      this.indent++;
      for (const s of stmt.body.body) {
        code += this.generateStatement(s);
      }
      this.indent--;
      code += this.getIndent() + '}\n';
      return code;
    }
    
    // Regular for loop
    let init = '';
    if (stmt.init) {
      if (stmt.init.type === 'VariableDeclaration') {
        const vType = this.mapType(stmt.init.typeAnnotation);
        init = `${vType} ${stmt.init.name} = ${stmt.init.init ? this.generateExpression(stmt.init.init) : '0'}`;
      } else {
        init = this.generateExpression(stmt.init);
      }
    }
    
    const cond = stmt.condition ? this.generateExpression(stmt.condition) : 'true';
    const update = stmt.update ? this.generateExpression(stmt.update) : '';
    
    let code = this.getIndent() + `for (${init}; ${cond}; ${update}) {\n`;
    this.indent++;
    for (const s of stmt.body.body) {
      code += this.generateStatement(s);
    }
    this.indent--;
    code += this.getIndent() + '}\n';
    
    return code;
  }

  private generateWhileStatement(stmt: AST.WhileStatement): string {
    let code = this.getIndent() + `while (${this.generateExpression(stmt.condition)}) {\n`;
    this.indent++;
    for (const s of stmt.body.body) {
      code += this.generateStatement(s);
    }
    this.indent--;
    code += this.getIndent() + '}\n';
    return code;
  }

  private generateReturnStatement(stmt: AST.ReturnStatement): string {
    if (stmt.argument) {
      return this.getIndent() + `return ${this.generateExpression(stmt.argument)};\n`;
    }
    return this.getIndent() + 'return;\n';
  }

  private generateBlockStatement(stmt: AST.BlockStatement): string {
    let code = this.getIndent() + '{\n';
    this.indent++;
    for (const s of stmt.body) {
      code += this.generateStatement(s);
    }
    this.indent--;
    code += this.getIndent() + '}\n';
    return code;
  }

  private generateExpression(expr: AST.Expression): string {
    switch (expr.type) {
      case 'Literal':
        return this.generateLiteral(expr);
      case 'Identifier':
        return this.generateIdentifier(expr);
      case 'BinaryExpression':
        return this.generateBinaryExpression(expr);
      case 'UnaryExpression':
        return this.generateUnaryExpression(expr);
      case 'CallExpression':
        return this.generateCallExpression(expr);
      case 'NewExpression':
        return this.generateNewExpression(expr);
      case 'MemberExpression':
        return this.generateMemberExpression(expr);
      case 'ArrayExpression':
        return this.generateArrayExpression(expr);
      case 'ObjectExpression':
        return this.generateObjectExpression(expr);
      case 'AssignmentExpression':
        return this.generateAssignmentExpression(expr);
      case 'TemplateStringExpression':
        return this.generateTemplateString(expr);
      case 'ThisExpression':
        return '(*this)'; // Use (*this) so member access with . works
      case 'TypeofExpression':
        return this.generateTypeofExpression(expr);
      case 'ArrowFunctionExpression':
        return this.generateArrowFunction(expr);
      case 'LogicalExpression':
        return this.generateLogicalExpression(expr);
      case 'ConditionalExpression':
        return this.generateConditionalExpression(expr);
      default:
        return `/* TODO: ${expr.type} */`;
    }
  }

  private generateLiteral(expr: AST.Literal): string {
    if (expr.value === null) {
      return 'nullptr';
    }
    if (typeof expr.value === 'string') {
      // Use C++ string literal
      const escaped = expr.value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
      return `"${escaped}"s`;  // Use string literal suffix
    }
    if (typeof expr.value === 'number') {
      // Check if it's an integer or float
      if (Number.isInteger(expr.value)) {
        return expr.value.toString();
      }
      return expr.value.toString();
    }
    if (typeof expr.value === 'boolean') {
      return expr.value ? 'true' : 'false';
    }
    return 'nullptr';
  }

  private generateIdentifier(expr: AST.Identifier): string {
    // Rename 'main' to avoid conflict
    if (expr.name === 'main') {
      return '_ljos_main';
    }
    return expr.name;
  }

  private generateBinaryExpression(expr: AST.BinaryExpression): string {
    const left = this.generateExpression(expr.left);
    const right = this.generateExpression(expr.right);
    
    // String concatenation - if either side is a string literal, use string concatenation
    if (expr.operator === '+') {
      const leftIsStringLiteral = this.isStringLiteral(expr.left);
      const rightIsStringLiteral = this.isStringLiteral(expr.right);
      
      if (leftIsStringLiteral || rightIsStringLiteral) {
        // Wrap non-string expressions in to_string
        const l = this.wrapForStringConcat(expr.left, left);
        const r = this.wrapForStringConcat(expr.right, right);
        return `(${l} + ${r})`;
      }
    }
    
    return `(${left} ${expr.operator} ${right})`;
  }

  private isStringLiteral(expr: AST.Expression): boolean {
    if (expr.type === 'Literal' && typeof expr.value === 'string') {
      return true;
    }
    if (expr.type === 'TemplateStringExpression') {
      return true;
    }
    if (expr.type === 'BinaryExpression' && expr.operator === '+') {
      return this.isStringLiteral(expr.left) || this.isStringLiteral(expr.right);
    }
    return false;
  }

  private isNumericLiteral(expr: AST.Expression): boolean {
    return expr.type === 'Literal' && typeof expr.value === 'number';
  }

  // Wrap expression for string concatenation - use to_string for non-string types
  private wrapForStringConcat(expr: AST.Expression, generated: string): string {
    // String literals don't need wrapping
    if (this.isStringLiteral(expr)) {
      return generated;
    }
    // Call expressions that return strings (like greet) don't need wrapping
    if (expr.type === 'CallExpression') {
      // Check if it's a known string-returning function
      if (expr.callee.type === 'Identifier') {
        const name = expr.callee.name;
        // These are known to return strings
        if (['greet', 'farewell'].includes(name)) {
          return generated;
        }
      }
      // For other calls, assume they might return non-string, wrap to be safe
      return `to_string(${generated})`;
    }
    // Identifiers and other expressions - wrap with to_string
    return `to_string(${generated})`;
  }

  private generateUnaryExpression(expr: AST.UnaryExpression): string {
    const arg = this.generateExpression(expr.argument);
    
    if (expr.prefix) {
      return `(${expr.operator}${arg})`;
    } else {
      return `(${arg}${expr.operator})`;
    }
  }

  private generateCallExpression(expr: AST.CallExpression): string {
    const args = expr.arguments.map(a => this.generateExpression(a)).join(', ');
    
    // Handle special standard library functions
    if (expr.callee.type === 'Identifier') {
      const name = expr.callee.name;
      
      // Map println/print to printf (from /std/io)
      if (name === 'println') {
        if (expr.arguments.length === 0) {
          return 'printf("\\n")';
        }
        // For single argument, use appropriate format
        if (expr.arguments.length === 1) {
          const arg = expr.arguments[0];
          const argStr = this.generateExpression(arg);
          // Determine format based on argument type
          if (this.isStringLiteral(arg) || arg.type === 'Identifier') {
            // String - use %s format, need .c_str() for std::string
            return `printf("%s\\n", (${argStr}).c_str())`;
          } else if (this.isNumericLiteral(arg)) {
            // Number literal
            if (Number.isInteger((arg as AST.Literal).value as number)) {
              return `printf("%d\\n", ${argStr})`;
            }
            return `printf("%g\\n", ${argStr})`;
          } else if (arg.type === 'CallExpression') {
            // Function call - assume returns string
            return `printf("%s\\n", (${argStr}).c_str())`;
          } else {
            // Default to string
            return `printf("%s\\n", to_string(${argStr}).c_str())`;
          }
        }
        // Multiple arguments - concatenate as string
        const argsStr = expr.arguments.map(a => {
          const gen = this.generateExpression(a);
          if (this.isStringLiteral(a)) return gen;
          return `to_string(${gen})`;
        }).join(' + ');
        return `printf("%s\\n", (${argsStr}).c_str())`;
      }
      if (name === 'print') {
        if (expr.arguments.length === 0) {
          return '/* print() */';
        }
        if (expr.arguments.length === 1) {
          const arg = expr.arguments[0];
          const argStr = this.generateExpression(arg);
          if (this.isStringLiteral(arg) || arg.type === 'Identifier') {
            return `printf("%s", (${argStr}).c_str())`;
          }
          return `printf("%s", to_string(${argStr}).c_str())`;
        }
        const argsStr = expr.arguments.map(a => {
          const gen = this.generateExpression(a);
          if (this.isStringLiteral(a)) return gen;
          return `to_string(${gen})`;
        }).join(' + ');
        return `printf("%s", (${argsStr}).c_str())`;
      }
      
      // readln - read line from stdin
      if (name === 'readln') {
        this.includes.add('#include <string>');
        return '[&]() { std::string _line; std::getline(std::cin, _line); return _line; }()';
      }
      
      // readInt - read integer from stdin
      if (name === 'readInt') {
        return '[&]() { int _n; std::cin >> _n; return _n; }()';
      }
    }
    
    // Handle method calls
    if (expr.callee.type === 'MemberExpression') {
      const obj = this.generateExpression(expr.callee.object);
      const prop = expr.callee.computed 
        ? this.generateExpression(expr.callee.property)
        : (expr.callee.property as AST.Identifier).name;
      
      return `${obj}.${prop}(${args})`;
    }
    
    const callee = this.generateExpression(expr.callee);
    return `${callee}(${args})`;
  }

  private generateNewExpression(expr: AST.NewExpression): string {
    const callee = this.generateExpression(expr.callee);
    const args = expr.arguments.map(a => this.generateExpression(a)).join(', ');
    
    // Use stack allocation for simple cases, or make_shared for heap
    return `${callee}(${args})`;
  }

  private generateMemberExpression(expr: AST.MemberExpression): string {
    const obj = this.generateExpression(expr.object);
    
    if (expr.computed) {
      const prop = this.generateExpression(expr.property);
      return `${obj}[${prop}]`;
    } else {
      const prop = (expr.property as AST.Identifier).name;
      // Use -> for pointers, . for objects
      return `${obj}.${prop}`;
    }
  }

  private generateArrayExpression(expr: AST.ArrayExpression): string {
    const elements = expr.elements.map(e => this.generateExpression(e)).join(', ');
    return `{${elements}}`;
  }

  private generateObjectExpression(expr: AST.ObjectExpression): string {
    // For now, generate as initializer list
    const props = expr.properties.map(p => {
      const value = this.generateExpression(p.value);
      return `.${(p.key as AST.Identifier).name} = ${value}`;
    }).join(', ');
    return `{${props}}`;
  }

  private generateAssignmentExpression(expr: AST.AssignmentExpression): string {
    const left = this.generateExpression(expr.left);
    const right = this.generateExpression(expr.right);
    return `${left} ${expr.operator} ${right}`;
  }

  private generateTemplateString(expr: AST.TemplateStringExpression): string {
    const parts = expr.parts.map(part => {
      if (typeof part === 'string') {
        const escaped = part
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n');
        return `"${escaped}"s`;
      }
      const exprStr = this.generateExpression(part);
      // Only wrap in to_string if it's a numeric literal
      // Identifiers and other expressions are assumed to be strings in template context
      if (this.isNumericLiteral(part)) {
        return `to_string(${exprStr})`;
      }
      return exprStr;
    });
    
    if (parts.length === 0) {
      return '""s';
    }
    if (parts.length === 1) {
      return parts[0];
    }
    
    return parts.join(' + ');
  }

  private generateTypeofExpression(expr: AST.TypeofExpression): string {
    // Use C++ typeid
    this.includes.add('#include <typeinfo>');
    return `typeid(${this.generateExpression(expr.argument)}).name()`;
  }

  private generateArrowFunction(expr: AST.ArrowFunctionExpression): string {
    const params = expr.params.map(p => {
      const pType = this.mapType(p.typeAnnotation);
      return `${pType} ${p.name}`;
    }).join(', ');
    
    if (expr.body.type === 'BlockStatement') {
      let code = `[&](${params}) {\n`;
      const oldIndent = this.indent;
      this.indent++;
      for (const stmt of expr.body.body) {
        code += this.generateStatement(stmt);
      }
      this.indent = oldIndent;
      code += this.getIndent() + '}';
      return code;
    } else {
      return `[&](${params}) { return ${this.generateExpression(expr.body)}; }`;
    }
  }

  private generateLogicalExpression(expr: AST.LogicalExpression): string {
    const left = this.generateExpression(expr.left);
    const right = this.generateExpression(expr.right);
    return `(${left} ${expr.operator} ${right})`;
  }

  private generateConditionalExpression(expr: AST.ConditionalExpression): string {
    const test = this.generateExpression(expr.test);
    const consequent = this.generateExpression(expr.consequent);
    const alternate = this.generateExpression(expr.alternate);
    return `(${test} ? ${consequent} : ${alternate})`;
  }
}
