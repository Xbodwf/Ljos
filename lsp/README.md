# Ljos Language Support for VS Code

为 Ljos 编程语言提供完整的 VS Code 语言支持。

## 功能

- **语法高亮**：支持 Ljos 语言的完整语法高亮
- **静态类型检查**：实时检测类型错误
- **悬浮提示**：鼠标悬停显示变量/函数类型信息
- **模块解析**：检查导入模块和导出成员是否存在
- **JetBrains风格错误**：清晰的中文错误消息，带错误代码 `lj(XXXX)`
- **括号匹配**：自动匹配 `{}`, `[]`, `()`
- **注释支持**：单行注释 `#`，多行注释 `/* */`，类型注释 `'' ''`
- **字符串插值**：高亮 `${expression}` 模板字符串

## 错误代码

| 代码 | 描述 |
|------|------|
| `lj(0101)` | 意外的字符 |
| `lj(0201)` | 意外的标记 |
| `lj(0312)` | 类体中出现意外的标记 |
| `lj(1001)` | 无法解析符号 |
| `lj(1004)` | 属性不存在 |
| `lj(1008)` | 无法实例化抽象类 |
| `lj(1101)` | 找不到模块 |
| `lj(1102)` | 导出不存在 |

## 安装

### 方法 1: 直接复制到扩展目录

1. 找到 VS Code 扩展目录：
   - Windows: `%USERPROFILE%\.vscode\extensions`
   - macOS: `~/.vscode/extensions`
   - Linux: `~/.vscode/extensions`

2. 将整个 `lsp` 文件夹复制到扩展目录，并重命名为 `ljos-language`

3. 重启 VS Code

### 方法 2: 使用 VSIX 打包

```bash
# 安装 vsce
npm install -g @vscode/vsce

# 打包扩展
cd lsp
vsce package

# 安装生成的 .vsix 文件
code --install-extension ljos-language-1.0.0.vsix
```

## 支持的语法

### 关键字

- **常量**: `nul`, `true`, `false`
- **修饰符**: `mut`, `const`
- **控制流**: `if`, `else`, `for`, `when`, `break`, `continue`, `return`, `throw`, `try`, `catch`
- **类型操作**: `is`, `of`, `in`, `as`
- **其他**: `fn`, `type`, `where`, `go`, `defer`, `move`, `borrow`, `using`, `macro`
- **模块**: `import`, `export`, `default`

### 类型

- **基础类型**: `int`, `float`, `str`, `bool`, `bytes`, `nul`
- **自定义类型**: 以大写字母开头的标识符

### 数字字面量

- 十进制: `123`, `1_000_000`
- 二进制: `0b1010`, `0B1010_1100`
- 八进制: `0o755`, `0O644`
- 十六进制: `0xDEAD`, `0XBEEF_CAFE`
- 浮点数: `3.14`, `6.02e23`, `1.0e-9`

### 字符串

- 普通字符串: `"Hello, World!"`
- 原始字符串: `` `C:\path\to\file` ``
- 字符串插值: `"Hello, ${name}!"`

### 注释

```lj
# 单行注释

/* 多行注释
   可以嵌套 /* 内层注释 */ 
*/

'' 类型注释 ''
```

## 示例代码

```lj
# Ljos 示例程序
import { println } : "/std/io"

fn factorial(n: int) : int {
  if (n <= 1) {
    return 1
  }
  return n * factorial(n - 1)
}

fn main() {
  const numbers = [1, 2, 3, 4, 5]
  
  for (num in numbers) {
    const result = factorial(num)
    println("factorial(${num}) = ${result}")
  }
}

main()
```

## 文件关联

扩展自动关联 `.lj` 文件扩展名。

## License

MIT
