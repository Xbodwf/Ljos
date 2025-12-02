/**
 * Ljos Standard Library - String Module (C++ Runtime)
 * 字符串操作的 C++ 实现
 */

#ifndef LJOS_STD_STRING_HPP
#define LJOS_STD_STRING_HPP

#include <string>
#include <vector>
#include <sstream>
#include <algorithm>
#include <cctype>
#include <regex>

namespace ljos {
namespace str {

// ============ 基本操作 ============

// 字符串长度
inline size_t len(const std::string& s) {
    return s.length();
}

// 是否为空
inline bool isEmpty(const std::string& s) {
    return s.empty();
}

// 字符访问
inline char charAt(const std::string& s, size_t index) {
    if (index >= s.length()) return '\0';
    return s[index];
}

// 子字符串
inline std::string substring(const std::string& s, size_t start, size_t end = std::string::npos) {
    if (start >= s.length()) return "";
    return s.substr(start, end - start);
}

inline std::string slice(const std::string& s, int start, int end = INT_MAX) {
    int len = static_cast<int>(s.length());
    if (start < 0) start = std::max(0, len + start);
    if (end < 0) end = len + end;
    if (start >= len || start >= end) return "";
    return s.substr(start, std::min(end, len) - start);
}

// ============ 查找 ============

inline size_t indexOf(const std::string& s, const std::string& search, size_t start = 0) {
    size_t pos = s.find(search, start);
    return pos == std::string::npos ? -1 : pos;
}

inline size_t lastIndexOf(const std::string& s, const std::string& search) {
    size_t pos = s.rfind(search);
    return pos == std::string::npos ? -1 : pos;
}

inline bool contains(const std::string& s, const std::string& search) {
    return s.find(search) != std::string::npos;
}

inline bool startsWith(const std::string& s, const std::string& prefix) {
    if (prefix.length() > s.length()) return false;
    return s.compare(0, prefix.length(), prefix) == 0;
}

inline bool endsWith(const std::string& s, const std::string& suffix) {
    if (suffix.length() > s.length()) return false;
    return s.compare(s.length() - suffix.length(), suffix.length(), suffix) == 0;
}

// ============ 转换 ============

inline std::string toUpper(const std::string& s) {
    std::string result = s;
    std::transform(result.begin(), result.end(), result.begin(), ::toupper);
    return result;
}

inline std::string toLower(const std::string& s) {
    std::string result = s;
    std::transform(result.begin(), result.end(), result.begin(), ::tolower);
    return result;
}

inline std::string capitalize(const std::string& s) {
    if (s.empty()) return s;
    std::string result = s;
    result[0] = std::toupper(result[0]);
    return result;
}

// ============ 修剪 ============

inline std::string trimLeft(const std::string& s) {
    size_t start = s.find_first_not_of(" \t\n\r\f\v");
    return start == std::string::npos ? "" : s.substr(start);
}

inline std::string trimRight(const std::string& s) {
    size_t end = s.find_last_not_of(" \t\n\r\f\v");
    return end == std::string::npos ? "" : s.substr(0, end + 1);
}

inline std::string trim(const std::string& s) {
    return trimRight(trimLeft(s));
}

// ============ 分割和连接 ============

inline std::vector<std::string> split(const std::string& s, const std::string& delimiter = " ") {
    std::vector<std::string> result;
    if (delimiter.empty()) {
        for (char c : s) {
            result.push_back(std::string(1, c));
        }
        return result;
    }
    
    size_t start = 0;
    size_t end = s.find(delimiter);
    
    while (end != std::string::npos) {
        result.push_back(s.substr(start, end - start));
        start = end + delimiter.length();
        end = s.find(delimiter, start);
    }
    
    result.push_back(s.substr(start));
    return result;
}

inline std::string join(const std::vector<std::string>& parts, const std::string& delimiter = "") {
    if (parts.empty()) return "";
    
    std::ostringstream oss;
    oss << parts[0];
    for (size_t i = 1; i < parts.size(); i++) {
        oss << delimiter << parts[i];
    }
    return oss.str();
}

// ============ 替换 ============

inline std::string replace(const std::string& s, const std::string& from, const std::string& to) {
    if (from.empty()) return s;
    
    std::string result = s;
    size_t pos = 0;
    while ((pos = result.find(from, pos)) != std::string::npos) {
        result.replace(pos, from.length(), to);
        pos += to.length();
    }
    return result;
}

inline std::string replaceFirst(const std::string& s, const std::string& from, const std::string& to) {
    size_t pos = s.find(from);
    if (pos == std::string::npos) return s;
    
    std::string result = s;
    result.replace(pos, from.length(), to);
    return result;
}

// ============ 重复和填充 ============

inline std::string repeat(const std::string& s, int count) {
    if (count <= 0) return "";
    
    std::string result;
    result.reserve(s.length() * count);
    for (int i = 0; i < count; i++) {
        result += s;
    }
    return result;
}

inline std::string padLeft(const std::string& s, size_t width, char fill = ' ') {
    if (s.length() >= width) return s;
    return std::string(width - s.length(), fill) + s;
}

inline std::string padRight(const std::string& s, size_t width, char fill = ' ') {
    if (s.length() >= width) return s;
    return s + std::string(width - s.length(), fill);
}

// ============ 类型转换 ============

inline int toInt(const std::string& s, int defaultValue = 0) {
    try {
        return std::stoi(s);
    } catch (...) {
        return defaultValue;
    }
}

inline double toFloat(const std::string& s, double defaultValue = 0.0) {
    try {
        return std::stod(s);
    } catch (...) {
        return defaultValue;
    }
}

inline std::string fromInt(int n) {
    return std::to_string(n);
}

inline std::string fromFloat(double n) {
    return std::to_string(n);
}

// ============ 字符检查 ============

inline bool isDigit(char c) { return std::isdigit(c); }
inline bool isAlpha(char c) { return std::isalpha(c); }
inline bool isAlnum(char c) { return std::isalnum(c); }
inline bool isSpace(char c) { return std::isspace(c); }

inline bool isNumeric(const std::string& s) {
    if (s.empty()) return false;
    for (char c : s) {
        if (!std::isdigit(c) && c != '.' && c != '-' && c != '+') return false;
    }
    return true;
}

// ============ 反转 ============

inline std::string reverse(const std::string& s) {
    return std::string(s.rbegin(), s.rend());
}

} // namespace str
} // namespace ljos

#endif // LJOS_STD_STRING_HPP
