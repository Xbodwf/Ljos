#include <cstdio>
#include <iostream>
#include <string>
#include <vector>
#include <memory>
#include <functional>

using namespace std;
inline string to_string(const string& s) { return s; }
inline string to_string(const char* s) { return string(s); }
inline string to_string(bool b) { return b ? "true" : "false"; }

// Forward declarations
string println(string);

auto _ljos_main() {
    printf("%s\n", ("Hello from Ljos"s).c_str());
}


int main() {
    _ljos_main();
    return 0;
}
