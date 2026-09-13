#!/usr/bin/env bash
# Generates audio test fixtures into e2e/fixtures/. Idempotent: skips existing files.
set -euo pipefail

command -v ffmpeg >/dev/null || { echo "ffmpeg required: brew install ffmpeg" >&2; exit 1; }

cd "$(dirname "$0")"
mkdir -p fixtures
cd fixtures

# gen <outfile> <ffmpeg args...>
gen() {
	local out="$1"
	shift
	[ -f "$out" ] || ffmpeg -loglevel error -y "$@" "$out"
}

gen sine440-wav16-44k-stereo-5s.wav   -f lavfi -i "sine=frequency=440:duration=5"  -ac 2 -ar 44100 -c:a pcm_s16le
gen sine440-wav16-44k-mono-0.5s.wav   -f lavfi -i "sine=frequency=440:duration=0.5" -ac 1 -ar 44100 -c:a pcm_s16le
gen sine3k-wav24-48k-stereo-5s.wav    -f lavfi -i "sine=frequency=3000:duration=5" -ac 2 -ar 48000 -c:a pcm_s24le
gen sine80-wav32f-96k-stereo-5s.wav   -f lavfi -i "sine=frequency=80:duration=5"   -ac 2 -ar 96000 -c:a pcm_f32le
gen pinknoise-wav16-44k-stereo-5s.wav -f lavfi -i "anoisesrc=color=pink:duration=5" -ac 2 -ar 44100 -c:a pcm_s16le
gen whitenoise-wav16-48k-mono-5s.wav  -f lavfi -i "anoisesrc=color=white:duration=5" -ac 1 -ar 48000 -c:a pcm_s16le
gen silence-wav16-44k-stereo-5s.wav   -f lavfi -i "anullsrc=r=44100:cl=stereo" -t 5 -c:a pcm_s16le
gen sweep-wav16-48k-stereo-5s.wav     -f lavfi -i "aevalsrc='sin(2*PI*(20*t+((2000-20)/(2*5))*t*t))':d=5:s=48000" -ac 2 -c:a pcm_s16le
# Right channel at half amplitude: a known +6.02 dB lean to the left, for the balance view.
gen lopsided-wav16-44k-stereo-5s.wav  -f lavfi -i "anoisesrc=color=pink:duration=5" -af "pan=stereo|c0=c0|c1=0.5*c0" -ar 44100 -c:a pcm_s16le

gen sine440-flac-44k-stereo-5s.flac   -f lavfi -i "sine=frequency=440:duration=5" -ac 2 -ar 44100 -c:a flac
gen sine440-flac-96k-stereo-5s.flac   -f lavfi -i "sine=frequency=440:duration=5" -ac 2 -ar 96000 -c:a flac
gen sine440-mp3-44k-stereo-5s.mp3     -f lavfi -i "sine=frequency=440:duration=5" -ac 2 -ar 44100 -c:a libmp3lame -b:a 192k
gen sine440-ogg-44k-stereo-5s.ogg     -f lavfi -i "sine=frequency=440:duration=5" -ac 2 -ar 44100 -c:a vorbis -strict experimental
gen sine440-opus-48k-stereo-5s.opus   -f lavfi -i "sine=frequency=440:duration=5" -ac 2 -ar 48000 -c:a libopus
gen sine440-m4a-44k-stereo-5s.m4a     -f lavfi -i "sine=frequency=440:duration=5" -ac 2 -ar 44100 -c:a aac -b:a 192k
gen sine440-aiff-44k-stereo-5s.aiff   -f lavfi -i "sine=frequency=440:duration=5" -ac 2 -ar 44100 -c:a pcm_s16be

gen pinknoise-mp3-44k-mono-5s.mp3     -f lavfi -i "anoisesrc=color=pink:duration=5" -ac 1 -ar 44100 -c:a libmp3lame -b:a 128k
gen pinknoise-wav16-44k-stereo-60s.wav -f lavfi -i "anoisesrc=color=pink:duration=60" -ac 2 -ar 44100 -c:a pcm_s16le
gen sine440-tagged-5s.mp3             -f lavfi -i "sine=frequency=440:duration=5" -ac 2 -ar 44100 -c:a libmp3lame -b:a 192k \
	-metadata title="Test Song" -metadata artist="Test Artist" -metadata album="Test Album"

[ -f "Fallback Artist - Fallback Song.wav" ] || cp sine440-wav16-44k-stereo-5s.wav "Fallback Artist - Fallback Song.wav"
[ -f corrupt.wav ] || head -c 4096 /dev/urandom > corrupt.wav
[ -f notaudio.txt ] || echo "this is not audio" > notaudio.txt

echo "fixtures ready: $(ls | wc -l | tr -d ' ') files"
