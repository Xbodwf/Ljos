// Ljos LSP Internationalization (i18n) Support

import * as vscode from 'vscode';

// Supported languages
export type SupportedLocale = 'en' | 'zh-CN' | 'zh-TW' | 'ja' | 'ko';

// Message keys
export interface Messages {
  // Keywords
  keywords: {
    const: { detail: string; documentation: string };
    mut: { detail: string; documentation: string };
    fn: { detail: string; documentation: string };
    class: { detail: string; documentation: string };
    abstract: { detail: string; documentation: string };
    enum: { detail: string; documentation: string };
    type: { detail: string; documentation: string };
    interface: { detail: string; documentation: string };
    if: { detail: string; documentation: string };
    else: { detail: string; documentation: string };
    for: { detail: string; documentation: string };
    while: { detail: string; documentation: string };
    do: { detail: string; documentation: string };
    when: { detail: string; documentation: string };
    break: { detail: string; documentation: string };
    continue: { detail: string; documentation: string };
    return: { detail: string; documentation: string };
    try: { detail: string; documentation: string };
    catch: { detail: string; documentation: string };
    finally: { detail: string; documentation: string };
    throw: { detail: string; documentation: string };
    extends: { detail: string; documentation: string };
    implements: { detail: string; documentation: string };
    static: { detail: string; documentation: string };
    constructor: { detail: string; documentation: string };
    this: { detail: string; documentation: string };
    super: { detail: string; documentation: string };
    new: { detail: string; documentation: string };
    public: { detail: string; documentation: string };
    private: { detail: string; documentation: string };
    protected: { detail: string; documentation: string };
    readonly: { detail: string; documentation: string };
    import: { detail: string; documentation: string };
    export: { detail: string; documentation: string };
    default: { detail: string; documentation: string };
    as: { detail: string; documentation: string };
    typeof: { detail: string; documentation: string };
    instanceof: { detail: string; documentation: string };
    is: { detail: string; documentation: string };
    of: { detail: string; documentation: string };
    async: { detail: string; documentation: string };
    await: { detail: string; documentation: string };
    go: { detail: string; documentation: string };
    chan: { detail: string; documentation: string };
    yield: { detail: string; documentation: string };
    defer: { detail: string; documentation: string };
    using: { detail: string; documentation: string };
    move: { detail: string; documentation: string };
    borrow: { detail: string; documentation: string };
    macro: { detail: string; documentation: string };
    where: { detail: string; documentation: string };
    in: { detail: string; documentation: string };
    void: { detail: string; documentation: string };
    delete: { detail: string; documentation: string };
    true: { detail: string; documentation: string };
    false: { detail: string; documentation: string };
    nul: { detail: string; documentation: string };
    null: { detail: string; documentation: string };
  };
  
  // Types
  types: {
    Int: { detail: string; documentation: string };
    Float: { detail: string; documentation: string };
    Str: { detail: string; documentation: string };
    Bool: { detail: string; documentation: string };
    Num: { detail: string; documentation: string };
    Byte: { detail: string; documentation: string };
    Char: { detail: string; documentation: string };
    Void: { detail: string; documentation: string };
    Nul: { detail: string; documentation: string };
    Any: { detail: string; documentation: string };
    int8: { detail: string; documentation: string };
    int16: { detail: string; documentation: string };
    int32: { detail: string; documentation: string };
    int64: { detail: string; documentation: string };
    uint8: { detail: string; documentation: string };
    uint16: { detail: string; documentation: string };
    uint32: { detail: string; documentation: string };
    uint64: { detail: string; documentation: string };
  };
  
  // Errors
  errors: {
    unexpectedCharacter: string;
    unterminatedString: string;
    unterminatedRawString: string;
    invalidEscapeSequence: string;
    unterminatedBlockComment: string;
    unexpectedToken: string;
    expectedExpression: string;
    expectedStatement: string;
    expectedIdentifier: string;
    expectedTypeAnnotation: string;
    expectedClassName: string;
    expectedFunctionName: string;
    expectedVariableName: string;
    expectedEnumName: string;
    expectedTypeName: string;
    expectedParameterName: string;
    expectedPropertyName: string;
    expectedInitializerOrType: string;
    unexpectedTokenInClass: string;
    expectedSuperclassName: string;
    expectedInterfaceName: string;
    unexpectedTokenInClassBody: string;
    expectedDecoratorName: string;
    expectedLparen: string;
    expectedRparen: string;
    expectedLbrace: string;
    expectedRbrace: string;
    expectedLbracket: string;
    expectedRbracket: string;
    expectedColon: string;
    expectedSemicolon: string;
    expectedArrow: string;
    expectedAssign: string;
    expectedGt: string;
    expectedComma: string;
    expectedElse: string;
    expectedIn: string;
    expectedAs: string;
    expectedWhile: string;
    expectedCaseOrDefault: string;
    cannotResolveSymbol: string;
    typeMismatch: string;
    cannotAssignToConst: string;
    propertyNotExist: string;
    methodNotExist: string;
    notCallable: string;
    argumentCountMismatch: string;
    cannotInstantiateAbstract: string;
    missingReturnType: string;
    incompatibleTypes: string;
    duplicateDeclaration: string;
    moduleNotFound: string;
    exportNotFound: string;
    circularDependency: string;
    invalidImportPath: string;
    defaultExportNotFound: string;
  };
  
  // Config schema
  config: {
    compilerOptions: { detail: string; documentation: string };
    outDir: { detail: string; documentation: string };
    rootDir: { detail: string; documentation: string };
    prelude: { detail: string; documentation: string };
    codegenTarget: { detail: string; documentation: string };
    strict: { detail: string; documentation: string };
    sourceMap: { detail: string; documentation: string };
    declaration: { detail: string; documentation: string };
    noImplicitAny: { detail: string; documentation: string };
    buildOptions: { detail: string; documentation: string };
    target: { detail: string; documentation: string };
    executableName: { detail: string; documentation: string };
    llvmOptions: { detail: string; documentation: string };
    gccOptions: { detail: string; documentation: string };
    optLevel: { detail: string; documentation: string };
    keepIntermediates: { detail: string; documentation: string };
    targetTriple: { detail: string; documentation: string };
    include: { detail: string; documentation: string };
    exclude: { detail: string; documentation: string };
    extends: { detail: string; documentation: string };
  };
  
  // Misc
  misc: {
    abstractClass: string;
    class: string;
    function: string;
    typeAlias: string;
    enum: string;
    importedFrom: string;
    namespaceImportedFrom: string;
    defaultImportedFrom: string;
  };
}

// Current locale
let currentLocale: SupportedLocale = 'en';
let messages: Messages;

// Detect locale from VS Code
export function detectLocale(): SupportedLocale {
  const vscodeLocale = vscode.env.language;
  
  if (vscodeLocale.startsWith('zh-CN') || vscodeLocale === 'zh') {
    return 'zh-CN';
  } else if (vscodeLocale.startsWith('zh-TW') || vscodeLocale.startsWith('zh-Hant')) {
    return 'zh-TW';
  } else if (vscodeLocale.startsWith('ja')) {
    return 'ja';
  } else if (vscodeLocale.startsWith('ko')) {
    return 'ko';
  }
  
  return 'en';
}

// Load messages for a locale
export function loadMessages(locale: SupportedLocale): Messages {
  switch (locale) {
    case 'zh-CN':
      return require('./locales/zh-CN').default;
    case 'zh-TW':
      return require('./locales/zh-TW').default;
    case 'ja':
      return require('./locales/ja').default;
    case 'ko':
      return require('./locales/ko').default;
    default:
      return require('./locales/en').default;
  }
}

// Initialize i18n
export function initI18n(): void {
  currentLocale = detectLocale();
  messages = loadMessages(currentLocale);
}

// Get current locale
export function getLocale(): SupportedLocale {
  return currentLocale;
}

// Set locale manually
export function setLocale(locale: SupportedLocale): void {
  currentLocale = locale;
  messages = loadMessages(locale);
}

// Get messages
export function getMessages(): Messages {
  if (!messages) {
    initI18n();
  }
  return messages;
}

// Helper function to get a specific message
export function t(key: string): string {
  const msgs = getMessages();
  const keys = key.split('.');
  let result: any = msgs;
  
  for (const k of keys) {
    if (result && typeof result === 'object' && k in result) {
      result = result[k];
    } else {
      return key; // Return key if not found
    }
  }
  
  return typeof result === 'string' ? result : key;
}

// Format message with placeholders
export function tf(key: string, ...args: string[]): string {
  let message = t(key);
  args.forEach((arg, i) => {
    message = message.replace(`{${i}}`, arg);
  });
  return message;
}
