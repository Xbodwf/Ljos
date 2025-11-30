# Nyalang

> Nyalang is Your Adorable LANGuage
>
> 一门动态强类型编程语言。
>
> "Consistent."

## Token

### 关键字列表

```
_ false true
val mut out
if else for when
break return throw
is of
continue 

!is !of !when
val* mut* out*
```

### 符号列表

```
( ) [ ] { }
. ?. .. ?..
< > <= >= == !=
+ += - -= * *= / /= % %= = !
, ; : & | <> =>
```

### 字符串字面量（每个字符为 32 位无符号整数）

* 普通字符串：包裹在 `""` 里的字符串，可以包含换行，可以转义，转义符列表：
    * `\n`
    * `\r`
    * `\t`
    * `\\`
    * `\"`
    * `\xHH`
    * `\uHHHH`
    * `\UHHHHHHHH`
* 原始字符串：包裹在 `` ` ` `` 中的原始字符串，不能转义，可以包含换行

### 注释

* 文本注释：以 `#` 开始到行末
* 类型注释：包裹在 `''` 里的原始字符串（不支持转义，但可以换行），可以插入在任意位置，无论写什么都不影响程序运行，只会由静态检查器进行类型检查

### 数字字面量

* 整数
    * 十进制：`[0-9]([0-9_]*[0-9])?`
    * 二进制：`0[Bb][01]([01_]*[01])?`
    * 八进制：`0[Oo][0-7]([0-7_]*[0-7])?`
    * 十六进制：`0[Xx][0-9A-Fa-f]([0-9A-Fa-f_]*[0-9A-Fa-f])?`
  > 数字必须以合法的进制数字开头，以合法的进制数字结尾
* 浮点数
    * 小数形式：`十进制整数\.十进制整数`
    * 指数形式：`十进制整数\.十进制整数[Ee][+\-]?十进制整数`
  > 也就是不支持 `.1` `1.` 这种写法，也不支持 `1e9`，需要写成 `1.0e9`

### 标识符 `Identifier`

要求：满足 `[A-Za-z_][A-Za-z0-9_]*` 且不为关键字

## 表达式

表达式分为普通表达式 `NormalExpr` 和可包含控制流的表达式 `AllExpr`。

普通表达式分为运算表达式 `CalcExpr`（运算表达式包含字面量）、比较链条件表达式和匹配表达式。

可包含控制流的表达式可以写普通表达式能写的所有内容，或是一个控制流表达式。

还有一种表达式叫可赋值表达式 `AssignExpr`，定义为不算括号内的内容，最后一次运算为 `.`、`?.`、`..`、`?..`、`[]`、`.[]`、`?.[]`
之一的运算表达式。

### 字面量

> 此处未说明的结构例如 `Block`, `Params` 将在后续内容说明。

* `_` 也就是其他语言中的 `null`
* `false`
* `true`
* 数字字面量
* 字符串插值：由任意数量的字符串字面量或 `{ Block }` 相邻构成，且至少包含一个字符串字面量
  > 如果把字符串字面量用 `A` 表示，` { Block } ` 用 `B` 表示，则字符串插值满足 `[AB]*A[AB]*`
* 标识符，表示取变量的值
* Lambda：格式为 `[ Params ] { Block }` 或 `[ Params ] Identifier { Block }`，其中 `Identifier` 为 Lambda 的作用域名称
* 小括号括起来的可包含控制流的表达式：`( AllExpr )`
* Vec 字面量：`[ VecItems ]`
* 对象字面量：`{ ObjectItems }`
* 对象修改表达式：`{ ObjectModItems }` 它的作用是修改传入的对象并返回此对象本身
  > 对象字面量与对象修改表达式统一记为 `{ Object }`
* 一元正号 `+` 后面接一个数字字面量，表示的数字值不变
* 一元正号后面接一个标识符，表示构造以标识符为名称的结构体的对象

* `Params`：分号分隔的至多三个元素，按顺序分别为 `ListPattern`、`ObjectPattern`、`Pattern`，也就是以下格式之一：
    * `ListPattern`
    * `ListPattern ; ObjectPattern`
    * `ListPattern ; ObjectPattern ;`
    * `ListPattern ; ObjectPattern ; Pattern`
    * `ListPattern ; ObjectPattern ; Pattern ;`
* `VecItems`：逗号分隔的 `AllExpr`、`* AllExpr` 或 `ColonSepExprs`
    * `ColonSepExprs`：一种特殊的冒号分隔的 `AllExpr` 或空白，空白将被解释为 `_` 并不允许尾随冒号，这种格式相当于一个 Vec
      字面量
  > 例如 `:::1:2::3::` 将被解释为 `_:_:_:1:2:_:3:_:_` 也就是 `[_, _, _, 1, 2, _, 3, _, _]`。
* `ObjectItems`：逗号分隔的 `Identifier : AllExpr`、`Identifier`、`TRecv Identifier : AllExpr`、`TRecv Identifier`、
  `TRecv Identifier :`、`Identifier :`
* `ObjectModItems`：逗号分隔的元素，第一项必须为 `* AllExpr`，后面允许 `Identifier : AllExpr`、`Identifier`、
  `[ Args ] : AllExpr`

* `TRecv`：`val`、`mut` 之一
* `VRecv`：`val`、`mut`、`val*`、`mut*`、`out*` 之一

### 运算表达式

一个字面量或由以下运算符构成的表达式（越往下优先级越低）：

| 运算符                                                                | 单目或双目 | 结合方向 |
|--------------------------------------------------------------------|-------|------|
| `.` `?.` `..` `?..` `[]` `.[]` `?.[]` `()` `.()` `?.()` `尾 Lambda` | （双目）  | 从左向右 |
| `-` `!`                                                            | 单目    | 从右向左 |
| `*` `/` `%`                                                        | 双目    | 从左向右 |
| `+` `-`                                                            | 双目    | 从左向右 |

所有运算符的操作数（与 `.` 相同优先级的只算左侧操作数）必须为运算表达式。

其中 `.` 表示取对象本身的属性，`..` 表示调用扩展属性 Getter。

`?.` 表示如果属性不存在于对象上则返回 `_`，其他的可空版本（例如 `?..`、`?.()`）则表示如果对象为 `_` 则返回 `_`，否则行为与不可空版本相同。

如果 `[]`、`()`、`尾 Lambda` 前方没有 `.` 或 `?.` 标记空安全性的话，则自动跟随前方最近的 `.`、`?.`、`..`、`?..`
（不算括号内的），如果前方没有则默认为 `.`。

`.` 同级运算符的使用：

* `.` `?.` `..` `?..`：右侧为标识符或 `val Identifier`、`mut Identifier`、`out Identifier` 之一，其中后三种表示取这个属性的只读/读写/只写引用
* `[]` `.[]` `?.[]`：`[]` 中为 `Args`
* `()` `.()` `?.()`：`()` 中为 `Args`
* 尾 Lambda：
    * `表达式 ( TLArgs ) [ Params ] Identifier { Block }`
    * `Identifier [ Params ] Identifier { Block }`
    * `表达式 四种点运算符之一 Identifier [ Params ] Identifier { Block }`

  其中 `Params` 为 `*` 时可以连着 `[]` 一起省略，`Block` 前的 `Identifier ` 为 Lambda 的作用域名称，在不需要为 Lambda
  命名或与前方 `Identifier`
  重名时可以省略

* `Args`：`VecItems` 或 `VecItems ; Object` 或 `VecItems ; Object ;`
* `TLArgs`：与 `Args` 基本相同，但 `VecItems` 或 `Object` 的元素中的表示值的部分的 `AllExpr` 可以写 `<>`，表示尾随的 Lambda
  这个函数对象，没有标明的时候默认为最后一个参数

> 注意不能用于值里嵌套的 `AllExpr`，例如 `sort(;key: <>) {}` 合法，但是 `sort(;*{key: <>})` 不合法。

### 比较链条件表达式

比较链条件表达式是由零至任意个 `&` 或 `|` 二元运算符连接起来的一个或多个运算表达式或比较链表达式，其中 `&` 的优先级高于
`|`，且都为短路逻辑运算符，并要求左侧的操作数一定为 `true` 或 `false` 之一，否则报错。

* `&`：`a & b => if (a) { b } else { false }`
* `|`：`a | b => if (a) { true } else { b }`

比较链表达式为由一至任意个 `<`、`>`、`<=`、`>=`、`==` 或 `!=` 二元运算符连接起来的多个运算表达式，执行链式比较（也就是
`a < b < c` 为 `a < b & b < c`），这些运算符之间没有优先级之分。

### 匹配表达式

匹配表达式的格式：`CalcExpr MatchExprClause+` 或 `CalcExpr MatchExprClause* if \( IfCondition \)`。

`MatchExprClause` 可以为下列格式之一：

* `is MatchLogicalExpr`
* `!is MatchLogicalExpr`
* `of MatchLogicalExpr`
* `!of MatchLogicalExpr`
* `when MatchLogicalExpr`
* `!when MatchLogicalExpr`

`!is` 的结果与 `is` 相反，其他两种同理。

* `is` 是对象提供的一个运算符，如果对象上没有这个运算符则会默认到 `==` 运算符，而 `==`
  运算符的逻辑是不存在运算符的话默认到比较引用，所以对于没有定义这两个运算符的对象，就是匹配引用
* `of` 是对象提供的一个运算符，没有的话则会报错
* `when` 后接一个函数作为判断条件，`CalcExpr` 会被当作函数的第一个参数调用，结果必须为 `true` 或 `false` 之一

`MatchLogicalExpr` 是由零至任意个 `&` 或 `|` 连接起来的一个或多个运算表达式，`&` 的优先级高于 `|`
，他们仍为短路运算符，但意义为使用前面的操作应用到操作数上的结果进行短路运算。
> 例如 `a of ClassA | ClassB & ClassC` 即为 `(a of ClassA) | (a of ClassB) & (a of ClassC)`。

多个 `MatchExprClause` 之间，以及 `MatchExprClause` 与 `if` 之间为 `&` 的关系。

求值顺序为从左至右。

### 控制流表达式

#### 控制流结构

* `if ( IfCondition ) { Block }`
* `if ( IfCondition ) { Block } else { Block }`
* `for { Block }`
* `for ( ForCondition ) { Block }`
* `for ( ForCondition ) { Block } else { Block }`
* `for ( ForCondition ) Identifier { Block }`
* `for ( ForCondition ) Identifier { Block } else { Block }`
* `try { Block } catch ( Pattern ) { Block }`
* `try { Block } catch when { PatternWhenBlock }`
* `try { Block } catch when ( Pattern ) { PatternWhenBlock }`
* `when { ConditionWhenBlock }`
* `when ( AllExpr ) { PatternWhenBlock }`
* `when ( Pattern = AllExpr ) { PatternWhenBlock }`
* `when ( Pattern = AllExpr ) { PatternWhenBlock } else { Block }`

其中：

* `for` 中的 `Identifier` 为此循环命名
* `IfCondition` 为逗号分隔的 `AllExpr` 或 `Assign`
* `ForCondition` 为逗号分隔的 `AllExpr`、`Assign` 或 `Pattern : AllExpr`
  > 上述两种条件各个逗号分隔的部分之间都为 `&` 的关系。
* `ConditionWhenBlock` 为带有自动分号插入的分号分隔的 `IfCondition { Block }` 或 `IfCondition => AllExpr`
* `PatternWhenBlock` 为带有自动分号插入的分号分隔的 `Pattern { Block }` 或 `Pattern => AllExpr`
  > 这两种 `WhenBlock` 里都可以写 `else { Block }` 或 `else => AllExpr`，并禁止在 `else` 后写其他分支。
* `Block` 为带有自动分号插入的分号分隔的 `AllExpr`、`Assign`、`GuardWhen`（不可以使用 `fun` 定义函数）
* `Assign` 为 `Pattern = AllExpr` 或 `AssignExpr 原地操作运算符 AllExpr`，其中原地操作运算符包括 `+=`、`-=`、`*=`、`/=`、`%=`
  > 在除了 `Condition` 的地方（例如 `Block`）中 `Assign` 的“返回值”为 `_`，且 `Pattern` 匹配失败时扔出异常。
  >
  > 在 `Condition` 中 `Pattern = AllExpr` 的“返回值”为是否匹配成功，其他类型的赋值返回 `true`。
  >
  > 而且对于位于顶级的 `Pattern = AllExpr` 或 `Pattern`，其中捕获的变量可以直接在对应语句块中使用，但是不能在其他分支中使用，例如
  `if` 条件内捕获的变量无法在 `else` 块内使用。
  >
  > 例如 `if (a of Int = b) { println(a) }` 合法，但是 `if (if (a of Int = b) { true } else { false }) { println(a) }`
  不合法。
  >
  > `ForCondition` 中 `Pattern : AllExpr` 的意义为迭代 `AllExpr` 直至找到一个匹配 `Pattern` 的元素，并返回 `true`，否则返回
  `false` 终止循环。

> `X` 符号分隔的 `Y` 代表 Token 流应该符合 `(YX)*Y?`。
>
> 自动分号插入规则：首先去除收尾所有的换行符，并把 Token 流中的多个相邻的换行符换成单个换行符，替换后如果某个换行符的前一个
> Token 是 `;` `,` `:` 或后一个 Token 是 `;`、`,`、`:`、`.`、`?.`、`..` 或 `?..` 之一的话则删去此换行符，然后把所有的换行符换成
`;`。

`GuardWhen` 的语法定义与 `when` 基本相同，只需要在 `when` 前额外加一个 `guard` 即可，但是 `GuardWhen` 并不属于表达式（“返回值”为
`_`
），只能出现在
`Block` 中，它只在指定的条件不满足时运行代码，并在每个分支（包括 `else` ）的末尾添加一个 `throw`
来保证后续代码不被执行，每个分支都可以使用前面所有分支定义的变量，其后的代码可以使用 `GuardWhen` 中定义的所有变量，同时禁止块中
`else` 分支的出现，因为没有意义。

#### 控制流语句

* `return AllExpr`
* `Identifier return AllExpr`
* `break AllExpr`
* `Identifier break AllExpr`
* `throw AllExpr`
* `continue AllExpr`
* `Identifier continue AllExpr`

`Identifier` 指定哪一个函数或循环，对于
`return` 来说，默认退出最内层的非 Lambda 函数，对于 `break` `continue` 来说，默认最内层的
`for`，如果未指定作用域且找不到默认作用域则编译错误。

当 `AllExpr` 为 `_` 时可以省略。

`continue` 后允许接表达式是为了能把代码写进一个表达式里，并没有额外的作用，只是计算表达式并进入下一次循环。

## 模式 `Pattern`

普通模式 `Pattern` 的构成与匹配表达式类似：`Capture PatternClause* (if \( IfCondition \))?`。

还有一种可以提供默认值的模式 `DefPattern`：`普通模式` 或 `普通模式 = AllExpr`
。默认值的意义是给无法取出值的场景提供默认值，所以无法用在普通的赋值等场景，也就不会发生歧义。

`PatternClause` 与 `MatchExprClause` ，以及后方的 `if` 与匹配表达式的 `if` 格式完全相同，不再赘述。

不同的是判断的顺序，匹配表达式是先求出 `CalcExpr` 的值，再从左向右依次判断，而模式是先求出将被匹配的值，先从左到右判断
`PatternClause`，然后反过去匹配 `Capture` 捕获变量，再去判断 `if`，同时注意只有模式匹配成功了才会去向指定为 `out` 的变量写入值，所以
`if` 中只有非 `out` 的变量才会是匹配后的值。

模式中不同 Recv 的意义：

* `out`：赋值到已有变量或对象的属性、元素中
* `val`：声明不可变变量
* `mut`：声明可变变量
* `out*`：声明只写引用，引用对象为匹配到的值
* `val*`：声明只读引用
* `mut*`：声明读写引用

`Recv` 也指这六种中的任意一个。

同时在非顶层的作用域内允许 Name Shadowing，也就是声明与之前变量同名的新变量。

`Capture` 有六种格式：

* `_`：丢弃
* 空格分隔的至少一个 `AssignExpr` 或 `Identifier`（当且仅当默认 Recv 为 `out` 时）：匹配成功后赋值到这些变量
* 空格分隔的多个指定了 Recv 的组，每个组可以是 `VRecv` 后接空格分隔的至少一个 `Identifier`，或 `out` 后接空格分隔的至少一个
  `AssignExpr` 或 `Identifier`：指定其 Recv
* 一个可选的 `Recv` 接上小括号包裹的迭代器模式 `GenPattern`，内容为逗号分隔的 `Pattern`，且最后一项必须为 `*` 或
  `* Pattern`，最后一项将接收到迭代后的迭代器，也就是将被匹配的值本身
* 一个可选的 `Recv` 接上中括号包裹的列表模式 `VecPattern`，内容为逗号分隔的 `Pattern`（假设为 `A`）、`DefPattern`（`B`）、`*`（
  `C`）或 `* Pattern`（`D`），必须符合以下之一：
    * `A*[CD]?A*`
    * `A*B+[CD]A*`
    * `A*[CD]B+A*`

  如果没有 `*` 或 `* Pattern`，那么对象转换至 `Vec` 之后必须长度严格等于模式指定的长度。
* 一个可选的 `Recv` 接上大括号包裹的对象模式 `ObjectPattern`，内容为逗号分隔的下列元素：
    * `* Pattern`（直接使用将被匹配的值匹配此 Pattern）
    * `Identifier: DefPattern`
    * `Identifier`
    * `Recv Identifier`
    * `Identifier = AllExpr`
    * `Recv Identifier = AllExpr`
    * `[ Args ]: Pattern`

可选的 `Recv` 指定了替代默认 Recv 的接收方法，如果不指定则使用默认 Recv。

`GenPattern`、`VecPattern` 与 `ObjectPattern` 的每一项都会假定前面的所有项都已匹配成功，所以可以使用所有前方声明的非 `out`
变量。

只有 `Block` 中的 `Pattern = AllExpr`，以及 `=>` 后的 `Pattern = AllExpr` 的默认 Recv 是 `out`，其余全部为 `val`。

## 其他内容

### 函数定义 `FuncDef`

只允许在顶层出现。

`fun Identifier ( Params ) { Block }`
`fun Identifier ( Params ) => AllExpr`
`fun Identifier ( Params ) Identifier { Block }`
`fun Identifier ( Params ) Identifier => AllExpr`

完全等效于 `val` 形式，也就是在运行到 `fun` 这一行时才进行初始化。
例如：`fun f() => 123` 完全等效于 `val f = [] { 123 }`

如果想要导出函数，可以在定义前添加 `export`，例如 `export fun f() => 123`。

### 协程

`Nyalang` 通过 `Params` 的第三部分接收 Continuation，实现基于 Continuation 的有栈协程。

堆栈信息也是基于 Continuation 的信息生成的，但是堆栈信息无法保证真实的程序运行堆栈，甚至运行时可以放弃支持堆栈信息或选择性扔掉部分堆栈信息，所以不可以将其用于反射用途。

Continuation 只用来 `resume`，无法保证除了 `resumeReturn_` 和 `resumeThrow_` 的其他属性的行为。

### 模块

在 `Nyalang` 中，一个 `.nya` 文件就是一个模块。

所有类或结构的私有成员都是模块私有的也就是文件私有的（私有成员以下划线开头），其他文件中相同名称的私有成员将指向一个完全不同的空间，但可以通过
`permit` 来和其他文件共享同一份空间。

从一个模块导入可以使用：`import Pattern : ModuleLocation`，或者直接将导入的内容导出可以使用
`export import Pattern : ModuleLocation`。

导出一个变量可以使用 `export` 后面接上第三种 `Capture` 的 `Pattern` 构成的 `Pattern = AllExpr`，也就是需要接至少一个
`Recv`，同时所有 `Recv` 都不能为
`out`。

实际上导出一些名称会生成一个匿名结构，里面包含这些名称，实际上模块导出的是一个对象，这也是为什么前面可以用 `Pattern` 匹配。

如果想直接导出某个对象，可以使用 `export _ = AllExpr`，这将禁止其他所有的 `export`。

顶层作用域禁止 Name Shadowing，并且顶层作用域声明的所有东西都可以在任意位置的函数体使用，不管是在函数体前还是函数体后，但是在顶层作用域内直接使用的话必须在声明后使用。

然而，虽然任意位置的函数体都可以使用任意位置定义的顶层名称，无论如何，在一个值未被初始化完成前使用都是未定义行为（如果是函数调用则按函数实际运行的时候变量定义这行代码有没有执行完毕来判断是否初始化完成），开发者需要自行控制初始化顺序。

在目录根文件 `_.nya` 下可以通过在第一行写 `permit : { Names }`（其中 Names 为逗号分隔的标识符）使自己的与 `Names`
中的包或文件的私有成员双向互通，且这个关系可以递归传递。

每个文件在运行时都会尝试寻找目录根文件获取双向互通许可，如果文件本身就是目录根文件的话则向上一级目录的根文件获取许可，获取成功则可以双向互通，获取失败也不会报错，继续正常运行。

总结：模块顶层不可以 Name Shadow，但是所有定义的东西都能在任意位置的函数体使用。`if` 等不属于函数体，也不属于模块顶层，需要遵守定义后使用的规则，但可以使用
Name Shadowing。

如果是目录根文件的话，模块顶层可以写 `permit : { Names }`

然后，紧跟着一些 `import Pattern : ModuleLocation` 或者 `export import Pattern : ModuleLocation`

后面可以写的有：

* `AllExpr`
* `Assign` 其中可以使用 `export`，但 `export` 后面必须直接跟 `Recv` 且不能 `export` `out`
* `GuardWhen` 可以使用 `export`，但 `export` 后面必须直接跟 `Recv` 且不能 `export` `out`
* `export _ = AllExpr` 出现了这个则不能出现任何其他 `export`
* `fun` 定义
* `export fun` 定义
* 类定义

### 类

TODO

## Examples

标准库我还没设计好，目前的 API 先写成这样吧。

默认命名空间里是什么也没有的，`Int` 也没有，所有东西都要导入。

语言核心部分在 `nya` 包里，其他标准库在 `std` 包里。

### Hello, world!

```nya
import { println } : "/std/io"

println("Hello, world!")
```

### 猜数游戏

```nya
import { print, println, readln } : "/std/io"
import { Random } : "/std/random"

val answer = Random().nextInt(100) + 1
val CHANCES = 5
mut remainingChances = CHANCES

val successful = for {
  print("Guess a number between 1 and 100 ("{remainingChances}"/"{CHANCES}"): ")
  
  guard when (guess = readln().tryParseInt()) {
    guess !is _ => continue println("Invalid number!")
    1 <= guess <= 100 => continue println("Out of range!")
  }
  
  when {
    guess < answer => println("Too small!")
    guess > answer => println("Too large!")
    else => break true
  }
  
  if (remainingChances -= 1, remainingChances == 0) {
    break false
  }
}

println(if (successful) { "You won!" } else { "You lost!" })
```

### 抽象语法树求值

```nya
export fun evaluate(ast of AstNode) 'Float' {
  when (ast) {
    [value] of FloatAstNode => value
    { child } of NegateAstNode => -evaluate(child)
    { operation, left, right } of OperationAstNode => operation(
      evaluate(left),
      evaluate(right),
    )
    else => throw Error("Unknown AST node: "{ast})
  }
}
```

### 实现函数结果缓存并计算斐波那契数列

```nya
"fun 'T, R' cached(func 'T -> R') 'T -> R'"
"fun 'T, R' cached(historyCache 'Map<T, R>', func 'T -> R') 'T -> R'"
export fun cached(*args) {
  val (cacheMap, func) = when (args) {
    [func] => [Map[], func]
    [historyCache, func] => [Map[*historyCache], func]
    else => throw ArgumentError()
  }
  [param 'T'] 'R' {
    cacheMap.getOrPut(param, func)
  }
}

val fib = cached [n of Int if (n > 0)] {
  if (n > 2) {
    fib(n - 1) + fib(n - 2)
  } else {
    1
  }
}

println(fib(100))
```
