// Ljos Type System for LSP

export type LjosType =
  | PrimitiveType
  | ClassType
  | FunctionType
  | ArrayType
  | MapType
  | TupleType
  | UnionType
  | GenericType
  | UnknownType
  | VoidType
  | NullType
  | ObjectLiteralType
  | EnumType
  | EnumMemberType;

// Object literal type (for { key: value } expressions)
export interface ObjectLiteralType {
  kind: 'object';
  properties: Map<string, LjosType>;
}

export interface PrimitiveType {
  kind: 'primitive';
  name: 'int' | 'float' | 'str' | 'bool' | 'any' | 'Int' | 'Float' | 'Str' | 'Bool' | 'Num' | 'Byte' | 'Char';
}

export interface ClassType {
  kind: 'class';
  name: string;
  isAbstract: boolean;
  superClass?: ClassType;
  members: Map<string, MemberInfo>;
  typeParameters?: string[];
}

export interface FunctionType {
  kind: 'function';
  params: ParameterInfo[];
  returnType: LjosType;
  typeParameters?: string[];
}

export interface ArrayType {
  kind: 'array';
  elementType: LjosType;
  size?: number;
}

export interface MapType {
  kind: 'map';
  keyType: LjosType;
  valueType: LjosType;
}

export interface TupleType {
  kind: 'tuple';
  elementTypes: LjosType[];
}

export interface UnionType {
  kind: 'union';
  types: LjosType[];
}

export interface GenericType {
  kind: 'generic';
  name: string;
  typeArguments: LjosType[];
}

export interface UnknownType {
  kind: 'unknown';
}

export interface VoidType {
  kind: 'void';
}

export interface NullType {
  kind: 'null';
}

// Enum type (ADT-style enum with optional associated data)
export interface EnumType {
  kind: 'enum';
  name: string;
  members: Map<string, EnumMemberInfo>;
}

// Enum member info
export interface EnumMemberInfo {
  name: string;
  valueType?: LjosType;           // 显式值的类型
  associatedData?: LjosType[];    // 关联数据的类型列表
  isCallable: boolean;            // 是否有关联数据（可调用）
}

// Enum member type (a specific variant of an enum)
export interface EnumMemberType {
  kind: 'enumMember';
  enumName: string;
  memberName: string;
  valueType?: LjosType;
  associatedData?: LjosType[];
}

export interface ParameterInfo {
  name: string;
  type: LjosType;
  optional: boolean;
  defaultValue?: string;
}

export interface MemberInfo {
  name: string;
  type: LjosType;
  isMethod: boolean;
  isStatic: boolean;
  isAbstract: boolean;
  isReadonly: boolean;
  visibility: 'public' | 'private' | 'protected';
}

export interface SymbolInfo {
  name: string;
  type: LjosType;
  kind: 'variable' | 'function' | 'class' | 'enum' | 'type' | 'parameter' | 'property' | 'method' | 'import';
  isConst: boolean;
  declarationLine: number;
  declarationColumn: number;
  documentation?: string;
}

export interface ModuleInfo {
  path: string;
  exports: Map<string, SymbolInfo>;
  defaultExport?: SymbolInfo;
  isResolved: boolean;
}

// Type utilities
export function typeToString(type: LjosType): string {
  switch (type.kind) {
    case 'primitive':
      // Normalize to Pascal case for display
      return normalizePrimitiveTypeName(type.name);
    case 'class':
      return type.name;
    case 'function': {
      const params = type.params.map(p => `${p.name}: ${typeToString(p.type)}`).join(', ');
      return `(${params}) => ${typeToString(type.returnType)}`;
    }
    case 'array':
      return `[${typeToString(type.elementType)}]`;
    case 'map':
      return `{${typeToString(type.keyType)}: ${typeToString(type.valueType)}}`;
    case 'tuple':
      return `(${type.elementTypes.map(typeToString).join(', ')})`;
    case 'union':
      return type.types.map(typeToString).join(' | ');
    case 'generic':
      // Only show <> if there are type arguments
      if (type.typeArguments.length === 0) {
        return type.name;
      }
      return `${type.name}<${type.typeArguments.map(typeToString).join(', ')}>`;
    case 'object': {
      const props: string[] = [];
      for (const [key, valueType] of type.properties) {
        props.push(`${key}: ${typeToString(valueType)}`);
      }
      return `{${props.join(', ')}}`;
    }
    case 'enum':
      return type.name;
    case 'enumMember':
      return `${type.enumName}.${type.memberName}`;
    case 'unknown':
      return 'unknown';
    case 'void':
      return 'Void';
    case 'null':
      return 'Nul';
  }
}

// Normalize primitive type names to Pascal case
function normalizePrimitiveTypeName(name: string): string {
  const normalizeMap: Record<string, string> = {
    'int': 'Int',
    'float': 'Float',
    'str': 'Str',
    'bool': 'Bool',
    'any': 'Any',
    'Int': 'Int',
    'Float': 'Float',
    'Str': 'Str',
    'Bool': 'Bool',
    'Num': 'Num',
    'Byte': 'Byte',
    'Char': 'Char',
  };
  return normalizeMap[name] || name;
}

export function createPrimitive(name: PrimitiveType['name']): PrimitiveType {
  return { kind: 'primitive', name };
}

export function createUnknown(): UnknownType {
  return { kind: 'unknown' };
}

export function createVoid(): VoidType {
  return { kind: 'void' };
}

export function createNull(): NullType {
  return { kind: 'null' };
}

export function createArray(elementType: LjosType): ArrayType {
  return { kind: 'array', elementType };
}

export function createFunction(params: ParameterInfo[], returnType: LjosType): FunctionType {
  return { kind: 'function', params, returnType };
}

export function createObjectLiteral(properties: Map<string, LjosType>): ObjectLiteralType {
  return { kind: 'object', properties };
}

export function createClass(name: string, isAbstract = false): ClassType {
  return { kind: 'class', name, isAbstract, members: new Map() };
}

export function createEnum(name: string): EnumType {
  return { kind: 'enum', name, members: new Map() };
}

export function createEnumMember(enumName: string, memberName: string, associatedData?: LjosType[]): EnumMemberType {
  return { kind: 'enumMember', enumName, memberName, associatedData };
}

// Implicit type conversion rules
const IMPLICIT_CONVERSIONS: Map<string, Set<string>> = new Map([
  // Numeric type conversions
  ['Int', new Set(['Float', 'Num'])],
  ['Float', new Set(['Num'])],
  ['Byte', new Set(['Int', 'Float', 'Num'])],
  // Character type conversions
  ['Char', new Set(['Str', 'Int'])],
  // Fixed-width integer conversions
  ['int8', new Set(['int16', 'int32', 'int64', 'Int', 'Float'])],
  ['int16', new Set(['int32', 'int64', 'Int', 'Float'])],
  ['int32', new Set(['int64', 'Int', 'Float'])],
  ['uint8', new Set(['uint16', 'uint32', 'uint64', 'int16', 'int32', 'int64', 'Int', 'Float'])],
  ['uint16', new Set(['uint32', 'uint64', 'int32', 'int64', 'Int', 'Float'])],
  ['uint32', new Set(['uint64', 'int64', 'Float'])],
  ['float', new Set(['double', 'Float'])],
]);

// Normalize primitive type name for comparison
function normalizePrimitiveName(name: string): string {
  const normalizeMap: Record<string, string> = {
    'int': 'Int', 'float': 'Float', 'str': 'Str', 'bool': 'Bool',
  };
  return normalizeMap[name] || name;
}

export function isAssignable(target: LjosType, source: LjosType): boolean {
  // unknown is assignable to/from anything
  if (target.kind === 'unknown' || source.kind === 'unknown') return true;
  
  // Same kind check
  if (target.kind !== source.kind) {
    // null is assignable to any reference type
    if (source.kind === 'null' && (target.kind === 'class' || target.kind === 'array' || target.kind === 'function')) {
      return true;
    }
    // Union type handling
    if (target.kind === 'union') {
      return target.types.some(t => isAssignable(t, source));
    }
    // enumMember is assignable to its enum type
    if (source.kind === 'enumMember' && target.kind === 'enum') {
      return (source as EnumMemberType).enumName === (target as EnumType).name;
    }
    return false;
  }
  
  switch (target.kind) {
    case 'primitive': {
      const targetName = normalizePrimitiveName(target.name);
      const sourceName = normalizePrimitiveName((source as PrimitiveType).name);
      
      // Same type or any
      if (targetName === sourceName || target.name === 'any') return true;
      
      // Check implicit conversions
      const conversions = IMPLICIT_CONVERSIONS.get(sourceName);
      if (conversions && conversions.has(targetName)) return true;
      
      return false;
    }
    case 'class':
      return target.name === (source as ClassType).name || isSubclass(source as ClassType, target);
    case 'array':
      return isAssignable(target.elementType, (source as ArrayType).elementType);
    case 'function': {
      const srcFn = source as FunctionType;
      if (target.params.length !== srcFn.params.length) return false;
      // Contravariant params, covariant return
      for (let i = 0; i < target.params.length; i++) {
        if (!isAssignable(srcFn.params[i].type, target.params[i].type)) return false;
      }
      return isAssignable(target.returnType, srcFn.returnType);
    }
    case 'enum':
      return (target as EnumType).name === (source as EnumType).name;
    case 'enumMember': {
      const targetMember = target as EnumMemberType;
      const sourceMember = source as EnumMemberType;
      return targetMember.enumName === sourceMember.enumName;
    }
    default:
      return true;
  }
}

function isSubclass(derived: ClassType, base: ClassType): boolean {
  let current: ClassType | undefined = derived;
  while (current) {
    if (current.name === base.name) return true;
    current = current.superClass;
  }
  return false;
}

// Get all members of a class including inherited ones
export function getAllClassMembers(classType: ClassType): Map<string, MemberInfo> {
  const allMembers = new Map<string, MemberInfo>();
  
  // First, collect all inherited members (from base to derived)
  const hierarchy: ClassType[] = [];
  let current: ClassType | undefined = classType;
  while (current) {
    hierarchy.unshift(current); // Add to front so base classes come first
    current = current.superClass;
  }
  
  // Apply members from base to derived (derived overrides base)
  for (const cls of hierarchy) {
    for (const [name, member] of cls.members) {
      // Skip private members from parent classes
      if (cls !== classType && member.visibility === 'private') {
        continue;
      }
      allMembers.set(name, member);
    }
  }
  
  return allMembers;
}

// Get member from class or its superclasses
export function getClassMember(classType: ClassType, memberName: string): MemberInfo | undefined {
  let current: ClassType | undefined = classType;
  while (current) {
    const member = current.members.get(memberName);
    if (member) {
      // Private members only accessible from the declaring class
      if (current !== classType && member.visibility === 'private') {
        current = current.superClass;
        continue;
      }
      return member;
    }
    current = current.superClass;
  }
  return undefined;
}

// Built-in types (support both lowercase and Pascal case)
export const BUILTIN_TYPES: Record<string, LjosType> = {
  // Lowercase versions
  'int': createPrimitive('Int'),
  'float': createPrimitive('Float'),
  'str': createPrimitive('Str'),
  'bool': createPrimitive('Bool'),
  'any': createPrimitive('any'),
  'void': createVoid(),
  'nul': createNull(),
  // Pascal case versions (Ljos standard)
  'Int': createPrimitive('Int'),
  'Float': createPrimitive('Float'),
  'Str': createPrimitive('Str'),
  'Bool': createPrimitive('Bool'),
  'Num': createPrimitive('Num'),
  'Byte': createPrimitive('Byte'),
  'Char': createPrimitive('Char'),
  'Any': createPrimitive('any'),
  'Void': createVoid(),
  'Nul': createNull(),
};
