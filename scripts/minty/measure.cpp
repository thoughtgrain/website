// Measure Minty for the website's figures.
//
//   g++ -std=c++20 -O2 -I <endless>/minty/source scripts/minty/measure.cpp -o measure
//   ./measure > synth.json          (add -DMINTY_PROFILE_GUITAR for guitar.json)
//
// Every number the Minty pages draw comes from here, measured by running
// Minty's own engine and classes, unmodified, the same way its test bench
// does (test/host_render.cpp): sines in, RMS out, the last quarter-second of
// each run. Nothing is re-derived from the formulas, so the figures can't
// drift from the DSP.
//
// Built by scripts/minty-data.mjs, which also checks the static curves
// against the table the bench itself prints.

#include "minty/MintyEngine.h"

#include <cstdio>
#include <vector>

using minty::Character;
using minty::MintyEngine;

namespace
{
constexpr int kFs = 48000;
constexpr int kBlock = 32;

MintyEngine makeEngine(float sens, float dyn, float eq, Character c, bool swellOn)
{
    MintyEngine e;
    e.setKnob(0, sens);
    e.setKnob(1, dyn);
    e.setKnob(2, eq);
    e.setCharacter(c);
    e.setSwell(swellOn);
    e.reset();
    return e;
}

double rmsDb(const std::vector<float>& x, size_t from, size_t to)
{
    double acc = 0.0;
    for (size_t i = from; i < to; ++i)
    {
        acc += static_cast<double>(x[i]) * static_cast<double>(x[i]);
    }
    return 10.0 * std::log10(acc / static_cast<double>(to - from) + 1e-20);
}

// --- static curves ---------------------------------------------------------
// Output RMS for a 1 kHz sine at each input RMS level, across both knobs that
// shape the curve. Also the meter (compressor + limiter gain reduction) the
// LED reads, averaged over the same window.
void curves()
{
    std::printf("\"curves\":{\"sens\":[");
    for (int s = 0; s <= 10; ++s) std::printf("%s%.1f", s ? "," : "", s / 10.0);
    std::printf("],\"dyn\":[");
    for (int d = 0; d <= 20; ++d) std::printf("%s%.2f", d ? "," : "", d / 20.0);
    std::printf("],\"levels\":[");
    for (int lv = -60; lv <= 0; lv += 3) std::printf("%s%d", lv == -60 ? "" : ",", lv);
    std::printf("],\"out\":[");
    std::vector<double> meters;
    for (int s = 0; s <= 10; ++s)
    {
        std::printf("%s[", s ? "," : "");
        for (int d = 0; d <= 20; ++d)
        {
            std::printf("%s[", d ? "," : "");
            for (int lv = -60; lv <= 0; lv += 3)
            {
                MintyEngine e = makeEngine(static_cast<float>(s) / 10.0f, static_cast<float>(d) / 20.0f, 0.5f,
                                           Character::kStable, false);
                const size_t n = kFs * 2;
                std::vector<float> l(n), r(n);
                const float amp = minty::dbToLin(static_cast<float>(lv) + 3.0103f); // RMS -> peak
                for (size_t i = 0; i < n; ++i)
                {
                    l[i] = r[i] = amp * std::sin(2.0f * minty::kPi * 1000.0f * static_cast<float>(i) / kFs);
                }
                double meter = 0.0;
                int meterN = 0;
                for (size_t i = 0; i < n; i += kBlock)
                {
                    e.process(&l[i], &r[i], kBlock);
                    if (i >= n - kFs / 4)
                    {
                        meter += static_cast<double>(e.meterDb());
                        ++meterN;
                    }
                }
                std::printf("%s%.2f", lv == -60 ? "" : ",", rmsDb(l, n - kFs / 4, n));
                meters.push_back(meter / meterN);
            }
            std::printf("]");
        }
        std::printf("]");
    }
    std::printf("],\"meter\":[");
    size_t k = 0;
    for (int s = 0; s <= 10; ++s)
    {
        std::printf("%s[", s ? "," : "");
        for (int d = 0; d <= 20; ++d)
        {
            std::printf("%s[", d ? "," : "");
            for (int lv = -60; lv <= 0; lv += 3)
            {
                std::printf("%s%.2f", lv == -60 ? "" : ",", meters[k++]);
            }
            std::printf("]");
        }
        std::printf("]");
    }
    std::printf("]}");
}

// --- the dynamic EQ ----------------------------------------------------------
// Magnitude response of Minty's own DynamicEq at each knob position, with the
// shift settled at none, half and full (playing well under, at, and well over
// the threshold). The shift is driven the way the engine drives it, through
// trackDynamics(), then an impulse goes through process().
void eqResponse()
{
    const int kFreqs = 72;
    std::printf(",\"eq\":{\"knob\":[");
    for (int q = 0; q <= 40; ++q) std::printf("%s%.3f", q ? "," : "", q / 40.0);
    std::printf("],\"shift\":[\"under\",\"at\",\"over\"],\"hz\":[");
    std::vector<double> hz;
    for (int f = 0; f < kFreqs; ++f)
    {
        hz.push_back(20.0 * std::pow(1000.0, static_cast<double>(f) / (kFreqs - 1))); // 20 Hz .. 20 kHz
        std::printf("%s%.1f", f ? "," : "", hz.back());
    }
    std::printf("],\"db\":[");
    const float thr = -24.0f;
    const float levels[3] = { thr - 30.0f, thr, thr + 30.0f };
    for (int q = 0; q <= 40; ++q)
    {
        std::printf("%s[", q ? "," : "");
        for (int sh = 0; sh < 3; ++sh)
        {
            minty::DynamicEq eq;
            eq.reset();
            eq.setKnob(static_cast<float>(q) / 40.0f);
            for (int i = 0; i < kFs * 4; ++i) eq.trackDynamics(levels[sh], thr);
            eq.updateCoefficients();
            const int n = 16384;
            std::vector<float> h(n);
            for (int i = 0; i < n; ++i)
            {
                float l = i == 0 ? 1.0f : 0.0f, r = l;
                eq.process(l, r);
                h[static_cast<size_t>(i)] = l;
            }
            std::printf("%s[", sh ? "," : "");
            for (int f = 0; f < kFreqs; ++f)
            {
                double re = 0.0, im = 0.0;
                const double w = 2.0 * 3.14159265358979 * hz[static_cast<size_t>(f)] / kFs;
                for (int i = 0; i < n; ++i)
                {
                    re += static_cast<double>(h[static_cast<size_t>(i)]) * std::cos(w * i);
                    im -= static_cast<double>(h[static_cast<size_t>(i)]) * std::sin(w * i);
                }
                std::printf("%s%.2f", f ? "," : "", 10.0 * std::log10(re * re + im * im + 1e-20));
            }
            std::printf("]");
        }
        std::printf("]");
    }
    std::printf("]}");
}

// --- characters --------------------------------------------------------------
// The gain reduction the meter reports while a 220 Hz tone jumps from -40 to
// -6 dBFS and back, the bench's own step test stretched to show the release.
void characters()
{
    const char* names[3] = { "stable", "wobble", "twitchy" };
    const Character cs[3] = { Character::kStable, Character::kWobble, Character::kTwitchy };
    const double t0 = 0.4, t1 = 2.4, hop = 0.004; // seconds; 4 ms between points
    std::printf(",\"characters\":{\"dyn\":0.4,\"sens\":0.5,\"loudFrom\":0.5,\"loudTo\":1.5,\"t0\":%.3f,\"hop\":%.3f", t0, hop);
    for (int c = 0; c < 3; ++c)
    {
        MintyEngine e = makeEngine(0.5f, 0.4f, 0.5f, cs[c], false);
        const size_t n = static_cast<size_t>(kFs * 2.5);
        std::vector<float> l(n), r(n);
        std::printf(",\"%s\":[", names[c]);
        bool first = true;
        double nextT = t0;
        for (size_t i = 0; i < n; i += kBlock)
        {
            for (size_t k = i; k < i + kBlock && k < n; ++k)
            {
                const double t = static_cast<double>(k) / kFs;
                const float amp = (t >= 0.5 && t < 1.5) ? 0.5f : 0.01f;
                l[k] = r[k] = amp * std::sin(2.0f * minty::kPi * 220.0f * static_cast<float>(k) / kFs);
            }
            e.process(&l[i], &r[i], kBlock);
            const double t = static_cast<double>(i + kBlock) / kFs;
            if (t >= nextT && t <= t1 + 1e-9)
            {
                std::printf("%s%.2f", first ? "" : ",", static_cast<double>(e.meterDb()));
                first = false;
                nextT += hop;
            }
        }
        std::printf("]");
    }
    std::printf("}");
}

// --- swell -------------------------------------------------------------------
// Output against input envelope with the swell on, compression off (DYNAMICS
// 0 means 1:1 and no make-up), so what you see is the swell alone: a run of
// sixteenth notes, a rest, a held note, silence.
void swell()
{
    MintyEngine e = makeEngine(0.5f, 0.0f, 0.5f, Character::kStable, true);
    const double dur = 4.2, hop = 0.005;
    const size_t n = static_cast<size_t>(kFs * dur);
    std::vector<float> in(n), l(n), r(n);
    for (size_t k = 0; k < n; ++k)
    {
        const double t = static_cast<double>(k) / kFs;
        float env = 0.0f;
        if (t >= 0.2 && t < 2.2)
        {
            // Sixteenths at 120 BPM, each with a 3 ms attack like the bench's
            // synth phrase. An instant onset would ring Minty's EQ filters and
            // show as overshoot that has nothing to do with the swell.
            const double ph = std::fmod(t - 0.2, 0.125);
            env = ph < 0.1 ? static_cast<float>(std::fmin(ph / 0.003, 1.0) * std::exp(-ph * 12.0)) : 0.0f;
        }
        else if (t >= 2.8 && t < 3.8)
        {
            env = static_cast<float>(std::fmin((t - 2.8) / 0.003, 1.0));
        }
        in[k] = 0.5f * env * std::sin(2.0f * minty::kPi * 330.0f * static_cast<float>(k) / kFs);
        l[k] = r[k] = in[k];
    }
    for (size_t i = 0; i < n; i += kBlock)
    {
        e.process(&l[i], &r[i], static_cast<int>(n - i < kBlock ? n - i : kBlock));
    }
    // The engine delays the audio by its 1.5 ms lookahead; line the input up.
    const size_t look = 72;
    std::printf(",\"swell\":{\"hop\":%.3f,\"in\":[", hop);
    const size_t step = static_cast<size_t>(hop * kFs);
    for (size_t i = 0; i + step <= n; i += step)
    {
        float p = 0.0f;
        for (size_t k = i; k < i + step; ++k) p = std::fabs(in[k]) > p ? std::fabs(in[k]) : p;
        std::printf("%s%.3f", i ? "," : "", static_cast<double>(p));
    }
    std::printf("],\"out\":[");
    for (size_t i = 0; i + step <= n; i += step)
    {
        float p = 0.0f;
        for (size_t k = i + look; k < i + step + look && k < n; ++k) p = std::fabs(l[k]) > p ? std::fabs(l[k]) : p;
        std::printf("%s%.3f", i ? "," : "", static_cast<double>(p));
    }
    std::printf("]}");
}
} // namespace

int main()
{
#ifdef MINTY_PROFILE_GUITAR
    const char* profile = "guitar";
#else
    const char* profile = "synth";
#endif
    std::printf("{\"profile\":\"%s\",\"thresholdAtMinDb\":%.1f,\"thresholdAtMaxDb\":%.1f,\"gateDb\":%.1f,"
                "\"detectorHz\":%.1f,\"swellRetrigger\":%s,",
                profile, static_cast<double>(minty::kProfile.thresholdAtMinDb),
                static_cast<double>(minty::kProfile.thresholdAtMaxDb),
                static_cast<double>(minty::kProfile.gateThresholdDb),
                static_cast<double>(minty::kProfile.detectorHighpassHz),
                minty::kProfile.swellRetrigger ? "true" : "false");
    curves();
    eqResponse();
    characters();
    swell();
    std::printf("}\n");
    return 0;
}
