import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import SearchIcon from '@mui/icons-material/Search'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from '../firebase'

const leer = {
  vorname: '',
  nachname: '',
  personalnummer: '',
  firma: 'OBG',
  abteilung: '',
  position: '',
  status: 'Aktiv',
  eintritt: '',
  geburtstag: '',
  telefon: '',
  email: '',
  stundensatz: '',
  gehalt: '',
  notizen: '',
}

function datum(value) {
  if (!value) return '—'
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('de-DE')
}

export default function Mitarbeiter() {
  const [mitarbeiter, setMitarbeiter] = useState([])
  const [suche, setSuche] = useState('')
  const [dialogOffen, setDialogOffen] = useState(false)
  const [formular, setFormular] = useState(leer)
  const [bearbeitenId, setBearbeitenId] = useState(null)
  const [fehler, setFehler] = useState('')
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'mitarbeiter'), orderBy('nachname', 'asc'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMitarbeiter(snapshot.docs.map((eintrag) => ({ id: eintrag.id, ...eintrag.data() })))
        setLaden(false)
      },
      (error) => {
        console.error(error)
        setFehler('Mitarbeiter konnten nicht geladen werden. Prüfe die Firestore-Regeln.')
        setLaden(false)
      },
    )
    return unsubscribe
  }, [])

  const gefiltert = useMemo(() => {
    const text = suche.trim().toLowerCase()
    if (!text) return mitarbeiter
    return mitarbeiter.filter((m) =>
      [m.vorname, m.nachname, m.personalnummer, m.firma, m.abteilung, m.position, m.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(text),
    )
  }, [mitarbeiter, suche])

  function neu() {
    setFormular(leer)
    setBearbeitenId(null)
    setDialogOffen(true)
  }

  function bearbeiten(person) {
    setFormular({ ...leer, ...person })
    setBearbeitenId(person.id)
    setDialogOffen(true)
  }

  async function speichern() {
    if (!formular.vorname.trim() || !formular.nachname.trim()) {
      setFehler('Vorname und Nachname sind Pflichtfelder.')
      return
    }
    setFehler('')
    const daten = {
      ...formular,
      vorname: formular.vorname.trim(),
      nachname: formular.nachname.trim(),
      userId: auth.currentUser?.uid || '',
      geaendertAm: serverTimestamp(),
    }
    try {
      if (bearbeitenId) {
        await updateDoc(doc(db, 'mitarbeiter', bearbeitenId), daten)
      } else {
        await addDoc(collection(db, 'mitarbeiter'), {
          ...daten,
          erstelltAm: serverTimestamp(),
        })
      }
      setDialogOffen(false)
    } catch (error) {
      console.error(error)
      setFehler('Speichern fehlgeschlagen. Prüfe die Firestore-Regeln.')
    }
  }

  async function loeschen(person) {
    if (!window.confirm(`${person.vorname} ${person.nachname} wirklich löschen?`)) return
    try {
      await deleteDoc(doc(db, 'mitarbeiter', person.id))
    } catch (error) {
      console.error(error)
      setFehler('Löschen fehlgeschlagen.')
    }
  }

  const feld = (name, label, props = {}) => (
    <TextField
      label={label}
      value={formular[name] ?? ''}
      onChange={(event) => setFormular((alt) => ({ ...alt, [name]: event.target.value }))}
      fullWidth
      {...props}
    />
  )

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: { xs: 'stretch', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" fontWeight={800}>Mitarbeiter</Typography>
          <Typography color="text.secondary">Stammdaten, Kontaktdaten und wichtige Termine.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={neu} sx={{ minHeight: 46 }}>
          Mitarbeiter anlegen
        </Button>
      </Box>

      {fehler && <Alert severity="error" onClose={() => setFehler('')}>{fehler}</Alert>}

      <TextField
        placeholder="Name, Personalnummer, Abteilung oder Position suchen"
        value={suche}
        onChange={(event) => setSuche(event.target.value)}
        fullWidth
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
      />

      {laden ? (
        <Typography>Lade Mitarbeiter …</Typography>
      ) : gefiltert.length === 0 ? (
        <Card variant="outlined"><CardContent><Typography color="text.secondary">Noch keine Mitarbeiter vorhanden.</Typography></CardContent></Card>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
          {gefiltert.map((person) => (
            <Card key={person.id} variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="h6" fontWeight={800} noWrap>{person.vorname} {person.nachname}</Typography>
                    <Typography color="primary.main" fontWeight={700}>{person.position || 'Keine Position'}</Typography>
                  </Box>
                  <Tooltip title="Bearbeiten"><IconButton onClick={() => bearbeiten(person)}><EditIcon /></IconButton></Tooltip>
                  <Tooltip title="Löschen"><IconButton color="error" onClick={() => loeschen(person)}><DeleteIcon /></IconButton></Tooltip>
                </Box>
                <Stack spacing={0.5} sx={{ mt: 2 }}>
                  <Typography variant="body2"><b>Firma:</b> {person.firma || '—'}</Typography>
                  <Typography variant="body2"><b>Abteilung:</b> {person.abteilung || '—'}</Typography>
                  <Typography variant="body2"><b>Status:</b> {person.status || '—'}</Typography>
                  <Typography variant="body2"><b>Eintritt:</b> {datum(person.eintritt)}</Typography>
                  <Typography variant="body2"><b>Telefon:</b> {person.telefon || '—'}</Typography>
                  <Typography variant="body2"><b>E-Mail:</b> {person.email || '—'}</Typography>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Dialog open={dialogOffen} onClose={() => setDialogOffen(false)} fullWidth maxWidth="md">
        <DialogTitle>{bearbeitenId ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter anlegen'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2, pt: 1 }}>
            {feld('vorname', 'Vorname *')}
            {feld('nachname', 'Nachname *')}
            {feld('personalnummer', 'Personalnummer')}
            {feld('firma', 'Firma', { select: true, children: ['OBG', 'ORG', 'OMT', 'Sonstige'].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>) })}
            {feld('abteilung', 'Abteilung')}
            {feld('position', 'Position')}
            {feld('status', 'Status', { select: true, children: ['Aktiv', 'Probezeit', 'Krank', 'Urlaub', 'Ausgeschieden'].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>) })}
            {feld('eintritt', 'Eintrittsdatum', { type: 'date', InputLabelProps: { shrink: true } })}
            {feld('geburtstag', 'Geburtstag', { type: 'date', InputLabelProps: { shrink: true } })}
            {feld('telefon', 'Telefon')}
            {feld('email', 'E-Mail', { type: 'email' })}
            {feld('stundensatz', 'Stundenlohn', { type: 'number' })}
            {feld('gehalt', 'Monatsgehalt', { type: 'number' })}
            <Box sx={{ gridColumn: { sm: '1 / -1' } }}>{feld('notizen', 'Notizen', { multiline: true, minRows: 3 })}</Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOffen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={speichern}>Speichern</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
