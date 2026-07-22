// UPDATE: Einklappbare Prioritätsgruppen und manuelle Drag-and-Drop-Sortierung
import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CategoryIcon from '@mui/icons-material/Category'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import TodayIcon from '@mui/icons-material/Today'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import AssignmentIcon from '@mui/icons-material/Assignment'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import WorkIcon from '@mui/icons-material/Work'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
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
  trackedSetDoc as setDoc,
  trackedUpdateDoc as updateDoc,
  trackedWriteBatch as writeBatch,
} from "../firebaseUsage";
import { auth, db } from '../firebase'

const STANDARD_KATEGORIE = 'Allgemein'
const PRIORITAETEN = ['Hoch', 'Mittel', 'Niedrig']
const LEERE_AUFGABE = {
  titel: '',
  beschreibung: '',
  notizen: '',
  verantwortlich: '',
  kategorieId: '',
  prioritaet: 'Mittel',
  status: 'Offen',
  faelligAm: '',
  wiederholung: 'Keine',
  erledigt: false,
  bereich: '',
}

function heuteIso() {
  const datum = new Date()
  const offset = datum.getTimezoneOffset()
  return new Date(datum.getTime() - offset * 60000).toISOString().slice(0, 10)
}

function datumFormatieren(value) {
  if (!value) return 'Kein Termin'
  const datum = new Date(`${value}T00:00:00`)
  return Number.isNaN(datum.getTime()) ? value : datum.toLocaleDateString('de-DE')
}

function zeitstempelFormatieren(value) {
  if (!value) return 'Zeitpunkt nicht verfügbar'
  const datum = typeof value?.toDate === 'function'
    ? value.toDate()
    : value?.seconds
      ? new Date(value.seconds * 1000)
      : new Date(value)
  return Number.isNaN(datum.getTime())
    ? 'Zeitpunkt nicht verfügbar'
    : datum.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

function prioritaetsFarbe(prioritaet) {
  if (prioritaet === 'Hoch') return 'error'
  if (prioritaet === 'Niedrig') return 'success'
  return 'warning'
}

function naechstesDatum(value, wiederholung) {
  if (!value || wiederholung === 'Keine') return ''
  const datum = new Date(`${value}T00:00:00`)
  if (wiederholung === 'Täglich') datum.setDate(datum.getDate() + 1)
  if (wiederholung === 'Wöchentlich') datum.setDate(datum.getDate() + 7)
  if (wiederholung === 'Monatlich') datum.setMonth(datum.getMonth() + 1)
  if (wiederholung === 'Jährlich') datum.setFullYear(datum.getFullYear() + 1)
  const offset = datum.getTimezoneOffset()
  return new Date(datum.getTime() - offset * 60000).toISOString().slice(0, 10)
}

function Kennzahl({ icon, label, wert }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.25 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        {icon}
        <Box>
          <Typography variant="h5" fontWeight={900}>{wert}</Typography>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Box>
      </Stack>
    </Paper>
  )
}

export default function Aufgaben() {
  const user = auth.currentUser
  const [aufgaben, setAufgaben] = useState([])
  const [kategorien, setKategorien] = useState([])
  const [fehler, setFehler] = useState('')
  const [suche, setSuche] = useState('')
  const [filterKategorie, setFilterKategorie] = useState('Alle')
  const [filterStatus, setFilterStatus] = useState('Offen')
  const [sortierung, setSortierung] = useState('Fälligkeit')
  const [bereich, setBereich] = useState(() => {
    const aktuelleUserId = auth.currentUser?.uid
    if (!aktuelleUserId) return 'arbeit'

    const gespeichert = localStorage.getItem(`sven-suite-aufgaben-bereich-${aktuelleUserId}`)
    return gespeichert === 'privat' ? 'privat' : 'arbeit'
  })

  const [aufgabeDialog, setAufgabeDialog] = useState(false)
  const [aufgabeId, setAufgabeId] = useState(null)
  const [aufgabeForm, setAufgabeForm] = useState(LEERE_AUFGABE)

  const [kategorieDialog, setKategorieDialog] = useState(false)
  const [kategorieId, setKategorieId] = useState(null)
  const [kategorieName, setKategorieName] = useState('')
  const [kategorieBereich, setKategorieBereich] = useState('arbeit')

  const [loeschKategorie, setLoeschKategorie] = useState(null)
  const [loeschBestaetigung, setLoeschBestaetigung] = useState('')
  const [verschiebeAufgaben, setVerschiebeAufgaben] = useState(true)
  const [speichert, setSpeichert] = useState(false)
  const [erledigteOffen, setErledigteOffen] = useState(true)
  const [offenePrioritaeten, setOffenePrioritaeten] = useState(() => {
    const aktuelleUserId = auth.currentUser?.uid
    if (!aktuelleUserId) return {}

    try {
      const gespeichert = JSON.parse(
        localStorage.getItem(`sven-suite-aufgaben-prioritaeten-${aktuelleUserId}`) || '{}',
      )
      return gespeichert && typeof gespeichert === 'object' ? gespeichert : {}
    } catch (error) {
      console.warn('Gespeicherter Prioritäten-Zustand konnte nicht gelesen werden.', error)
      return {}
    }
  })
  const [manuelleSortierung, setManuelleSortierung] = useState(() => {
    const aktuelleUserId = auth.currentUser?.uid
    if (!aktuelleUserId) return false
    return localStorage.getItem(`sven-suite-aufgaben-manuell-${aktuelleUserId}`) === 'true'
  })
  const [gezogeneAufgabeId, setGezogeneAufgabeId] = useState('')
  const [dragUeberAufgabeId, setDragUeberAufgabeId] = useState('')
  const [sortierungSpeichert, setSortierungSpeichert] = useState(false)

  useEffect(() => {
    if (!user) return undefined
    const aufgabenQuery = query(collection(db, 'suiteAufgaben'), where('userId', '==', user.uid))
    const kategorienQuery = query(collection(db, 'aufgabenKategorien'), where('userId', '==', user.uid))

    const unsubAufgaben = onSnapshot(
      aufgabenQuery,
      (snapshot) => setAufgaben(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      () => setFehler('Aufgaben konnten nicht geladen werden. Prüfe die Firestore-Regeln.'),
    )
    const unsubKategorien = onSnapshot(
      kategorienQuery,
      (snapshot) => setKategorien(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      () => setFehler('Kategorien konnten nicht geladen werden. Prüfe die Firestore-Regeln.'),
    )
    return () => { unsubAufgaben(); unsubKategorien() }
  }, [user])

  useEffect(() => {
    if (!user) return

    const standardKategorien = [
      { id: `allgemein-${user.uid}-arbeit`, bereich: 'arbeit' },
      { id: `allgemein-${user.uid}-privat`, bereich: 'privat' },
    ]

    Promise.all(standardKategorien.map((eintrag) => setDoc(
      doc(db, 'aufgabenKategorien', eintrag.id),
      {
        userId: user.uid,
        name: STANDARD_KATEGORIE,
        bereich: eintrag.bereich,
        system: true,
        aktualisiertAm: serverTimestamp(),
      },
      { merge: true },
    ))).catch((error) => {
      console.error(error)
      setFehler('Die Standardkategorien konnten nicht angelegt werden.')
    })
  }, [user])

  const bereichKategorien = useMemo(
    () => kategorien.filter((item) => (item.bereich || 'arbeit') === bereich),
    [kategorien, bereich],
  )

  const sortierteKategorien = useMemo(
    () => [...bereichKategorien].sort((a, b) => String(a.name).localeCompare(String(b.name), 'de')),
    [bereichKategorien],
  )
  const standardKategorie = bereichKategorien.find((item) => item.id === `allgemein-${user?.uid}-${bereich}`)
    || bereichKategorien.find((item) => String(item.name || '').trim().toLocaleLowerCase('de-DE') === STANDARD_KATEGORIE.toLocaleLowerCase('de-DE'))
  const heute = heuteIso()
  const offenePrioritaetenSchluessel = user ? `sven-suite-aufgaben-prioritaeten-${user.uid}` : ''
  const manuelleSortierungSchluessel = user ? `sven-suite-aufgaben-manuell-${user.uid}` : ''
  const bereichSchluessel = user ? `sven-suite-aufgaben-bereich-${user.uid}` : ''
  const bereichName = bereich === 'privat' ? 'Privat' : 'Arbeit'

  // Nur Aufgaben mit einer ausdrücklichen Bereichszuordnung werden angezeigt.
  // Bestehende Aufgaben ohne "bereich" bleiben unverändert und werden nicht automatisch migriert.
  const bereichAufgaben = useMemo(
    () => aufgaben.filter((aufgabe) => aufgabe.bereich === bereich),
    [aufgaben, bereich],
  )

  const kennzahlen = useMemo(() => ({
    offen: bereichAufgaben.filter((a) => !a.erledigt).length,
    heute: bereichAufgaben.filter((a) => !a.erledigt && a.faelligAm === heute).length,
    ueberfaellig: bereichAufgaben.filter((a) => !a.erledigt && a.faelligAm && a.faelligAm < heute).length,
    erledigt: bereichAufgaben.filter((a) => a.erledigt).length,
  }), [bereichAufgaben, heute])


  const letzteErledigte = useMemo(() => [...bereichAufgaben]
    .filter((aufgabe) => aufgabe.erledigt)
    .sort((a, b) => {
      const aZeit = a.erledigtAm?.seconds || a.aktualisiertAm?.seconds || 0
      const bZeit = b.erledigtAm?.seconds || b.aktualisiertAm?.seconds || 0
      return bZeit - aZeit
    })
    .slice(0, 10), [bereichAufgaben])

  const gefilterteAufgaben = useMemo(() => {
    const term = suche.trim().toLowerCase()
    return bereichAufgaben
      .filter((item) => filterStatus === 'Alle' || (filterStatus === 'Erledigt' ? item.erledigt : !item.erledigt))
      .filter((item) => filterKategorie === 'Alle' || item.kategorieId === filterKategorie)
      .filter((item) => !term || [item.titel, item.beschreibung, item.notizen, item.verantwortlich].some((wert) => String(wert || '').toLowerCase().includes(term)))
  }, [bereichAufgaben, filterKategorie, filterStatus, suche])

  const prioritaetsGruppen = useMemo(() => PRIORITAETEN
    .map((prioritaet) => {
      const gruppenAufgaben = gefilterteAufgaben
        .filter((aufgabe) => (aufgabe.prioritaet || 'Mittel') === prioritaet)
        .sort((a, b) => {
          if (manuelleSortierung) {
            const reihenfolgeA = Number.isFinite(Number(a.manuelleReihenfolge))
              ? Number(a.manuelleReihenfolge)
              : Number.MAX_SAFE_INTEGER
            const reihenfolgeB = Number.isFinite(Number(b.manuelleReihenfolge))
              ? Number(b.manuelleReihenfolge)
              : Number.MAX_SAFE_INTEGER
            if (reihenfolgeA !== reihenfolgeB) return reihenfolgeA - reihenfolgeB
          }

          if (sortierung === 'Titel') return String(a.titel).localeCompare(String(b.titel), 'de')
          const faelligkeit = String(a.faelligAm || '9999-12-31').localeCompare(String(b.faelligAm || '9999-12-31'))
          if (faelligkeit !== 0) return faelligkeit
          return String(a.titel).localeCompare(String(b.titel), 'de')
        })

      return {
        id: `prioritaet-${prioritaet.toLowerCase()}`,
        prioritaet,
        name: `Priorität ${prioritaet}`,
        aufgaben: gruppenAufgaben,
      }
    })
    .filter((gruppe) => gruppe.aufgaben.length > 0), [gefilterteAufgaben, manuelleSortierung, sortierung])

  function bereichWechseln(_event, neuerBereich) {
    if (!neuerBereich) return

    setBereich(neuerBereich)
    setFilterKategorie('Alle')
    if (bereichSchluessel) localStorage.setItem(bereichSchluessel, neuerBereich)
  }

  function neueAufgabe(kategorieId = '', prioritaet = 'Mittel') {
    setAufgabeId(null)
    setAufgabeForm({
      ...LEERE_AUFGABE,
      bereich,
      kategorieId: kategorieId || standardKategorie?.id || sortierteKategorien[0]?.id || '',
      prioritaet,
    })
    setAufgabeDialog(true)
  }

  function offenePrioritaetenSpeichern(naechsterStand) {
    if (offenePrioritaetenSchluessel) {
      localStorage.setItem(offenePrioritaetenSchluessel, JSON.stringify(naechsterStand))
    }
    return naechsterStand
  }

  function prioritaetUmschalten(id) {
    setOffenePrioritaeten((vorher) => offenePrioritaetenSpeichern({
      ...vorher,
      [id]: vorher[id] === false,
    }))
  }

  function allePrioritaetenSetzen(offen) {
    setOffenePrioritaeten((vorher) => {
      const naechsterStand = { ...vorher }
      prioritaetsGruppen.forEach((gruppe) => { naechsterStand[gruppe.id] = offen })
      return offenePrioritaetenSpeichern(naechsterStand)
    })
  }

  function manuelleSortierungUmschalten(event) {
    const aktiviert = event.target.checked
    setManuelleSortierung(aktiviert)
    setGezogeneAufgabeId('')
    setDragUeberAufgabeId('')
    if (manuelleSortierungSchluessel) {
      localStorage.setItem(manuelleSortierungSchluessel, String(aktiviert))
    }
  }

  function naechsteManuelleReihenfolge(prioritaet, aufgabenBereich, ausgeschlossenId = '') {
    const werte = aufgaben
      .filter((aufgabe) => aufgabe.id !== ausgeschlossenId)
      .filter((aufgabe) => (aufgabe.bereich || 'arbeit') === aufgabenBereich)
      .filter((aufgabe) => (aufgabe.prioritaet || 'Mittel') === prioritaet)
      .map((aufgabe) => Number(aufgabe.manuelleReihenfolge))
      .filter(Number.isFinite)

    return (werte.length ? Math.max(...werte) : 0) + 1000
  }

  function dragStarten(event, aufgabe) {
    if (!manuelleSortierung || sortierungSpeichert) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', aufgabe.id)
    setGezogeneAufgabeId(aufgabe.id)
  }

  function dragUeber(event, zielAufgabe) {
    if (!manuelleSortierung || sortierungSpeichert) return
    const quelle = aufgaben.find((aufgabe) => aufgabe.id === gezogeneAufgabeId)
    if (!quelle || (quelle.prioritaet || 'Mittel') !== (zielAufgabe.prioritaet || 'Mittel')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragUeberAufgabeId(zielAufgabe.id)
  }

  function dragBeenden() {
    setGezogeneAufgabeId('')
    setDragUeberAufgabeId('')
  }

  async function aufgabeAblegen(event, zielAufgabe) {
    event.preventDefault()
    const quellId = event.dataTransfer.getData('text/plain') || gezogeneAufgabeId
    const quellAufgabe = aufgaben.find((aufgabe) => aufgabe.id === quellId)
    if (!quellAufgabe || quellAufgabe.id === zielAufgabe.id) {
      dragBeenden()
      return
    }

    const prioritaet = quellAufgabe.prioritaet || 'Mittel'
    if (prioritaet !== (zielAufgabe.prioritaet || 'Mittel')) {
      setFehler('Aufgaben können nur innerhalb derselben Prioritätsgruppe verschoben werden.')
      dragBeenden()
      return
    }

    const sichtbareGruppe = prioritaetsGruppen.find((gruppe) => gruppe.prioritaet === prioritaet)
    if (!sichtbareGruppe) {
      dragBeenden()
      return
    }

    const sichtbareIds = sichtbareGruppe.aufgaben.map((aufgabe) => aufgabe.id)
    const quellIndex = sichtbareIds.indexOf(quellAufgabe.id)
    const zielIndex = sichtbareIds.indexOf(zielAufgabe.id)
    if (quellIndex < 0 || zielIndex < 0) {
      dragBeenden()
      return
    }

    const neueSichtbareIds = [...sichtbareIds]
    const [verschobeneId] = neueSichtbareIds.splice(quellIndex, 1)
    neueSichtbareIds.splice(zielIndex, 0, verschobeneId)

    const vollstaendigeGruppe = [...bereichAufgaben]
      .filter((aufgabe) => (aufgabe.prioritaet || 'Mittel') === prioritaet)
      .sort((a, b) => {
        const aWert = Number.isFinite(Number(a.manuelleReihenfolge)) ? Number(a.manuelleReihenfolge) : Number.MAX_SAFE_INTEGER
        const bWert = Number.isFinite(Number(b.manuelleReihenfolge)) ? Number(b.manuelleReihenfolge) : Number.MAX_SAFE_INTEGER
        if (aWert !== bWert) return aWert - bWert
        return String(a.faelligAm || '9999-12-31').localeCompare(String(b.faelligAm || '9999-12-31'))
      })

    const sichtbareMenge = new Set(sichtbareIds)
    let sichtbarerIndex = 0
    const neueGesamtreihenfolge = vollstaendigeGruppe.map((aufgabe) => {
      if (!sichtbareMenge.has(aufgabe.id)) return aufgabe
      const naechsteId = neueSichtbareIds[sichtbarerIndex]
      sichtbarerIndex += 1
      return vollstaendigeGruppe.find((eintrag) => eintrag.id === naechsteId)
    })

    setSortierungSpeichert(true)
    setFehler('')
    try {
      const batch = writeBatch(db)
      neueGesamtreihenfolge.forEach((aufgabe, index) => {
        batch.update(doc(db, 'suiteAufgaben', aufgabe.id), {
          manuelleReihenfolge: (index + 1) * 1000,
          aktualisiertAm: serverTimestamp(),
        })
      })
      await batch.commit()
    } catch (error) {
      console.error(error)
      setFehler('Die individuelle Reihenfolge konnte nicht gespeichert werden.')
    } finally {
      setSortierungSpeichert(false)
      dragBeenden()
    }
  }

  function aufgabeBearbeiten(aufgabe) {
    setAufgabeId(aufgabe.id)
    setAufgabeForm({
      ...LEERE_AUFGABE,
      ...aufgabe,
      bereich: aufgabe.bereich || bereich,
      status: aufgabe.erledigt ? 'Erledigt' : (aufgabe.status || 'Offen'),
    })
    setAufgabeDialog(true)
  }

  async function aufgabeSpeichern() {
    if (!user || !aufgabeForm.titel.trim() || !aufgabeForm.kategorieId) return
    setSpeichert(true)
    setFehler('')
    try {
      const erledigt = aufgabeForm.status === 'Erledigt'
      const bisherigeAufgabe = aufgaben.find((aufgabe) => aufgabe.id === aufgabeId)
      const aufgabenBereich = aufgabeForm.bereich || bereich
      const prioritaet = aufgabeForm.prioritaet || 'Mittel'
      const prioritaetOderBereichGeaendert = !bisherigeAufgabe
        || (bisherigeAufgabe.prioritaet || 'Mittel') !== prioritaet
        || (bisherigeAufgabe.bereich || 'arbeit') !== aufgabenBereich
      const manuelleReihenfolge = prioritaetOderBereichGeaendert
        ? naechsteManuelleReihenfolge(prioritaet, aufgabenBereich, aufgabeId || '')
        : (Number.isFinite(Number(bisherigeAufgabe.manuelleReihenfolge))
          ? Number(bisherigeAufgabe.manuelleReihenfolge)
          : naechsteManuelleReihenfolge(prioritaet, aufgabenBereich, aufgabeId || ''))
      const daten = {
        ...aufgabeForm,
        prioritaet,
        manuelleReihenfolge,
        bereich: aufgabeForm.bereich || bereich,
        titel: aufgabeForm.titel.trim(),
        beschreibung: aufgabeForm.beschreibung.trim(),
        notizen: aufgabeForm.notizen.trim(),
        verantwortlich: aufgabeForm.verantwortlich.trim(),
        erledigt,
        userId: user.uid,
        aktualisiertAm: serverTimestamp(),
      }
      if (aufgabeId) await updateDoc(doc(db, 'suiteAufgaben', aufgabeId), daten)
      else await addDoc(collection(db, 'suiteAufgaben'), { ...daten, erstelltAm: serverTimestamp() })
      setAufgabeDialog(false)
    } catch (error) {
      console.error(error)
      setFehler('Aufgabe konnte nicht gespeichert werden.')
    } finally { setSpeichert(false) }
  }

  async function aufgabeStatusAendern(aufgabe) {
    try {
      const wirdErledigt = !aufgabe.erledigt
      await updateDoc(doc(db, 'suiteAufgaben', aufgabe.id), {
        erledigt: wirdErledigt,
        status: wirdErledigt ? 'Erledigt' : 'Offen',
        erledigtAm: wirdErledigt ? serverTimestamp() : null,
        aktualisiertAm: serverTimestamp(),
      })
      if (wirdErledigt && aufgabe.wiederholung && aufgabe.wiederholung !== 'Keine' && aufgabe.faelligAm) {
        await addDoc(collection(db, 'suiteAufgaben'), {
          ...aufgabe,
          id: undefined,
          erledigt: false,
          status: 'Offen',
          bereich: aufgabe.bereich || bereich,
          faelligAm: naechstesDatum(aufgabe.faelligAm, aufgabe.wiederholung),
          manuelleReihenfolge: naechsteManuelleReihenfolge(
            aufgabe.prioritaet || 'Mittel',
            aufgabe.bereich || bereich,
          ),
          userId: user.uid,
          erstelltAm: serverTimestamp(),
          aktualisiertAm: serverTimestamp(),
        })
      }
    } catch (error) {
      console.error(error)
      setFehler('Status konnte nicht geändert werden.')
    }
  }

  async function aufgabeLoeschen(aufgabe) {
    if (!window.confirm(`Aufgabe „${aufgabe.titel}“ wirklich löschen?`)) return
    try { await deleteDoc(doc(db, 'suiteAufgaben', aufgabe.id)) }
    catch (error) { console.error(error); setFehler('Aufgabe konnte nicht gelöscht werden.') }
  }

  function neueKategorie() { setKategorieId(null); setKategorieName(''); setKategorieBereich(bereich); setKategorieDialog(true) }
  function kategorieBearbeiten(kategorie) { setKategorieId(kategorie.id); setKategorieName(kategorie.name); setKategorieBereich(kategorie.bereich || 'arbeit'); setKategorieDialog(true) }

  async function kategorieSpeichern() {
    const name = kategorieName.trim()
    if (!user || !name) return
    if (kategorien.some((item) => item.id !== kategorieId && (item.bereich || 'arbeit') === kategorieBereich && item.name.toLowerCase() === name.toLowerCase())) {
      setFehler('Eine Kategorie mit diesem Namen existiert bereits.'); return
    }
    setSpeichert(true); setFehler('')
    try {
      if (kategorieId) await updateDoc(doc(db, 'aufgabenKategorien', kategorieId), { name, aktualisiertAm: serverTimestamp() })
      else await addDoc(collection(db, 'aufgabenKategorien'), { userId: user.uid, name, bereich: kategorieBereich, system: false, erstelltAm: serverTimestamp(), aktualisiertAm: serverTimestamp() })
      setKategorieDialog(false)
    } catch (error) { console.error(error); setFehler('Kategorie konnte nicht gespeichert werden.') }
    finally { setSpeichert(false) }
  }

  function loeschenVorbereiten(kategorie) { setLoeschKategorie(kategorie); setLoeschBestaetigung(''); setVerschiebeAufgaben(true) }

  async function kategorieSicherLoeschen() {
    if (!user || !loeschKategorie || loeschBestaetigung !== loeschKategorie.name) return
    const betroffeneAufgaben = aufgaben.filter((item) => item.kategorieId === loeschKategorie.id)
    if (betroffeneAufgaben.length && !standardKategorie) { setFehler('Keine Standardkategorie vorhanden.'); return }
    setSpeichert(true); setFehler('')
    try {
      const batch = writeBatch(db)
      betroffeneAufgaben.forEach((aufgabe) => {
        const ref = doc(db, 'suiteAufgaben', aufgabe.id)
        if (verschiebeAufgaben) batch.update(ref, { kategorieId: standardKategorie.id, aktualisiertAm: serverTimestamp() })
        else batch.delete(ref)
      })
      batch.delete(doc(db, 'aufgabenKategorien', loeschKategorie.id))
      await batch.commit()
      if (filterKategorie === loeschKategorie.id) setFilterKategorie('Alle')
      setLoeschKategorie(null)
    } catch (error) { console.error(error); setFehler('Kategorie konnte nicht sicher gelöscht werden.') }
    finally { setSpeichert(false) }
  }

  const anzahlBetroffen = loeschKategorie ? aufgaben.filter((item) => item.kategorieId === loeschKategorie.id).length : 0

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
          <Box>
            <Typography variant="overline" color="primary" fontWeight={800}>Business Suite 5.0</Typography>
            <Typography variant="h4" fontWeight={800}>Aufgaben</Typography>
            <Typography color="text.secondary" mt={0.5}>Aufgaben für Arbeit und Privat getrennt planen, priorisieren und verwalten.</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <Button startIcon={<CategoryIcon />} variant="outlined" onClick={neueKategorie}>Kategorie</Button>
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => neueAufgabe()} disabled={!kategorien.length}>Neue Aufgabe</Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 1.25 }}>
        <ToggleButtonGroup
          value={bereich}
          exclusive
          onChange={bereichWechseln}
          fullWidth
          color="primary"
          aria-label="Aufgabenbereich auswählen"
          sx={{
            '& .MuiToggleButton-root': {
              py: 1.25,
              gap: 1,
              fontWeight: 850,
              textTransform: 'none',
              fontSize: { xs: '0.95rem', sm: '1rem' },
            },
          }}
        >
          <ToggleButton value="arbeit" aria-label="Arbeitsaufgaben anzeigen">
            <WorkIcon />
            Arbeit
          </ToggleButton>
          <ToggleButton value="privat" aria-label="Private Aufgaben anzeigen">
            <HomeOutlinedIcon />
            Privat
          </ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {fehler && <Alert severity="error" onClose={() => setFehler('')}>{fehler}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
        <Kennzahl icon={<AssignmentIcon color="primary" />} label="Offen" wert={kennzahlen.offen} />
        <Kennzahl icon={<TodayIcon color="warning" />} label="Heute fällig" wert={kennzahlen.heute} />
        <Kennzahl icon={<WarningAmberIcon color="error" />} label="Überfällig" wert={kennzahlen.ueberfaellig} />
        <Kennzahl icon={<TaskAltIcon color="success" />} label="Erledigt" wert={kennzahlen.erledigt} />
      </Box>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ lg: 'center' }}>
          <TextField label="Suche" value={suche} onChange={(e) => setSuche(e.target.value)} fullWidth />
          <TextField select label="Kategorie" value={filterKategorie} onChange={(e) => setFilterKategorie(e.target.value)} sx={{ minWidth: 210 }}>
            <MenuItem value="Alle">Alle Kategorien</MenuItem>
            {kategorien.filter((item) => (item.bereich || 'arbeit') === (aufgabeForm.bereich || bereich)).sort((a, b) => String(a.name).localeCompare(String(b.name), 'de')).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </TextField>
          <TextField select label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} sx={{ minWidth: 150 }}>
            {['Offen', 'Erledigt', 'Alle'].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
          </TextField>
          <TextField
            select
            label="Sortierung"
            value={sortierung}
            onChange={(e) => setSortierung(e.target.value)}
            disabled={manuelleSortierung}
            sx={{ minWidth: 170 }}
          >
            {['Fälligkeit', 'Titel'].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
          </TextField>
          <FormControlLabel
            sx={{ minWidth: 230, ml: { lg: 0.5 } }}
            control={(
              <Switch
                checked={manuelleSortierung}
                onChange={manuelleSortierungUmschalten}
                disabled={sortierungSpeichert}
              />
            )}
            label={sortierungSpeichert ? 'Reihenfolge wird gespeichert …' : 'Individuell sortieren'}
          />
        </Stack>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(280px, 1fr)' }, gap: 3 }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}>
            <Box>
              <Typography variant="h6" fontWeight={800}>Aufgaben nach Priorität</Typography>
              <Typography variant="body2" color="text.secondary">
                Prioritätsgruppen anklicken, um sie ein- oder auszuklappen.
              </Typography>
            </Box>
            {prioritaetsGruppen.length > 1 && (
              <Stack direction="row" gap={0.5}>
                <Button size="small" onClick={() => allePrioritaetenSetzen(true)}>Alle öffnen</Button>
                <Button size="small" onClick={() => allePrioritaetenSetzen(false)}>Alle schließen</Button>
              </Stack>
            )}
          </Stack>

          {manuelleSortierung && (
            <Alert severity="info">
              Ziehe Aufgaben am Griff in die gewünschte Reihenfolge. Verschieben ist nur innerhalb derselben Prioritätsgruppe möglich.
            </Alert>
          )}

          {!gefilterteAufgaben.length && <Paper sx={{ p: 5, textAlign: 'center' }}><TaskAltIcon color="disabled" sx={{ fontSize: 52 }} /><Typography variant="h6" fontWeight={700} mt={1}>Keine Aufgaben in „{bereichName}“ gefunden</Typography></Paper>}

          {prioritaetsGruppen.map((gruppe) => {
            const istOffen = offenePrioritaeten[gruppe.id] !== false
            return (
              <Paper key={gruppe.id} variant="outlined" sx={{ overflow: 'hidden' }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  gap={1}
                  role="button"
                  tabIndex={0}
                  aria-expanded={istOffen}
                  onClick={() => prioritaetUmschalten(gruppe.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      prioritaetUmschalten(gruppe.id)
                    }
                  }}
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                    bgcolor: 'action.hover',
                    '&:hover': { bgcolor: 'action.selected' },
                  }}
                >
                  <IconButton size="small" tabIndex={-1} aria-label={istOffen ? 'Prioritätsgruppe schließen' : 'Prioritätsgruppe öffnen'}>
                    {istOffen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography fontWeight={850}>{gruppe.name}</Typography>
                      <Chip size="small" color={prioritaetsFarbe(gruppe.prioritaet)} label={gruppe.prioritaet} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {gruppe.aufgaben.length} Aufgabe{gruppe.aufgaben.length === 1 ? '' : 'n'} im aktuellen Filter
                    </Typography>
                  </Box>
                  <Chip size="small" label={gruppe.aufgaben.length} color={istOffen ? 'primary' : 'default'} />
                  <Tooltip title={`Neue Aufgabe mit Priorität „${gruppe.prioritaet}“`}>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={(event) => {
                        event.stopPropagation()
                        neueAufgabe('', gruppe.prioritaet)
                      }}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                <Collapse in={istOffen} timeout="auto" unmountOnExit>
                  <Stack spacing={1.25} sx={{ p: 1.5, pt: 1.25 }}>
                    {gruppe.aufgaben.map((aufgabe) => {
                      const ueberfaellig = !aufgabe.erledigt && aufgabe.faelligAm && aufgabe.faelligAm < heute
                      const wirdGezogen = gezogeneAufgabeId === aufgabe.id
                      const istDragZiel = dragUeberAufgabeId === aufgabe.id && !wirdGezogen
                      const kategorie = kategorien.find((eintrag) => eintrag.id === aufgabe.kategorieId)
                      return (
                        <Card
                          key={aufgabe.id}
                          variant="outlined"
                          draggable={manuelleSortierung && !sortierungSpeichert}
                          onDragStart={(event) => dragStarten(event, aufgabe)}
                          onDragOver={(event) => dragUeber(event, aufgabe)}
                          onDrop={(event) => aufgabeAblegen(event, aufgabe)}
                          onDragEnd={dragBeenden}
                          sx={{
                            opacity: wirdGezogen ? 0.45 : (aufgabe.erledigt ? 0.65 : 1),
                            borderColor: istDragZiel ? 'primary.main' : (ueberfaellig ? 'error.main' : 'divider'),
                            borderWidth: istDragZiel ? 2 : 1,
                            cursor: manuelleSortierung ? 'grab' : 'default',
                            transition: 'border-color 120ms ease, opacity 120ms ease',
                            '&:active': manuelleSortierung ? { cursor: 'grabbing' } : undefined,
                          }}
                        >
                          <CardContent>
                            <Stack direction="row" gap={1.25} alignItems="flex-start">
                              {manuelleSortierung && (
                                <Tooltip title="Zum Sortieren ziehen">
                                  <Box
                                    aria-label="Aufgabe verschieben"
                                    sx={{
                                      display: 'grid',
                                      placeItems: 'center',
                                      minWidth: 28,
                                      minHeight: 40,
                                      color: 'text.secondary',
                                      cursor: 'grab',
                                    }}
                                  >
                                    <DragIndicatorIcon />
                                  </Box>
                                </Tooltip>
                              )}
                              <Checkbox checked={aufgabe.erledigt === true} onChange={() => aufgabeStatusAendern(aufgabe)} />
                              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                <Typography fontWeight={800} sx={{ textDecoration: aufgabe.erledigt ? 'line-through' : 'none' }}>{aufgabe.titel}</Typography>
                                {aufgabe.beschreibung && <Typography color="text.secondary" mt={0.5}>{aufgabe.beschreibung}</Typography>}
                                {aufgabe.notizen && <Typography variant="body2" mt={1}><strong>Notiz:</strong> {aufgabe.notizen}</Typography>}
                                <Stack direction="row" gap={1} flexWrap="wrap" mt={1.5} useFlexGap>
                                  <Chip size="small" color={prioritaetsFarbe(aufgabe.prioritaet)} label={aufgabe.prioritaet || 'Mittel'} />
                                  <Chip size="small" variant="outlined" label={`Kategorie: ${kategorie?.name || 'Ohne Kategorie'}`} />
                                  <Chip size="small" color={ueberfaellig ? 'error' : 'default'} variant={ueberfaellig ? 'filled' : 'outlined'} label={ueberfaellig ? `Überfällig: ${datumFormatieren(aufgabe.faelligAm)}` : datumFormatieren(aufgabe.faelligAm)} />
                                  {aufgabe.verantwortlich && <Chip size="small" variant="outlined" label={`Verantwortlich: ${aufgabe.verantwortlich}`} />}
                                  {aufgabe.wiederholung && aufgabe.wiederholung !== 'Keine' && <Chip size="small" variant="outlined" label={aufgabe.wiederholung} />}
                                </Stack>
                              </Box>
                              <Tooltip title="Bearbeiten"><IconButton onClick={() => aufgabeBearbeiten(aufgabe)}><EditIcon /></IconButton></Tooltip>
                              <Tooltip title="Löschen"><IconButton color="error" onClick={() => aufgabeLoeschen(aufgabe)}><DeleteIcon /></IconButton></Tooltip>
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

        <Paper sx={{ p: 2.5, alignSelf: 'start' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6" fontWeight={800}>Kategorien</Typography><IconButton color="primary" onClick={neueKategorie}><AddIcon /></IconButton></Stack>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1}>{sortierteKategorien.map((kategorie) => {
            const anzahl = bereichAufgaben.filter((item) => item.kategorieId === kategorie.id).length
            return <Stack key={kategorie.id} direction="row" alignItems="center" gap={1} sx={{ py: 0.5 }}><Box sx={{ flexGrow: 1 }}><Typography fontWeight={700}>{kategorie.name}</Typography><Typography variant="body2" color="text.secondary">{anzahl} Aufgabe{anzahl === 1 ? '' : 'n'} in {bereichName}</Typography></Box><IconButton size="small" onClick={() => kategorieBearbeiten(kategorie)}><EditIcon fontSize="small" /></IconButton><IconButton size="small" color="error" disabled={kategorie.system === true} onClick={() => loeschenVorbereiten(kategorie)}><DeleteIcon fontSize="small" /></IconButton></Stack>
          })}</Stack>
        </Paper>
      </Box>

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          onClick={() => setErledigteOffen((vorher) => !vorher)}
          sx={{ p: 2, cursor: 'pointer', bgcolor: 'action.hover' }}
        >
          <Box>
            <Typography variant="h6" fontWeight={800}>Letzte 10 erledigte Aufgaben – {bereichName}</Typography>
            <Typography variant="body2" color="text.secondary">Mit Abschlussdatum und Uhrzeit · jederzeit wiederherstellbar</Typography>
          </Box>
          <IconButton aria-label={erledigteOffen ? 'Erledigte Aufgaben einklappen' : 'Erledigte Aufgaben ausklappen'}>
            {erledigteOffen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>
        <Collapse in={erledigteOffen} timeout="auto">
          <Stack spacing={1} sx={{ p: 2, pt: 1.5 }}>
            {!letzteErledigte.length && <Typography color="text.secondary">In diesem Bereich wurden noch keine Aufgaben erledigt.</Typography>}
            {letzteErledigte.map((aufgabe) => (
              <Paper key={aufgabe.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={1.5}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={800}>{aufgabe.titel}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Erledigt am {zeitstempelFormatieren(aufgabe.erledigtAm || aufgabe.aktualisiertAm)}
                    </Typography>
                  </Box>
                  <Button variant="outlined" size="small" onClick={() => aufgabeStatusAendern(aufgabe)}>
                    Wiederherstellen
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Collapse>
      </Paper>

      <Dialog open={aufgabeDialog} onClose={() => setAufgabeDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{aufgabeId ? 'Aufgabe bearbeiten' : 'Aufgabe anlegen'}</DialogTitle>
        <DialogContent><Stack spacing={2} mt={1}>
          <Chip
            icon={aufgabeForm.bereich === 'privat' ? <HomeOutlinedIcon /> : <WorkIcon />}
            label={aufgabeForm.bereich === 'privat' ? 'Privat' : 'Arbeit'}
            color="primary"
            variant="outlined"
            sx={{ alignSelf: 'flex-start', fontWeight: 750 }}
          />
          <TextField label="Titel" value={aufgabeForm.titel} onChange={(e) => setAufgabeForm({ ...aufgabeForm, titel: e.target.value })} required autoFocus />
          <TextField label="Beschreibung" value={aufgabeForm.beschreibung} onChange={(e) => setAufgabeForm({ ...aufgabeForm, beschreibung: e.target.value })} multiline minRows={2} />
          <TextField label="Notizen" value={aufgabeForm.notizen} onChange={(e) => setAufgabeForm({ ...aufgabeForm, notizen: e.target.value })} multiline minRows={2} />
          <TextField label="Verantwortlich" value={aufgabeForm.verantwortlich} onChange={(e) => setAufgabeForm({ ...aufgabeForm, verantwortlich: e.target.value })} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField select fullWidth label="Kategorie" value={aufgabeForm.kategorieId} onChange={(e) => setAufgabeForm({ ...aufgabeForm, kategorieId: e.target.value })} required>{sortierteKategorien.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField>
            <TextField select fullWidth label="Priorität" value={aufgabeForm.prioritaet} onChange={(e) => setAufgabeForm({ ...aufgabeForm, prioritaet: e.target.value })}>{['Hoch', 'Mittel', 'Niedrig'].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}</TextField>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField fullWidth label="Fällig am" type="date" InputLabelProps={{ shrink: true }} value={aufgabeForm.faelligAm} onChange={(e) => setAufgabeForm({ ...aufgabeForm, faelligAm: e.target.value })} />
            <TextField select fullWidth label="Wiederholung" value={aufgabeForm.wiederholung} onChange={(e) => setAufgabeForm({ ...aufgabeForm, wiederholung: e.target.value })}>{['Keine', 'Täglich', 'Wöchentlich', 'Monatlich', 'Jährlich'].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}</TextField>
          </Stack>
          <TextField select label="Status" value={aufgabeForm.status} onChange={(e) => setAufgabeForm({ ...aufgabeForm, status: e.target.value })}>{['Offen', 'In Bearbeitung', 'Erledigt'].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}</TextField>
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setAufgabeDialog(false)}>Abbrechen</Button><Button variant="contained" onClick={aufgabeSpeichern} disabled={speichert || !aufgabeForm.titel.trim() || !aufgabeForm.kategorieId}>Speichern</Button></DialogActions>
      </Dialog>

      <Dialog open={kategorieDialog} onClose={() => setKategorieDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle>{kategorieId ? 'Kategorie bearbeiten' : 'Kategorie anlegen'}</DialogTitle>
        <DialogContent><Stack spacing={2} mt={1}>
          {!kategorieId && <TextField select label="Bereich" value={kategorieBereich} onChange={(e) => setKategorieBereich(e.target.value)} fullWidth>
            <MenuItem value="arbeit">Arbeit</MenuItem>
            <MenuItem value="privat">Privat</MenuItem>
          </TextField>}
          {kategorieId && <Chip icon={kategorieBereich === 'privat' ? <HomeOutlinedIcon /> : <WorkIcon />} label={`Fest zugeordnet: ${kategorieBereich === 'privat' ? 'Privat' : 'Arbeit'}`} color="primary" variant="outlined" sx={{ alignSelf: 'flex-start' }} />}
          <TextField label="Kategoriename" value={kategorieName} onChange={(e) => setKategorieName(e.target.value)} fullWidth autoFocus />
          <Alert severity="info">Die Kategorie wird ausschließlich im gewählten Bereich angezeigt und kann später nicht in den anderen Bereich verschoben werden.</Alert>
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setKategorieDialog(false)}>Abbrechen</Button><Button variant="contained" onClick={kategorieSpeichern} disabled={speichert || !kategorieName.trim()}>Speichern</Button></DialogActions>
      </Dialog>

      <Dialog open={loeschKategorie !== null} onClose={() => setLoeschKategorie(null)} fullWidth maxWidth="sm">
        <DialogTitle>Kategorie sicher löschen</DialogTitle>
        <DialogContent><Alert severity="warning" sx={{ mb: 2 }}>Diese Aktion kann nicht rückgängig gemacht werden.</Alert><Typography>Die Kategorie <strong>{loeschKategorie?.name}</strong> enthält {anzahlBetroffen} Aufgabe{anzahlBetroffen === 1 ? '' : 'n'}.</Typography>{anzahlBetroffen > 0 && <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={verschiebeAufgaben} onChange={(e) => setVerschiebeAufgaben(e.target.checked)} />} label={`Aufgaben nach „${standardKategorie?.name || STANDARD_KATEGORIE}“ verschieben`} />}{anzahlBetroffen > 0 && !verschiebeAufgaben && <Alert severity="error" sx={{ mt: 1 }}>Auch alle enthaltenen Aufgaben werden endgültig gelöscht.</Alert>}<Typography mt={2} mb={1}>Zur Bestätigung den Kategorienamen exakt eingeben:</Typography><TextField value={loeschBestaetigung} onChange={(e) => setLoeschBestaetigung(e.target.value)} placeholder={loeschKategorie?.name || ''} fullWidth autoFocus /></DialogContent>
        <DialogActions><Button onClick={() => setLoeschKategorie(null)}>Abbrechen</Button><Button color="error" variant="contained" onClick={kategorieSicherLoeschen} disabled={speichert || loeschBestaetigung !== loeschKategorie?.name}>Endgültig löschen</Button></DialogActions>
      </Dialog>
    </Stack>
  )
}
