"""Cut the narration's transcripts into the parts the page plays.

The narration is two recordings of the slides (ElevenLabs, Eleven v4),
public/mini-c/narration-1.mp3 and narration-2.mp3. whisper.cpp transcribes
each a word at a time:

    ffmpeg -i narration-1.mp3 -ar 16000 -ac 1 narration-1.wav
    whisper-cli -m ggml-large-v3-turbo.bin -f narration-1.wav -l en \\
      -ojf -of narration-1 -ml 1 -sow -dtw large.v3.turbo

and this script splits each transcript where each part's first words are
heard (RECORDINGS), writing public/mini-c/narration.json:

    python3 align.py ../../../../public/mini-c/narration.json \\
      narration-1.json narration-2.json

The page lines the heard words up against the slide's text as it renders
(narration.tsx), so a word the transcriber misheard ("Kali" for "callee")
still lights in its place.
"""

import json
import sys

# Each recording's parts: the id (a slide's `voice`, with `:k` for a body
# with a register count) and the words it opens with, in the order heard.
RECORDINGS = [
    (
        '/mini-c/narration-1.mp3',
        [
            ('welcome', 'This is an interactive'),
            ('background', 'Before you dive in'),
            ('tokens', 'Lexical analysis is'),
            ('grammar', 'The parser checks'),
            ('ast', 'The other key responsibility'),
            ('precedence', 'To view an interesting'),
            ('semantic', 'The parser guarantees'),
            ('names', 'When it comes to validating'),
            ('types', "Now let's take a look"),
            ('lvalues', 'This code is not meaningful'),
            ('emit', 'Now that our AST'),
            ('hardware', 'Unlike C, assembly'),
            ('infinite', 'We assume for this phase'),
            ('stack', 'Each time a function is called'),
            ('convention', 'In the code on screen'),
            ('saving', 'Back in step two'),
        ],
    ),
    (
        '/mini-c/narration-2.mp3',
        [
            ('registers', 'In Emmet, we gave'),
            ('liveness', 'The liveness ranges beside'),
            ('interference', "You'll now see these"),
            ('colouring:18', 'Fitting our virtual registers'),
            ('chaitin:18', "Chaitin's algorithm is one"),
            ('none-easy:18', 'Sometimes, every node left'),
            ('reverse:18', 'Once every node has'),
            ('spilling', 'Spills happen when'),
            ('saving-now', 'Back in omit'),
            ('precedence-problem', 'This solves interesting problems'),
            ('precedence-aside', 'And aside, my actual'),
            ('only-four:4', 'To show what happens'),
            ('colouring:4', 'Fitting our virtual registers'),
            ('chaitin:4', "Chaitin's algorithm is one"),
            ('none-easy:4', 'Sometimes, every node left'),
            ('reverse:4', 'Once every node has'),
            ('spilling-four:4', 'Spills happen when'),
        ],
    ),
]


def words(path):
    """The heard words as [text, start, end] in seconds."""
    out = []
    for seg in json.load(open(path))['transcription']:
        text = seg['text'].strip()
        if text and not text.startswith('['):
            out.append([text, seg['offsets']['from'] / 1000, seg['offsets']['to'] / 1000])
    # A word the transcriber gave no time of its own (a run starting
    # together at a window's edge) gets an even share up to the next.
    i = 0
    while i < len(out):
        j = i
        while j + 1 < len(out) and out[j + 1][1] == out[i][1]:
            j += 1
        if j > i:
            end = out[j + 1][1] if j + 1 < len(out) else out[j][2]
            step = (end - out[i][1]) / (j - i + 1)
            for k in range(i, j + 1):
                out[k][1] = out[i][1] + step * (k - i)
        i = j + 1
    return out


def key(word):
    return ''.join(c for c in word.lower() if c.isalnum())


def cut(src, transcript, opening):
    heard = words(transcript)
    keys = [key(w[0]) for w in heard]
    starts = []
    for name, first in opening:
        want = [key(w) for w in first.split()]
        after = starts[-1][1] + 1 if starts else 0
        at = next(
            (i for i in range(after, len(keys)) if keys[i : i + len(want)] == want),
            None,
        )
        if at is None:
            sys.exit(f'{name}: "{first}" is never heard in {transcript}')
        starts.append((name, at))
    parts = {}
    for n, (name, at) in enumerate(starts):
        end = starts[n + 1][1] if n + 1 < len(starts) else len(heard)
        run = heard[at:end]
        # (a part runs to where the next one's first word starts: the
        # transcriber rounds a word's end up, into that word)
        stop = heard[end][1] - 0.05 if end < len(heard) else run[-1][2] + 0.3
        parts[name] = {
            'src': src,
            'start': round(max(0, run[0][1] - 0.05), 2),
            'end': round(stop, 2),
            'words': [[w, round(t, 2)] for w, t, _ in run],
        }
    return parts


def main(dest, *transcripts):
    if len(transcripts) != len(RECORDINGS):
        sys.exit(f'one transcript for each of the {len(RECORDINGS)} recordings')
    parts = {}
    for (src, opening), transcript in zip(RECORDINGS, transcripts):
        parts.update(cut(src, transcript, opening))
    with open(dest, 'w') as f:
        json.dump({'parts': parts}, f, separators=(',', ':'))
    for name, p in parts.items():
        print(f"{name:18} {p['src'][-5]} {p['start']:7.2f}-{p['end']:7.2f}  {len(p['words'])} words")


if __name__ == '__main__':
    main(*sys.argv[1:])
