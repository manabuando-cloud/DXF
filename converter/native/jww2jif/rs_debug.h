// Minimal stand-in for LibreCAD's rs_debug.h so jwwlib builds without the
// rest of LibreCAD. jwwlib only touches RS_DEBUG inside #ifdef DEBUG blocks.
#ifndef RS_DEBUG_H
#define RS_DEBUG_H

class RS_Debug {
public:
    enum RS_DebugLevel { D_NOTHING, D_CRITICAL, D_ERROR, D_WARNING, D_NOTICE, D_INFORMATIONAL, D_DEBUGGING };
    void setLevel(RS_DebugLevel) {}
    void print(const char*, ...) {}
    void print(RS_DebugLevel, const char*, ...) {}
    static RS_Debug* instance() { static RS_Debug d; return &d; }
};

#define RS_DEBUG RS_Debug::instance()

#endif
