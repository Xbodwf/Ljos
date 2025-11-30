// Ljos Error Codes - JetBrains style error messages
// Format: lj(XXXX) where XXXX is a 4-digit error code

export enum ErrorCode {
  // Lexer errors (01xx)
  UNEXPECTED_CHARACTER = '0101',
  UNTERMINATED_STRING = '0102',
  UNTERMINATED_RAW_STRING = '0103',
  INVALID_ESCAPE_SEQUENCE = '0104',
  UNTERMINATED_BLOCK_COMMENT = '0105',

  // Parser errors - General (02xx)
  UNEXPECTED_TOKEN = '0201',
  EXPECTED_EXPRESSION = '0202',
  EXPECTED_STATEMENT = '0203',
  EXPECTED_IDENTIFIER = '0204',
  EXPECTED_TYPE_ANNOTATION = '0205',

  // Parser errors - Declarations (03xx)
  EXPECTED_CLASS_NAME = '0301',
  EXPECTED_FUNCTION_NAME = '0302',
  EXPECTED_VARIABLE_NAME = '0303',
  EXPECTED_ENUM_NAME = '0304',
  EXPECTED_TYPE_NAME = '0305',
  EXPECTED_PARAMETER_NAME = '0306',
  EXPECTED_PROPERTY_NAME = '0307',
  EXPECTED_INITIALIZER_OR_TYPE = '0308',
  UNEXPECTED_TOKEN_IN_CLASS = '0309',
  EXPECTED_SUPERCLASS_NAME = '0310',
  EXPECTED_INTERFACE_NAME = '0311',
  UNEXPECTED_TOKEN_IN_CLASS_BODY = '0312',
  EXPECTED_DECORATOR_NAME = '0313',

  // Parser errors - Punctuation (04xx)
  EXPECTED_LPAREN = '0401',
  EXPECTED_RPAREN = '0402',
  EXPECTED_LBRACE = '0403',
  EXPECTED_RBRACE = '0404',
  EXPECTED_LBRACKET = '0405',
  EXPECTED_RBRACKET = '0406',
  EXPECTED_COLON = '0407',
  EXPECTED_SEMICOLON = '0408',
  EXPECTED_ARROW = '0409',
  EXPECTED_ASSIGN = '0410',
  EXPECTED_GT = '0411',
  EXPECTED_COMMA = '0412',

  // Parser errors - Keywords (05xx)
  EXPECTED_ELSE = '0501',
  EXPECTED_IN = '0502',
  EXPECTED_AS = '0503',
  EXPECTED_WHILE = '0504',
  EXPECTED_CASE_OR_DEFAULT = '0505',

  // Type errors (10xx)
  CANNOT_RESOLVE_SYMBOL = '1001',
  TYPE_MISMATCH = '1002',
  CANNOT_ASSIGN_TO_CONST = '1003',
  PROPERTY_NOT_EXIST = '1004',
  METHOD_NOT_EXIST = '1005',
  NOT_CALLABLE = '1006',
  ARGUMENT_COUNT_MISMATCH = '1007',
  CANNOT_INSTANTIATE_ABSTRACT = '1008',
  MISSING_RETURN_TYPE = '1009',
  INCOMPATIBLE_TYPES = '1010',
  DUPLICATE_DECLARATION = '1011',

  // Module errors (11xx)
  MODULE_NOT_FOUND = '1101',
  EXPORT_NOT_FOUND = '1102',
  CIRCULAR_DEPENDENCY = '1103',
  INVALID_IMPORT_PATH = '1104',
  DEFAULT_EXPORT_NOT_FOUND = '1105',
}

export interface LjosError {
  code: ErrorCode;
  message: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  severity: 'error' | 'warning' | 'info';
  file?: string;
}

// JetBrains-style error message formatters
export function formatError(code: ErrorCode, ...args: string[]): string {
  const templates: Record<ErrorCode, string> = {
    // Lexer
    [ErrorCode.UNEXPECTED_CHARACTER]: `意外的字符: '{0}'`,
    [ErrorCode.UNTERMINATED_STRING]: `未终止的字符串`,
    [ErrorCode.UNTERMINATED_RAW_STRING]: `未终止的原始字符串`,
    [ErrorCode.INVALID_ESCAPE_SEQUENCE]: `无效的转义序列: '\\{0}'`,
    [ErrorCode.UNTERMINATED_BLOCK_COMMENT]: `未终止的块注释`,

    // Parser - General
    [ErrorCode.UNEXPECTED_TOKEN]: `意外的标记: '{0}'`,
    [ErrorCode.EXPECTED_EXPRESSION]: `需要表达式`,
    [ErrorCode.EXPECTED_STATEMENT]: `需要语句`,
    [ErrorCode.EXPECTED_IDENTIFIER]: `需要标识符`,
    [ErrorCode.EXPECTED_TYPE_ANNOTATION]: `需要类型注解`,

    // Parser - Declarations
    [ErrorCode.EXPECTED_CLASS_NAME]: `需要类名`,
    [ErrorCode.EXPECTED_FUNCTION_NAME]: `需要函数名`,
    [ErrorCode.EXPECTED_VARIABLE_NAME]: `需要变量名`,
    [ErrorCode.EXPECTED_ENUM_NAME]: `需要枚举名`,
    [ErrorCode.EXPECTED_TYPE_NAME]: `需要类型名`,
    [ErrorCode.EXPECTED_PARAMETER_NAME]: `需要参数名`,
    [ErrorCode.EXPECTED_PROPERTY_NAME]: `需要属性名`,
    [ErrorCode.EXPECTED_INITIALIZER_OR_TYPE]: `需要初始化器或类型注解`,
    [ErrorCode.UNEXPECTED_TOKEN_IN_CLASS]: `类声明中出现意外的标记`,
    [ErrorCode.EXPECTED_SUPERCLASS_NAME]: `需要父类名`,
    [ErrorCode.EXPECTED_INTERFACE_NAME]: `需要接口名`,
    [ErrorCode.UNEXPECTED_TOKEN_IN_CLASS_BODY]: `类体中出现意外的标记`,
    [ErrorCode.EXPECTED_DECORATOR_NAME]: `需要装饰器名`,

    // Parser - Punctuation
    [ErrorCode.EXPECTED_LPAREN]: `需要 '('`,
    [ErrorCode.EXPECTED_RPAREN]: `需要 ')'`,
    [ErrorCode.EXPECTED_LBRACE]: `需要 '{'`,
    [ErrorCode.EXPECTED_RBRACE]: `需要 '}'`,
    [ErrorCode.EXPECTED_LBRACKET]: `需要 '['`,
    [ErrorCode.EXPECTED_RBRACKET]: `需要 ']'`,
    [ErrorCode.EXPECTED_COLON]: `需要 ':'`,
    [ErrorCode.EXPECTED_SEMICOLON]: `需要 ';'`,
    [ErrorCode.EXPECTED_ARROW]: `需要 '=>'`,
    [ErrorCode.EXPECTED_ASSIGN]: `需要 '='`,
    [ErrorCode.EXPECTED_GT]: `需要 '>'`,
    [ErrorCode.EXPECTED_COMMA]: `需要 ','`,

    // Parser - Keywords
    [ErrorCode.EXPECTED_ELSE]: `需要 'else'`,
    [ErrorCode.EXPECTED_IN]: `需要 'in'`,
    [ErrorCode.EXPECTED_AS]: `需要 'as'`,
    [ErrorCode.EXPECTED_WHILE]: `需要 'while'`,
    [ErrorCode.EXPECTED_CASE_OR_DEFAULT]: `需要 'case' 或 'default'`,

    // Type errors
    [ErrorCode.CANNOT_RESOLVE_SYMBOL]: `无法解析符号 '{0}'`,
    [ErrorCode.TYPE_MISMATCH]: `类型不匹配: 需要 '{0}', 实际为 '{1}'`,
    [ErrorCode.CANNOT_ASSIGN_TO_CONST]: `无法对常量 '{0}' 赋值`,
    [ErrorCode.PROPERTY_NOT_EXIST]: `属性 '{0}' 在类型 '{1}' 上不存在`,
    [ErrorCode.METHOD_NOT_EXIST]: `方法 '{0}' 在类型 '{1}' 上不存在`,
    [ErrorCode.NOT_CALLABLE]: `类型 '{0}' 不可调用`,
    [ErrorCode.ARGUMENT_COUNT_MISMATCH]: `参数数量不匹配: 需要 {0} 个, 实际为 {1} 个`,
    [ErrorCode.CANNOT_INSTANTIATE_ABSTRACT]: `无法实例化抽象类 '{0}'`,
    [ErrorCode.MISSING_RETURN_TYPE]: `缺少返回类型`,
    [ErrorCode.INCOMPATIBLE_TYPES]: `类型 '{0}' 与 '{1}' 不兼容`,
    [ErrorCode.DUPLICATE_DECLARATION]: `重复的声明 '{0}'`,

    // Module errors
    [ErrorCode.MODULE_NOT_FOUND]: `找不到模块 '{0}'`,
    [ErrorCode.EXPORT_NOT_FOUND]: `模块 '{0}' 中不存在导出 '{1}'`,
    [ErrorCode.CIRCULAR_DEPENDENCY]: `检测到循环依赖: {0}`,
    [ErrorCode.INVALID_IMPORT_PATH]: `无效的导入路径: '{0}'`,
    [ErrorCode.DEFAULT_EXPORT_NOT_FOUND]: `模块 '{0}' 没有默认导出`,
  };

  let message = templates[code] || `未知错误`;
  args.forEach((arg, i) => {
    message = message.replace(`{${i}}`, arg);
  });
  return message;
}

export function createError(
  code: ErrorCode,
  line: number,
  column: number,
  endLine: number,
  endColumn: number,
  severity: 'error' | 'warning' | 'info' = 'error',
  ...args: string[]
): LjosError {
  return {
    code,
    message: formatError(code, ...args),
    line,
    column,
    endLine,
    endColumn,
    severity,
  };
}
