import { useEffect, useRef } from 'react'
import {
  Box,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import FormatColorTextIcon from '@mui/icons-material/FormatColorText'

import {
  enthaeltRichTextHtml,
  sanitizeRichText,
  textZuRichTextHtml,
} from '../utils/richText'

function editorHtml(value) {
  const rohwert = String(value || '')
  if (!rohwert) return ''
  return enthaeltRichTextHtml(rohwert) ? sanitizeRichText(rohwert) : textZuRichTextHtml(rohwert)
}

export function RichTextEditor({ label, value, onChange, minHeight = 120 }) {
  const editorRef = useRef(null)
  const auswahlRef = useRef(null)

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const html = editorHtml(value)
    if (editor.innerHTML !== html) editor.innerHTML = html
  }, [value])

  function auswahlMerken() {
    const editor = editorRef.current
    const auswahl = window.getSelection()
    if (!editor || !auswahl || auswahl.rangeCount === 0) return
    const bereich = auswahl.getRangeAt(0)
    if (editor.contains(bereich.commonAncestorContainer)) {
      auswahlRef.current = bereich.cloneRange()
    }
  }

  function auswahlWiederherstellen() {
    const editor = editorRef.current
    const auswahl = window.getSelection()
    if (!editor || !auswahl) return
    editor.focus()
    if (!auswahlRef.current) return
    auswahl.removeAllRanges()
    auswahl.addRange(auswahlRef.current)
  }

  function aenderungMelden() {
    const editor = editorRef.current
    if (!editor) return
    onChange(editor.innerHTML)
    auswahlMerken()
  }

  function formatieren(command) {
    auswahlWiederherstellen()
    document.execCommand('styleWithCSS', false, false)
    document.execCommand(command, false)
    aenderungMelden()
  }

  function farbeSetzen(event) {
    auswahlWiederherstellen()
    document.execCommand('styleWithCSS', false, false)
    document.execCommand('foreColor', false, event.target.value)
    aenderungMelden()
  }

  function nurTextEinfuegen(event) {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    aenderungMelden()
  }

  function toolbarMaus(event) {
    event.preventDefault()
    auswahlMerken()
  }

  return (
    <Box>
      <Typography component="label" variant="body2" fontWeight={700} sx={{ display: 'block', mb: 0.75 }}>
        {label}
      </Typography>
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack
          direction="row"
          alignItems="center"
          gap={0.25}
          flexWrap="wrap"
          useFlexGap
          sx={{ px: 0.75, py: 0.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}
        >
          <Tooltip title="Fett">
            <IconButton size="small" onMouseDown={toolbarMaus} onClick={() => formatieren('bold')} aria-label="Fett">
              <FormatBoldIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Kursiv">
            <IconButton size="small" onMouseDown={toolbarMaus} onClick={() => formatieren('italic')} aria-label="Kursiv">
              <FormatItalicIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Unterstrichen">
            <IconButton size="small" onMouseDown={toolbarMaus} onClick={() => formatieren('underline')} aria-label="Unterstrichen">
              <FormatUnderlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Schriftfarbe auswählen">
            <Box
              component="label"
              onMouseDown={auswahlMerken}
              sx={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                borderRadius: '50%',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <FormatColorTextIcon fontSize="small" />
              <Box
                component="input"
                type="color"
                defaultValue="#1d3a6d"
                onChange={farbeSetzen}
                aria-label="Schriftfarbe"
                sx={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
              />
            </Box>
          </Tooltip>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            Text markieren, dann formatieren
          </Typography>
        </Stack>
        <Box
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label={label}
          aria-multiline="true"
          onInput={aenderungMelden}
          onSelect={auswahlMerken}
          onPointerUp={auswahlMerken}
          onMouseUp={auswahlMerken}
          onTouchEnd={auswahlMerken}
          onKeyUp={auswahlMerken}
          onFocus={auswahlMerken}
          onPaste={nurTextEinfuegen}
          sx={{
            minHeight,
            whiteSpace: 'pre-wrap',
            px: 1.5,
            py: 1.25,
            outline: 'none',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            '&:empty::before': {
              content: '"Text eingeben …"',
              color: 'text.disabled',
              pointerEvents: 'none',
            },
            '& p': { my: 0.5 },
            '& div': { minHeight: '1.4em' },
          }}
        />
      </Paper>
    </Box>
  )
}

export function RichTextContent({ value, sx = {} }) {
  const rohwert = String(value || '')
  if (!rohwert) return null

  const basisSx = {
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    lineHeight: 1.5,
    '& p': { my: 0.5 },
    '& p:first-of-type': { mt: 0 },
    '& p:last-of-type': { mb: 0 },
    '& div': { minHeight: '1.4em' },
  }

  if (!enthaeltRichTextHtml(rohwert)) {
    return <Box sx={{ ...basisSx, whiteSpace: 'pre-wrap', ...sx }}>{rohwert}</Box>
  }

  return (
    <Box
      sx={{ ...basisSx, ...sx }}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(rohwert) }}
    />
  )
}
