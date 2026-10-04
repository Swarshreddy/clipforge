"""
Media service — wraps FFmpeg/FFprobe for:
- Probing media metadata (duration, resolution, codecs)
- Extracting audio from video (WAV, 16kHz mono for Whisper)
- Rendering portrait clips (landscape -> 9:16 center-crop)
- Burning in captions via drawtext filter
"""

import subprocess
import json
import os


def probe_media(file_path: str) -> dict:
    """Get media file metadata using ffprobe."""
    cmd = [
        'ffprobe', '-v', 'quiet',
        '-print_format', 'json',
        '-show_format', '-show_streams',
        file_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not result.stdout.strip():
        raise FileNotFoundError(f"ffprobe failed for '{file_path}': {result.stderr.strip()[:200]}")
    data = json.loads(result.stdout)

    video_stream = None
    audio_stream = None
    for s in data.get('streams', []):
        if s.get('codec_type') == 'video' and video_stream is None:
            video_stream = s
        elif s.get('codec_type') == 'audio' and audio_stream is None:
            audio_stream = s

    duration = float(data.get('format', {}).get('duration', 0))
    width = int(video_stream.get('width', 0)) if video_stream else 0
    height = int(video_stream.get('height', 0)) if video_stream else 0

    return {
        'duration_sec': duration,
        'has_video': video_stream is not None,
        'width': width,
        'height': height,
        'video_codec': video_stream.get('codec_name', '') if video_stream else '',
        'audio_codec': audio_stream.get('codec_name', '') if audio_stream else '',
    }


def extract_audio(video_path: str, output_path: str) -> str:
    """Extract audio as 16kHz mono WAV (ideal for Whisper)."""
    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    cmd = [
        'ffmpeg', '-i', video_path,
        '-vn', '-acodec', 'pcm_s16le',
        '-ar', '16000', '-ac', '1',
        '-y', output_path
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path


def render_portrait_clip(
    source_path: str,
    output_path: str,
    start_sec: float,
    end_sec: float,
    width: int = 1080,
    height: int = 1920,
    caption_words: list = None,
    caption_style: str = 'classic'
) -> str:
    """
    Render a portrait (9:16) clip from a landscape source.
    Steps:
    1. Trim to start_sec -> end_sec
    2. Center-crop to 9:16 aspect ratio
    3. Scale to 1080x1920
    4. Burn in captions using drawtext filter chain
    5. Encode H.264 MP4
    """
    duration = end_sec - start_sec
    if duration <= 0:
        raise ValueError(f"Invalid duration: {duration}")

    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)

    # Build FFmpeg filter chain
    # Center-crop to 9:16 with an EVEN width so libx264 never sees odd dimensions
    # (trunc(ih*9/32)*2 = 2 * floor(ih * 9/16 / 2))
    vf_filters = [
        "crop=trunc(ih*9/32)*2:ih:(iw-trunc(ih*9/32)*2)/2:0",
        f"scale={width}:{height}:force_original_aspect_ratio=decrease",
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black"
    ]

    # Add caption drawtext filters if words are provided
    if caption_words:
        from backend.services.caption_service import build_drawtext_filters
        caption_filters = build_drawtext_filters(caption_words, caption_style, start_sec)
        vf_filters.extend(caption_filters)

    vf = ','.join(vf_filters)

    cmd = [
        'ffmpeg',
        '-ss', str(start_sec),
        '-i', source_path,
        '-t', str(duration),
        '-vf', vf,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        '-y', output_path
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path
