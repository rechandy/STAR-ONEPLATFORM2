#!/usr/bin/env python3
"""
Generate the STAR OnePlatform demo voiceover as a single .mp3 for a Loom overlay.

Reads the narration straight from docs/demo/loom-demo-script.md (the voiceover
column is the single source of truth), synthesizes each scene with a deep
baritone voice via the ElevenLabs API, and stitches one timeline-aligned master
track (each scene begins at its script timestamp where the pacing allows) plus
per-scene clips.

--------------------------------------------------------------------------------
Setup
  pip install elevenlabs pydub          # pydub also needs ffmpeg on PATH
  export ELEVENLABS_API_KEY=sk_...      # (Windows: set ELEVENLABS_API_KEY=...)
  # optional: pick a deep/baritone voice from YOUR library:
  export ELEVENLABS_VOICE_ID=<voice_id>

Usage
  python generate_narration.py --list-voices      # discover voice IDs (deepest = baritone)
  python generate_narration.py --dry-run          # parse + show segments, no API calls
  python generate_narration.py                    # full render -> output/narration_full.mp3

Notes
  * Default voice is "Adam" (pNInz6obpgDQGcFmaJgB), a deep ElevenLabs narrator.
    For a James-Earl-Jones register, audition "Adam", "Daniel", or "George"
    via --list-voices and set ELEVENLABS_VOICE_ID to the deepest you like.
  * High stability + speaker boost give the slow, authoritative read; tune below.
  * No ffmpeg? The script falls back to plain MP3 concatenation (no silence
    padding / timeline alignment) and still produces a usable single file.
  * Alternative engines (Azure "en-US-DavisNeural", OpenAI tts-1 "onyx",
    Coqui TTS) can be dropped into synth_segment() — the rest is engine-agnostic.
"""
from __future__ import annotations

import argparse
import io
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_SCRIPT = HERE / "loom-demo-script.md"
DEFAULT_OUT = HERE / "output"

DEFAULT_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "pNInz6obpgDQGcFmaJgB")  # "Adam" (deep)
DEFAULT_MODEL = os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2")
OUTPUT_FORMAT = "mp3_44100_128"

# Voice settings tuned for a measured, authoritative baritone read.
VOICE_SETTINGS = {
    "stability": 0.55,        # higher = steadier, less expressive wobble
    "similarity_boost": 0.80,
    "style": 0.15,            # a touch of gravitas; keep low for control
    "use_speaker_boost": True,
}

TIME_RE = re.compile(r"(\d+):(\d{2})")


# --------------------------------------------------------------------------- #
# Parse the narration out of the markdown script (voiceover column).
# --------------------------------------------------------------------------- #
def parse_script(path: Path) -> list[dict]:
    segments: list[dict] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 3:
            continue
        m = TIME_RE.search(cells[0])          # col 0 must be a time range, e.g. **2:20–3:20**
        if not m:
            continue
        start = int(m.group(1)) * 60 + int(m.group(2))
        text = cells[2].strip().strip('"').strip().strip('"').strip()
        if not text:
            continue
        segments.append(
            {"index": len(segments) + 1, "start": start, "label": cells[0].replace("*", ""), "text": text}
        )
    return segments


def fmt_ts(seconds: float) -> str:
    m, s = divmod(int(round(seconds)), 60)
    return f"{m}:{s:02d}"


# --------------------------------------------------------------------------- #
# ElevenLabs synthesis (lazy import so --dry-run / --list-voices work without it).
# --------------------------------------------------------------------------- #
def make_client():
    try:
        from elevenlabs.client import ElevenLabs
    except ImportError:
        sys.exit("ERROR: pip install elevenlabs")
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("ERROR: set ELEVENLABS_API_KEY")
    return ElevenLabs(api_key=key)


def list_voices() -> None:
    client = make_client()
    voices = client.voices.get_all().voices
    print(f"{'voice_id':<24}  {'name':<16}  labels")
    print("-" * 72)
    for v in voices:
        labels = ", ".join(f"{k}={val}" for k, val in (v.labels or {}).items())
        print(f"{v.voice_id:<24}  {(v.name or ''):<16}  {labels}")


def synth_segment(client, text: str, voice_id: str, model: str) -> bytes:
    from elevenlabs import VoiceSettings
    audio = client.text_to_speech.convert(
        voice_id=voice_id,
        model_id=model,
        text=text,
        output_format=OUTPUT_FORMAT,
        voice_settings=VoiceSettings(**VOICE_SETTINGS),
    )
    return b"".join(audio)  # convert() yields a stream of bytes chunks


# --------------------------------------------------------------------------- #
# Stitch the unified track.
# --------------------------------------------------------------------------- #
def build_unified(clips: list[bytes], starts: list[int], out_path: Path, gap_ms: int, align: bool) -> None:
    """Prefer pydub (clean joins + timeline alignment); fall back to byte concat."""
    try:
        from pydub import AudioSegment
    except Exception:
        print("  (pydub/ffmpeg unavailable -> plain concatenation, no timeline alignment)")
        with open(out_path, "wb") as f:
            for i, clip in enumerate(clips):
                f.write(clip)
        return

    master = AudioSegment.empty()
    report = []
    for i, clip in enumerate(clips):
        seg = AudioSegment.from_file(io.BytesIO(clip), format="mp3")
        target_ms = starts[i] * 1000
        if align and target_ms > len(master):
            master += AudioSegment.silent(duration=target_ms - len(master))
        elif i > 0:
            master += AudioSegment.silent(duration=gap_ms)
        actual_ms = len(master)
        master += seg
        report.append((i + 1, starts[i], actual_ms / 1000.0, len(seg) / 1000.0))

    master.export(out_path, format="mp3", bitrate="128k")

    print("\n  scene  target   actual   spoken")
    for idx, tgt, act, dur in report:
        drift = act - tgt
        flag = "  <-- overruns window" if drift > 1.5 else ""
        print(f"   {idx:>2}    {fmt_ts(tgt):>5}    {fmt_ts(act):>5}    {dur:4.1f}s{flag}")
    print(f"\n  total runtime: {fmt_ts(len(master)/1000.0)}")


# --------------------------------------------------------------------------- #
def main() -> None:
    ap = argparse.ArgumentParser(description="Render the STAR demo narration to a single MP3.")
    ap.add_argument("--script", type=Path, default=DEFAULT_SCRIPT)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--voice", default=DEFAULT_VOICE_ID, help="ElevenLabs voice_id")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--gap", type=int, default=700, help="silence between scenes (ms) when not aligning")
    ap.add_argument("--no-align", action="store_true", help="concatenate with gaps instead of timeline-aligning")
    ap.add_argument("--dry-run", action="store_true", help="parse + print segments; no API calls")
    ap.add_argument("--list-voices", action="store_true", help="print available ElevenLabs voices and exit")
    args = ap.parse_args()

    if args.list_voices:
        list_voices()
        return

    segments = parse_script(args.script)
    if not segments:
        sys.exit(f"No narration parsed from {args.script}")
    words = sum(len(s["text"].split()) for s in segments)
    print(f"Parsed {len(segments)} scenes, {words} words (~{words/150:.1f} min at 150 wpm).\n")
    for s in segments:
        preview = s["text"][:70] + ("…" if len(s["text"]) > 70 else "")
        print(f"  [{fmt_ts(s['start']):>5}] scene {s['index']:>2}: {preview}")

    if args.dry_run:
        print("\n(dry run — no audio generated)")
        return

    args.out.mkdir(parents=True, exist_ok=True)
    seg_dir = args.out / "segments"
    seg_dir.mkdir(exist_ok=True)

    client = make_client()
    print(f"\nSynthesizing with voice={args.voice} model={args.model} …")
    clips: list[bytes] = []
    for s in segments:
        print(f"  scene {s['index']:>2} [{fmt_ts(s['start'])}] …", end="", flush=True)
        data = synth_segment(client, s["text"], args.voice, args.model)
        (seg_dir / f"scene_{s['index']:02d}.mp3").write_bytes(data)
        clips.append(data)
        print(f" {len(data)//1024} KB")

    full = args.out / "narration_full.mp3"
    build_unified(clips, [s["start"] for s in segments], full, args.gap, align=not args.no_align)
    print(f"\nWrote {full}")
    print(f"Per-scene clips in {seg_dir}")


if __name__ == "__main__":
    main()
