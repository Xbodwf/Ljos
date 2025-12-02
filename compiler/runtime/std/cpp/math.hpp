/**
 * Ljos Standard Library - Math Module (C++ Runtime)
 * 数学函数的 C++ 实现
 */

#ifndef LJOS_STD_MATH_HPP
#define LJOS_STD_MATH_HPP

#include <cmath>
#include <cstdlib>
#include <random>
#include <limits>
#include <algorithm>

namespace ljos {
namespace math {

// ============ 常量 ============

constexpr double PI = 3.14159265358979323846;
constexpr double E = 2.71828182845904523536;
constexpr double TAU = 2 * PI;
constexpr double SQRT2 = 1.41421356237309504880;
constexpr double LN2 = 0.69314718055994530942;
constexpr double LN10 = 2.30258509299404568402;

// ============ 基本函数 ============

inline double abs(double x) { return std::abs(x); }
inline int abs(int x) { return std::abs(x); }

inline double floor(double x) { return std::floor(x); }
inline double ceil(double x) { return std::ceil(x); }
inline double round(double x) { return std::round(x); }
inline double trunc(double x) { return std::trunc(x); }

inline double min(double a, double b) { return std::min(a, b); }
inline double max(double a, double b) { return std::max(a, b); }
inline int min(int a, int b) { return std::min(a, b); }
inline int max(int a, int b) { return std::max(a, b); }

inline double clamp(double x, double lo, double hi) {
    return std::max(lo, std::min(x, hi));
}

inline int clamp(int x, int lo, int hi) {
    return std::max(lo, std::min(x, hi));
}

// ============ 幂和对数 ============

inline double pow(double base, double exp) { return std::pow(base, exp); }
inline double sqrt(double x) { return std::sqrt(x); }
inline double cbrt(double x) { return std::cbrt(x); }

inline double exp(double x) { return std::exp(x); }
inline double log(double x) { return std::log(x); }
inline double log2(double x) { return std::log2(x); }
inline double log10(double x) { return std::log10(x); }

// ============ 三角函数 ============

inline double sin(double x) { return std::sin(x); }
inline double cos(double x) { return std::cos(x); }
inline double tan(double x) { return std::tan(x); }

inline double asin(double x) { return std::asin(x); }
inline double acos(double x) { return std::acos(x); }
inline double atan(double x) { return std::atan(x); }
inline double atan2(double y, double x) { return std::atan2(y, x); }

// 双曲函数
inline double sinh(double x) { return std::sinh(x); }
inline double cosh(double x) { return std::cosh(x); }
inline double tanh(double x) { return std::tanh(x); }

// 角度转换
inline double toRadians(double degrees) { return degrees * PI / 180.0; }
inline double toDegrees(double radians) { return radians * 180.0 / PI; }

// ============ 随机数 ============

// 全局随机数生成器
inline std::mt19937& getRandomEngine() {
    static std::random_device rd;
    static std::mt19937 gen(rd());
    return gen;
}

// 随机浮点数 [0, 1)
inline double random() {
    static std::uniform_real_distribution<double> dist(0.0, 1.0);
    return dist(getRandomEngine());
}

// 随机整数 [min, max]
inline int randomInt(int min, int max) {
    std::uniform_int_distribution<int> dist(min, max);
    return dist(getRandomEngine());
}

// 随机浮点数 [min, max)
inline double randomFloat(double min, double max) {
    std::uniform_real_distribution<double> dist(min, max);
    return dist(getRandomEngine());
}

// 设置随机种子
inline void seed(unsigned int s) {
    getRandomEngine().seed(s);
}

// ============ 数值检查 ============

inline bool isNaN(double x) { return std::isnan(x); }
inline bool isInf(double x) { return std::isinf(x); }
inline bool isFinite(double x) { return std::isfinite(x); }

inline int sign(double x) {
    if (x > 0) return 1;
    if (x < 0) return -1;
    return 0;
}

// ============ 整数运算 ============

// 最大公约数
inline int gcd(int a, int b) {
    a = std::abs(a);
    b = std::abs(b);
    while (b != 0) {
        int t = b;
        b = a % b;
        a = t;
    }
    return a;
}

// 最小公倍数
inline int lcm(int a, int b) {
    if (a == 0 || b == 0) return 0;
    return std::abs(a / gcd(a, b) * b);
}

// 阶乘
inline long long factorial(int n) {
    if (n < 0) return 0;
    if (n <= 1) return 1;
    long long result = 1;
    for (int i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}

// 斐波那契
inline long long fibonacci(int n) {
    if (n <= 0) return 0;
    if (n == 1) return 1;
    long long a = 0, b = 1;
    for (int i = 2; i <= n; i++) {
        long long c = a + b;
        a = b;
        b = c;
    }
    return b;
}

// 是否为素数
inline bool isPrime(int n) {
    if (n < 2) return false;
    if (n == 2) return true;
    if (n % 2 == 0) return false;
    for (int i = 3; i * i <= n; i += 2) {
        if (n % i == 0) return false;
    }
    return true;
}

} // namespace math
} // namespace ljos

#endif // LJOS_STD_MATH_HPP
