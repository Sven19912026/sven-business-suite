import { useEffect, useMemo, useRef, useState } from 'react'
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
  TextField,
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
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '../firebase'

const STANDARD_KATEGORIE = 'Allgemein'
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

  const [aufgabeDialog, setAufgabeDialog] = useState(false)
  const [aufgabeId, setAufgabeId] = useState(null)
  const [aufgabeForm, setAufgabeForm] = useState(LEERE_AUFGABE)

  const [kategorieDialog, setKategorieDialog] = useState(false)
  const [kategorieId, setKategorieId] = useState(null)
  const [kategorieName, setKategorieName] = useState('')

  const [loeschKategorie, setLoeschKategorie] = useState(null)
  const [loeschBestaetigung, setLoeschBestaetigung] = useState('')
  const [verschiebeAufgaben, setVerschiebeAufgaben] = useState(true)
  const [speichert, setSpeichert] = useState(false)
  const [offeneKategorien, setOffeneKategorien] = useState(() => {
    const aktuelleUserId = auth.currentUser?.uid
    if (!aktuelleUserId) return {}

    try {
      const gespeichert = JSON.parse(
        localStorage.getItem(`sven-suite-aufgaben-kategorien-${aktuelleUserId}`) || '{}',
      )
      return gespeichert && typeof gespeichert === 'object' ? gespeichert : {}
    } catch (error) {
      console.warn('Gespeicherter Kategorie-Zustand konnte nicht gelesen werden.', error)
      return {}
    }
  })
  const standardBereinigungLaeuft = useRef(false)

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

    const standardRef = doc(db, 'aufgabenKategorien', `allgemein-${user.uid}`)
    setDoc(
      standardRef,
      {
        userId: user.uid,
        name: STANDARD_KATEGORIE,
        system: true,
        aktualisiertAm: serverTimestamp(),
      },
      { merge: true },
    ).catch((error) => {
      console.error(error)
      setFehler('Die Standardkategorie konnte nicht angelegt werden.')
    })
  }, [user])

  useEffect(() => {
    if (!user || standardBereinigungLaeuft.current) return

    const standardId = `allgemein-${user.uid}`
    const standardIstVorhanden = kategorien.some((item) => item.id === standardId)
    if (!standardIstVorhanden) return

    const doppelteKategorien = kategorien.filter((item) => (
      item.id !== standardId
      && String(item.name || '').trim().toLocaleLowerCase('de-DE') === STANDARD_KATEGORIE.toLocaleLowerCase('de-DE')
    ))

    if (!doppelteKategorien.length) return

    standardBereinigungLaeuft.current = true

    async function doppelteAllgemeinKategorienBereinigen() {
      try {
        const doppelteIds = new Set(doppelteKategorien.map((item) => item.id))
        const aufgabenSnapshot = await getDocs(
          query(collection(db, 'suiteAufgaben'), where('userId', '==', user.uid)),
        )

        const aktionen = []
        aufgabenSnapshot.docs.forEach((aufgabeDokument) => {
          if (doppelteIds.has(aufgabeDokument.data().kategorieId)) {
            aktionen.push({ typ: 'update', ref: aufgabeDokument.ref })
          }
        })
        doppelteKategorien.forEach((kategorie) => {
          aktionen.push({ typ: 'delete', ref: doc(db, 'aufgabenKategorien', kategorie.id) })
        })

        for (let index = 0; index < aktionen.length; index += 450) {
          const batch = writeBatch(db)
          aktionen.slice(index, index + 450).forEach((aktion) => {
            if (aktion.typ === 'update') {
              batch.update(aktion.ref, {
                kategorieId: standardId,
                aktualisiertAm: serverTimestamp(),
              })
            } else {
              batch.delete(aktion.ref)
            }
          })
          await batch.commit()
        }
      } catch (error) {
        console.error(error)
        standardBereinigungLaeuft.current = false
        setFehler('Doppelte Allgemein-Kategorien konnten nicht automatisch bereinigt werden.')
      }
    }

    doppelteAllgemeinKategorienBereinigen()
  }, [user, kategorien])

  const sortierteKategorien = useMemo(
    () => [...kategorien].sort((a, b) => String(a.name).localeCompare(String(b.name), 'de')),
    [kategorien],
  )
  const standardKategorie = kategorien.find((item) => item.id === `allgemein-${user?.uid}`)
    || kategorien.find((item) => String(item.name || '').trim().toLocaleLowerCase('de-DE') === STANDARD_KATEGORIE.toLocaleLowerCase('de-DE'))
  const heute = heuteIso()
  const offeneKategorienSchluessel = user ? `sven-suite-aufgaben-kategorien-${user.uid}` : ''

  const kennzahlen = useMemo(() => ({
    offen: aufgaben.filter((a) => !a.erledigt).length,
    heute: aufgaben.filter((a) => !a.erledigt && a.faelligAm === heute).length,
    ueberfaellig: aufgaben.filter((a) => !a.erledigt && a.faelligAm && a.faelligAm < heute).length,
    erledigt: aufgaben.filter((a) => a.erledigt).length,
  }), [aufgaben, heute])

  const gefilterteAufgaben = useMemo(() => {
    const term = suche.trim().toLowerCase()
    const prioritaetsRang = { Hoch: 0, Mittel: 1, Niedrig: 2 }
    return [...aufgaben]
      .filter((item) => filterStatus === 'Alle' || (filterStatus === 'Erledigt' ? item.erledigt : !item.erledigt))
      .filter((item) => filterKategorie === 'Alle' || item.kategorieId === filterKategorie)
      .filter((item) => !term || [item.titel, item.beschreibung, item.notizen, item.verantwortlich].some((wert) => String(wert || '').toLowerCase().includes(term)))
      .sort((a, b) => {
        if (sortierung === 'Priorität') return (prioritaetsRang[a.prioritaet] ?? 9) - (prioritaetsRang[b.prioritaet] ?? 9)
        if (sortierung === 'Titel') return String(a.titel).localeCompare(String(b.titel), 'de')
        return String(a.faelligAm || '9999-12-31').localeCompare(String(b.faelligAm || '9999-12-31'))
      })
  }, [aufgaben, filterKategorie, filterStatus, sortierung, suche])

  const kategorienGruppen = useMemo(() => {
    const gruppen = sortierteKategorien
      .map((kategorie) => ({
        ...kategorie,
        aufgaben: gefilterteAufgaben.filter((aufgabe) => aufgabe.kategorieId === kategorie.id),
      }))
      .filter((gruppe) => gruppe.aufgaben.length > 0)

    const bekannteIds = new Set(kategorien.map((item) => item.id))
    const ohneKategorie = gefilterteAufgaben.filter((aufgabe) => !bekannteIds.has(aufgabe.kategorieId))
    if (ohneKategorie.length > 0) {
      gruppen.push({ id: '__ohne_kategorie__', name: 'Ohne Kategorie', system: true, aufgaben: ohneKategorie })
    }

    return gruppen
  }, [gefilterteAufgaben, kategorien, sortierteKategorien])

  function neueAufgabe(kategorieId = '') {
    setAufgabeId(null)
    setAufgabeForm({
      ...LEERE_AUFGABE,
      kategorieId: kategorieId || standardKategorie?.id || sortierteKategorien[0]?.id || '',
    })
    setAufgabeDialog(true)
  }

  function offeneKategorienSpeichern(naechsterStand) {
    if (offeneKategorienSchluessel) {
      localStorage.setItem(offeneKategorienSchluessel, JSON.stringify(naechsterStand))
    }
    return naechsterStand
  }

  function kategorieUmschalten(id) {
    setOffeneKategorien((vorher) => offeneKategorienSpeichern({
      ...vorher,
      [id]: vorher[id] === false,
    }))
  }

  function alleKategorienSetzen(offen) {
    setOffeneKategorien((vorher) => {
      const naechsterStand = { ...vorher }
      kategorienGruppen.forEach((gruppe) => { naechsterStand[gruppe.id] = offen })
      return offeneKategorienSpeichern(naechsterStand)
    })
  }

  function aufgabeBearbeiten(aufgabe) {
    setAufgabeId(aufgabe.id)
    setAufgabeForm({ ...LEERE_AUFGABE, ...aufgabe, status: aufgabe.erledigt ? 'Erledigt' : (aufgabe.status || 'Offen') })
    setAufgabeDialog(true)
  }

  async function aufgabeSpeichern() {
    if (!user || !aufgabeForm.titel.trim() || !aufgabeForm.kategorieId) return
    setSpeichert(true)
    setFehler('')
    try {
      const erledigt = aufgabeForm.status === 'Erledigt'
      const daten = {
        ...aufgabeForm,
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
          faelligAm: naechstesDatum(aufgabe.faelligAm, aufgabe.wiederholung),
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

  function neueKategorie() { setKategorieId(null); setKategorieName(''); setKategorieDialog(true) }
  function kategorieBearbeiten(kategorie) { setKategorieId(kategorie.id); setKategorieName(kategorie.name); setKategorieDialog(true) }

  async function kategorieSpeichern() {
    const name = kategorieName.trim()
    if (!user || !name) return
    if (kategorien.some((item) => item.id !== kategorieId && item.name.toLowerCase() === name.toLowerCase())) {
      setFehler('Eine Kategorie mit diesem Namen existiert bereits.'); return
    }
    setSpeichert(true); setFehler('')
    try {
      if (kategorieId) await updateDoc(doc(db, 'aufgabenKategorien', kategorieId), { name, aktualisiertAm: serverTimestamp() })
      else await addDoc(collection(db, 'aufgabenKategorien'), { userId: user.uid, name, system: false, erstelltAm: serverTimestamp(), aktualisiertAm: serverTimestamp() })
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
            <Typography variant="overline" color="primary" fontWeight={800}>Version 2.1</Typography>
            <Typography variant="h4" fontWeight={800}>Aufgaben</Typography>
            <Typography color="text.secondary" mt={0.5}>Planen, priorisieren und Aufgaben übersichtlich in ein- und ausklappbaren Kategorien verwalten.</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <Button startIcon={<CategoryIcon />} variant="outlined" onClick={neueKategorie}>Kategorie</Button>
            <Button startIcon={<AddIcon />} variant="contained" onClick={neueAufgabe} disabled={!kategorien.length}>Neue Aufgabe</Button>
          </Stack>
        </Stack>
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
            {sortierteKategorien.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </TextField>
          <TextField select label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} sx={{ minWidth: 150 }}>
            {['Offen', 'Erledigt', 'Alle'].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
          </TextField>
          <TextField select label="Sortierung" value={sortierung} onChange={(e) => setSortierung(e.target.value)} sx={{ minWidth: 170 }}>
            {['Fälligkeit', 'Priorität', 'Titel'].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
          </TextField>
        </Stack>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(280px, 1fr)' }, gap: 3 }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}>
            <Box>
              <Typography variant="h6" fontWeight={800}>Aufgaben nach Kategorien</Typography>
              <Typography variant="body2" color="text.secondary">Kategorie anklicken, um die enthaltenen Aufgaben ein- oder auszuklappen.</Typography>
            </Box>
            {kategorienGruppen.length > 1 && (
              <Stack direction="row" gap={0.5}>
                <Button size="small" onClick={() => alleKategorienSetzen(true)}>Alle öffnen</Button>
                <Button size="small" onClick={() => alleKategorienSetzen(false)}>Alle schließen</Button>
              </Stack>
            )}
          </Stack>

          {!gefilterteAufgaben.length && <Paper sx={{ p: 5, textAlign: 'center' }}><TaskAltIcon color="disabled" sx={{ fontSize: 52 }} /><Typography variant="h6" fontWeight={700} mt={1}>Keine Aufgaben gefunden</Typography></Paper>}

          {kategorienGruppen.map((gruppe) => {
            const istOffen = offeneKategorien[gruppe.id] !== false
            return (
              <Paper key={gruppe.id} variant="outlined" sx={{ overflow: 'hidden' }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  gap={1}
                  role="button"
                  tabIndex={0}
                  aria-expanded={istOffen}
                  onClick={() => kategorieUmschalten(gruppe.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      kategorieUmschalten(gruppe.id)
                    }
                  }}
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                    bgcolor: 'action.hover',
                    '&:hover': { bgcolor: 'action.selected' },
                  }}
                >
                  <IconButton size="small" tabIndex={-1} aria-label={istOffen ? 'Kategorie schließen' : 'Kategorie öffnen'}>
                    {istOffen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography fontWeight={850}>{gruppe.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {gruppe.aufgaben.length} Aufgabe{gruppe.aufgaben.length === 1 ? '' : 'n'} im aktuellen Filter
                    </Typography>
                  </Box>
                  <Chip size="small" label={gruppe.aufgaben.length} color={istOffen ? 'primary' : 'default'} />
                  {gruppe.id !== '__ohne_kategorie__' && (
                    <Tooltip title={`Neue Aufgabe in „${gruppe.name}“`}>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={(event) => {
                          event.stopPropagation()
                          neueAufgabe(gruppe.id)
                        }}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>

                <Collapse in={istOffen} timeout="auto" unmountOnExit>
                  <Stack spacing={1.25} sx={{ p: 1.5, pt: 1.25 }}>
                    {gruppe.aufgaben.map((aufgabe) => {
                      const ueberfaellig = !aufgabe.erledigt && aufgabe.faelligAm && aufgabe.faelligAm < heute
                      return (
                        <Card key={aufgabe.id} variant="outlined" sx={{ opacity: aufgabe.erledigt ? 0.65 : 1, borderColor: ueberfaellig ? 'error.main' : 'divider' }}>
                          <CardContent>
                            <Stack direction="row" gap={1.5} alignItems="flex-start">
                              <Checkbox checked={Boolean(aufgabe.erledigt)} onChange={() => aufgabeStatusAendern(aufgabe)} />
                              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                <Typography fontWeight={800} sx={{ textDecoration: aufgabe.erledigt ? 'line-through' : 'none' }}>{aufgabe.titel}</Typography>
                                {aufgabe.beschreibung && <Typography color="text.secondary" mt={0.5}>{aufgabe.beschreibung}</Typography>}
                                {aufgabe.notizen && <Typography variant="body2" mt={1}><strong>Notiz:</strong> {aufgabe.notizen}</Typography>}
                                <Stack direction="row" gap={1} flexWrap="wrap" mt={1.5}>
                                  <Chip size="small" color={prioritaetsFarbe(aufgabe.prioritaet)} label={aufgabe.prioritaet || 'Mittel'} />
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
            const anzahl = aufgaben.filter((item) => item.kategorieId === kategorie.id).length
            return <Stack key={kategorie.id} direction="row" alignItems="center" gap={1} sx={{ py: 0.5 }}><Box sx={{ flexGrow: 1 }}><Typography fontWeight={700}>{kategorie.name}</Typography><Typography variant="body2" color="text.secondary">{anzahl} Aufgabe{anzahl === 1 ? '' : 'n'}</Typography></Box><IconButton size="small" onClick={() => kategorieBearbeiten(kategorie)}><EditIcon fontSize="small" /></IconButton><IconButton size="small" color="error" disabled={Boolean(kategorie.system)} onClick={() => loeschenVorbereiten(kategorie)}><DeleteIcon fontSize="small" /></IconButton></Stack>
          })}</Stack>
        </Paper>
      </Box>

      <Dialog open={aufgabeDialog} onClose={() => setAufgabeDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{aufgabeId ? 'Aufgabe bearbeiten' : 'Aufgabe anlegen'}</DialogTitle>
        <DialogContent><Stack spacing={2} mt={1}>
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
        <DialogContent><TextField label="Kategoriename" value={kategorieName} onChange={(e) => setKategorieName(e.target.value)} fullWidth autoFocus sx={{ mt: 1 }} /></DialogContent>
        <DialogActions><Button onClick={() => setKategorieDialog(false)}>Abbrechen</Button><Button variant="contained" onClick={kategorieSpeichern} disabled={speichert || !kategorieName.trim()}>Speichern</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(loeschKategorie)} onClose={() => setLoeschKategorie(null)} fullWidth maxWidth="sm">
        <DialogTitle>Kategorie sicher löschen</DialogTitle>
        <DialogContent><Alert severity="warning" sx={{ mb: 2 }}>Diese Aktion kann nicht rückgängig gemacht werden.</Alert><Typography>Die Kategorie <strong>{loeschKategorie?.name}</strong> enthält {anzahlBetroffen} Aufgabe{anzahlBetroffen === 1 ? '' : 'n'}.</Typography>{anzahlBetroffen > 0 && <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={verschiebeAufgaben} onChange={(e) => setVerschiebeAufgaben(e.target.checked)} />} label={`Aufgaben nach „${standardKategorie?.name || STANDARD_KATEGORIE}“ verschieben`} />}{anzahlBetroffen > 0 && !verschiebeAufgaben && <Alert severity="error" sx={{ mt: 1 }}>Auch alle enthaltenen Aufgaben werden endgültig gelöscht.</Alert>}<Typography mt={2} mb={1}>Zur Bestätigung den Kategorienamen exakt eingeben:</Typography><TextField value={loeschBestaetigung} onChange={(e) => setLoeschBestaetigung(e.target.value)} placeholder={loeschKategorie?.name || ''} fullWidth autoFocus /></DialogContent>
        <DialogActions><Button onClick={() => setLoeschKategorie(null)}>Abbrechen</Button><Button color="error" variant="contained" onClick={kategorieSicherLoeschen} disabled={speichert || loeschBestaetigung !== loeschKategorie?.name}>Endgültig löschen</Button></DialogActions>
      </Dialog>
    </Stack>
  )
}
