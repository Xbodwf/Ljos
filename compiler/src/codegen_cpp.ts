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
    
    // Helpers
    code += 'inline string to_string(const string& s) { return s; }\n';
    code += 'inline string to_string(const char* s) { return string(s); }\n';
    code += 'inline string to_string(bool b) { return b ? "true" : "false"; }\n';

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
      case 'EnumDeclaration':
        this.indent = 0;
        this.globalDecls.push(this.generateEnumDeclaration(stmt));
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
          } else if (stmt.declaration.type === 'EnumDeclaration') {
            // For enums, add enum declaration to header
            this.exportedDecls.push(this.generateEnumDeclaration(stmt.declaration));
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
        // Basic types
        case 'Int': return 'int';
        case 'Float': return 'double';
        case 'Str': return 'string';
        case 'Bool': return 'bool';
        case 'Void': return 'void';
        case 'Any': 
          this.includes.add('#include <any>');
          return 'std::any';
        case 'Nul': return 'nullptr_t';
        case 'Char': return 'char';
        case 'Byte': return 'unsigned char';
        
        // C++ style integer types
        case 'short': return 'short';
        case 'long': return 'long';
        case 'long long': return 'long long';
        
        // Unsigned types (C++ style)
        case 'unsigned char': return 'unsigned char';
        case 'unsigned short': return 'unsigned short';
        case 'unsigned int': return 'unsigned int';
        case 'unsigned long': return 'unsigned long';
        case 'unsigned long long': return 'unsigned long long';
        
        // Fixed-width integer types
        case 'int8': return 'int8_t';
        case 'int16': return 'int16_t';
        case 'int32': return 'int32_t';
        case 'int64': return 'int64_t';
        case 'uint8': return 'uint8_t';
        case 'uint16': return 'uint16_t';
        case 'uint32': return 'uint32_t';
        case 'uint64': return 'uint64_t';
        
        // Floating point types
        case 'float': return 'float';
        case 'double': return 'double';
        
        // Size types
        case 'size_t': return 'size_t';
        case 'ptrdiff_t': return 'ptrdiff_t';
        
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
      case 'BreakStatement':
        return this.getIndent() + 'break;\n';
      case 'ContinueStatement':
        return this.getIndent() + 'continue;\n';
      case 'ThrowStatement':
        return this.generateThrowStatement(stmt);
      case 'TryStatement':
        return this.generateTryStatement(stmt);
      case 'WhenStatement':
        return this.generateWhenStatement(stmt);
      case 'DeferStatement':
        return this.generateDeferStatement(stmt);
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
        // Infer type from initializer for tracking
        const inferredType = this.inferType(stmt.init);
        this.varTypes.set(stmt.name, { cppType: inferredType, isConst: stmt.kind === 'const' });
        return this.getIndent() + `${keyword}auto ${stmt.name} = ${init};\n`;
      }
      return this.getIndent() + `${keyword}${cppType} ${stmt.name} = ${init};\n`;
    }
    return this.getIndent() + `${cppType} ${stmt.name};\n`;
  }

  // Infer C++ type from expression
  private inferType(expr: AST.Expression): string {
    if (expr.type === 'Literal') {
      if (typeof expr.value === 'string') return 'string';
      if (typeof expr.value === 'number') {
        return Number.isInteger(expr.value) ? 'int' : 'double';
      }
      if (typeof expr.value === 'boolean') return 'bool';
    }
    if (expr.type === 'TemplateStringExpression') return 'string';
    if (expr.type === 'BinaryExpression' && expr.operator === '+') {
      // If either side is string, result is string
      if (this.isStringLiteral(expr.left) || this.isStringLiteral(expr.right)) {
        return 'string';
      }
    }
    if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier') {
      // Known string returning functions
      if (['repeatStr', 'greet', 'farewell', 'greetWithTime', 'formatNumber', 
           'padLeft', 'padRight', 'separator', 'boxTitle', 'bordered', 
           'success', 'error', 'warning', 'info', 'debug', 'toBinary'].includes(expr.callee.name)) {
        return 'string';
      }
    }
    return 'auto';
  }

  private generateFunctionDeclaration(stmt: AST.FunctionDeclaration): string {
    // Rename 'main' to avoid conflict with C++ main()
    const funcName = stmt.name === 'main' ? '_ljos_main' : stmt.name;
    const returnType = this.mapType(stmt.returnType);
    
    // Track parameter types
    for (const p of stmt.params) {
      const pType = this.mapType(p.typeAnnotation);
      this.varTypes.set(p.name, { cppType: pType, isConst: false });
    }
    
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
      const staticPrefix = field.isStatic ? 'static ' : '';
      code += `    ${staticPrefix}${fieldType} ${field.name}`;
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
    const staticPrefix = method.isStatic ? 'static ' : '';
    
    const params = method.params.map(p => {
      const pType = this.mapType(p.typeAnnotation);
      return `${pType} ${p.name}`;
    }).join(', ');
    
    let code = `    ${staticPrefix}${returnType} ${method.name}(${params}) {\n`;
    
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

  private generateEnumDeclaration(stmt: AST.EnumDeclaration): string {
    const hasAssociatedData = stmt.members.some(m => m.associatedData && m.associatedData.length > 0);
    
    if (hasAssociatedData) {
      // 带关联数据的 enum 使用 std::variant (C++17)
      this.includes.add('#include <variant>');
      
      let code = `// ADT-style enum: ${stmt.name}\n`;
      
      // 为每个带关联数据的成员生成结构体
      for (const m of stmt.members) {
        if (m.associatedData && m.associatedData.length > 0) {
          code += `struct ${stmt.name}_${m.name} {\n`;
          for (const param of m.associatedData) {
            const pType = this.mapType(param.typeAnnotation);
            code += `    ${pType} ${param.name};\n`;
          }
          code += `};\n`;
        }
      }
      
      // 生成 variant 类型
      const variantTypes = stmt.members.map(m => {
        if (m.associatedData && m.associatedData.length > 0) {
          return `${stmt.name}_${m.name}`;
        }
        return 'monostate'; // 无数据的变体
      });
      code += `using ${stmt.name} = variant<${variantTypes.join(', ')}>;\n`;
      
      // 生成工厂函数
      for (let i = 0; i < stmt.members.length; i++) {
        const m = stmt.members[i];
        if (m.associatedData && m.associatedData.length > 0) {
          const params = m.associatedData.map(p => {
            const pType = this.mapType(p.typeAnnotation);
            return `${pType} ${p.name}`;
          }).join(', ');
          const args = m.associatedData.map(p => p.name).join(', ');
          code += `inline ${stmt.name} ${stmt.name}_${m.name}_create(${params}) { return ${stmt.name}_${m.name}{${args}}; }\n`;
        }
      }
      
      return code;
    } else {
      // 简单 enum
      let code = `enum class ${stmt.name} {\n`;
      
      for (let i = 0; i < stmt.members.length; i++) {
        const m = stmt.members[i];
        const comma = i < stmt.members.length - 1 ? ',' : '';
        
        if (m.value) {
          code += `    ${m.name} = ${this.generateExpression(m.value)}${comma}\n`;
        } else {
          code += `    ${m.name}${comma}\n`;
        }
      }
      
      code += '};\n';
      return code;
    }
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

  private generateThrowStatement(stmt: AST.ThrowStatement): string {
    this.includes.add('#include <stdexcept>');
    const arg = this.generateExpression(stmt.argument);
    return this.getIndent() + `throw runtime_error(${arg});\n`;
  }

  private generateTryStatement(stmt: AST.TryStatement): string {
    let code = this.getIndent() + 'try {\n';
    this.indent++;
    for (const s of stmt.block.body) {
      code += this.generateStatement(s);
    }
    this.indent--;
    code += this.getIndent() + '}';
    
    for (const handler of stmt.handlers) {
      if (handler.typeAnnotation) {
        const exType = this.mapType(handler.typeAnnotation);
        code += ` catch (const ${exType}& ${handler.param || 'e'}) {\n`;
      } else {
        code += ` catch (...) {\n`;
      }
      this.indent++;
      for (const s of handler.body.body) {
        code += this.generateStatement(s);
      }
      this.indent--;
      code += this.getIndent() + '}';
    }
    
    code += '\n';
    return code;
  }

  private generateWhenStatement(stmt: AST.WhenStatement): string {
    // when statement -> if-else chain
    const disc = stmt.discriminant ? this.generateExpression(stmt.discriminant) : null;
    let code = '';
    let first = true;
    
    for (const c of stmt.cases) {
      const isElse = c.pattern.type === 'ElsePattern';
      
      if (isElse) {
        code += this.getIndent() + '} else {\n';
      } else if (first) {
        code += this.getIndent() + `if (${this.generateWhenPattern(c.pattern, disc)}) {\n`;
        first = false;
      } else {
        code += this.getIndent() + `} else if (${this.generateWhenPattern(c.pattern, disc)}) {\n`;
      }
      
      this.indent++;
      if (c.body.type === 'BlockStatement') {
        for (const s of c.body.body) {
          code += this.generateStatement(s);
        }
      } else {
        // Expression body
        code += this.getIndent() + this.generateExpression(c.body) + ';\n';
      }
      this.indent--;
    }
    
    if (stmt.cases.length > 0) {
      code += this.getIndent() + '}\n';
    }
    return code;
  }

  private generateWhenPattern(pattern: AST.Pattern, disc: string | null): string {
    switch (pattern.type) {
      case 'LiteralPattern': {
        const val = this.generateExpression(pattern.value);
        return disc ? `(${disc} == ${val})` : val;
      }
      case 'IdentifierPattern': {
        // Binding pattern - just use true (will bind in body)
        return 'true';
      }
      case 'OrPattern': {
        const parts = pattern.patterns.map(p => this.generateWhenPattern(p, disc));
        return `(${parts.join(' || ')})`;
      }
      case 'TypePattern': {
        // Type checking - use typeid or dynamic_cast
        return `true /* type check: ${pattern.typeAnnotation} */`;
      }
      case 'ElsePattern':
        return 'true';
      default:
        return 'true';
    }
  }

  private generateDeferStatement(stmt: AST.DeferStatement): string {
    // C++ doesn't have defer - use RAII or comment
    // For now, generate a comment
    let code = this.getIndent() + '// defer: ';
    if (stmt.body.type === 'BlockStatement') {
      code += '{ ... } - TODO: Use scope_guard\n';
    } else {
      // Expression body
      code += this.generateExpression(stmt.body) + ';\n';
    }
    return code;
  }

  private generateExpression(expr: AST.Expression): string {
    switch (expr.type) {
      case 'Literal':
        return this.generateLiteral(expr);
      case 'CharLiteral':
        // C++ char literal
        return `'${this.escapeChar(expr.value)}'`;
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
      case 'IfExpression':
        return this.generateIfExpression(expr);
      default:
        return `/* TODO: ${expr.type} */`;
    }
  }

  private generateIfExpression(expr: AST.IfExpression): string {
    const condition = this.generateExpression(expr.condition);
    const consequent = this.generateExpression(expr.consequent);
    const alternate = this.generateExpression(expr.alternate);
    return `(${condition} ? ${consequent} : ${alternate})`;
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
    // Check if identifier is a known string variable
    if (expr.type === 'Identifier') {
      const varInfo = this.varTypes.get(expr.name);
      if (varInfo && varInfo.cppType === 'string') {
        return generated;
      }
    }
    // Call expressions that return strings (like greet) don't need wrapping
    if (expr.type === 'CallExpression') {
      // Check if it's a known string-returning function
      if (expr.callee.type === 'Identifier') {
        const name = expr.callee.name;
        // These are known to return strings
        if (['greet', 'farewell', 'greetPerson'].includes(name)) {
          return generated;
        }
      }
      // For other calls, assume they might return non-string, wrap to be safe
      return `to_string(${generated})`;
    }
    // Member expressions - check if accessing a string property
    if (expr.type === 'MemberExpression') {
      // Assume member access might be string, don't wrap
      return generated;
    }
    // Other expressions - wrap with to_string
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

  private escapeChar(c: string): string {
    switch (c) {
      case '\n': return '\\n';
      case '\r': return '\\r';
      case '\t': return '\\t';
      case '\\': return '\\\\';
      case '\'': return '\\\'';
      case '\0': return '\\0';
      default: return c;
    }
  }
}
