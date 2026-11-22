"""Inline css + all <script src="js/..."> files of index.html into one self-contained HTML file.
Usage: python3 tools/build_single.py [output.html]   (run from the project root)"""
import re, sys
root = '.'
html = open(root + '/index.html', encoding='utf-8').read()
css = open(root + '/css/style.css', encoding='utf-8').read()
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '</style>')
def inline(m):
    return '<script>\n' + open(root + '/' + m.group(1), encoding='utf-8').read() + '</script>'
html = re.sub(r'<script src="(js/[^"]+)"></script>', inline, html)
out = sys.argv[1] if len(sys.argv) > 1 else 'puppet_tag_single.html'
open(out, 'w', encoding='utf-8').write(html)
print('wrote', out, len(html), 'bytes')
