"""
YouTube service — yt-dlp integration for import with copyright pre-check.

Copyright pre-check: reads video metadata (title, license, duration) via yt-dlp
and warns if the content appears to be copyright-protected (non-Creative-Commons
license or a claimed/flagged status).
"""

import subprocess
import json
import re
import os


def check_youtube_copyright(url: str) -> dict:
    """
    Inspect a YouTube URL's metadata and assess copyright risk.
    Returns { ok, isLikelyCopyrighted, title, duration, license, reason }.
    """
    cmd = ['yt-dlp', '--dump-json', '--no-warnings', url]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except FileNotFoundError:
        return {'ok': False, 'error': 'yt-dlp is not installed. Install it with: pip install yt-dlp'}

    if result.returncode != 0:
        return {'ok': False, 'error': f'yt-dlp failed: {result.stderr.strip()[:300]}'}

    try:
        info = json.loads(result.stdout)
    except json.JSONDecodeError:
        return {'ok': False, 'error': 'Could not parse video metadata'}

    license_name = (info.get('license') or '').lower()
    is_cc = 'creative commons' in license_name
    # yt-dlp does not expose Content ID claims directly; treat non-CC public videos
    # as potentially copyrighted and surface the info to the user.
    return {
        'ok': True,
        'videoId': info.get('id'),
        'title': info.get('title'),
        'duration': info.get('duration'),
        'uploader': info.get('uploader'),
        'license': info.get('license'),
        'isCreativeCommons': is_cc,
        'isLikelyCopyrighted': not is_cc,
        'reason': 'Creative Commons licensed' if is_cc else 'Standard YouTube license — you should own this content or have permission before clipping it',
    }


def download_youtube_video(url: str, output_dir: str, progress_cb=None) -> dict:
    """
    Download a YouTube video with yt-dlp into output_dir.
    Returns { ok, path, title, duration }.
    """
    os.makedirs(output_dir, exist_ok=True)
    output_template = os.path.join(output_dir, '%(id)s.%(ext)s')

    cmd = [
        'yt-dlp',
        '-f', 'bv*[height<=1080]+ba/b[height<=1080]',
        '--merge-output-format', 'mp4',
        '-o', output_template,
        '--no-playlist',
        '--newline',
        url,
    ]

    try:
        process = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, bufsize=1
        )
        final_path = None
        for line in process.stdout:
            line = line.strip()
            # Merger output line signals final merged file
            match = re.search(r'(?:Merger|Merging formats into)\s+"(.+)"', line)
            if match:
                final_path = match.group(1)
            if progress_cb:
                progress_cb(line)
        process.wait(timeout=600)

        if process.returncode != 0:
            return {'ok': False, 'error': 'yt-dlp download failed (see logs)'}

        # Resolve final path from output template if merger line not found
        if not final_path:
            probe = subprocess.run(
                ['yt-dlp', '--print', 'after_move:%(filepath)s', '--no-playlist', url],
                capture_output=True, text=True, timeout=60
            )
            candidate = probe.stdout.strip().splitlines()[0] if probe.stdout.strip() else None
            if candidate and os.path.exists(candidate):
                final_path = candidate

        if not final_path or not os.path.exists(final_path):
            return {'ok': False, 'error': 'Download completed but output file not found'}

        return {'ok': True, 'path': final_path, 'title': os.path.basename(final_path)}
    except FileNotFoundError:
        return {'ok': False, 'error': 'yt-dlp is not installed. Install it with: pip install yt-dlp'}
    except subprocess.TimeoutExpired:
        return {'ok': False, 'error': 'Download timed out'}
