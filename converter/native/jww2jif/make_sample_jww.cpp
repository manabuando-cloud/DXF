// Test helper: writes a small .jww (lines, circle, arc, Shift-JIS text and a
// stray JW_CAD print-setting text) using jwwlib's own writer, so the reader
// pipeline can be tested without shipping a real customer drawing.
//
//   make_sample_jww out.jww
#include <cmath>
#include <iostream>
#include <string>

#include "jwwdoc.h"

template <class T> static void base(T& d, int layer) {
    d.SetVersion(600);
    d.m_lGroup = 0; d.m_nPenStyle = 1; d.m_nPenColor = 1; d.m_nPenWidth = 1;
    d.m_nLayer = layer; d.m_nGLayer = 0; d.m_sFlg = 0;
}

static CDataMoji text(double x, double y, double h, const std::string& s) {
    CDataMoji m{}; base(m, 1);
    m.m_start.x = x; m.m_start.y = y; m.m_end.x = x + h * s.size() / 2; m.m_end.y = y;
    m.m_nMojiShu = 1; m.m_dSizeX = h; m.m_dSizeY = h; m.m_dKankaku = 0; m.m_degKakudo = 0;
    m.m_strFontName = "\x82\x6c\x82\x72 \x83\x53\x83\x56\x83\x62\x83\x4e"; // "ＭＳ ゴシック" in CP932
    m.m_string = s;
    return m;
}

int main(int argc, char** argv) {
    if (argc < 2) { std::cerr << "usage: make_sample_jww out.jww\n"; return 2; }
    std::string in, out = argv[1];
    JWWDocument doc(in, out);
    doc.Header = JWWHead{};
    doc.Header.JW_DATA_VERSION = 600;

    double rect[4][4] = {{0, 0, 400, 0}, {400, 0, 400, 250}, {400, 250, 0, 250}, {0, 250, 0, 0}};
    for (auto& r : rect) {
        CDataSen s{}; base(s, 0);
        s.m_start.x = r[0]; s.m_start.y = r[1]; s.m_end.x = r[2]; s.m_end.y = r[3];
        doc.vSen.push_back(s);
    }

    CDataEnko c{}; base(c, 0);
    c.m_start.x = 200; c.m_start.y = 125; c.m_dHankei = 50;
    c.m_radKaishiKaku = 0; c.m_radEnkoKaku = 2 * M_PI; c.m_radKatamukiKaku = 0;
    c.m_dHenpeiRitsu = 1; c.m_bZenEnFlg = 1;
    doc.vEnko.push_back(c);

    CDataEnko a = c;
    a.m_start.x = 320; a.m_dHankei = 30; a.m_radKaishiKaku = 0; a.m_radEnkoKaku = M_PI / 2; a.m_bZenEnFlg = 0;
    doc.vEnko.push_back(a);

    // "合番：206（A）" and "φ10-2" in Shift-JIS
    doc.vMoji.push_back(text(20, 20, 10, "\x8d\x87\x94\xd4\x81\x46\x32\x30\x36\x81\x69\x82\x60\x81\x6a"));
    doc.vMoji.push_back(text(170, 185, 7, "\x83\xd3\x31\x30\x2d\x32"));
    doc.vMoji.push_back(text(0, -1000, 3, "Printer_Orientation = 0"));

    if (!doc.Save()) { std::cerr << "save failed\n"; return 1; }
    return 0;
}
