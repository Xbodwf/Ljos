/**
 * Ljos Standard Library - IO Module (C++ Runtime)
 * 输入输出操作的 C++ 实现
 */

#ifndef LJOS_STD_IO_HPP
#define LJOS_STD_IO_HPP

#include <iostream>
#include <string>
#include <cstdio>
#include <cstdarg>
#include <sstream>

namespace ljos {
namespace io {

// ============ 标准输出 ============

// println - 打印一行（使用 printf）
inline void println() {
    printf("\n");
}

inline void println(const std::string& s) {
    printf("%s\n", s.c_str());
}

inline void println(const char* s) {
    printf("%s\n", s);
}

inline void println(int n) {
    printf("%d\n", n);
}

inline void println(long n) {
    printf("%ld\n", n);
}

inline void println(long long n) {
    printf("%lld\n", n);
}

inline void println(double n) {
    printf("%g\n", n);
}

inline void println(bool b) {
    printf("%s\n", b ? "true" : "false");
}

// print - 打印不换行
inline void print(const std::string& s) {
    printf("%s", s.c_str());
}

inline void print(const char* s) {
    printf("%s", s);
}

inline void print(int n) {
    printf("%d", n);
}

inline void print(double n) {
    printf("%g", n);
}

inline void print(bool b) {
    printf("%s", b ? "true" : "false");
}

// ============ 标准输入 ============

// readln - 读取一行
inline std::string readln() {
    std::string line;
    std::getline(std::cin, line);
    return line;
}

// readInt - 读取整数
inline int readInt() {
    int n;
    std::cin >> n;
    return n;
}

// readFloat - 读取浮点数
inline double readFloat() {
    double n;
    std::cin >> n;
    return n;
}

// ============ 标准错误 ============

inline void eprintln(const std::string& s) {
    fprintf(stderr, "%s\n", s.c_str());
}

inline void eprint(const std::string& s) {
    fprintf(stderr, "%s", s.c_str());
}

// ============ 格式化输出 ============

// format - 格式化字符串
template<typename... Args>
std::string format(const std::string& fmt, Args... args) {
    int size = snprintf(nullptr, 0, fmt.c_str(), args...) + 1;
    if (size <= 0) return "";
    std::unique_ptr<char[]> buf(new char[size]);
    snprintf(buf.get(), size, fmt.c_str(), args...);
    return std::string(buf.get(), buf.get() + size - 1);
}

// printf style
template<typename... Args>
void printf_fmt(const char* fmt, Args... args) {
    printf(fmt, args...);
}

// ============ 调试输出 ============

template<typename T>
T dbg(T value) {
    std::cerr << "[DEBUG] " << value << std::endl;
    return value;
}

} // namespace io
} // namespace ljos

// 全局便捷函数（不使用命名空间时）
using ljos::io::println;
using ljos::io::print;
using ljos::io::readln;
using ljos::io::readInt;
using ljos::io::readFloat;
using ljos::io::eprintln;
using ljos::io::eprint;
using ljos::io::dbg;

#endif // LJOS_STD_IO_HPP
