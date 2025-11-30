# Ljos 编程语言规范 v1.0

# 编程


## 1. 语言概述


Ljos 是一门**静态类型与动态类型可选**的强类型编译型编程语言，缩写为 `lj`，代码文件扩展名为 `.lj`。其设计目标是融合主流编程语言的简洁性、类型安全性与执行效率，支持从脚本式开发到系统级编程的全场景应用。




## 2. 核心特性


- **类型系统**：默认动态强类型，支持通过类型注解实现静态类型检查（渐进式类型系统）
- **执行模型**：基于中间代码（IR）的 Ahead-of-Time（AOT）编译，支持即时编译（JIT）优化
- **内存管理**：默认自动垃圾回收（GC），可选手动内存管理（基于所有权系统）
- **并发模型**：轻量级协程（Coroutine）+ 通道（Channel）通信，避免共享状态竞争




## 3. 词法规范


### 3.1 关键字


| 类别         | 关键字列表                                                                 | 说明                                                                 |
|--------------|--------------------------------------------------------------------------|----------------------------------------------------------------------|
| 基础常量     | `nul`, `false`, `true`                                                  | `nul` 表示空值，`false`/`true` 为布尔常量                            |
| 绑定修饰符   | `mut`, `const`                                                          | `mut` 声明可变绑定，`const` 声明不可变绑定（编译期常量）              |
| 控制流       | `if`, `else`, `for`, `when`, `break`, `continue`, `return`, `throw`     | 流程控制关键字                                                       |
| 类型操作     | `is`, `of`                                                              | `is` 用于类型判断，`of` 用于类型转换（安全转换，失败返回 `nul`）     |




### 3.2 符号系统


| 类别         | 符号列表                                                                 | 优先级（从高到低） |
|--------------|--------------------------------------------------------------------------|--------------------|
| 分组符       | `( )`, `[ ]`, `{ }`                                                     | -                  |
| 成员访问     | `.`, `?.`（安全访问）, `..`（范围运算符）, `?..`（安全范围访问）         | 1                  |
| 比较运算符   | `<`, `>`, `<=`, `>=`, `==`, `!=`                                        | 2                  |
| 算术运算符   | `+`, `-`, `*`, `/`, `%`                                                 | 3                  |
| 赋值运算符   | `=`, `+=`, `-=`, `*=`, `/=`, `%=`                                       | 4                  |
| 逻辑运算符   | `!`（非）, `&`（与）, `|`（或）                                         | 5                  |
| 分隔符       | `,`（逻辑与）, `;`（逻辑或）, `:`（标签/类型分隔）, `<>`（异或）, `=>`（箭头） | 6                  |


> 说明：`&`/`|` 同时支持位运算与逻辑运算（根据上下文推断）；`,` 表示“条件叠加”（同逻辑与），`;` 表示“条件并列”（同逻辑或），如 `if(a > 0, b < 10)` 等价于 `if(a > 0 && b < 10)`。




### 3.3 字面量


#### 3.3.1 字符串字面量
- **编码标准**：采用 UTF-32 编码（每个字符对应 32 位无符号整数，支持全部 Unicode 码点）
- **普通字符串**：由 `""` 包裹，支持转义序列：
  - 控制字符：`\n`（换行）、`\r`（回车）、`\t`（制表符）、`\\`（反斜杠）、`\"`（双引号）
  - 编码表示：`\xHH`（8 位十六进制）、`\uHHHH`（16 位 Unicode）、`\UHHHHHHHH`（32 位 Unicode）
- **原始字符串**：由 `` ` `` 包裹，禁用转义，保留原始格式（含换行），如 `` `C:\Users\file.txt` ``
- **字符串插值**：支持 `${表达式}` 嵌入，如 `"Hello, ${name}!"`（编译期解析为字符串拼接）




#### 3.3.2 数字字面量
- **整数**：
  - 十进制：`[0-9]([0-9_]*[0-9])?`（支持下划线分隔，如 `1_000_000`）
  - 二进制：`0[Bb][01]([01_]*[01])?`（如 `0b1010_1100`）
  - 八进制：`0[Oo][0-7]([0-7_]*[0-7])?`（如 `0o755`）
  - 十六进制：`0[Xx][0-9A-Fa-f]([0-9A-Fa-f_]*[0-9A-Fa-f])?`（如 `0xDEAD_BEEF`）
  > 约束：必须以合法进制数字开头和结尾，下划线仅用于分隔（不可连续）
- **浮点数**：
  - 小数形式：`十进制整数\.十进制整数`（如 `3.14`、`100.0`）
  - 指数形式：`十进制整数\.十进制整数[Ee][+-]?十进制整数`（如 `6.02e23`、`1.0e-9`）
  > 约束：不支持 `.1` 或 `1.` 形式，强制显式整数部分与小数部分




#### 3.3.3 复合字面量
- **数组**：`[元素1, 元素2; 元素3]`（`,` 分隔元素，`;` 表示换行分组，如 `[1, 2; 3, 4]` 等价于 `[1,2,3,4]`）
- **映射**：`{键1 => 值1, 键2 => 值2}`（如 `{name => "Ljos", version => 1.0}`）




### 3.4 注释
- **单行注释**：`# 注释内容`（从 `#` 到行尾）
- **多行注释**：`/* 注释内容 */`（支持嵌套，如 `/* outer /* inner */ */`）
- **类型注释**：`'' 类型说明 ''`（无转义，支持换行，仅用于静态检查器，不影响运行时，如 `mut x = 10 '' number ''`）




## 4. 类型系统


### 4.1 基础类型
- `nul`：空类型（仅 `nul` 一个值）
- `bool`：布尔类型（`false`/`true`）
- `int`：变长整数（根据平台自动适配 32/64 位）
- `float`：64 位双精度浮点数
- `str`：字符串类型（UTF-32 编码）
- `bytes`：字节序列（二进制数据）




### 4.2 复合类型
- **数组**：`[T; N]`（固定长度，如 `[int; 5]` 表示 5 个 int 的数组）、`[T]`（动态长度切片）
- **映射**：`{K: V}`（键值对集合，如 `{str: int}` 表示字符串到整数的映射）
- **元组**：`(T1, T2, ..., Tn)`（异构元素集合，如 `(str, int)` 表示字符串和整数的元组）
- **函数**：`(T1, T2) : R`（参数类型为 `T1`、`T2`，返回类型为 `R` 的函数）




### 4.3 高级类型特性
- **泛型**：`fn identity<T>(x: T) : T { return x }`（类型参数化，支持约束 `where T: Clone`）
- **联合类型**：`T1 | T2`（值可为 `T1` 或 `T2`，如 `int | str` 表示整数或字符串）
- **交叉类型**：`T1 & T2`（同时满足 `T1` 和 `T2` 的特性，如 `A & B` 表示同时实现 A 和 B 接口）
- **类型别名**：`type IntList = [int]`（为复杂类型定义别名）




## 5. 语法规范


### 5.1 绑定声明
- **不可变绑定**：`const 标识符[: 类型] = 表达式`（如 `const answer: int = 42`，类型可省略，由编译器推断）
- **可变绑定**：`mut 标识符[: 类型] = 表达式`（如 `mut count = 0`）
- **类型断言**：`const x = y of int`（若 `y` 可转换为 `int` 则赋值，否则为 `nul`）




### 5.2 控制流语句


#### 5.2.1 条件语句
```lj
if (条件1, 条件2; 条件3) {  // 等价于 (条件1 && 条件2) || 条件3
  // 分支1
} else (条件4) {  // 等价于 else if (条件4)
  // 分支2
} else {
  // 分支3
}
```
> 特性：if 语句为表达式，可返回值，如 `const result = if (a > b) a else b`




#### 5.2.2 循环语句
- **无限循环**：`for { ... }`（等价于 `while true`）
- **条件循环**：`for (条件) { ... }`（等价于 `while (条件)`）
- **传统循环**：`for (初始化; 条件; 更新) { ... }`（如 `for (mut i=0; i<10; i++) { ... }`）
- **迭代循环**：`for (元素 in 可迭代对象) { ... }`（如 `for (num in [1,2,3]) { ... }`）


> 特性：循环可返回值，通过 `break 表达式` 传递，如 `const sum = for (mut i=0, s=0; i<=10; i++) { s += i; if (i==10) break s }`




#### 5.2.3 模式匹配（when 语句）
```lj
when (value) {  // 可选匹配值，省略则匹配布尔表达式
  1 | 2 => println("1 or 2")  // 多值匹配
  n is int where n > 10 => println("Large int")  // 类型+守卫条件
  [x, y] => println("Pair: ${x}, ${y}")  // 数组解构
  { name: n } => println("Name: ${n}")  // 映射解构
  else => println("Other")  // 默认分支
}
```




### 5.3 模块化
- **导入**：`import 标识符 : "路径|包名"`（支持命名导入 `import { a, b } : "mod"`、默认导入 `import mod : "mod"`、命名空间导入 `import * as ns : "mod"`）
- **导出**：`export 声明`（如 `export const x = 10`）、`export default 表达式`（默认导出）
- **重导出**：`export * : "mod"`（转发导出其他模块内容）


> 模块解析规则：优先解析相对路径（`./mod.lj`），其次查找包管理器（`node_modules` 风格）




### 5.4 函数与闭包
- **函数定义**：
  ```lj
  fn add(a: int, b: int) : int {
    return a + b
  }
  ```
- **匿名函数**：`(x, y) => x + y`（单表达式可省略 `{}`）
- **闭包**：自动捕获环境变量，如 `mut count = 0; const inc = () => { count += 1; return count }`
- **特性**：支持默认参数（`fn greet(name: str = "Guest") { ... }`）、命名参数调用（`greet(name: "Alice")`）




## 6. 进阶特性


### 6.1 错误处理
- **异常抛出**：`throw 表达式`（抛出任意类型值作为错误）
- **异常捕获**：
  ```lj
  try {
    riskyOperation()
  } catch (e: IOError) {  // 类型匹配捕获
    println("IO error: ${e}")
  } catch {  // 捕获所有错误
    println("Unknown error")
  }
  ```
- **Result 类型**：`Result<T, E>`（避免异常开销，如 `fn read() : Result<str, IOError>`），配合 `?` 简化传播：`const data = read()?`（等价于 `if data is Err then throw data`）




### 6.2 并发编程
- **协程创建**：`go 函数调用`（如 `go task()`，创建轻量级线程）
- **通道通信**：`const ch = chan int(10)`（带缓冲通道），`ch <- 42`（发送）、`const x = <-ch`（接收）
- **同步原语**：`mutex`（互斥锁）、`waitgroup`（等待组）等，如：
  ```lj
  const m = mutex()
  go {
    m.lock()
    defer m.unlock()  // 延迟解锁（函数退出时执行）
    // 临界区操作
  }
  ```




### 6.3 内存管理
- **自动 GC**：默认启用标记-清除 GC，支持分代回收优化
- **所有权模式**（可选）：
  - `move` 关键字：转移所有权（`const b = move a`，`a` 此后不可用）
  - `borrow` 关键字：临时借用（`const b = borrow a`，`a` 仍可访问，`b` 生命周期受限于 `a`）
- **资源释放**：`using` 语句自动释放资源（实现 `Disposable` 接口）：`using (f = File.open("a.txt")) { f.write("hi") }`（文件自动关闭）




### 6.4 元编程
- **宏定义**：`macro 宏名(参数) { ... }`（编译期代码生成，如 `macro log(expr) { println("${expr}: ${expr}") }`）
- **反射**：`typeof(x)`（获取类型信息）、`x.respondsTo("method")`（检查方法是否存在）




## 7. 标准库

Ljos 采用**极简核心 + 标准库**的设计理念，语言本身不内置任何类型或函数，所有功能都通过标准库提供。

### 7.1 标准库模块

| 模块路径 | 说明 | 主要导出 |
|---------|------|---------|
| `/std/core` | 核心类型和基础操作 | `Int`, `Float`, `Bool`, `Str`, `Nul`, `Option`, `Result`, `Error` |
| `/std/io` | 输入输出 | `println`, `print`, `readln`, `dbg` |
| `/std/string` | 字符串操作 | `len`, `split`, `join`, `trim`, `replace`, `StringBuilder` |
| `/std/math` | 数学函数 | `PI`, `sin`, `cos`, `sqrt`, `pow`, `random` |
| `/std/collections` | 集合类型 | `Vec`, `Map`, `Set`, `Stack`, `Queue` |
| `/std/concurrency` | 并发编程 | `Channel`, `WaitGroup`, `Mutex`, `spawn`, `sleep` |
| `/std/fs` | 文件系统 | `readFile`, `writeFile`, `exists`, `File` |

### 7.2 导入方式

```lj
# 命名导入
import { println, print } : "/std/io"
import { Int, Str, Option } : "/std/core"

# 命名空间导入
import * as math : "/std/math"

# 默认导入（如果模块有默认导出）
import Server : "/std/http"
```

### 7.3 Prelude 模式

编译器支持三种 prelude 模式，通过 `-p` 或 `--prelude` 选项指定：

| 模式 | 说明 |
|------|------|
| `none` | 默认模式，不自动导入任何内容，所有类型和函数必须显式导入 |
| `core` | 自动导入核心类型：`Int`, `Float`, `Bool`, `Str`, `Nul`, `Option`, `Result` 等 |
| `full` | 自动导入核心类型 + IO 函数：`println`, `print`, `readln`, `dbg` |

```bash
# 纯净模式（推荐用于库开发）
ljc main.lj --no-prelude

# 核心类型模式
ljc main.lj -p core

# 完整模式（适合快速原型开发）
ljc main.lj -p full
```

### 7.4 示例：使用标准库

```lj
# 纯净模式 - 显式导入所有依赖
import { println } : "/std/io"
import { Int, Str } : "/std/core"
import { Vec } : "/std/collections"

fn main() {
  const numbers = new Vec<Int>()
  numbers.push(1)
  numbers.push(2)
  numbers.push(3)
  
  println("Numbers: ${numbers.toArray()}")
}

main()
```


## 8. 工具链
- **编译器**：`ljc`（Ljos 编译器）
- **包管理器**：`lpm`（Ljos Package Manager，支持依赖管理、发布包）
- **开发工具**：LSP 支持（类型提示、自动补全）、调试器（`lldb` 集成）




## 9. 示例：HTTP 服务器（融合主流语言优点）
```lj
import { Server, Request, Response } : "/std/http"
import { go, chan } : "/std/concurrency"


fn handle(req: Request) : Response {
  when (req.path) {
    "/" => Response.ok("Hello, Ljos!")
    "/user/{name}" => Response.ok(`Hello, ${req.params.name}!`)  // 路径参数
    else => Response.notFound()
  }
}


fn main() {
  const server = Server.new(":8080")
  const stop = chan bool(1)


  go {  // 协程处理停止信号
    <-stop
    server.close()
  }


  println("Server running on http://localhost:8080")
  server.listen(handle)  // 非阻塞监听（内部使用协程池）
}
```



# 编译器

对于一个ljos项目，编译器通过检查项目根目录的`.ljconfig.json`或者`.ljconfig.lj`来读取配置(参考tsconfig) (lj实现配置的方法是提供一个defineConfig函数) (lj的优先级大于json)