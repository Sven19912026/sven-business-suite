import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteIcon from '@mui/icons-material/Delete'
import DescriptionIcon from '@mui/icons-material/Description'
import EditIcon from '@mui/icons-material/Edit'
import EuroIcon from '@mui/icons-material/Euro'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import {
  collection,
  doc,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import {
  trackedAddDoc as addDoc,
  trackedDeleteDoc as deleteDoc,
  trackedOnSnapshot as onSnapshot,
  trackedUpdateDoc as updateDoc,
} from "../firebaseUsage";
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { auth, db } from '../firebase'

GlobalWorkerOptions.workerSrc = pdfWorker

const MAX_PDF_GROESSE = 20 * 1024 * 1024
const MAX_PDF_SEITEN = 80
const KEIN_LIEFERANT = '__keiner__'
const NEUER_LIEFERANT = '__neu__'

const LEERER_VERTRAG = {
  name: '',
  anbieter: '',
  lieferantId: '',
  kategorie: 'Dienstleister',
  status: 'Aktiv',
  vertragsnummer: '',
  startdatum: '',
  enddatum: '',
  kuendigungsfristMonate: '3',
  kuendigungsfristText: '',
  automatischeVerlaengerung: true,
  kosten: '',
  kostenIntervall: 'Monatlich',
  zahlungsziel: '',
  ansprechpartner: '',
  email: '',
  telefon: '',
  notizen: '',
}

const LEERER_LIEFERANT = {
  firma: '',
  kategorie: 'Dienstleistung',
  status: 'Aktiv',
  kundennummer: '',
  strasse: '',
  plz: '',
  ort: '',
  website: '',
  telefon: '',
  email: '',
  zahlungsziel: '',
  skonto: '',
  lieferbedingungen: '',
  standardrabatt: '',
  bonusvereinbarung: '',
  notizen: '',
}

const KATEGORIEN = [
  'Dienstleister',
  'Software',
  'Versicherung',
  'Leasing',
  'Miete',
  'Telefon / Internet',
  'Energie',
  'Wartung',
  'Material',
  'Sonstiges',
]

function heuteIso() {
  const datum = new Date()
  const offset = datum.getTimezoneOffset()
  return new Date(datum.getTime() - offset * 60000).toISOString().slice(0, 10)
}

function datumFormatieren(value) {
  if (!value) return 'Unbefristet'
  const datum = new Date(`${value}T00:00:00`)
  return Number.isNaN(datum.getTime()) ? value : datum.toLocaleDateString('de-DE')
}

function geldFormatieren(value) {
  const nummer = Number(String(value || '').replace(',', '.'))
  if (!Number.isFinite(nummer)) return '0,00 €'
  return nummer.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function kuendigungsdatum(enddatum, monate) {
  if (!enddatum) return ''
  const datum = new Date(`${enddatum}T00:00:00`)
  if (Number.isNaN(datum.getTime())) return ''
  datum.setMonth(datum.getMonth() - Number(monate || 0))
  const offset = datum.getTimezoneOffset()
  return new Date(datum.getTime() - offset * 60000).toISOString().slice(0, 10)
}

function jahreskosten(vertrag) {
  const kosten = Number(String(vertrag.kosten || '').replace(',', '.')) || 0
  if (vertrag.kostenIntervall === 'Monatlich') return kosten * 12
  if (vertrag.kostenIntervall === 'Quartalsweise') return kosten * 4
  if (vertrag.kostenIntervall === 'Halbjährlich') return kosten * 2
  if (vertrag.kostenIntervall === 'Einmalig') return 0
  return kosten
}

function textNormalisieren(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function regexText(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function ersterTreffer(text, muster) {
  for (const regex of muster) {
    const treffer = text.match(regex)
    const wert = treffer?.[1]?.trim()
    if (wert) return wert.replace(/[|;]+$/, '').trim()
  }
  return ''
}

function zeilen(text) {
  return text
    .split(/\r?\n/)
    .map((zeile) => zeile.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function datumZuIso(value) {
  const roh = String(value || '').trim()
  if (!roh) return ''

  let treffer = roh.match(/\b(20\d{2}|19\d{2})-(\d{1,2})-(\d{1,2})\b/)
  if (treffer) return `${treffer[1]}-${treffer[2].padStart(2, '0')}-${treffer[3].padStart(2, '0')}`

  treffer = roh.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2}|19\d{2})\b/)
  if (treffer) return `${treffer[3]}-${treffer[2].padStart(2, '0')}-${treffer[1].padStart(2, '0')}`

  const monate = {
    januar: '01',
    februar: '02',
    märz: '03',
    maerz: '03',
    april: '04',
    mai: '05',
    juni: '06',
    juli: '07',
    august: '08',
    september: '09',
    oktober: '10',
    november: '11',
    dezember: '12',
  }
  treffer = roh.toLowerCase().match(/\b(\d{1,2})\.?\s+(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)\s+(20\d{2}|19\d{2})\b/)
  if (treffer) return `${treffer[3]}-${monate[treffer[2]]}-${treffer[1].padStart(2, '0')}`

  return ''
}

function datumNachBegriffen(text, begriffe) {
  const datumsmuster = '(\\d{1,2}[./-]\\d{1,2}[./-](?:19|20)\\d{2}|(?:19|20)\\d{2}-\\d{1,2}-\\d{1,2}|\\d{1,2}\\.?\\s+(?:Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\\s+(?:19|20)\\d{2})'
  for (const begriff of begriffe) {
    const regex = new RegExp(`${regexText(begriff)}(?:\\s+(?:am|zum|ab|bis))?\\s*[:–—-]?\\s*${datumsmuster}`, 'i')
    const treffer = text.match(regex)
    const datum = datumZuIso(treffer?.[1])
    if (datum) return datum
  }
  return ''
}

function deutscheZahl(value) {
  let text = String(value || '').replace(/\s/g, '').replace(/[^\d.,-]/g, '')
  if (!text) return ''

  if (text.includes(',')) {
    text = text.replace(/\./g, '').replace(',', '.')
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '')
  }

  const nummer = Number(text)
  return Number.isFinite(nummer) ? nummer.toFixed(2) : ''
}

function kostenErkennen(text) {
  const definitionen = [
    {
      intervall: 'Monatlich',
      muster: [
        /(?:monatlich(?:er|e|es)?\s+(?:Beitrag|Preis|Kosten|Entgelt)?|Monatsbeitrag|pro\s+Monat)[^\d€]{0,35}(\d[\d.\s]*(?:,\d{1,2})?)\s*(?:€|EUR)/i,
        /(\d[\d.\s]*(?:,\d{1,2})?)\s*(?:€|EUR)[^\n]{0,30}(?:monatlich|pro\s+Monat)/i,
      ],
    },
    {
      intervall: 'Quartalsweise',
      muster: [
        /(?:quartalsweise|vierteljährlich)[^\d€]{0,35}(\d[\d.\s]*(?:,\d{1,2})?)\s*(?:€|EUR)/i,
        /(\d[\d.\s]*(?:,\d{1,2})?)\s*(?:€|EUR)[^\n]{0,30}(?:quartalsweise|vierteljährlich)/i,
      ],
    },
    {
      intervall: 'Halbjährlich',
      muster: [
        /(?:halbjährlich)[^\d€]{0,35}(\d[\d.\s]*(?:,\d{1,2})?)\s*(?:€|EUR)/i,
        /(\d[\d.\s]*(?:,\d{1,2})?)\s*(?:€|EUR)[^\n]{0,30}(?:halbjährlich)/i,
      ],
    },
    {
      intervall: 'Jährlich',
      muster: [
        /(?:jährlich(?:er|e|es)?\s+(?:Beitrag|Preis|Kosten|Entgelt)?|Jahresbeitrag|pro\s+Jahr)[^\d€]{0,35}(\d[\d.\s]*(?:,\d{1,2})?)\s*(?:€|EUR)/i,
        /(\d[\d.\s]*(?:,\d{1,2})?)\s*(?:€|EUR)[^\n]{0,30}(?:jährlich|pro\s+Jahr)/i,
      ],
    },
    {
      intervall: 'Einmalig',
      muster: [
        /(?:einmalig(?:er|e|es)?\s+(?:Preis|Kosten|Entgelt)?|Gesamtpreis|Auftragssumme)[^\d€]{0,35}(\d[\d.\s]*(?:,\d{1,2})?)\s*(?:€|EUR)/i,
        /(\d[\d.\s]*(?:,\d{1,2})?)\s*(?:€|EUR)[^\n]{0,30}(?:einmalig|Gesamtpreis|Auftragssumme)/i,
      ],
    },
  ]

  for (const definition of definitionen) {
    const roh = ersterTreffer(text, definition.muster)
    const kosten = deutscheZahl(roh)
    if (kosten) return { kosten, kostenIntervall: definition.intervall }
  }

  const beliebigerBetrag = ersterTreffer(text, [/(\d[\d.\s]*(?:,\d{2}))\s*(?:€|EUR)/i])
  return { kosten: deutscheZahl(beliebigerBetrag), kostenIntervall: 'Monatlich' }
}

function kuendigungsfristErkennen(text) {
  const treffer = text.match(/(?:Kündigungsfrist|Frist\s+für\s+die\s+Kündigung)[^\n\d]{0,50}(\d+)\s*(Monat(?:e|en)?|Woche(?:n)?|Tag(?:e|en)?)/i)
  if (!treffer) return { monate: '', text: '' }

  const anzahl = Number(treffer[1])
  const einheit = treffer[2].toLowerCase()
  let monate = anzahl
  if (einheit.startsWith('woche')) monate = Math.max(1, Math.ceil(anzahl / 4.345))
  if (einheit.startsWith('tag')) monate = Math.max(1, Math.ceil(anzahl / 30))

  return {
    monate: String(monate),
    text: `${anzahl} ${treffer[2]}`,
  }
}

function kategorieErkennen(text) {
  const klein = text.toLowerCase()
  if (/versicherung|police|versicherungsschein/.test(klein)) return 'Versicherung'
  if (/leasing|leasinggeber|leasingnehmer/.test(klein)) return 'Leasing'
  if (/mietvertrag|vermieter|mietobjekt|mietzins/.test(klein)) return 'Miete'
  if (/software|lizenz|saas|cloud|hosting/.test(klein)) return 'Software'
  if (/telefon|mobilfunk|internet|glasfaser|telekommunikation/.test(klein)) return 'Telefon / Internet'
  if (/strom|gas|energie|netzbetreiber/.test(klein)) return 'Energie'
  if (/wartung|instandhaltung|servicevertrag/.test(klein)) return 'Wartung'
  if (/material|liefervertrag|warenlieferung/.test(klein)) return 'Material'
  return 'Dienstleister'
}

function anbieterErkennen(text) {
  const beschriftet = ersterTreffer(text, [
    /(?:Anbieter|Vertragspartner|Auftragnehmer|Lieferant|Versicherer|Vermieter)\s*[:–—-]\s*([^\n]{2,100})/i,
    /(?:zwischen)\s+([^\n]{2,100}?(?:GmbH(?:\s*&\s*Co\.?\s*KG)?|AG|KG|OHG|UG(?:\s*\(haftungsbeschränkt\))?|GbR|e\.?\s*K\.?|SE))\s+(?:und|–|-)/i,
  ])
  if (beschriftet) return beschriftet

  return zeilen(text).find((zeile) => (
    zeile.length <= 120
    && /\b(?:GmbH(?:\s*&\s*Co\.?\s*KG)?|AG|KG|OHG|UG(?:\s*\(haftungsbeschränkt\))?|GbR|e\.?\s*K\.?|SE)\b/i.test(zeile)
  )) || ''
}

function vertragsnameErkennen(text, dateiname) {
  const beschriftet = ersterTreffer(text, [
    /(?:Vertragsbezeichnung|Vertragsgegenstand|Bezeichnung)\s*[:–—-]\s*([^\n]{3,120})/i,
    /(?:Vertrag|Vereinbarung)\s+(?:über|für)\s+([^\n]{3,120})/i,
  ])
  if (beschriftet) return beschriftet

  const titelzeile = zeilen(text).find((zeile) => (
    zeile.length >= 4
    && zeile.length <= 120
    && /(?:vertrag|vereinbarung|police|versicherungsschein)/i.test(zeile)
  ))
  if (titelzeile) return titelzeile

  return String(dateiname || 'Importierter Vertrag')
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
}

function dokumentErkennen(text, dateiname) {
  const sauber = textNormalisieren(text)
  const anbieter = anbieterErkennen(sauber)
  const kosten = kostenErkennen(sauber)
  const frist = kuendigungsfristErkennen(sauber)
  const startdatum = datumNachBegriffen(sauber, ['Vertragsbeginn', 'Vertragsstart', 'Beginn', 'Laufzeit ab', 'gültig ab'])
  const enddatum = datumNachBegriffen(sauber, ['Vertragsende', 'Laufzeit bis', 'Ende', 'gültig bis', 'Ablaufdatum'])
  const automatischeVerlaengerung = !/(?:keine|nicht|ohne)\s+(?:automatische\s+)?Verlängerung|endet\s+automatisch\s+ohne\s+Verlängerung/i.test(sauber)
    && /automatisch(?:e|en)?\s+Verlängerung|verlängert\s+sich\s+automatisch|verlängert\s+sich\s+jeweils/i.test(sauber)

  const email = ersterTreffer(sauber, [
    /(?:E-?Mail|E-Mail-Adresse)\s*[:–—-]\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i,
  ])
  const telefon = ersterTreffer(sauber, [
    /(?:Telefon|Tel\.?|Telefonnummer)\s*[:–—-]\s*([+()\d][+()\d\s./-]{5,})/i,
  ])
  const ansprechpartner = ersterTreffer(sauber, [
    /(?:Ansprechpartner|Kontaktperson|Ihr Kontakt|Betreuer)\s*[:–—-]\s*([^\n]{2,80})/i,
  ])
  const vertragsnummer = ersterTreffer(sauber, [
    /(?:Vertragsnummer|Vertragsnr\.?|Vertrag\s*Nr\.?|Policennummer|Versicherungsscheinnummer|Aktenzeichen)\s*[:#–—-]?\s*([A-Z0-9][A-Z0-9./_-]{2,})/i,
  ])
  const kundennummer = ersterTreffer(sauber, [
    /(?:Kundennummer|Kunden-Nr\.?|Kd\.?-?Nr\.?)\s*[:#–—-]?\s*([A-Z0-9][A-Z0-9./_-]{2,})/i,
  ])
  const zahlungsziel = ersterTreffer(sauber, [
    /(?:Zahlungsziel|zahlbar\s+innerhalb)\s*[:–—-]?\s*([^\n.;]{2,60})/i,
  ])
  const website = ersterTreffer(sauber, [
    /\b((?:https?:\/\/|www\.)[A-Z0-9.-]+\.[A-Z]{2,}(?:\/[^\s]*)?)\b/i,
  ])
  const strasse = ersterTreffer(sauber, [
    /^([^\n]{2,80}(?:straße|strasse|str\.|weg|allee|platz|ring)\s+\d+[a-z]?)$/im,
  ])
  const ortTreffer = sauber.match(/\b(\d{5})\s+([A-ZÄÖÜ][A-ZÄÖÜa-zäöüß .-]{2,60})\b/)

  const warnungen = []
  if (!anbieter) warnungen.push('Anbieter/Lieferant wurde nicht sicher erkannt.')
  if (!vertragsnummer) warnungen.push('Keine Vertragsnummer erkannt.')
  if (!startdatum && !enddatum) warnungen.push('Keine eindeutige Vertragslaufzeit erkannt.')
  if (!kosten.kosten) warnungen.push('Keine eindeutigen Vertragskosten erkannt.')
  if (!frist.monate) warnungen.push('Keine eindeutige Kündigungsfrist erkannt.')

  return {
    vertrag: {
      ...LEERER_VERTRAG,
      name: vertragsnameErkennen(sauber, dateiname),
      anbieter,
      kategorie: kategorieErkennen(sauber),
      vertragsnummer,
      startdatum,
      enddatum,
      kuendigungsfristMonate: frist.monate || '3',
      kuendigungsfristText: frist.text,
      automatischeVerlaengerung,
      kosten: kosten.kosten,
      kostenIntervall: kosten.kostenIntervall,
      zahlungsziel,
      ansprechpartner,
      email,
      telefon,
      notizen: 'Daten lokal aus PDF erkannt. Bitte vor dem Speichern prüfen.',
    },
    lieferant: {
      ...LEERER_LIEFERANT,
      firma: anbieter,
      kundennummer,
      strasse,
      plz: ortTreffer?.[1] || '',
      ort: ortTreffer?.[2]?.trim() || '',
      website,
      telefon,
      email,
      zahlungsziel,
      notizen: 'Per lokalem PDF-Import erkannt. Bitte Stammdaten prüfen.',
    },
    warnungen,
  }
}

function firmaNormalisieren(value) {
  return String(value || '')
    .toLocaleLowerCase('de-DE')
    .replace(/\b(gmbh|ag|kg|ohg|ug|se|gbr|e\.?\s*k\.?)\b/g, '')
    .replace(/[^a-z0-9äöüß]/g, '')
}

function passendenLieferantenFinden(lieferanten, firma) {
  const gesucht = firmaNormalisieren(firma)
  if (!gesucht) return null

  return lieferanten.find((item) => firmaNormalisieren(item.firma) === gesucht)
    || lieferanten.find((item) => {
      const vorhanden = firmaNormalisieren(item.firma)
      return vorhanden.length >= 5 && (vorhanden.includes(gesucht) || gesucht.includes(vorhanden))
    })
    || null
}

async function pdfTextAuslesen(datei) {
  const daten = new Uint8Array(await datei.arrayBuffer())
  const ladevorgang = getDocument({ data: daten })
  const pdf = await ladevorgang.promise

  if (pdf.numPages > MAX_PDF_SEITEN) {
    throw new Error(`Das PDF hat ${pdf.numPages} Seiten. Erlaubt sind maximal ${MAX_PDF_SEITEN} Seiten.`)
  }

  const seitenTexte = []
  for (let seitenNummer = 1; seitenNummer <= pdf.numPages; seitenNummer += 1) {
    const seite = await pdf.getPage(seitenNummer)
    const inhalt = await seite.getTextContent()
    const zeilenListe = []
    let aktuelleZeile = ''
    let letzteY = null

    inhalt.items.forEach((item) => {
      if (!item || typeof item.str !== 'string') return
      const y = Array.isArray(item.transform) ? item.transform[5] : null
      const neueZeile = letzteY !== null && y !== null && Math.abs(y - letzteY) > 2

      if (neueZeile && aktuelleZeile.trim()) {
        zeilenListe.push(aktuelleZeile.trim())
        aktuelleZeile = ''
      }

      aktuelleZeile += `${item.str} `
      if (item.hasEOL && aktuelleZeile.trim()) {
        zeilenListe.push(aktuelleZeile.trim())
        aktuelleZeile = ''
      }
      letzteY = y
    })

    if (aktuelleZeile.trim()) zeilenListe.push(aktuelleZeile.trim())
    seitenTexte.push(`--- Seite ${seitenNummer} ---\n${zeilenListe.join('\n')}`)
  }

  return {
    text: textNormalisieren(seitenTexte.join('\n\n')),
    seiten: pdf.numPages,
  }
}

function Kennzahl({ icon, label, wert, zusatz }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.25 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        {icon}
        <Box>
          <Typography variant="h5" fontWeight={900}>{wert}</Typography>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          {zusatz && <Typography variant="caption" color="text.secondary">{zusatz}</Typography>}
        </Box>
      </Stack>
    </Paper>
  )
}

export default function Vertraege() {
  const user = auth.currentUser
  const dateiEingabeRef = useRef(null)
  const [vertraege, setVertraege] = useState([])
  const [lieferanten, setLieferanten] = useState([])
  const [fehler, setFehler] = useState('')
  const [meldung, setMeldung] = useState('')
  const [suche, setSuche] = useState('')
  const [statusFilter, setStatusFilter] = useState('Aktiv')
  const [kategorieFilter, setKategorieFilter] = useState('Alle')
  const [dialogOffen, setDialogOffen] = useState(false)
  const [vertragId, setVertragId] = useState(null)
  const [form, setForm] = useState(LEERER_VERTRAG)
  const [speichert, setSpeichert] = useState(false)
  const [lieferantDialogOffen, setLieferantDialogOffen] = useState(false)
  const [lieferantForm, setLieferantForm] = useState(LEERER_LIEFERANT)
  const [offeneLieferanten, setOffeneLieferanten] = useState({})

  const [importDialogOffen, setImportDialogOffen] = useState(false)
  const [importLaedt, setImportLaedt] = useState(false)
  const [importSpeichert, setImportSpeichert] = useState(false)
  const [importFehler, setImportFehler] = useState('')
  const [importDatei, setImportDatei] = useState(null)
  const [importInfo, setImportInfo] = useState({ seiten: 0, zeichen: 0 })
  const [importText, setImportText] = useState('')
  const [rohtextOffen, setRohtextOffen] = useState(false)
  const [importWarnungen, setImportWarnungen] = useState([])
  const [importVertrag, setImportVertrag] = useState(LEERER_VERTRAG)
  const [importLieferant, setImportLieferant] = useState(LEERER_LIEFERANT)
  const [vertragAnlegen, setVertragAnlegen] = useState(true)
  const [lieferantZuordnung, setLieferantZuordnung] = useState(KEIN_LIEFERANT)

  useEffect(() => {
    if (!user) return undefined
    const vertragsQuery = query(collection(db, 'suiteVertraege'), where('userId', '==', user.uid))
    const lieferantenQuery = query(collection(db, 'lieferanten'), where('userId', '==', user.uid))

    const unsubVertraege = onSnapshot(
      vertragsQuery,
      (snapshot) => setVertraege(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => {
        console.error(error)
        setFehler('Verträge konnten nicht geladen werden. Prüfe die Firestore-Regeln.')
      },
    )
    const unsubLieferanten = onSnapshot(
      lieferantenQuery,
      (snapshot) => setLieferanten(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => {
        console.error(error)
        setFehler('Lieferanten konnten nicht geladen werden. Prüfe die Firestore-Regeln.')
      },
    )

    return () => {
      unsubVertraege()
      unsubLieferanten()
    }
  }, [user])

  const heute = heuteIso()
  const in90Tagen = useMemo(() => {
    const datum = new Date()
    datum.setDate(datum.getDate() + 90)
    const offset = datum.getTimezoneOffset()
    return new Date(datum.getTime() - offset * 60000).toISOString().slice(0, 10)
  }, [])

  const kategorien = useMemo(
    () => [...new Set(vertraege.map((item) => item.kategorie).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de')),
    [vertraege],
  )

  const kennzahlen = useMemo(() => {
    const aktive = vertraege.filter((item) => item.status === 'Aktiv')
    const baldKuendbar = aktive.filter((item) => {
      const datum = kuendigungsdatum(item.enddatum, item.kuendigungsfristMonate)
      return datum && datum >= heute && datum <= in90Tagen
    })
    const verlaengerung = aktive.filter((item) => item.automatischeVerlaengerung).length
    const kosten = aktive.reduce((summe, item) => summe + jahreskosten(item), 0)
    return { aktive: aktive.length, baldKuendbar: baldKuendbar.length, verlaengerung, kosten }
  }, [vertraege, heute, in90Tagen])

  const gefilterteVertraege = useMemo(() => {
    const term = suche.trim().toLowerCase()
    return [...vertraege]
      .filter((item) => statusFilter === 'Alle' || item.status === statusFilter)
      .filter((item) => kategorieFilter === 'Alle' || item.kategorie === kategorieFilter)
      .filter((item) => !term || [item.name, item.anbieter, item.vertragsnummer, item.ansprechpartner, item.notizen]
        .some((wert) => String(wert || '').toLowerCase().includes(term)))
      .sort((a, b) => String(a.enddatum || '9999-12-31').localeCompare(String(b.enddatum || '9999-12-31')))
  }, [vertraege, suche, statusFilter, kategorieFilter])


  const lieferantenGruppen = useMemo(() => {
    const gruppen = lieferanten
      .map((lieferant) => ({
        lieferant,
        vertraege: gefilterteVertraege.filter((vertrag) => vertrag.lieferantId === lieferant.id),
      }))
      .filter((gruppe) => gruppe.vertraege.length > 0 || (!suche.trim() && statusFilter !== 'Alle'))
      .sort((a, b) => String(a.lieferant.firma || '').localeCompare(String(b.lieferant.firma || ''), 'de'))

    const unzugeordnet = gefilterteVertraege.filter((vertrag) => !vertrag.lieferantId || !lieferanten.some((lieferant) => lieferant.id === vertrag.lieferantId))
    if (unzugeordnet.length) gruppen.push({ lieferant: { id: '__unzugeordnet__', firma: 'Nicht zugeordnete Verträge' }, vertraege: unzugeordnet })
    return gruppen
  }, [lieferanten, gefilterteVertraege, suche, statusFilter])

  function neuerLieferant() {
    setLieferantForm(LEERER_LIEFERANT)
    setLieferantDialogOffen(true)
  }

  async function lieferantSpeichern() {
    if (!user || !lieferantForm.firma.trim()) return
    setSpeichert(true)
    setFehler('')
    try {
      await addDoc(collection(db, 'lieferanten'), {
        ...lieferantForm,
        firma: lieferantForm.firma.trim(),
        userId: user.uid,
        erstelltAm: serverTimestamp(),
        aktualisiertAm: serverTimestamp(),
      })
      setLieferantDialogOffen(false)
      setLieferantForm(LEERER_LIEFERANT)
      setMeldung('Lieferant erfolgreich angelegt.')
    } catch (error) {
      console.error(error)
      setFehler('Lieferant konnte nicht gespeichert werden.')
    } finally {
      setSpeichert(false)
    }
  }

  function vertragFuerLieferant(lieferant) {
    setVertragId(null)
    setForm({
      ...LEERER_VERTRAG,
      lieferantId: lieferant.id === '__unzugeordnet__' ? '' : lieferant.id,
      anbieter: lieferant.id === '__unzugeordnet__' ? '' : lieferant.firma,
    })
    setDialogOffen(true)
  }

  function lieferantAufklappen(id) {
    setOffeneLieferanten((vorher) => ({ ...vorher, [id]: !vorher[id] }))
  }

  function neuerVertrag() {
    setVertragId(null)
    setForm(LEERER_VERTRAG)
    setDialogOffen(true)
  }

  function vertragBearbeiten(vertrag) {
    setVertragId(vertrag.id)
    setForm({ ...LEERER_VERTRAG, ...vertrag })
    setDialogOffen(true)
  }

  function feldAendern(feld, wert) {
    setForm((vorher) => ({ ...vorher, [feld]: wert }))
  }

  function importZuruecksetzen() {
    setImportLaedt(false)
    setImportSpeichert(false)
    setImportFehler('')
    setImportDatei(null)
    setImportInfo({ seiten: 0, zeichen: 0 })
    setImportText('')
    setRohtextOffen(false)
    setImportWarnungen([])
    setImportVertrag(LEERER_VERTRAG)
    setImportLieferant(LEERER_LIEFERANT)
    setVertragAnlegen(true)
    setLieferantZuordnung(KEIN_LIEFERANT)
  }

  function pdfImportOeffnen() {
    importZuruecksetzen()
    setImportDialogOffen(true)
  }

  function importDialogSchliessen() {
    if (importLaedt || importSpeichert) return
    setImportDialogOffen(false)
    importZuruecksetzen()
  }

  async function pdfVerarbeiten(datei) {
    if (!datei) return
    setImportFehler('')

    if (datei.type !== 'application/pdf' && !datei.name.toLowerCase().endsWith('.pdf')) {
      setImportFehler('Bitte wähle eine PDF-Datei aus.')
      return
    }
    if (datei.size > MAX_PDF_GROESSE) {
      setImportFehler('Die PDF-Datei ist größer als 20 MB.')
      return
    }

    setImportLaedt(true)
    setImportDatei(datei)
    try {
      const ergebnis = await pdfTextAuslesen(datei)
      if (!ergebnis.text || ergebnis.text.replace(/--- Seite \d+ ---/g, '').trim().length < 30) {
        throw new Error('Das PDF enthält keinen ausreichend auslesbaren Text. Bei einem Scan ist später eine OCR-Erweiterung nötig.')
      }

      const erkannt = dokumentErkennen(ergebnis.text, datei.name)
      const passenderLieferant = passendenLieferantenFinden(lieferanten, erkannt.lieferant.firma)
      const vertragMitLieferant = {
        ...erkannt.vertrag,
        lieferantId: passenderLieferant?.id || '',
      }

      setImportText(ergebnis.text)
      setImportInfo({ seiten: ergebnis.seiten, zeichen: ergebnis.text.length })
      setImportVertrag(vertragMitLieferant)
      setImportLieferant(erkannt.lieferant)
      setImportWarnungen(erkannt.warnungen)
      setLieferantZuordnung(
        passenderLieferant?.id
          || (erkannt.lieferant.firma ? NEUER_LIEFERANT : KEIN_LIEFERANT),
      )
    } catch (error) {
      console.error(error)
      setImportFehler(error.message || 'Die PDF-Datei konnte nicht ausgelesen werden.')
    } finally {
      setImportLaedt(false)
    }
  }

  function dateiAblegen(event) {
    event.preventDefault()
    const datei = event.dataTransfer?.files?.[0]
    pdfVerarbeiten(datei)
  }

  function lieferantZuordnungAendern(value) {
    setLieferantZuordnung(value)
    if (value !== KEIN_LIEFERANT && value !== NEUER_LIEFERANT) {
      const lieferant = lieferanten.find((item) => item.id === value)
      if (lieferant) {
        setImportVertrag((vorher) => ({
          ...vorher,
          lieferantId: lieferant.id,
          anbieter: vorher.anbieter || lieferant.firma,
        }))
      }
    } else {
      setImportVertrag((vorher) => ({ ...vorher, lieferantId: '' }))
    }
  }

  async function vertragSpeichern() {
    if (!user || !form.name.trim()) return
    setSpeichert(true)
    setFehler('')
    try {
      const daten = {
        ...form,
        name: form.name.trim(),
        anbieter: form.anbieter.trim(),
        vertragsnummer: form.vertragsnummer.trim(),
        kuendigungsfristText: form.kuendigungsfristText.trim(),
        zahlungsziel: form.zahlungsziel.trim(),
        ansprechpartner: form.ansprechpartner.trim(),
        email: form.email.trim(),
        telefon: form.telefon.trim(),
        notizen: form.notizen.trim(),
        kosten: String(form.kosten || '').replace(',', '.'),
        kuendigungsfristMonate: String(form.kuendigungsfristMonate || '0'),
        userId: user.uid,
        aktualisiertAm: serverTimestamp(),
      }
      if (vertragId) await updateDoc(doc(db, 'suiteVertraege', vertragId), daten)
      else await addDoc(collection(db, 'suiteVertraege'), { ...daten, erstelltAm: serverTimestamp() })
      setDialogOffen(false)
    } catch (error) {
      console.error(error)
      setFehler('Vertrag konnte nicht gespeichert werden.')
    } finally {
      setSpeichert(false)
    }
  }

  async function pdfDatenSpeichern() {
    const erstelltLieferant = lieferantZuordnung === NEUER_LIEFERANT
    const erstelltVertrag = vertragAnlegen
    if (!user || (!erstelltLieferant && !erstelltVertrag)) return
    if (erstelltLieferant && !importLieferant.firma.trim()) {
      setImportFehler('Für einen neuen Lieferanten muss ein Firmenname eingetragen sein.')
      return
    }
    if (erstelltVertrag && !importVertrag.name.trim()) {
      setImportFehler('Für einen neuen Vertrag muss ein Vertragsname eingetragen sein.')
      return
    }

    setImportSpeichert(true)
    setImportFehler('')
    try {
      let lieferantId = ''
      let lieferantName = importVertrag.anbieter.trim()

      if (lieferantZuordnung === NEUER_LIEFERANT) {
        const lieferantDaten = {
          ...importLieferant,
          firma: importLieferant.firma.trim(),
          kundennummer: importLieferant.kundennummer.trim(),
          strasse: importLieferant.strasse.trim(),
          plz: importLieferant.plz.trim(),
          ort: importLieferant.ort.trim(),
          website: importLieferant.website.trim(),
          telefon: importLieferant.telefon.trim(),
          email: importLieferant.email.trim(),
          zahlungsziel: importLieferant.zahlungsziel.trim(),
          notizen: importLieferant.notizen.trim(),
          userId: user.uid,
          erstelltAm: serverTimestamp(),
          aktualisiertAm: serverTimestamp(),
        }
        const lieferantRef = await addDoc(collection(db, 'lieferanten'), lieferantDaten)
        lieferantId = lieferantRef.id
        lieferantName = lieferantDaten.firma
        await addDoc(collection(db, 'historie'), {
          userId: user.uid,
          lieferantId,
          firma: lieferantName,
          text: 'Lieferant per lokalem PDF-Import angelegt',
          erstelltAm: serverTimestamp(),
        })
      } else if (lieferantZuordnung !== KEIN_LIEFERANT) {
        const lieferant = lieferanten.find((item) => item.id === lieferantZuordnung)
        if (lieferant) {
          lieferantId = lieferant.id
          lieferantName = lieferant.firma
        }
      }

      if (vertragAnlegen) {
        const vertragsDaten = {
          ...importVertrag,
          name: importVertrag.name.trim(),
          anbieter: importVertrag.anbieter.trim() || lieferantName,
          lieferantId,
          vertragsnummer: importVertrag.vertragsnummer.trim(),
          kuendigungsfristText: importVertrag.kuendigungsfristText.trim(),
          zahlungsziel: importVertrag.zahlungsziel.trim(),
          ansprechpartner: importVertrag.ansprechpartner.trim(),
          email: importVertrag.email.trim(),
          telefon: importVertrag.telefon.trim(),
          notizen: importVertrag.notizen.trim(),
          kosten: String(importVertrag.kosten || '').replace(',', '.'),
          kuendigungsfristMonate: String(importVertrag.kuendigungsfristMonate || '0'),
          importQuelle: 'PDF lokal ausgelesen',
          userId: user.uid,
          erstelltAm: serverTimestamp(),
          aktualisiertAm: serverTimestamp(),
        }
        await addDoc(collection(db, 'suiteVertraege'), vertragsDaten)
      }

      setImportDialogOffen(false)
      importZuruecksetzen()
      const teile = []
      if (erstelltLieferant) teile.push('Lieferant')
      if (erstelltVertrag) teile.push('Vertrag')
      setMeldung(`${teile.join(' und ')} erfolgreich angelegt. Die PDF-Datei wurde nicht gespeichert.`)
    } catch (error) {
      console.error(error)
      setImportFehler('Die erkannten Daten konnten nicht gespeichert werden. Prüfe die Firestore-Regeln.')
    } finally {
      setImportSpeichert(false)
    }
  }

  async function vertragLoeschen(vertrag) {
    if (!window.confirm(`Vertrag „${vertrag.name}“ wirklich löschen?`)) return
    try {
      await deleteDoc(doc(db, 'suiteVertraege', vertrag.id))
    } catch (error) {
      console.error(error)
      setFehler('Vertrag konnte nicht gelöscht werden.')
    }
  }

  const importIstBereit = Boolean(importText)
  const importKannSpeichern = (
    (vertragAnlegen && importVertrag.name.trim())
    || (lieferantZuordnung === NEUER_LIEFERANT && importLieferant.firma.trim())
  )

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
          <Box>
            <Typography variant="overline" color="primary" fontWeight={800}>Business Suite 5.1</Typography>
            <Typography variant="h4" fontWeight={800}>Vertragsverwaltung</Typography>
            <Typography color="text.secondary" mt={0.5}>
              Lieferanten anlegen und darunter mehrere Verträge wie Rahmenverträge oder Nachträge verwalten. PDFs werden nur lokal ausgelesen und nicht gespeichert.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <Button startIcon={<PictureAsPdfIcon />} variant="outlined" onClick={pdfImportOeffnen}>PDF importieren</Button>
            <Button startIcon={<AddIcon />} variant="outlined" onClick={neuerLieferant}>Neuer Lieferant</Button>
            <Button startIcon={<AddIcon />} variant="contained" onClick={neuerVertrag}>Neuer Vertrag</Button>
          </Stack>
        </Stack>
      </Paper>

      {fehler && <Alert severity="error" onClose={() => setFehler('')}>{fehler}</Alert>}
      {meldung && <Alert severity="success" onClose={() => setMeldung('')}>{meldung}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
        <Kennzahl icon={<DescriptionIcon color="primary" />} label="Aktive Verträge" wert={kennzahlen.aktive} />
        <Kennzahl icon={<EventBusyIcon color="error" />} label="Frist in 90 Tagen" wert={kennzahlen.baldKuendbar} />
        <Kennzahl icon={<AutorenewIcon color="warning" />} label="Automatische Verlängerung" wert={kennzahlen.verlaengerung} />
        <Kennzahl icon={<EuroIcon color="success" />} label="Jahreskosten" wert={geldFormatieren(kennzahlen.kosten)} />
      </Box>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField label="Suche" value={suche} onChange={(event) => setSuche(event.target.value)} fullWidth />
          <TextField select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} sx={{ minWidth: 170 }}>
            {['Aktiv', 'Gekündigt', 'Beendet', 'Entwurf', 'Alle'].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
          </TextField>
          <TextField select label="Kategorie" value={kategorieFilter} onChange={(event) => setKategorieFilter(event.target.value)} sx={{ minWidth: 190 }}>
            <MenuItem value="Alle">Alle Kategorien</MenuItem>
            {kategorien.map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
          </TextField>
        </Stack>
      </Paper>

      <Stack spacing={1.5}>
        {!lieferantenGruppen.length && (
          <Paper sx={{ p: 5, textAlign: 'center' }}>
            <DescriptionIcon color="disabled" sx={{ fontSize: 56 }} />
            <Typography variant="h6" fontWeight={700} mt={1}>Keine Lieferanten oder Verträge gefunden</Typography>
            <Typography color="text.secondary">Lege zuerst einen Lieferanten und anschließend beliebig viele Verträge an.</Typography>
          </Paper>
        )}

        {lieferantenGruppen.map(({ lieferant, vertraege: gruppenVertraege }) => {
          const istOffen = offeneLieferanten[lieferant.id] !== false
          return (
            <Paper key={lieferant.id} variant="outlined" sx={{ overflow: 'hidden' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={1} sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Stack direction="row" alignItems="center" gap={1} sx={{ cursor: 'pointer', flexGrow: 1 }} onClick={() => lieferantAufklappen(lieferant.id)}>
                  <IconButton size="small">{istOffen ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
                  <Box>
                    <Typography variant="h6" fontWeight={800}>{lieferant.firma}</Typography>
                    <Typography variant="body2" color="text.secondary">{gruppenVertraege.length} Vertrag{gruppenVertraege.length === 1 ? '' : 'e'} hinterlegt</Typography>
                  </Box>
                </Stack>
                <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => vertragFuerLieferant(lieferant)}>
                  Vertrag hinzufügen
                </Button>
              </Stack>

              <Collapse in={istOffen} timeout="auto">
                <Stack spacing={1.25} sx={{ p: 2 }}>
                  {!gruppenVertraege.length && <Typography color="text.secondary">Noch keine Verträge hinterlegt.</Typography>}
                  {gruppenVertraege.map((vertrag) => {
                    const frist = kuendigungsdatum(vertrag.enddatum, vertrag.kuendigungsfristMonate)
                    const fristKritisch = vertrag.status === 'Aktiv' && frist && frist >= heute && frist <= in90Tagen
                    const fristAbgelaufen = vertrag.status === 'Aktiv' && frist && frist < heute
                    return (
                      <Card key={vertrag.id} variant="outlined" sx={{ borderColor: fristKritisch || fristAbgelaufen ? 'error.main' : 'divider' }}>
                        <CardContent>
                          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
                            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                              <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                                <Typography variant="h6" fontWeight={800}>{vertrag.name}</Typography>
                                <Chip size="small" label={vertrag.status || 'Aktiv'} color={vertrag.status === 'Aktiv' ? 'success' : 'default'} />
                                <Chip size="small" variant="outlined" label={vertrag.kategorie || 'Sonstiges'} />
                              </Stack>
                              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 1.5, mt: 2 }}>
                                <Box><Typography variant="caption" color="text.secondary">Laufzeit</Typography><Typography fontWeight={700}>{datumFormatieren(vertrag.startdatum)} – {datumFormatieren(vertrag.enddatum)}</Typography></Box>
                                <Box><Typography variant="caption" color="text.secondary">Kündigungsfrist</Typography><Typography fontWeight={700} color={fristKritisch || fristAbgelaufen ? 'error.main' : 'text.primary'}>{frist ? datumFormatieren(frist) : 'Keine Frist'}</Typography></Box>
                                <Box><Typography variant="caption" color="text.secondary">Kosten</Typography><Typography fontWeight={700}>{geldFormatieren(vertrag.kosten)} {vertrag.kostenIntervall ? `/ ${vertrag.kostenIntervall}` : ''}</Typography></Box>
                                <Box><Typography variant="caption" color="text.secondary">Vertragsnummer</Typography><Typography fontWeight={700}>{vertrag.vertragsnummer || '–'}</Typography></Box>
                              </Box>
                              {vertrag.notizen && <Typography variant="body2" mt={2}><strong>Notiz:</strong> {vertrag.notizen}</Typography>}
                            </Box>
                            <Stack direction="row" alignSelf={{ xs: 'flex-end', md: 'flex-start' }}>
                              <Tooltip title="Bearbeiten"><IconButton onClick={() => vertragBearbeiten(vertrag)}><EditIcon /></IconButton></Tooltip>
                              <Tooltip title="Löschen"><IconButton color="error" onClick={() => vertragLoeschen(vertrag)}><DeleteIcon /></IconButton></Tooltip>
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    )
                  })}
                </Stack>
              </Collapse>
            </Paper>
          )
        })}
      </Stack>

      <Dialog open={lieferantDialogOffen} onClose={() => !speichert && setLieferantDialogOffen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Neuen Lieferanten anlegen</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Firma / Dienstleister" value={lieferantForm.firma} onChange={(event) => setLieferantForm((vorher) => ({ ...vorher, firma: event.target.value }))} required autoFocus />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField fullWidth label="Kategorie" value={lieferantForm.kategorie} onChange={(event) => setLieferantForm((vorher) => ({ ...vorher, kategorie: event.target.value }))} />
              <TextField fullWidth label="Kundennummer" value={lieferantForm.kundennummer} onChange={(event) => setLieferantForm((vorher) => ({ ...vorher, kundennummer: event.target.value }))} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField fullWidth label="Telefon" value={lieferantForm.telefon} onChange={(event) => setLieferantForm((vorher) => ({ ...vorher, telefon: event.target.value }))} />
              <TextField fullWidth type="email" label="E-Mail" value={lieferantForm.email} onChange={(event) => setLieferantForm((vorher) => ({ ...vorher, email: event.target.value }))} />
            </Stack>
            <TextField label="Notizen" value={lieferantForm.notizen} onChange={(event) => setLieferantForm((vorher) => ({ ...vorher, notizen: event.target.value }))} multiline minRows={3} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLieferantDialogOffen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={lieferantSpeichern} disabled={speichert || !lieferantForm.firma.trim()}>Lieferant speichern</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOffen} onClose={() => !speichert && setDialogOffen(false)} fullWidth maxWidth="md">
        <DialogTitle>{vertragId ? 'Vertrag bearbeiten' : 'Neuen Vertrag anlegen'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2, pt: 1 }}>
            <TextField label="Vertragsname" value={form.name} onChange={(event) => feldAendern('name', event.target.value)} required fullWidth />
            <TextField label="Anbieter / Vertragspartner" value={form.anbieter} onChange={(event) => feldAendern('anbieter', event.target.value)} fullWidth />
            <TextField select label="Lieferant verknüpfen" value={form.lieferantId || ''} onChange={(event) => {
              const lieferantId = event.target.value
              const lieferant = lieferanten.find((item) => item.id === lieferantId)
              setForm((vorher) => ({
                ...vorher,
                lieferantId,
                anbieter: lieferant?.firma || vorher.anbieter,
              }))
            }} fullWidth>
              <MenuItem value="">Kein Lieferant</MenuItem>
              {lieferanten.map((lieferant) => <MenuItem key={lieferant.id} value={lieferant.id}>{lieferant.firma}</MenuItem>)}
            </TextField>
            <TextField select label="Kategorie" value={form.kategorie} onChange={(event) => feldAendern('kategorie', event.target.value)} fullWidth>
              {KATEGORIEN.map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
            </TextField>
            <TextField select label="Status" value={form.status} onChange={(event) => feldAendern('status', event.target.value)} fullWidth>
              {['Aktiv', 'Gekündigt', 'Beendet', 'Entwurf'].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
            </TextField>
            <TextField label="Vertragsnummer" value={form.vertragsnummer} onChange={(event) => feldAendern('vertragsnummer', event.target.value)} fullWidth />
            <TextField select label="Automatische Verlängerung" value={form.automatischeVerlaengerung ? 'Ja' : 'Nein'} onChange={(event) => feldAendern('automatischeVerlaengerung', event.target.value === 'Ja')} fullWidth>
              <MenuItem value="Ja">Ja</MenuItem><MenuItem value="Nein">Nein</MenuItem>
            </TextField>
            <TextField label="Vertragsbeginn" type="date" value={form.startdatum} onChange={(event) => feldAendern('startdatum', event.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Vertragsende" type="date" value={form.enddatum} onChange={(event) => feldAendern('enddatum', event.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Kündigungsfrist in Monaten" type="number" inputProps={{ min: 0 }} value={form.kuendigungsfristMonate} onChange={(event) => feldAendern('kuendigungsfristMonate', event.target.value)} fullWidth />
            <TextField label="Kündigungsfrist laut Vertrag" value={form.kuendigungsfristText} onChange={(event) => feldAendern('kuendigungsfristText', event.target.value)} fullWidth />
            <TextField label="Berechneter Kündigungstermin" value={datumFormatieren(kuendigungsdatum(form.enddatum, form.kuendigungsfristMonate))} disabled fullWidth />
            <TextField label="Kosten" type="number" inputProps={{ min: 0, step: '0.01' }} value={form.kosten} onChange={(event) => feldAendern('kosten', event.target.value)} fullWidth />
            <TextField select label="Kostenintervall" value={form.kostenIntervall} onChange={(event) => feldAendern('kostenIntervall', event.target.value)} fullWidth>
              {['Monatlich', 'Quartalsweise', 'Halbjährlich', 'Jährlich', 'Einmalig'].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
            </TextField>
            <TextField label="Zahlungsziel" value={form.zahlungsziel} onChange={(event) => feldAendern('zahlungsziel', event.target.value)} fullWidth />
            <TextField label="Ansprechpartner" value={form.ansprechpartner} onChange={(event) => feldAendern('ansprechpartner', event.target.value)} fullWidth />
            <TextField label="E-Mail" type="email" value={form.email} onChange={(event) => feldAendern('email', event.target.value)} fullWidth />
            <TextField label="Telefon" value={form.telefon} onChange={(event) => feldAendern('telefon', event.target.value)} fullWidth />
            <TextField label="Notizen" value={form.notizen} onChange={(event) => feldAendern('notizen', event.target.value)} multiline minRows={3} fullWidth sx={{ gridColumn: { sm: '1 / -1' } }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOffen(false)} disabled={speichert}>Abbrechen</Button>
          <Button variant="contained" onClick={vertragSpeichern} disabled={speichert || !form.name.trim()}>{speichert ? 'Speichert …' : 'Speichern'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importDialogOffen} onClose={importDialogSchliessen} fullWidth maxWidth="lg">
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <AutoFixHighIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={800}>PDF automatisch auslesen</Typography>
              <Typography variant="body2" color="text.secondary">Vertrags- und Lieferantendaten prüfen, bevor sie gespeichert werden.</Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Alert severity="info">
              Die PDF wird nur in deinem Browser ausgelesen. Weder die Datei noch der vollständige PDF-Text werden in Firebase gespeichert.
            </Alert>

            <Paper
              variant="outlined"
              onDragOver={(event) => event.preventDefault()}
              onDrop={dateiAblegen}
              onClick={() => !importLaedt && dateiEingabeRef.current?.click()}
              sx={{
                p: { xs: 3, sm: 4 },
                textAlign: 'center',
                cursor: importLaedt ? 'default' : 'pointer',
                borderStyle: 'dashed',
                borderWidth: 2,
                bgcolor: 'action.hover',
                '&:hover': { bgcolor: importLaedt ? 'action.hover' : 'action.selected' },
              }}
            >
              <input
                ref={dateiEingabeRef}
                hidden
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => {
                  const datei = event.target.files?.[0]
                  pdfVerarbeiten(datei)
                  event.target.value = ''
                }}
              />
              {importLaedt ? (
                <Stack alignItems="center" spacing={1.5}>
                  <CircularProgress />
                  <Typography fontWeight={800}>PDF wird lokal ausgelesen …</Typography>
                </Stack>
              ) : (
                <Stack alignItems="center" spacing={1}>
                  <CloudUploadIcon color="primary" sx={{ fontSize: 48 }} />
                  <Typography variant="h6" fontWeight={800}>PDF hier ablegen oder anklicken</Typography>
                  <Typography color="text.secondary">Digitale PDF mit auswählbarem Text, maximal 20 MB und 80 Seiten</Typography>
                  {importDatei && <Chip icon={<PictureAsPdfIcon />} label={importDatei.name} color="primary" variant="outlined" sx={{ mt: 1 }} />}
                </Stack>
              )}
            </Paper>

            {importFehler && <Alert severity="error" onClose={() => setImportFehler('')}>{importFehler}</Alert>}

            {importIstBereit && (
              <>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip icon={<FactCheckIcon />} color="success" label="Text erkannt" />
                  <Chip label={`${importInfo.seiten} Seite${importInfo.seiten === 1 ? '' : 'n'}`} variant="outlined" />
                  <Chip label={`${importInfo.zeichen.toLocaleString('de-DE')} Zeichen`} variant="outlined" />
                  <Chip label="PDF wird nicht gespeichert" color="info" variant="outlined" />
                </Stack>

                {importWarnungen.length > 0 && (
                  <Alert severity="warning">
                    <Typography fontWeight={800} mb={0.5}>Bitte besonders prüfen:</Typography>
                    {importWarnungen.map((warnung) => <Typography key={warnung} variant="body2">• {warnung}</Typography>)}
                  </Alert>
                )}

                <Paper variant="outlined" sx={{ p: 2.5 }}>
                  <Typography variant="h6" fontWeight={800} mb={1.5}>Was soll angelegt werden?</Typography>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                    <FormControlLabel
                      control={<Checkbox checked={vertragAnlegen} onChange={(event) => setVertragAnlegen(event.target.checked)} />}
                      label="Vertrag anlegen"
                    />
                    <TextField
                      select
                      fullWidth
                      label="Lieferant"
                      value={lieferantZuordnung}
                      onChange={(event) => lieferantZuordnungAendern(event.target.value)}
                    >
                      <MenuItem value={KEIN_LIEFERANT}>Keinen Lieferanten anlegen oder verknüpfen</MenuItem>
                      <MenuItem value={NEUER_LIEFERANT}>Neuen Lieferanten anlegen</MenuItem>
                      {lieferanten.map((lieferant) => <MenuItem key={lieferant.id} value={lieferant.id}>Bestehend: {lieferant.firma}</MenuItem>)}
                    </TextField>
                  </Stack>
                </Paper>

                {vertragAnlegen && (
                  <Paper variant="outlined" sx={{ p: 2.5 }}>
                    <Typography variant="h6" fontWeight={800} mb={2}>Erkannte Vertragsdaten</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
                      <TextField label="Vertragsname" required value={importVertrag.name} onChange={(event) => setImportVertrag((vorher) => ({ ...vorher, name: event.target.value }))} />
                      <TextField label="Anbieter / Vertragspartner" value={importVertrag.anbieter} onChange={(event) => setImportVertrag((vorher) => ({ ...vorher, anbieter: event.target.value }))} />
                      <TextField select label="Kategorie" value={importVertrag.kategorie} onChange={(event) => setImportVertrag((vorher) => ({ ...vorher, kategorie: event.target.value }))}>
                        {KATEGORIEN.map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
                      </TextField>
                      <TextField select label="Status" value={importVertrag.status} onChange={(event) => setImportVertrag((vorher) => ({ ...vorher, status: event.target.value }))}>
                        {['Aktiv', 'Gekündigt', 'Beendet', 'Entwurf'].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
                      </TextField>
                      <TextField label="Vertragsnummer" value={importVertrag.vertragsnummer} onChange={(event) => setImportVertrag((vorher) => ({ ...vorher, vertragsnummer: event.target.value }))} />
                      <TextField select label="Automatische Verlängerung" value={importVertrag.automatischeVerlaengerung ? 'Ja' : 'Nein'} onChange={(event) => setImportVertrag((vorher) => ({ ...vorher, automatischeVerlaengerung: event.target.value === 'Ja' }))}>
                        <MenuItem value="Ja">Ja</MenuItem><MenuItem value="Nein">Nein</MenuItem>
                      </TextField>
                      <TextField label="Vertragsbeginn" type="date" InputLabelProps={{ shrink: true }} value={importVertrag.startdatum} onChange={(event) => setImportVertrag((vorher) => ({ ...vorher, startdatum: event.target.value }))} />
                      <TextField label="Vertragsende" type="date" InputLabelProps={{ shrink: true }} value={importVertrag.enddatum} onChange={(event) => setImportVertrag((vorher) => ({ ...vorher, enddatum: event.target.value }))} />
                      <TextField label="Kündigungsfrist in Monaten" type="number" inputProps={{ min: 0 }} value={importVertrag.kuendigungsfristMonate} onChange={(event) => setImportVertrag((vorher) => ({ ...vorher, kuendigungsfristMonate: event.target.value }))} />
                      <TextField label="Kündigungsfrist laut PDF" value={importVertrag.kuendigungsfristText} onChange={(event) => setImportVertrag((vorher) => ({ ...vorher, kuendigungsfristText: event.target.value }))} />
                      <TextField label="Kosten" type="number" inputProps={{ min: 0, step: '0.01' }} value={importVertrag.kosten} onChange={(event) => setImportVertrag((vorher) => ({ ...vorher, kosten: event.target.value }))} />
                      <TextField select label="Kostenintervall" value={importVertrag.kostenIntervall} onChange={(event) => setImportVertrag((vorher) => ({ ...vorher, kostenIntervall: event.target.value }))}>
                        {['Monatlich', 'Quartalsweise', 'Halbjährlich', 'Jährlich', 'Einmalig'].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
                      </TextField>
                      <TextField label="Zahlungsziel" value={importVertrag.zahlungsziel} onChange={(event) => setImportVertrag((vorher) => ({ ...vorher, zahlungsziel: event.target.value }))} />
                      <TextField label="Ansprechpartner" value={importVertrag.ansprechpartner} onChange={(event) => setImportVertrag((vorher) => ({ ...vorher, ansprechpartner: event.target.value }))} />
                      <TextField label="E-Mail" value={importVertrag.email} onChange={(event) => setImportVertrag((vorher) => ({ ...vorher, email: event.target.value }))} />
                      <TextField label="Telefon" value={importVertrag.telefon} onChange={(event) => setImportVertrag((vorher) => ({ ...vorher, telefon: event.target.value }))} />
                      <TextField label="Notizen" multiline minRows={2} value={importVertrag.notizen} onChange={(event) => setImportVertrag((vorher) => ({ ...vorher, notizen: event.target.value }))} sx={{ gridColumn: { sm: '1 / -1' } }} />
                    </Box>
                  </Paper>
                )}

                {lieferantZuordnung === NEUER_LIEFERANT && (
                  <Paper variant="outlined" sx={{ p: 2.5 }}>
                    <Typography variant="h6" fontWeight={800} mb={2}>Erkannte Lieferantendaten</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
                      <TextField label="Firma" required value={importLieferant.firma} onChange={(event) => setImportLieferant((vorher) => ({ ...vorher, firma: event.target.value }))} />
                      <TextField label="Kundennummer" value={importLieferant.kundennummer} onChange={(event) => setImportLieferant((vorher) => ({ ...vorher, kundennummer: event.target.value }))} />
                      <TextField label="Straße und Hausnummer" value={importLieferant.strasse} onChange={(event) => setImportLieferant((vorher) => ({ ...vorher, strasse: event.target.value }))} sx={{ gridColumn: { sm: '1 / -1' } }} />
                      <TextField label="PLZ" value={importLieferant.plz} onChange={(event) => setImportLieferant((vorher) => ({ ...vorher, plz: event.target.value }))} />
                      <TextField label="Ort" value={importLieferant.ort} onChange={(event) => setImportLieferant((vorher) => ({ ...vorher, ort: event.target.value }))} />
                      <TextField label="Website" value={importLieferant.website} onChange={(event) => setImportLieferant((vorher) => ({ ...vorher, website: event.target.value }))} />
                      <TextField label="Telefon" value={importLieferant.telefon} onChange={(event) => setImportLieferant((vorher) => ({ ...vorher, telefon: event.target.value }))} />
                      <TextField label="E-Mail" value={importLieferant.email} onChange={(event) => setImportLieferant((vorher) => ({ ...vorher, email: event.target.value }))} />
                      <TextField label="Zahlungsziel" value={importLieferant.zahlungsziel} onChange={(event) => setImportLieferant((vorher) => ({ ...vorher, zahlungsziel: event.target.value }))} />
                      <TextField label="Notizen" multiline minRows={2} value={importLieferant.notizen} onChange={(event) => setImportLieferant((vorher) => ({ ...vorher, notizen: event.target.value }))} sx={{ gridColumn: { sm: '1 / -1' } }} />
                    </Box>
                  </Paper>
                )}

                <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                  <Button
                    fullWidth
                    onClick={() => setRohtextOffen((vorher) => !vorher)}
                    endIcon={rohtextOffen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    sx={{ justifyContent: 'space-between', px: 2.5, py: 1.5 }}
                  >
                    Ausgelesenen PDF-Text kontrollieren
                  </Button>
                  <Collapse in={rohtextOffen}>
                    <Box sx={{ p: 2.5, pt: 0 }}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={8}
                        maxRows={18}
                        value={importText}
                        InputProps={{ readOnly: true }}
                      />
                    </Box>
                  </Collapse>
                </Paper>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={importDialogSchliessen} disabled={importLaedt || importSpeichert}>Abbrechen</Button>
          <Button
            variant="contained"
            startIcon={<FactCheckIcon />}
            onClick={pdfDatenSpeichern}
            disabled={!importIstBereit || !importKannSpeichern || importLaedt || importSpeichert}
          >
            {importSpeichert ? 'Speichert …' : 'Geprüfte Daten übernehmen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
