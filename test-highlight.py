import re
from html.parser import HTMLParser

class MyHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.current_data = []
        self.paragraphs = []
        
    def handle_starttag(self, tag, attrs):
        self.tags.append(tag)
        self.current_data = []

    def handle_endtag(self, tag):
        popped = self.tags.pop()
        text = "".join(self.current_data).strip()
        if tag in ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div'] and text:
            self.paragraphs.append(text)
            
    def handle_data(self, data):
        self.current_data.append(data)

parser = MyHTMLParser()
with open('public/10_Chapter2T7494hiseBookislicensedtoFrankaSimovicfsimov.xhtml', 'r') as f:
    parser.feed(f.read())

for i, p in enumerate(parser.paragraphs[:15]):
    print(f"[{i}] {p}")
