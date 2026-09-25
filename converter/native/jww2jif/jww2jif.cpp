// jww2jif: read a JW_CAD .jww file with jwwlib and emit JIF
// (JWW Intermediate Format, newline-delimited JSON) on stdout or to a file.
//
// The DXF itself is assembled on the Python side with ezdxf, so this tool
// only needs to forward the handful of callbacks jwwlib actually fires:
// addLayer / addLine / addCircle / addArc / addEllipse / addPoint / addText.
//
// Text strings arrive as raw Shift-JIS bytes (jwwlib's conversion code is
// compiled out), so they are base64-encoded into "text_b64" and decoded as
// cp932 by the converter.

#include <cmath>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>

#include "dl_creationinterface.h"
#include "dl_jww.h"

namespace {

std::string jsonEscape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 2);
    for (unsigned char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (c < 0x20 || c >= 0x80) {
                    char buf[8];
                    std::snprintf(buf, sizeof(buf), "\\u%04x", c);
                    out += buf;
                } else {
                    out += static_cast<char>(c);
                }
        }
    }
    return out;
}

std::string base64(const std::string& in) {
    static const char* tbl = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;
    size_t i = 0;
    while (i + 2 < in.size()) {
        unsigned n = (unsigned char)in[i] << 16 | (unsigned char)in[i + 1] << 8 | (unsigned char)in[i + 2];
        out += tbl[(n >> 18) & 63]; out += tbl[(n >> 12) & 63];
        out += tbl[(n >> 6) & 63];  out += tbl[n & 63];
        i += 3;
    }
    if (i + 1 == in.size()) {
        unsigned n = (unsigned char)in[i] << 16;
        out += tbl[(n >> 18) & 63]; out += tbl[(n >> 12) & 63]; out += "==";
    } else if (i + 2 == in.size()) {
        unsigned n = (unsigned char)in[i] << 16 | (unsigned char)in[i + 1] << 8;
        out += tbl[(n >> 18) & 63]; out += tbl[(n >> 12) & 63];
        out += tbl[(n >> 6) & 63];  out += '=';
    }
    return out;
}

std::string num(double v) {
    if (!std::isfinite(v)) return "0";
    char buf[64];
    std::snprintf(buf, sizeof(buf), "%.10g", v);
    return buf;
}

class JifWriter : public DL_CreationInterface {
public:
    explicit JifWriter(std::ostream& os) : os_(os) {}

    void addLayer(const DL_LayerData& d) override {
        lastLayer_ = d.name;
        if (seenLayers_.find("|" + d.name + "|") == std::string::npos) {
            seenLayers_ += "|" + d.name + "|";
            os_ << "{\"t\":\"layer\",\"name\":\"" << jsonEscape(d.name) << "\"}\n";
        }
    }

    void addLine(const DL_LineData& d) override {
        os_ << "{\"t\":\"line\"" << common()
            << ",\"x1\":" << num(d.x1) << ",\"y1\":" << num(d.y1)
            << ",\"x2\":" << num(d.x2) << ",\"y2\":" << num(d.y2) << "}\n";
    }

    void addCircle(const DL_CircleData& d) override {
        os_ << "{\"t\":\"circle\"" << common()
            << ",\"cx\":" << num(d.cx) << ",\"cy\":" << num(d.cy)
            << ",\"r\":" << num(d.radius) << "}\n";
    }

    void addArc(const DL_ArcData& d) override {
        os_ << "{\"t\":\"arc\"" << common()
            << ",\"cx\":" << num(d.cx) << ",\"cy\":" << num(d.cy)
            << ",\"r\":" << num(d.radius)
            << ",\"a1\":" << num(d.angle1) << ",\"a2\":" << num(d.angle2) << "}\n";
    }

    void addEllipse(const DL_EllipseData& d) override {
        os_ << "{\"t\":\"ellipse\"" << common()
            << ",\"cx\":" << num(d.cx) << ",\"cy\":" << num(d.cy)
            << ",\"mx\":" << num(d.mx) << ",\"my\":" << num(d.my)
            << ",\"ratio\":" << num(d.ratio)
            << ",\"a1\":" << num(d.angle1) << ",\"a2\":" << num(d.angle2) << "}\n";
    }

    void addPoint(const DL_PointData& d) override {
        os_ << "{\"t\":\"point\"" << common()
            << ",\"x\":" << num(d.x) << ",\"y\":" << num(d.y) << "}\n";
    }

    void addText(const DL_TextData& d) override {
        os_ << "{\"t\":\"text\"" << common()
            << ",\"ipx\":" << num(d.ipx) << ",\"ipy\":" << num(d.ipy)
            << ",\"height\":" << num(d.height)
            << ",\"xscale\":" << num(d.xScaleFactor)
            << ",\"angle\":" << num(d.angle * 180.0 / M_PI)
            << ",\"hjust\":" << d.hJustification << ",\"vjust\":" << d.vJustification
            << ",\"text_b64\":\"" << base64(d.text) << "\"}\n";
    }

    // Everything below is either never called by jwwlib or irrelevant here.
    void addBlock(const DL_BlockData&) override {}
    void endBlock() override {}
    void addPolyline(const DL_PolylineData&) override {}
    void addVertex(const DL_VertexData&) override {}
    void addSpline(const DL_SplineData&) override {}
    void addControlPoint(const DL_ControlPointData&) override {}
    void addKnot(const DL_KnotData&) override {}
    void addInsert(const DL_InsertData&) override {}
    void addTrace(const DL_TraceData&) override {}
    void add3dFace(const DL_3dFaceData&) override {}
    void addSolid(const DL_SolidData&) override {}
    void addMText(const DL_MTextData&) override {}
    void addMTextChunk(const char*) override {}
    void addDimAlign(const DL_DimensionData&, const DL_DimAlignedData&) override {}
    void addDimLinear(const DL_DimensionData&, const DL_DimLinearData&) override {}
    void addDimRadial(const DL_DimensionData&, const DL_DimRadialData&) override {}
    void addDimDiametric(const DL_DimensionData&, const DL_DimDiametricData&) override {}
    void addDimAngular(const DL_DimensionData&, const DL_DimAngularData&) override {}
    void addDimAngular3P(const DL_DimensionData&, const DL_DimAngular3PData&) override {}
    void addDimOrdinate(const DL_DimensionData&, const DL_DimOrdinateData&) override {}
    void addLeader(const DL_LeaderData&) override {}
    void addLeaderVertex(const DL_LeaderVertexData&) override {}
    void addHatch(const DL_HatchData&) override {}
    void addImage(const DL_ImageData&) override {}
    void linkImage(const DL_ImageDefData&) override {}
    void addHatchLoop(const DL_HatchLoopData&) override {}
    void addHatchEdge(const DL_HatchEdgeData&) override {}
    void endEntity() override {}
    void addComment(const char*) override {}
    void setVariableVector(const char*, double, double, double, int) override {}
    void setVariableString(const char*, const char*, int) override {}
    void setVariableInt(const char*, int, int) override {}
    void setVariableDouble(const char*, double, int) override {}
    void endSequence() override {}

private:
    // Some jwwlib builds leave the DL_Attributes layer empty even though the
    // correct name was just passed to addLayer(), so fall back to that.
    std::string layerName() {
        std::string l = attributes.getLayer();
        return l.empty() ? (lastLayer_.empty() ? std::string("0") : lastLayer_) : l;
    }

    std::string common() {
        std::ostringstream s;
        s << ",\"layer\":\"" << jsonEscape(layerName()) << "\""
          << ",\"color\":" << attributes.getColor()
          << ",\"width\":" << attributes.getWidth()
          << ",\"ltype\":\"" << jsonEscape(attributes.getLineType()) << "\"";
        return s.str();
    }

    std::ostream& os_;
    std::string lastLayer_;
    std::string seenLayers_;
};

}  // namespace

int main(int argc, char** argv) {
    if (argc < 2) {
        std::cerr << "usage: jww2jif <input.jww> [output.jif]\n";
        return 2;
    }

    std::ofstream file;
    std::ostream* out = &std::cout;
    if (argc >= 3) {
        file.open(argv[2], std::ios::binary);
        if (!file) {
            std::cerr << "cannot open output: " << argv[2] << "\n";
            return 3;
        }
        out = &file;
    }

    // jwwlib prints diagnostics to std::cout; keep them off the JIF stream.
    std::streambuf* realCout = nullptr;
    std::ostringstream sink;
    std::ostream jifStream(out == &std::cout ? std::cout.rdbuf() : file.rdbuf());
    if (out == &std::cout) {
        realCout = std::cout.rdbuf(sink.rdbuf());
    }

    JifWriter writer(jifStream);
    DL_Jww jww;
    bool ok = false;
    try {
        ok = jww.in(std::string(argv[1]), &writer);
    } catch (...) {
        ok = false;
    }
    jifStream.flush();

    if (realCout) std::cout.rdbuf(realCout);
    if (!sink.str().empty()) std::cerr << sink.str();

    if (!ok) {
        std::cerr << "failed to read JWW file: " << argv[1] << "\n";
        return 1;
    }
    return 0;
}
