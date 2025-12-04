import { Program, Statement, Expression, Identifier, VariableDeclaration, FunctionDeclaration, ClassDeclaration, EnumDeclaration, EnumMember, TypeAnnotation, MemberExpression, WhileStatement, DoWhileStatement, TypeofExpression, InstanceofExpression, VoidExpression, DeleteExpression, ThisExpression, SuperExpression, YieldExpression, Parameter, IfExpression } from './ast';
import { CompilerError } from './compiler';

// Type information
type TypeInfo =
  | { kind: 'primitive'; name: string }
  | { kind: 'class'; name: string; members: Map<string, MemberInfo> }
  | { kind: 'function'; params: TypeInfo[]; returnType: TypeInfo }
  | { kind: 'array'; elementType: TypeInfo }
  | { kind: 'enum'; name: string; members: Map<string, EnumMemberInfo> }
  | { kind: 'enumMember'; enumName: string; memberName: string; valueType?: TypeInfo; associatedData?: TypeInfo[] }
  | { kind: 'unknown' }
  | { kind: 'void' };

interface EnumMemberInfo {
  name: string;
  valueType?: TypeInfo;           // 显式值的类型
  associatedData?: TypeInfo[];    // 关联数据的类型列表
  isCallable: boolean;            // 是否有关联数据（可调用）
}

interface MemberInfo {
  type: TypeInfo;
  isMethod: boolean;
  isStatic: boolean;
}

interface SymbolInfo {
  type: TypeInfo;
}

interface Scope {
  parent?: Scope;
  symbols: Map<string, SymbolInfo>;
}

// 隐式类型转换规则：定义哪些类型可以隐式转换为其他类型
const IMPLICIT_CONVERSIONS: Map<string, Set<string>> = new Map([
  // 数值类型转换
  ['Int', new Set(['Float', 'Num', 'long', 'long long'])],      // Int -> Float, Int -> Num
  ['Float', new Set(['Num', 'double'])],              // Float -> Num
  ['Byte', new Set(['Int', 'Float', 'Num', 'short', 'int'])], // Byte -> Int -> Float -> Num
  // 字符类型转换
  ['Char', new Set(['Str', 'Int'])],               // Char -> Str, Char -> Int
  // C++ 风格整数类型隐式转换
  ['int8', new Set(['int16', 'int32', 'int64', 'Int', 'Float'])],
  ['int16', new Set(['int32', 'int64', 'Int', 'Float'])],
  ['int32', new Set(['int64', 'Int', 'Float'])],
  ['uint8', new Set(['uint16', 'uint32', 'uint64', 'int16', 'int32', 'int64', 'Int', 'Float'])],
  ['uint16', new Set(['uint32', 'uint64', 'int32', 'int64', 'Int', 'Float'])],
  ['uint32', new Set(['uint64', 'int64', 'Float'])],
  ['short', new Set(['int', 'long', 'long long', 'Int', 'Float'])],
  ['unsigned char', new Set(['unsigned short', 'unsigned int', 'unsigned long', 'short', 'int', 'Int'])],
  ['unsigned short', new Set(['unsigned int', 'unsigned long', 'int', 'long', 'Int'])],
  ['float', new Set(['double', 'Float'])],
]);

// 显式类型转换规则：定义哪些类型可以显式转换
const EXPLICIT_CONVERSIONS: Map<string, Set<string>> = new Map([
  // 数值类型之间可以显式转换
  ['Int', new Set(['Float', 'Num', 'Byte', 'Str', 'Bool', 'Char', 'int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64'])],
  ['Float', new Set(['Int', 'Num', 'Byte', 'Str', 'int32', 'int64', 'float', 'double'])],
  ['Num', new Set(['Int', 'Float', 'Byte', 'Str'])],
  ['Byte', new Set(['Int', 'Float', 'Num', 'Str', 'Char', 'uint8', 'int8'])],
  // 字符类型转换
  ['Char', new Set(['Int', 'Byte', 'Str', 'int8', 'uint8', 'unsigned char'])],
  // 字符串转换
  ['Str', new Set(['Int', 'Float', 'Num', 'Bool'])],
  // 布尔转换
  ['Bool', new Set(['Int', 'Str'])],
  // C++ 风格类型显式转换
  ['int8', new Set(['int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64', 'Int', 'Byte', 'Char'])],
  ['int16', new Set(['int8', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64', 'Int', 'Byte'])],
  ['int32', new Set(['int8', 'int16', 'int64', 'uint8', 'uint16', 'uint32', 'uint64', 'Int', 'Byte'])],
  ['int64', new Set(['int8', 'int16', 'int32', 'uint8', 'uint16', 'uint32', 'uint64', 'Int', 'Byte'])],
  ['uint8', new Set(['int8', 'int16', 'int32', 'int64', 'uint16', 'uint32', 'uint64', 'Int', 'Byte', 'Char'])],
  ['uint16', new Set(['int8', 'int16', 'int32', 'int64', 'uint8', 'uint32', 'uint64', 'Int', 'Byte'])],
  ['uint32', new Set(['int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint64', 'Int', 'Byte'])],
  ['uint64', new Set(['int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'Int', 'Byte'])],
  ['float', new Set(['double', 'Float', 'Int', 'int32', 'int64'])],
  ['double', new Set(['float', 'Float', 'Int', 'int32', 'int64'])],
  ['unsigned char', new Set(['char', 'Char', 'Byte', 'int8', 'uint8'])],
]);

export class TypeChecker {
  private classTypes: Map<string, TypeInfo> = new Map();
  private enumTypes: Map<string, TypeInfo> = new Map();
  private currentClass: TypeInfo | null = null;
  private currentFunctionReturnType: TypeInfo | null = null;

  check(program: Program, filename: string | undefined, errors: CompilerError[]): void {
    this.classTypes.clear();
    this.enumTypes.clear();
    const globalScope: Scope = { symbols: new Map() };

    // Built-in functions
    globalScope.symbols.set('println', { type: { kind: 'function', params: [{ kind: 'unknown' }], returnType: { kind: 'void' } } });
    globalScope.symbols.set('print', { type: { kind: 'function', params: [{ kind: 'unknown' }], returnType: { kind: 'void' } } });
    // Built-in values
    globalScope.symbols.set('NaN', { type: { kind: 'primitive', name: 'Float' } });
    globalScope.symbols.set('Infinity', { type: { kind: 'primitive', name: 'Float' } });

    // First pass: collect all class definitions
    for (const stmt of program.body) {
      if (stmt.type === 'ClassDeclaration') {
        const classType = this.collectClassType(stmt);
        this.classTypes.set(stmt.name, classType);
        globalScope.symbols.set(stmt.name, { type: classType });
      }
    }

    // Collect all enum definitions
    for (const stmt of program.body) {
      if (stmt.type === 'EnumDeclaration') {
        const enumType = this.collectEnumType(stmt);
        this.enumTypes.set(stmt.name, enumType);
        globalScope.symbols.set(stmt.name, { type: enumType });
      }
    }

    // Second pass: collect other top-level declarations
    for (const stmt of program.body) {
      switch (stmt.type) {
        case 'VariableDeclaration':
          globalScope.symbols.set(stmt.name, { type: this.resolveTypeAnnotation(stmt.typeAnnotation) });
          break;
        case 'FunctionDeclaration':
          globalScope.symbols.set(stmt.name, { type: this.resolveFunctionType(stmt) });
          break;
        case 'TypeAliasDeclaration':
          globalScope.symbols.set(stmt.name, { type: { kind: 'unknown' } });
          break;
        case 'ImportStatement':
          for (const spec of stmt.specifiers) {
            const name = spec.type === 'default' || spec.type === 'named' || spec.type === 'namespace' ? spec.local : '';
            if (name) globalScope.symbols.set(name, { type: { kind: 'unknown' } });
          }
          break;
      }
    }

    // Third pass: check usages and type compatibility
    for (const stmt of program.body) {
      this.checkStatement(stmt, globalScope, filename, errors);
    }
  }

  /**
   * 收集 enum 类型信息
   */
  private collectEnumType(stmt: EnumDeclaration): TypeInfo {
    const members = new Map<string, EnumMemberInfo>();
    
    for (const member of stmt.members) {
      const memberInfo: EnumMemberInfo = {
        name: member.name,
        isCallable: !!member.associatedData && member.associatedData.length > 0,
      };
      
      // 处理显式值
      if (member.value) {
        memberInfo.valueType = this.inferExpressionType(member.value);
      }
      
      // 处理关联数据
      if (member.associatedData && member.associatedData.length > 0) {
        memberInfo.associatedData = member.associatedData.map(p => 
          this.resolveTypeAnnotation(p.typeAnnotation)
        );
      }
      
      members.set(member.name, memberInfo);
    }
    
    return { kind: 'enum', name: stmt.name, members };
  }

  /**
   * 推断表达式类型（简化版，用于 enum 值）
   */
  private inferExpressionType(expr: Expression): TypeInfo {
    if (expr.type === 'Literal') {
      return this.inferLiteralType(expr.value);
    }
    return { kind: 'unknown' };
  }

  private collectClassType(stmt: ClassDeclaration): TypeInfo {
    const members = new Map<string, MemberInfo>();
    
    for (const member of stmt.body) {
      if (member.type === 'FieldDeclaration') {
        members.set(member.name, {
          type: this.resolveTypeAnnotation(member.typeAnnotation),
          isMethod: false,
          isStatic: member.isStatic || false,
        });
      } else if (member.type === 'MethodDeclaration') {
        members.set(member.name, {
          type: {
            kind: 'function',
            params: member.params.map(p => this.resolveTypeAnnotation(p.typeAnnotation)),
            returnType: this.resolveTypeAnnotation(member.returnType),
          },
          isMethod: true,
          isStatic: member.isStatic || false,
        });
      }
    }

    return { kind: 'class', name: stmt.name, members };
  }

  private resolveTypeAnnotation(annotation: TypeAnnotation | undefined): TypeInfo {
    if (!annotation) return { kind: 'unknown' };
    
    if (annotation.kind === 'simple') {
      // Check for Void type
      if (annotation.name === 'Void') {
        return { kind: 'void' };
      }
      
      // Check if it's a known class
      const classType = this.classTypes.get(annotation.name);
      if (classType) return classType;
      
      // Primitive types
      return { kind: 'primitive', name: annotation.name };
    }
    
    if (annotation.kind === 'array') {
      return { kind: 'array', elementType: this.resolveTypeAnnotation(annotation.elementType) };
    }
    
    // Function type: (params) => returnType
    if (annotation.kind === 'function') {
      return {
        kind: 'function',
        params: annotation.paramTypes.map(p => this.resolveTypeAnnotation(p)),
        returnType: this.resolveTypeAnnotation(annotation.returnType),
      };
    }
    
    return { kind: 'unknown' };
  }

  private resolveFunctionType(stmt: FunctionDeclaration): TypeInfo {
    return {
      kind: 'function',
      params: stmt.params.map(p => this.resolveTypeAnnotation(p.typeAnnotation)),
      returnType: this.resolveTypeAnnotation(stmt.returnType),
    };
  }

  private checkStatement(stmt: Statement, scope: Scope, filename: string | undefined, errors: CompilerError[]): void {
    switch (stmt.type) {
      case 'VariableDeclaration': {
        const declaredType = stmt.typeAnnotation 
          ? this.resolveTypeAnnotation(stmt.typeAnnotation)
          : null;
        
        let initType: TypeInfo = { kind: 'unknown' };
        if (stmt.init) {
          initType = this.checkExpression(stmt.init, scope, filename, errors);
        }
        
        // 确定变量的最终类型
        const varType = declaredType || initType;
        scope.symbols.set(stmt.name, { type: varType });
        
        // 检查赋值兼容性
        if (declaredType && stmt.init && initType.kind !== 'unknown') {
          if (!this.isAssignableTo(initType, declaredType)) {
            errors.push({
              message: `Type '${this.typeToString(initType)}' is not assignable to type '${this.typeToString(declaredType)}'`,
              line: 0,
              column: 0,
              file: filename,
            });
          }
        }
        break;
      }
      case 'FunctionDeclaration': {
        // Add function to current scope to support recursion and calling from subsequent statements in the block
        scope.symbols.set(stmt.name, { type: this.resolveFunctionType(stmt) });

        const fnScope: Scope = { parent: scope, symbols: new Map() };
        for (const param of stmt.params) {
          fnScope.symbols.set(param.name, { type: this.resolveTypeAnnotation(param.typeAnnotation) });
        }
        
        // 保存当前函数返回类型，用于检查 return 语句
        const prevReturnType = this.currentFunctionReturnType;
        this.currentFunctionReturnType = this.resolveTypeAnnotation(stmt.returnType);
        
        this.checkStatement(stmt.body, fnScope, filename, errors);
        
        this.currentFunctionReturnType = prevReturnType;
        break;
      }
      case 'BlockStatement': {
        const blockScope: Scope = { parent: scope, symbols: new Map() };
        for (const s of stmt.body) {
          this.checkStatement(s, blockScope, filename, errors);
        }
        break;
      }
      case 'ExpressionStatement':
        this.checkExpression(stmt.expression, scope, filename, errors);
        break;
      case 'ReturnStatement': {
        if (stmt.argument) {
          const returnType = this.checkExpression(stmt.argument, scope, filename, errors);
          // 检查返回值类型是否与函数声明的返回类型兼容
          if (this.currentFunctionReturnType && 
              this.currentFunctionReturnType.kind !== 'unknown' &&
              returnType.kind !== 'unknown') {
            if (!this.isAssignableTo(returnType, this.currentFunctionReturnType)) {
              errors.push({
                message: `Type '${this.typeToString(returnType)}' is not assignable to return type '${this.typeToString(this.currentFunctionReturnType)}'`,
                line: stmt.loc?.line ?? 0,
                column: stmt.loc?.column ?? 0,
                file: filename,
              });
            }
          }
        } else {
          // 没有返回值，检查函数是否应该返回 void
          if (this.currentFunctionReturnType && 
              this.currentFunctionReturnType.kind !== 'unknown' &&
              this.currentFunctionReturnType.kind !== 'void') {
            errors.push({
              message: `A function whose declared type is not 'Void' must return a value`,
              line: 0,
              column: 0,
              file: filename,
            });
          }
        }
        break;
      }
      case 'IfStatement':
        this.checkExpression(stmt.condition, scope, filename, errors);
        this.checkStatement(stmt.consequent, scope, filename, errors);
        if (stmt.alternate) this.checkStatement(stmt.alternate as Statement, scope, filename, errors);
        break;
      case 'ForStatement':
        if (stmt.init && 'type' in stmt.init) {
          this.checkStatement(stmt.init as Statement, scope, filename, errors);
        }
        if (stmt.condition) this.checkExpression(stmt.condition, scope, filename, errors);
        if (stmt.update) this.checkExpression(stmt.update, scope, filename, errors);
        this.checkStatement(stmt.body, scope, filename, errors);
        break;
      case 'WhenStatement':
        if (stmt.discriminant) this.checkExpression(stmt.discriminant, scope, filename, errors);
        for (const c of stmt.cases) {
          if (c.guard) this.checkExpression(c.guard, scope, filename, errors);
          if ('type' in c.body) this.checkStatement(c.body as Statement, scope, filename, errors);
          else this.checkExpression(c.body as Expression, scope, filename, errors);
        }
        break;
      case 'ClassDeclaration': {
        const classType = this.classTypes.get(stmt.name);
        const prevClass = this.currentClass;
        this.currentClass = classType || null;

        const classScope: Scope = { parent: scope, symbols: new Map() };
        // Add 'this' with the class type
        if (classType) {
          classScope.symbols.set('this', { type: classType });
        }
        // Add all members to scope
        for (const member of stmt.body) {
          if (member.type === 'FieldDeclaration') {
            classScope.symbols.set(member.name, { type: this.resolveTypeAnnotation(member.typeAnnotation) });
          } else if (member.type === 'MethodDeclaration') {
            classScope.symbols.set(member.name, {
              type: {
                kind: 'function',
                params: member.params.map(p => this.resolveTypeAnnotation(p.typeAnnotation)),
                returnType: this.resolveTypeAnnotation(member.returnType),
              }
            });
          }
        }
        // Check member bodies
        for (const member of stmt.body) {
          if (member.type === 'FieldDeclaration') {
            if (member.init) this.checkExpression(member.init, classScope, filename, errors);
          } else if (member.type === 'MethodDeclaration') {
            const methodScope: Scope = { parent: classScope, symbols: new Map() };
            for (const param of member.params) {
              methodScope.symbols.set(param.name, { type: this.resolveTypeAnnotation(param.typeAnnotation) });
            }
            if (member.body) this.checkStatement(member.body, methodScope, filename, errors);
          } else if (member.type === 'ConstructorDeclaration') {
            const ctorScope: Scope = { parent: classScope, symbols: new Map() };
            for (const param of member.params) {
              ctorScope.symbols.set(param.name, { type: this.resolveTypeAnnotation(param.typeAnnotation) });
            }
            this.checkStatement(member.body, ctorScope, filename, errors);
          }
        }
        this.currentClass = prevClass;
        break;
      }
      case 'WhileStatement':
        this.checkExpression(stmt.condition, scope, filename, errors);
        this.checkStatement(stmt.body, scope, filename, errors);
        break;
      case 'DoWhileStatement':
        this.checkStatement(stmt.body, scope, filename, errors);
        this.checkExpression(stmt.condition, scope, filename, errors);
        break;
      case 'EnumDeclaration':
      case 'ImportStatement':
      case 'ExportStatement':
      case 'TypeAliasDeclaration':
      case 'DeferStatement':
      case 'UsingStatement':
      case 'TryStatement':
      case 'ThrowStatement':
      case 'BreakStatement':
      case 'ContinueStatement':
        break;
    }
  }

  private checkExpression(expr: Expression, scope: Scope, filename: string | undefined, errors: CompilerError[]): TypeInfo {
    switch (expr.type) {
      case 'Identifier': {
        const symbol = this.lookupSymbol(expr.name, scope);
        if (!symbol) {
          errors.push({
            message: `Undefined identifier '${expr.name}'`,
            line: expr.line || 0,
            column: expr.column || 0,
            file: filename,
          });
          return { kind: 'unknown' };
        }
        return symbol.type;
      }
      case 'Literal':
        return this.inferLiteralType(expr.value);
      case 'CharLiteral':
        return { kind: 'primitive', name: 'Char' };
      case 'BinaryExpression': {
        const leftType = this.checkExpression(expr.left, scope, filename, errors);
        const rightType = this.checkExpression(expr.right, scope, filename, errors);
        return this.inferBinaryExpressionType(expr.operator, leftType, rightType);
      }
      case 'UnaryExpression': {
        const argType = this.checkExpression(expr.argument, scope, filename, errors);
        return this.inferUnaryExpressionType(expr.operator, argType);
      }
      case 'CallExpression': {
        const calleeType = this.checkExpression(expr.callee, scope, filename, errors);
        for (const arg of expr.arguments) this.checkExpression(arg, scope, filename, errors);
        if (calleeType.kind === 'function') {
          return calleeType.returnType;
        }
        return { kind: 'unknown' };
      }
      case 'NewExpression': {
        // new ClassName() returns instance of that class
        if (expr.callee.type === 'Identifier') {
          const classType = this.classTypes.get(expr.callee.name);
          if (classType) {
            for (const arg of expr.arguments) this.checkExpression(arg, scope, filename, errors);
            return classType;
          }
        }
        this.checkExpression(expr.callee, scope, filename, errors);
        for (const arg of expr.arguments) this.checkExpression(arg, scope, filename, errors);
        return { kind: 'unknown' };
      }
      case 'MemberExpression': {
        const objectType = this.checkExpression(expr.object, scope, filename, errors);
        
        // For computed access (obj[expr]), check the expression
        if (expr.computed) {
          this.checkExpression(expr.property, scope, filename, errors);
          return { kind: 'unknown' };
        }
        
        // For non-computed access (obj.prop), check if member exists
        if (expr.property.type === 'Identifier') {
          const memberName = expr.property.name;
          
          // Enum 成员访问: EnumName.MemberName
          if (objectType.kind === 'enum') {
            const member = objectType.members.get(memberName);
            if (!member) {
              errors.push({
                message: `Enum member '${memberName}' does not exist on enum '${objectType.name}'`,
                line: 0,
                column: 0,
                file: filename,
              });
              return { kind: 'unknown' };
            }
            // 返回 enumMember 类型
            return {
              kind: 'enumMember',
              enumName: objectType.name,
              memberName: member.name,
              valueType: member.valueType,
              associatedData: member.associatedData,
            };
          }
          
          if (objectType.kind === 'class') {
            const member = objectType.members.get(memberName);
            if (!member) {
              errors.push({
                message: `Property '${memberName}' does not exist on type '${objectType.name}'`,
                line: 0,
                column: 0,
                file: filename,
              });
              return { kind: 'unknown' };
            }
            return member.type;
          }
        }
        return { kind: 'unknown' };
      }
      case 'ArrayExpression':
        for (const e of expr.elements) this.checkExpression(e, scope, filename, errors);
        return { kind: 'array', elementType: { kind: 'unknown' } };
      case 'ObjectExpression':
        for (const p of expr.properties) {
          // 对象字面量的键如果是标识符，不需要在作用域中查找
          // 只有计算属性（如 [expr]: value）才需要检查键表达式
          if (p.key.type !== 'Identifier') {
            this.checkExpression(p.key, scope, filename, errors);
          }
          this.checkExpression(p.value, scope, filename, errors);
        }
        return { kind: 'unknown' };
      case 'ArrowFunctionExpression': {
        const fnScope: Scope = { parent: scope, symbols: new Map() };
        for (const p of expr.params) {
          fnScope.symbols.set(p.name, { type: this.resolveTypeAnnotation(p.typeAnnotation) });
        }
        if ('type' in expr.body && expr.body.type === 'BlockStatement') {
          this.checkStatement(expr.body, fnScope, filename, errors);
        } else {
          this.checkExpression(expr.body as Expression, fnScope, filename, errors);
        }
        return { kind: 'function', params: [], returnType: { kind: 'unknown' } };
      }
      case 'AssignmentExpression': {
        const leftType = this.checkExpression(expr.left, scope, filename, errors);
        const rightType = this.checkExpression(expr.right, scope, filename, errors);
        
        // 检查赋值兼容性
        if (leftType.kind !== 'unknown' && rightType.kind !== 'unknown') {
          if (!this.isAssignableTo(rightType, leftType)) {
            errors.push({
              message: `Type '${this.typeToString(rightType)}' is not assignable to type '${this.typeToString(leftType)}'`,
              line: 0,
              column: 0,
              file: filename,
            });
          }
        }
        return leftType;
      }
      case 'ConditionalExpression':
        this.checkExpression(expr.test, scope, filename, errors);
        this.checkExpression(expr.consequent, scope, filename, errors);
        this.checkExpression(expr.alternate, scope, filename, errors);
        return { kind: 'unknown' };
      case 'LogicalExpression':
        this.checkExpression(expr.left, scope, filename, errors);
        this.checkExpression(expr.right, scope, filename, errors);
        return { kind: 'unknown' };
      case 'TemplateStringExpression':
        for (const part of expr.parts) {
          if (typeof part !== 'string') this.checkExpression(part, scope, filename, errors);
        }
        return { kind: 'primitive', name: 'Str' };
      case 'ThisExpression': {
        // 'this' should be looked up in scope - it's set in class context
        const thisSymbol = this.lookupSymbol('this', scope);
        return thisSymbol?.type || { kind: 'unknown' };
      }
      case 'SuperExpression':
        // super refers to parent class, type checking would need parent class info
        return { kind: 'unknown' };
      case 'TypeofExpression':
        this.checkExpression(expr.argument, scope, filename, errors);
        return { kind: 'primitive', name: 'Str' };
      case 'InstanceofExpression':
        this.checkExpression(expr.left, scope, filename, errors);
        this.checkExpression(expr.right, scope, filename, errors);
        return { kind: 'primitive', name: 'Bool' };
      case 'VoidExpression':
        this.checkExpression(expr.argument, scope, filename, errors);
        return { kind: 'primitive', name: 'Nul' };
      case 'DeleteExpression':
        this.checkExpression(expr.argument, scope, filename, errors);
        return { kind: 'primitive', name: 'Bool' };
      case 'YieldExpression':
        if (expr.argument) this.checkExpression(expr.argument, scope, filename, errors);
        return { kind: 'unknown' };
      case 'TypeCastExpression': {
        const sourceType = this.checkExpression(expr.expression, scope, filename, errors);
        const targetType = this.resolveTypeAnnotation(expr.typeAnnotation);
        
        // 检查显式类型转换是否合法
        if (sourceType.kind !== 'unknown' && targetType.kind !== 'unknown') {
          if (!this.canExplicitCast(sourceType, targetType)) {
            errors.push({
              message: `Cannot convert type '${this.typeToString(sourceType)}' to type '${this.typeToString(targetType)}'`,
              line: 0,
              column: 0,
              file: filename,
            });
          }
        }
        return targetType;
      }
      case 'TypeCheckExpression': {
        this.checkExpression(expr.expression, scope, filename, errors);
        // is 表达式返回 Bool
        return { kind: 'primitive', name: 'Bool' };
      }
      case 'IfExpression': {
        this.checkExpression(expr.condition, scope, filename, errors);
        const consequentType = this.checkExpression(expr.consequent, scope, filename, errors);
        const alternateType = this.checkExpression(expr.alternate, scope, filename, errors);
        // 返回两个分支的公共类型（简化处理，返回第一个分支的类型）
        return consequentType;
      }
      default:
        return { kind: 'unknown' };
    }
  }

  private lookupSymbol(name: string, scope: Scope | undefined): SymbolInfo | undefined {
    let current: Scope | undefined = scope;
    while (current) {
      const symbol = current.symbols.get(name);
      if (symbol) return symbol;
      current = current.parent;
    }
    return undefined;
  }

  private inferType(expr: Expression, scope: Scope): TypeInfo {
    if (expr.type === 'Literal') {
      return this.inferLiteralType(expr.value);
    }
    if (expr.type === 'Identifier') {
      const symbol = this.lookupSymbol(expr.name, scope);
      return symbol?.type || { kind: 'unknown' };
    }
    if (expr.type === 'NewExpression' && expr.callee.type === 'Identifier') {
      const classType = this.classTypes.get(expr.callee.name);
      if (classType) return classType;
    }
    return { kind: 'unknown' };
  }

  private inferLiteralType(value: any): TypeInfo {
    if (typeof value === 'number') {
      return { kind: 'primitive', name: Number.isInteger(value) ? 'Int' : 'Float' };
    }
    if (typeof value === 'string') {
      return { kind: 'primitive', name: 'Str' };
    }
    if (typeof value === 'boolean') {
      return { kind: 'primitive', name: 'Bool' };
    }
    if (value === null) {
      return { kind: 'primitive', name: 'Nul' };
    }
    return { kind: 'unknown' };
  }

  // ============ 表达式类型推断 ============

  /**
   * 推断二元表达式的结果类型
   */
  private inferBinaryExpressionType(operator: string, leftType: TypeInfo, rightType: TypeInfo): TypeInfo {
    // 比较运算符返回 Bool
    if (['==', '!=', '===', '!==', '<', '>', '<=', '>='].includes(operator)) {
      return { kind: 'primitive', name: 'Bool' };
    }
    
    // 逻辑运算符返回 Bool
    if (['&&', '||'].includes(operator)) {
      return { kind: 'primitive', name: 'Bool' };
    }
    
    // 字符串连接
    if (operator === '+') {
      if (leftType.kind === 'primitive' && leftType.name === 'Str') {
        return { kind: 'primitive', name: 'Str' };
      }
      if (rightType.kind === 'primitive' && rightType.name === 'Str') {
        return { kind: 'primitive', name: 'Str' };
      }
    }
    
    // 数值运算
    if (['+', '-', '*', '/', '%', '**'].includes(operator)) {
      // 如果任一操作数是 Float，结果是 Float
      if (leftType.kind === 'primitive' && rightType.kind === 'primitive') {
        if (leftType.name === 'Float' || rightType.name === 'Float') {
          return { kind: 'primitive', name: 'Float' };
        }
        // 两个 Int 运算，除法也返回 Int (整数除法)
        if (leftType.name === 'Int' && rightType.name === 'Int') {
          return { kind: 'primitive', name: 'Int' };
        }
        // Num 类型
        if (leftType.name === 'Num' || rightType.name === 'Num') {
          return { kind: 'primitive', name: 'Num' };
        }
      }
    }
    
    // 位运算返回 Int
    if (['&', '|', '^', '<<', '>>', '>>>'].includes(operator)) {
      return { kind: 'primitive', name: 'Int' };
    }
    
    // 空值合并运算符
    if (operator === '??') {
      // 返回非空的那个类型
      if (leftType.kind !== 'unknown') return leftType;
      if (rightType.kind !== 'unknown') return rightType;
    }
    
    return { kind: 'unknown' };
  }

  /**
   * 推断一元表达式的结果类型
   */
  private inferUnaryExpressionType(operator: string, argType: TypeInfo): TypeInfo {
    switch (operator) {
      case '!':
        return { kind: 'primitive', name: 'Bool' };
      case '-':
      case '+':
        // 保持数值类型
        if (argType.kind === 'primitive' && ['Int', 'Float', 'Num', 'Byte'].includes(argType.name)) {
          return argType;
        }
        return { kind: 'primitive', name: 'Num' };
      case '~':
        return { kind: 'primitive', name: 'Int' };
      case '++':
      case '--':
        return argType;
      case 'typeof':
        return { kind: 'primitive', name: 'Str' };
      default:
        return { kind: 'unknown' };
    }
  }

  // ============ 类型兼容性检查 ============

  /**
   * 检查两个类型是否相等
   */
  private isTypeEqual(a: TypeInfo, b: TypeInfo): boolean {
    if (a.kind !== b.kind) return false;
    
    switch (a.kind) {
      case 'primitive':
        return a.name === (b as typeof a).name;
      case 'class':
        return a.name === (b as typeof a).name;
      case 'array':
        return this.isTypeEqual(a.elementType, (b as typeof a).elementType);
      case 'function': {
        const bFunc = b as typeof a;
        if (a.params.length !== bFunc.params.length) return false;
        if (!this.isTypeEqual(a.returnType, bFunc.returnType)) return false;
        return a.params.every((p, i) => this.isTypeEqual(p, bFunc.params[i]));
      }
      case 'void':
      case 'unknown':
        return true;
      default:
        return false;
    }
  }

  /**
   * 检查 source 类型是否可以赋值给 target 类型
   * 支持隐式类型转换
   */
  private isAssignableTo(source: TypeInfo, target: TypeInfo): boolean {
    // unknown 类型可以赋值给任何类型，任何类型也可以赋值给 unknown
    if (source.kind === 'unknown' || target.kind === 'unknown') return true;
    
    // 完全相等
    if (this.isTypeEqual(source, target)) return true;
    
    // null 可以赋值给任何引用类型
    if (source.kind === 'primitive' && source.name === 'Nul') {
      return target.kind === 'class' || target.kind === 'array';
    }
    
    // 检查隐式类型转换
    if (source.kind === 'primitive' && target.kind === 'primitive') {
      const conversions = IMPLICIT_CONVERSIONS.get(source.name);
      if (conversions && conversions.has(target.name)) return true;
    }
    
    // 数组类型：检查元素类型兼容性
    if (source.kind === 'array' && target.kind === 'array') {
      return this.isAssignableTo(source.elementType, target.elementType);
    }
    
    // 函数类型：参数逆变，返回值协变
    if (source.kind === 'function' && target.kind === 'function') {
      if (source.params.length !== target.params.length) return false;
      // 参数逆变
      for (let i = 0; i < source.params.length; i++) {
        if (!this.isAssignableTo(target.params[i], source.params[i])) return false;
      }
      // 返回值协变
      return this.isAssignableTo(source.returnType, target.returnType);
    }
    
    // 类类型：检查继承关系（简化版，只检查名称）
    if (source.kind === 'class' && target.kind === 'class') {
      // TODO: 实现继承链检查
      return source.name === target.name;
    }
    
    // Enum 类型：enumMember 可以赋值给对应的 enum 类型
    if (source.kind === 'enumMember' && target.kind === 'enum') {
      return source.enumName === target.name;
    }
    
    // 同一 enum 的成员之间可以赋值
    if (source.kind === 'enumMember' && target.kind === 'enumMember') {
      return source.enumName === target.enumName;
    }
    
    return false;
  }

  /**
   * 检查是否可以进行显式类型转换
   */
  private canExplicitCast(source: TypeInfo, target: TypeInfo): boolean {
    // 如果可以隐式转换，当然也可以显式转换
    if (this.isAssignableTo(source, target)) return true;
    
    // 检查显式转换规则
    if (source.kind === 'primitive' && target.kind === 'primitive') {
      const conversions = EXPLICIT_CONVERSIONS.get(source.name);
      if (conversions && conversions.has(target.name)) return true;
      // 反向检查（如 Float -> Int）
      const reverseConversions = EXPLICIT_CONVERSIONS.get(target.name);
      if (reverseConversions && reverseConversions.has(source.name)) return true;
    }
    
    // 类类型之间可以显式转换（向下转型）
    if (source.kind === 'class' && target.kind === 'class') {
      return true; // 运行时检查
    }
    
    // any/unknown 可以转换为任何类型
    if (source.kind === 'unknown') return true;
    
    return false;
  }

  /**
   * 获取类型的字符串表示
   */
  private typeToString(type: TypeInfo): string {
    switch (type.kind) {
      case 'primitive':
        return type.name;
      case 'class':
        return type.name;
      case 'enum':
        return type.name;
      case 'enumMember':
        return `${type.enumName}.${type.memberName}`;
      case 'array':
        return `${this.typeToString(type.elementType)}[]`;
      case 'function':
        return `(${type.params.map(p => this.typeToString(p)).join(', ')}) => ${this.typeToString(type.returnType)}`;
      case 'void':
        return 'Void';
      case 'unknown':
        return 'unknown';
      default:
        return 'unknown';
    }
  }
}
