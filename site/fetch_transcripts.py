"""
Local lecture-video transcription pipeline.

Downloads audio from the professor's own YouTube "every lecture" playlist
(found in Course content/ExternalLinks.txt) and transcribes it locally with
faster-whisper. Deliberately kept separate from generate.py -- this is a
slow, occasional, non-idempotent-cost task, not something that should run on
every site rebuild. Everything it writes lands under Course content/, which
is fully .gitignore'd, so none of it is ever committed or pushed.

Usage:
  python site/fetch_transcripts.py --list      # list playlist videos only
  python site/fetch_transcripts.py             # download + transcribe all
  python site/fetch_transcripts.py L10         # just one lecture code
"""
import os

# Must be set before ctranslate2 (pulled in by faster_whisper) loads its
# OpenMP runtime, which otherwise conflicts with the Anaconda base env's
# MKL/numpy OpenMP runtime (OMP Error #15) and crashes the process.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import subprocess
import sys
import time
from pathlib import Path

SITE_DIR = Path(__file__).resolve().parent
BASE_DIR = SITE_DIR.parent
COURSE_ROOT = BASE_DIR / "Course content"
AUDIO_DIR = COURSE_ROOT / "lecture-audio"
TRANSCRIPT_DIR = COURSE_ROOT / "transcripts"

PLAYLIST_URL = "https://www.youtube.com/playlist?list=PLCNA7a1ujLbHHK09mAfEiEwX7VmgwRNCY"

# ffmpeg was installed into its own isolated conda env (ffmpegenv) rather than
# the shared base env, to avoid dragging the base env's old-pinned
# numpy/pandas/scipy into a slow, memory-heavy solve. Point yt-dlp at it
# directly instead of relying on PATH.
FFMPEG_LOCATION = Path("C:/Users/batte/anaconda3/envs/ffmpegenv/Library/bin")

# The pip index available in this environment is frozen at yt-dlp 2024.10.22,
# which is too old to extract current YouTube signatures (nsig extraction
# fails). Using the latest standalone binary from yt-dlp's GitHub releases
# instead of the pip-installed module.
YT_DLP_BIN = str(SITE_DIR.parent / "tools" / "yt-dlp.exe")

# Cool-down between audio jobs (download+transcribe of one video part) so the
# CPU isn't pegged back-to-back for hours and YouTube doesn't see a rapid-fire
# stream of requests. Per user request.
REST_BETWEEN_PARTS_SECONDS = 20
REST_BETWEEN_LECTURES_SECONDS = 60

# Mapped by hand against the site's lecture codes (see GUIDE_CODE_MAP in
# generate.py for the same kind of topic-based mapping done for the study
# guide) -- the playlist's own "Lecture N" numbering doesn't line up with
# the site's L-codes past L5 (raw class-day recordings don't slice the same
# way the slide decks do). Confirmed with the user 2026-07-31. Some lectures
# have multiple video parts, transcribed separately then concatenated.
# L17 and the two addendum decks (naledi, floresiensis) have no matching
# video -- newer material, not yet recorded/uploaded.
VIDEO_SLUG_MAP = {
    "L1": ["EIzgKnFNdq4"],
    "L2": ["8YPW1Jegfvk"],
    "L3": ["pSyZ9TL55u4"],
    "L4": ["4yjmBS7C4DU"],
    "L5": ["kr-SskmxiyQ"],
    "L6": ["HS_EC6JLi9g"],
    "L7": ["3WeqoeCsyqc", "Mo1qOH4HgDc"],
    "L8": ["IyVQSGkYy_g", "94Mtj7R9CH0"],
    "L9.1": ["-xF2CVyqX9Y"],
    "L9.2": ["b7w7-OSyxlo"],
    "L10": ["ctBoOVsjMIo", "fLN8TOjKaLM", "BH8tyKK--Cs"],
    "L11": ["jKV6nqhDp2Q", "uX7AmIog8Ys"],
    "L12": ["r4xfWNivES8"],
    "L13": ["7H4jwTPXAHw", "yVCBfbFxO6Y"],
    "L14": ["T2gpo291Qh4", "IqAFv-r79Lw"],
    "L15.1": ["xkSKz_RYHUw"],
    "L16.1": ["e79QbQHKYIE", "bCv5JsMdO3w"],
}


def list_playlist():
    subprocess.run(
        [YT_DLP_BIN, "--flat-playlist", "--dump-json", PLAYLIST_URL],
        check=True,
    )


def download_audio(video_id, out_path):
    if out_path.exists():
        return True
    out_path.parent.mkdir(parents=True, exist_ok=True)
    url = f"https://www.youtube.com/watch?v={video_id}"
    result = subprocess.run(
        [
            YT_DLP_BIN,
            "-x", "--audio-format", "mp3",
            "--ffmpeg-location", str(FFMPEG_LOCATION),
            "-o", str(out_path.with_suffix("")) + ".%(ext)s",
            url,
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"  WARNING: download failed for {video_id}: {result.stderr[-500:]}")
        return False
    return True


def format_srt_timestamp(seconds):
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def transcribe(model, mp3_path, time_offset=0.0):
    """Returns (paragraphs: list[str], srt_entries: list[(start, end, text)])."""
    segments, _info = model.transcribe(str(mp3_path), beam_size=5)
    paragraphs = []
    srt_entries = []
    for seg in segments:
        text = seg.text.strip()
        if not text:
            continue
        paragraphs.append(text)
        srt_entries.append((seg.start + time_offset, seg.end + time_offset, text))
    return paragraphs, srt_entries


def write_srt(entries, path):
    lines = []
    for i, (start, end, text) in enumerate(entries, 1):
        lines.append(str(i))
        lines.append(f"{format_srt_timestamp(start)} --> {format_srt_timestamp(end)}")
        lines.append(text)
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def process_lecture(model, code, video_ids):
    slug = code.replace(".", "_")
    txt_path = TRANSCRIPT_DIR / f"{slug}.txt"
    srt_path = TRANSCRIPT_DIR / f"{slug}.srt"
    if txt_path.exists() and srt_path.exists():
        print(f"{code}: already transcribed, skipping")
        return "skipped"

    TRANSCRIPT_DIR.mkdir(parents=True, exist_ok=True)
    all_paragraphs = []
    all_srt_entries = []
    time_offset = 0.0

    for part_num, video_id in enumerate(video_ids, 1):
        part_label = f"{slug}_pt{part_num}" if len(video_ids) > 1 else slug
        mp3_path = AUDIO_DIR / f"{part_label}.mp3"
        print(f"{code}: downloading part {part_num}/{len(video_ids)} ({video_id})...")
        if not download_audio(video_id, mp3_path):
            return "failed"

        print(f"{code}: transcribing part {part_num}/{len(video_ids)} (this takes a while)...")
        paragraphs, srt_entries = transcribe(model, mp3_path, time_offset)
        all_paragraphs.extend(paragraphs)
        all_srt_entries.extend(srt_entries)
        if srt_entries:
            time_offset = srt_entries[-1][1]

        if part_num < len(video_ids):
            print(f"{code}: resting {REST_BETWEEN_PARTS_SECONDS}s before next part...")
            time.sleep(REST_BETWEEN_PARTS_SECONDS)

    txt_path.write_text("\n\n".join(all_paragraphs), encoding="utf-8")
    write_srt(all_srt_entries, srt_path)
    print(f"{code}: done -- {txt_path.name}, {srt_path.name}")
    return "done"


def main():
    args = sys.argv[1:]
    if "--list" in args:
        list_playlist()
        return

    only_code = args[0] if args else None
    items = VIDEO_SLUG_MAP.items()
    if only_code:
        if only_code not in VIDEO_SLUG_MAP:
            print(f"Unknown lecture code: {only_code}")
            sys.exit(1)
        items = [(only_code, VIDEO_SLUG_MAP[only_code])]

    from faster_whisper import WhisperModel
    print("Loading Whisper model (medium)...")
    model = WhisperModel("medium", device="cpu", compute_type="int8")

    items = list(items)
    results = {"done": 0, "skipped": 0, "failed": 0}
    for i, (code, video_ids) in enumerate(items):
        outcome = process_lecture(model, code, video_ids)
        results[outcome] += 1
        if outcome != "skipped" and i < len(items) - 1:
            print(f"Resting {REST_BETWEEN_LECTURES_SECONDS}s before next lecture...")
            time.sleep(REST_BETWEEN_LECTURES_SECONDS)

    print(f"\nSummary: {results['done']} transcribed, {results['skipped']} skipped "
          f"(already done), {results['failed']} failed")


if __name__ == "__main__":
    main()
