const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('public/10_Chapter2T7494hiseBookislicensedtoFrankaSimovicfsimov.xhtml', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;

function extractParagraphs(iframeDocument) {
  const elements = Array.from(
    iframeDocument.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, div')
  ).filter(el => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'div' || tag === 'li' || tag === 'blockquote') {
      const hasBlockChild = Array.from(el.children).some(child => 
        ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'div'].includes(child.tagName.toLowerCase())
      );
      if (hasBlockChild) return false;
    }
    return true;
  });

  const paragraphs = [];
  let actualIndex = 0;
  elements.forEach((el) => {
    const text = el.textContent?.trim() ?? '';
    if (text.length > 0) {
      el.setAttribute('data-paragraph-index', String(actualIndex));
      paragraphs.push({ index: actualIndex, text });
      actualIndex++;
    }
  });
  return paragraphs;
}

const paras = extractParagraphs(document);
console.log(paras.slice(0, 15));

