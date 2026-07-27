const ERLAUBTE_TAGS = new Set([
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'SPAN',
  'DIV',
  'P',
  'BR',
])

const KOMPLETT_ENTFERNEN = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'SVG',
  'MATH',
  'FORM',
  'INPUT',
  'BUTTON',
  'TEXTAREA',
  'SELECT',
  'OPTION',
])

export function enthaeltRichTextHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''))
}

function textHtmlSicher(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function textZuRichTextHtml(value) {
  return textHtmlSicher(value).replace(/\r?\n/g, '<br>')
}

function farbeBereinigen(value) {
  const farbe = String(value || '').trim()
  if (!farbe || farbe.length > 80) return ''
  if (/^#[0-9a-f]{3,8}$/i.test(farbe)) return farbe
  if (/^rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?(?:\s*,\s*[\d.]+%?)?\s*\)$/i.test(farbe)) return farbe
  if (/^hsla?\(\s*[\d.]+(?:deg|grad|rad|turn)?\s*,\s*[\d.]+%\s*,\s*[\d.]+%(?:\s*,\s*[\d.]+%?)?\s*\)$/i.test(farbe)) return farbe
  return ''
}

function elementBereinigen(element, dokument) {
  const tag = element.tagName.toUpperCase()

  if (KOMPLETT_ENTFERNEN.has(tag)) {
    element.remove()
    return
  }

  if (tag === 'FONT') {
    const span = dokument.createElement('span')
    const farbe = farbeBereinigen(element.getAttribute('color'))
    if (farbe) span.style.color = farbe
    while (element.firstChild) span.appendChild(element.firstChild)
    element.replaceWith(span)
    elementBereinigen(span, dokument)
    return
  }

  if (!ERLAUBTE_TAGS.has(tag)) {
    const fragment = dokument.createDocumentFragment()
    while (element.firstChild) fragment.appendChild(element.firstChild)
    element.replaceWith(fragment)
    return
  }

  const farbe = tag === 'SPAN'
    ? farbeBereinigen(element.style.color || element.getAttribute('color'))
    : ''
  const schriftGewicht = tag === 'SPAN' ? String(element.style.fontWeight || '').toLowerCase() : ''
  const istFett = schriftGewicht === 'bold' || Number(schriftGewicht) >= 600
  const istKursiv = tag === 'SPAN' && String(element.style.fontStyle || '').toLowerCase() === 'italic'
  const istUnterstrichen = tag === 'SPAN'
    && String(element.style.textDecorationLine || element.style.textDecoration || '').toLowerCase().includes('underline')

  for (const attribut of [...element.attributes]) {
    element.removeAttribute(attribut.name)
  }

  if (tag === 'SPAN') {
    if (farbe) element.style.color = farbe
    if (istFett) element.style.fontWeight = 'bold'
    if (istKursiv) element.style.fontStyle = 'italic'
    if (istUnterstrichen) element.style.textDecoration = 'underline'
  }
}

export function sanitizeRichText(value) {
  const rohwert = String(value || '')
  if (!rohwert) return ''
  if (!enthaeltRichTextHtml(rohwert)) return rohwert
  if (typeof DOMParser === 'undefined') return rohwert.replace(/<[^>]*>/g, '')

  const dokument = new DOMParser().parseFromString(rohwert, 'text/html')
  const walker = dokument.createTreeWalker(
    dokument.body,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
  )
  const knoten = []
  while (walker.nextNode()) knoten.push(walker.currentNode)

  for (const knotenElement of knoten.reverse()) {
    if (knotenElement.nodeType === Node.COMMENT_NODE) knotenElement.remove()
    else elementBereinigen(knotenElement, dokument)
  }

  return dokument.body.innerHTML.trim()
}

export function richTextToPlainText(value) {
  const rohwert = String(value || '')
  if (!rohwert) return ''
  if (!enthaeltRichTextHtml(rohwert)) return rohwert
  if (typeof DOMParser === 'undefined') return rohwert.replace(/<[^>]*>/g, ' ')

  const dokument = new DOMParser().parseFromString(sanitizeRichText(rohwert), 'text/html')
  dokument.body.querySelectorAll('br').forEach((element) => element.replaceWith('\n'))
  dokument.body.querySelectorAll('p, div').forEach((element) => element.append('\n'))
  return (dokument.body.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function cleanRichTextForStorage(value) {
  const bereinigt = sanitizeRichText(value)
  if (!enthaeltRichTextHtml(bereinigt)) return bereinigt.trim()
  return richTextToPlainText(bereinigt) ? bereinigt : ''
}
