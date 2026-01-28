
import os
import re

base_dir = r"c:\Users\luolan\ASG\ASG.Director\pages"
html_path = os.path.join(base_dir, "frontend.html")
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
    with open(os.path.join(css_dir, "frontend.css"), 'w', encoding='utf-8') as f:
        f.write(css_content)
    print("CSS extracted.")
    
    # Replace in HTML
    content = content.replace(match_css.group(0), '<link rel="stylesheet" href="./css/frontend.css">')

# 2. Extract Scripts
# Strategy: Find all <script> tags.
# We know:
# 1. src="./js/signalr.min.js" -> Skip
# 2. <script> ... content ... </script> -> Main Logic
# 3. <script> ... content ... </script> -> 3D Settings Inject
# 4. src="./js/frontend-onboarding.js" -> Skip

# We can use a regex to find all script blocks that do NOT have src.
script_pattern = re.compile(r'<script\s*>(.*?)</script>', re.DOTALL)
# However, <script> might have spaces.
# Use finding all matches.

matches = list(re.finditer(r'<script(?![^>]*src=)([^>]*)>(.*?)</script>', content, re.DOTALL))

if len(matches) >= 2:
    # First match is Main Logic
    main_js_content = matches[0].group(2).strip()
    # Second match is 3D Settings
    settings_js_content = matches[1].group(2).strip()
    
    with open(os.path.join(js_dir, "frontend-main.js"), 'w', encoding='utf-8') as f:
        f.write(main_js_content)
    print("Main JS extracted.")

    with open(os.path.join(js_dir, "frontend-3d-inject.js"), 'w', encoding='utf-8') as f:
        f.write(settings_js_content)
    print("3D Settings JS extracted.")

    # Replace matches in content
    # We need to replace safely. Since string length changes, we replace from last to first?
    # Or just use the original span.
    
    # Replace second script first (indices are higher)
    span2 = matches[1].span()
    content = content[:span2[0]] + '<script src="./js/frontend-3d-inject.js"></script>' + content[span2[1]:]
    
    # Re-calculate first script pos? No, the first script is before second, but we modified the string AFTER the first script, so first script index is valid?
    # Wait, if I modify content, the indices of matches[0] might change if it was *after* matches[1] (which is not true here).
    # But strictly speaking, if I replace matches[1] first, matches[0] indices are preserved because it's before.
    
    # Checking order:
    span1 = matches[0].span()
    # span1 start should be < span2 start
    if span1[0] < span2[0]:
        # Safe to use span1
        content = content[:span1[0]] + '<script src="./js/frontend-main.js"></script>' + content[span1[1]:span2[0]] + '<script src="./js/frontend-3d-inject.js"></script>' + content[span2[1]:]
        # Wait, the string slicing above is wrong because span2 indices in `content` are no longer valid after the first replacement if I did it sequentially incorrectly.
        
        # Proper way:
        # Construct new content from parts.
        
        part1 = content[:span1[0]]
        part2 = '<script src="./js/frontend-main.js"></script>'
        part3 = content[span1[1]:span2[0]]
        part4 = '<script src="./js/frontend-3d-inject.js"></script>'
        part5 = content[span2[1]:]
        
        # Actually... `content` variable was *already modified* by CSS removal?
        # Yes! `matches` finds are based on `content` *after* CSS removal?
        # NO. I ran regex on `content` *after* CSS removal.
        # So the indices are correct relative to the *current* `content`.
        
        new_content = header = content[:span1[0]] + \
                      '<script src="./js/frontend-main.js"></script>' + \
                      content[span1[1]:span2[0]] + \
                      '<script src="./js/frontend-3d-inject.js"></script>' + \
                      content[span2[1]:]
        
        content = new_content
    else:
        print("Warning: Script order unexpected.")

elif len(matches) == 1:
    # Handle case where maybe only one script exists
    print("Found only 1 inline script.")
    span = matches[0].span()
    main_js_content = matches[0].group(2).strip()
    with open(os.path.join(js_dir, "frontend-main.js"), 'w', encoding='utf-8') as f:
        f.write(main_js_content)
    
    content = content[:span[0]] + '<script src="./js/frontend-main.js"></script>' + content[span[1]:]
else:
    print("No inline scripts found to extract.")

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Frontend HTML updated.")
