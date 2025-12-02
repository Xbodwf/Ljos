/**
 * Ljos Standard Library - File System Module (C++ Runtime)
 * 文件系统操作的 C++ 实现
 */

#ifndef LJOS_STD_FS_HPP
#define LJOS_STD_FS_HPP

#include <string>
#include <fstream>
#include <sstream>
#include <vector>
#include <filesystem>
#include <optional>

namespace ljos {
namespace fs {

namespace stdfs = std::filesystem;

// ============ 文件读写 ============

// 读取整个文件内容
inline std::optional<std::string> readFile(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open()) {
        return std::nullopt;
    }
    std::stringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

// 写入文件（覆盖）
inline bool writeFile(const std::string& path, const std::string& content) {
    std::ofstream file(path);
    if (!file.is_open()) {
        return false;
    }
    file << content;
    return true;
}

// 追加到文件
inline bool appendFile(const std::string& path, const std::string& content) {
    std::ofstream file(path, std::ios::app);
    if (!file.is_open()) {
        return false;
    }
    file << content;
    return true;
}

// 按行读取文件
inline std::vector<std::string> readLines(const std::string& path) {
    std::vector<std::string> lines;
    std::ifstream file(path);
    if (!file.is_open()) {
        return lines;
    }
    std::string line;
    while (std::getline(file, line)) {
        lines.push_back(line);
    }
    return lines;
}

// ============ 文件信息 ============

// 检查文件是否存在
inline bool exists(const std::string& path) {
    return stdfs::exists(path);
}

// 检查是否是文件
inline bool isFile(const std::string& path) {
    return stdfs::is_regular_file(path);
}

// 检查是否是目录
inline bool isDir(const std::string& path) {
    return stdfs::is_directory(path);
}

// 获取文件大小
inline long long fileSize(const std::string& path) {
    if (!stdfs::exists(path)) return -1;
    return static_cast<long long>(stdfs::file_size(path));
}

// 获取文件扩展名
inline std::string extension(const std::string& path) {
    return stdfs::path(path).extension().string();
}

// 获取文件名（不含路径）
inline std::string filename(const std::string& path) {
    return stdfs::path(path).filename().string();
}

// 获取父目录
inline std::string parent(const std::string& path) {
    return stdfs::path(path).parent_path().string();
}

// ============ 目录操作 ============

// 创建目录
inline bool mkdir(const std::string& path) {
    return stdfs::create_directory(path);
}

// 递归创建目录
inline bool mkdirp(const std::string& path) {
    return stdfs::create_directories(path);
}

// 删除文件或空目录
inline bool remove(const std::string& path) {
    return stdfs::remove(path);
}

// 递归删除目录
inline int removeAll(const std::string& path) {
    return static_cast<int>(stdfs::remove_all(path));
}

// 列出目录内容
inline std::vector<std::string> listDir(const std::string& path) {
    std::vector<std::string> entries;
    if (!stdfs::is_directory(path)) return entries;
    
    for (const auto& entry : stdfs::directory_iterator(path)) {
        entries.push_back(entry.path().filename().string());
    }
    return entries;
}

// 复制文件
inline bool copy(const std::string& src, const std::string& dst) {
    try {
        stdfs::copy(src, dst, stdfs::copy_options::overwrite_existing);
        return true;
    } catch (...) {
        return false;
    }
}

// 移动/重命名文件
inline bool move(const std::string& src, const std::string& dst) {
    try {
        stdfs::rename(src, dst);
        return true;
    } catch (...) {
        return false;
    }
}

// ============ 路径操作 ============

// 连接路径
inline std::string join(const std::string& p1, const std::string& p2) {
    return (stdfs::path(p1) / p2).string();
}

// 获取绝对路径
inline std::string absolute(const std::string& path) {
    return stdfs::absolute(path).string();
}

// 获取当前工作目录
inline std::string cwd() {
    return stdfs::current_path().string();
}

// 改变当前工作目录
inline bool chdir(const std::string& path) {
    try {
        stdfs::current_path(path);
        return true;
    } catch (...) {
        return false;
    }
}

} // namespace fs
} // namespace ljos

#endif // LJOS_STD_FS_HPP
