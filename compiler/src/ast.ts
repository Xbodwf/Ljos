// AST Node definitions for Ljos language

export type ASTNode =
  | Program
  | Statement
  | Expression;

// ============ Program ============
export interface Program {
  type: 'Program';
  body: Statement[];
}

// ============ Statements ============
export type Statement =
  | VariableDeclaration
  | FunctionDeclaration
  | ClassDeclaration
  | EnumDeclaration
  | ExpressionStatement
  | IfStatement
  | ForStatement
  | WhileStatement
  | DoWhileStatement
  | WhenStatement
  | ReturnStatement
  | BreakStatement
  | ContinueStatement
  | ThrowStatement
  | TryStatement
  | ImportStatement
  | ExportStatement
  | TypeAliasDeclaration
  | BlockStatement
  | DeferStatement
  | UsingStatement;

export interface VariableDeclaration {
  type: 'VariableDeclaration';
  kind: 'const' | 'mut';
  name: string;
  typeAnnotation?: TypeAnnotation;
  init?: Expression;
}

export interface FunctionDeclaration {
  type: 'FunctionDeclaration';
  name: string;
  typeParameters?: string[];
  params: Parameter[];
  returnType?: TypeAnnotation;
  body: BlockStatement;
  isExported?: boolean;
}

export interface ClassDeclaration {
  type: 'ClassDeclaration';
  name: string;
  isAbstract?: boolean;
  superClass?: Identifier;
  implements?: Identifier[];
  body: ClassMember[];
  decorators?: Expression[];
}

export type ClassMember =
  | FieldDeclaration
  | MethodDeclaration
  | ConstructorDeclaration;

// Access modifiers for class members
export type AccessModifier = 'public' | 'private' | 'protected';

export interface FieldDeclaration {
  type: 'FieldDeclaration';
  name: string;
  kind: 'const' | 'mut';
  typeAnnotation?: TypeAnnotation;
  init?: Expression;
  isStatic?: boolean;
  isReadonly?: boolean;
  accessibility?: AccessModifier;
  decorators?: Expression[];
}

export interface MethodDeclaration {
  type: 'MethodDeclaration';
  name: string;
  params: Parameter[];
  returnType?: TypeAnnotation;
  body?: BlockStatement;
  isStatic?: boolean;
  isAbstract?: boolean;
  accessibility?: AccessModifier;
  decorators?: Expression[];
}

export interface ConstructorDeclaration {
  type: 'ConstructorDeclaration';
  params: Parameter[];
  body: BlockStatement;
  accessibility?: AccessModifier;
  decorators?: Expression[];
}

export interface EnumDeclaration {
  type: 'EnumDeclaration';
  name: string;
  members: { name: string }[];
}

export interface Parameter {
  name: string;
  typeAnnotation?: TypeAnnotation;
  defaultValue?: Expression;
}

export interface ExpressionStatement {
  type: 'ExpressionStatement';
  expression: Expression;
}

export interface IfStatement {
  type: 'IfStatement';
  condition: Expression;
  consequent: BlockStatement;
  alternate?: IfStatement | BlockStatement;
}

export interface ForStatement {
  type: 'ForStatement';
  init?: VariableDeclaration | Expression;
  condition?: Expression;
  update?: Expression;
  body: BlockStatement;
  // For-in loop
  variable?: string;
  iterable?: Expression;
  isForIn: boolean;
}

export interface WhileStatement {
  type: 'WhileStatement';
  condition: Expression;
  body: BlockStatement;
}

export interface DoWhileStatement {
  type: 'DoWhileStatement';
  body: BlockStatement;
  condition: Expression;
}

export interface WhenStatement {
  type: 'WhenStatement';
  discriminant?: Expression;
  cases: WhenCase[];
}

export interface WhenCase {
  pattern: Pattern;
  guard?: Expression;
  body: Expression | BlockStatement;
}

export type Pattern =
  | LiteralPattern
  | IdentifierPattern
  | ArrayPattern
  | ObjectPattern
  | TypePattern
  | OrPattern
  | ElsePattern;

export interface LiteralPattern {
  type: 'LiteralPattern';
  value: Expression;
}

export interface IdentifierPattern {
  type: 'IdentifierPattern';
  name: string;
}

export interface ArrayPattern {
  type: 'ArrayPattern';
  elements: Pattern[];
}

export interface ObjectPattern {
  type: 'ObjectPattern';
  properties: { key: string; value: Pattern }[];
}

export interface TypePattern {
  type: 'TypePattern';
  name: string;
  typeAnnotation: TypeAnnotation;
}

export interface OrPattern {
  type: 'OrPattern';
  patterns: Pattern[];
}

export interface ElsePattern {
  type: 'ElsePattern';
}

export interface ReturnStatement {
  type: 'ReturnStatement';
  argument?: Expression;
}

export interface BreakStatement {
  type: 'BreakStatement';
  argument?: Expression;
}

export interface ContinueStatement {
  type: 'ContinueStatement';
}

export interface ThrowStatement {
  type: 'ThrowStatement';
  argument: Expression;
}

export interface TryStatement {
  type: 'TryStatement';
  block: BlockStatement;
  handlers: CatchClause[];
}

export interface CatchClause {
  param?: string;
  typeAnnotation?: TypeAnnotation;
  body: BlockStatement;
}

export interface ImportStatement {
  type: 'ImportStatement';
  specifiers: ImportSpecifier[];
  source: string;
}

export type ImportSpecifier =
  | { type: 'default'; local: string }
  | { type: 'named'; imported: string; local: string }
  | { type: 'namespace'; local: string };

export interface ExportStatement {
  type: 'ExportStatement';
  declaration?: Statement;
  isDefault?: boolean;
  source?: string;
  specifiers?: { exported: string; local: string }[];
}

export interface TypeAliasDeclaration {
  type: 'TypeAliasDeclaration';
  name: string;
  typeParameters?: string[];
  typeAnnotation: TypeAnnotation;
}

export interface BlockStatement {
  type: 'BlockStatement';
  body: Statement[];
}

export interface DeferStatement {
  type: 'DeferStatement';
  body: Expression | BlockStatement;
}

export interface UsingStatement {
  type: 'UsingStatement';
  binding: string;
  init: Expression;
  body: BlockStatement;
}

// ============ Expressions ============
export type Expression =
  | Literal
  | Identifier
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | NewExpression
  | MemberExpression
  | ArrayExpression
  | ObjectExpression
  | ArrowFunctionExpression
  | AssignmentExpression
  | ConditionalExpression
  | LogicalExpression
  | TemplateStringExpression
  | TypeCastExpression
  | TypeCheckExpression
  | RangeExpression
  | AwaitExpression
  | GoExpression
  | ChannelExpression
  | SendExpression
  | ReceiveExpression
  | WhenExpression
  | TypeofExpression
  | InstanceofExpression
  | VoidExpression
  | DeleteExpression
  | ThisExpression
  | SuperExpression
  | YieldExpression;

export interface Literal {
  type: 'Literal';
  value: string | number | boolean | null;
  raw: string;
}

export interface Identifier {
  type: 'Identifier';
  name: string;
}

export interface BinaryExpression {
  type: 'BinaryExpression';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression {
  type: 'UnaryExpression';
  operator: string;
  argument: Expression;
  prefix: boolean;
}

export interface CallExpression {
  type: 'CallExpression';
  callee: Expression;
  arguments: Expression[];
}

export interface NewExpression {
  type: 'NewExpression';
  callee: Expression;
  typeArguments?: TypeAnnotation[];
  arguments: Expression[];
}

export interface MemberExpression {
  type: 'MemberExpression';
  object: Expression;
  property: Expression;
  computed: boolean;
  optional: boolean;
}

export interface ArrayExpression {
  type: 'ArrayExpression';
  elements: Expression[];
}

export interface ObjectExpression {
  type: 'ObjectExpression';
  properties: { key: Expression; value: Expression }[];
}

export interface ArrowFunctionExpression {
  type: 'ArrowFunctionExpression';
  params: Parameter[];
  body: Expression | BlockStatement;
}

export interface AssignmentExpression {
  type: 'AssignmentExpression';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface ConditionalExpression {
  type: 'ConditionalExpression';
  test: Expression;
  consequent: Expression;
  alternate: Expression;
}

export interface LogicalExpression {
  type: 'LogicalExpression';
  operator: '&&' | '||' | '??';
  left: Expression;
  right: Expression;
}

export interface TemplateStringExpression {
  type: 'TemplateStringExpression';
  parts: (string | Expression)[];
}

export interface TypeCastExpression {
  type: 'TypeCastExpression';
  expression: Expression;
  typeAnnotation: TypeAnnotation;
}

export interface TypeCheckExpression {
  type: 'TypeCheckExpression';
  expression: Expression;
  typeAnnotation: TypeAnnotation;
}

export interface RangeExpression {
  type: 'RangeExpression';
  start: Expression;
  end: Expression;
  inclusive: boolean;
}

export interface AwaitExpression {
  type: 'AwaitExpression';
  argument: Expression;
}

export interface GoExpression {
  type: 'GoExpression';
  argument: Expression;
}

export interface ChannelExpression {
  type: 'ChannelExpression';
  elementType?: TypeAnnotation;
  bufferSize?: Expression;
}

export interface SendExpression {
  type: 'SendExpression';
  channel: Expression;
  value: Expression;
}

export interface ReceiveExpression {
  type: 'ReceiveExpression';
  channel: Expression;
}

export interface WhenExpression {
  type: 'WhenExpression';
  discriminant?: Expression;
  cases: WhenCase[];
}

export interface TypeofExpression {
  type: 'TypeofExpression';
  argument: Expression;
}

export interface InstanceofExpression {
  type: 'InstanceofExpression';
  left: Expression;
  right: Expression;
}

export interface VoidExpression {
  type: 'VoidExpression';
  argument: Expression;
}

export interface DeleteExpression {
  type: 'DeleteExpression';
  argument: Expression;
}

export interface ThisExpression {
  type: 'ThisExpression';
}

export interface SuperExpression {
  type: 'SuperExpression';
}

export interface YieldExpression {
  type: 'YieldExpression';
  argument?: Expression;
  delegate: boolean;  // yield* vs yield
}

// ============ Type Annotations ============
export type TypeAnnotation =
  | SimpleType
  | ArrayType
  | MapType
  | ObjectType
  | TupleType
  | FunctionType
  | UnionType
  | IntersectionType
  | GenericType;

export interface SimpleType {
  kind: 'simple';
  name: string;
}

export interface ArrayType {
  kind: 'array';
  elementType: TypeAnnotation;
  size?: number;
}

export interface MapType {
  kind: 'map';
  keyType: TypeAnnotation;
  valueType: TypeAnnotation;
}

export interface ObjectType {
  kind: 'object';
  properties: ObjectTypeProperty[];
}

export interface ObjectTypeProperty {
  key: string;
  type: TypeAnnotation;
  optional: boolean;
}

export interface TupleType {
  kind: 'tuple';
  elementTypes: TypeAnnotation[];
}

export interface FunctionType {
  kind: 'function';
  paramTypes: TypeAnnotation[];
  returnType: TypeAnnotation;
}

export interface UnionType {
  kind: 'union';
  types: TypeAnnotation[];
}

export interface IntersectionType {
  kind: 'intersection';
  types: TypeAnnotation[];
}

export interface GenericType {
  kind: 'generic';
  name: string;
  typeArguments: TypeAnnotation[];
}
