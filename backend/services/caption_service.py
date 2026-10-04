"""
Caption service — generates FFmpeg drawtext filter chains for burned-in captions.
Supports multiple styles: classic, neon, minimal, bold.

Words are chunked into groups of 2 and displayed with timing based on word-level timestamps.
"""

CAPTION_WORDS_PER_CHUNK = 2

STYLES = {
    'classic': {
        'fontsize': 48, 'fontcolor': 'white',
        'borderw': 3, 'bordercolor': 'black',
        'font': 'Arial', 'shadowx': 2, 'shadowy': 2
    },
    'neon': {
        'fontsize': 52, 'fontcolor': '#00ff88',
        'borderw': 2, 'bordercolor': '#003322',
        'font': 'Arial Bold', 'shadowx': 0, 'shadowy': 0
    },
    'minimal': {
        'fontsize': 40, 'fontcolor': '#cccccc',
        'borderw': 0, 'bordercolor': 'none',
        'font': 'Arial', 'shadowx': 1, 'shadowy': 1
    },
    'bold': {
        'fontsize': 60, 'fontcolor': 'yellow',
        'borderw': 4, 'bordercolor': 'black',
        'font': 'Impact', 'shadowx': 3, 'shadowy': 3
    },
}


def escape_drawtext_text(text: str) -> str:
    """Escape text for use inside a quoted drawtext value.

    Drawtext has two escaping levels:
    - filtergraph/option level: \\ ' : , must be backslash-escaped (even inside quotes)
    - text expansion level (expansion=normal, the default): % is the expansion
      escape char, so a literal % must be doubled to %%
    """
    text = text.replace('\\', '\\\\')
    text = text.replace("'", "\\'")
    text = text.replace(':', '\\:')
    text = text.replace(',', '\\,')
    text = text.replace('%', '%%')
    return text


def build_drawtext_filters(words: list, style_name: str = 'classic', clip_start: float = 0) -> list:
    """
    Build FFmpeg drawtext filter strings for word-by-word captions.

    Args:
        words: List of {text, start, end} dicts (absolute timestamps)
        style_name: Caption style preset name
        clip_start: The start time of the clip (to offset timestamps)

    Returns:
        List of drawtext filter strings
    """
    style = STYLES.get(style_name, STYLES['classic'])
    filters = []

    for i in range(0, len(words), CAPTION_WORDS_PER_CHUNK):
        chunk = words[i:i + CAPTION_WORDS_PER_CHUNK]
        text = escape_drawtext_text(' '.join(w['text'] for w in chunk))

        start = chunk[0]['start'] - clip_start
        end = chunk[-1]['end'] - clip_start

        f = (
            f"drawtext=text='{text}'"
            f":fontsize={style['fontsize']}"
            f":fontcolor={style['fontcolor']}"
            f":borderw={style['borderw']}"
            f":bordercolor={style['bordercolor']}"
            f":x=(w-text_w)/2:y=h-h/4"
            f":enable='between(t,{start:.2f},{end:.2f})'"
        )
        filters.append(f)

    return filters
