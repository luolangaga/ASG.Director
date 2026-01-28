
import os
import re

base_dir = r"c:\Users\luolan\ASG\ASG.Director\pages"
html_path = os.path.join(base_dir, "local-bp.html")
css_dir = os.path.join(base_dir, "css")
js_dir = os.path.join(base_dir, "js")

if not os.path.exists(css_dir):
    os.makedirs(css_dir)
if not os.path.exists(js_dir):
    os.makedirs(js_dir)

with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Extract CSS
style_pattern = re.compile(r'<style>(.*?)</style>', re.DOTALL)
match_css = style_pattern.search(content)
if match_css:
    css_content = match_css.group(1).strip()
    with open(os.path.join(css_dir, "local-bp.css"), 'w', encoding='utf-8') as f:
        f.write(css_content)
    print("CSS extracted.")
    
    # Replace in HTML
    content = content.replace(match_css.group(0), '<link rel="stylesheet" href="./css/local-bp.css">')

# 2. Extract Scripts
# Find all script tags
# Use a regex that captures attributes and content
script_pattern = re.compile(r'<script([^>]*)>(.*?)</script>', re.DOTALL)

matches = list(script_pattern.finditer(content))

# Determine which script is the main inline logic
# It should be large and not have 'src=' in attributes
inline_script_match = None

for m in matches:
    attrs = m.group(1)
    script_content = m.group(2)
    if 'src=' not in attrs and len(script_content) > 1000:
        inline_script_match = m
        break

if inline_script_match:
    js_content = inline_script_match.group(2).strip()
    with open(os.path.join(js_dir, "local-bp-logic.js"), 'w', encoding='utf-8') as f:
        f.write(js_content)
    print("Main JS logic extracted.")
    
    # Replace in content
    # We construct new content carefully
    start, end = inline_script_match.span()
    content = content[:start] + '<script src="./js/local-bp-logic.js"></script>' + content[end:]
else:
    print("No large inline script found.")

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("local-bp.html updated.")
