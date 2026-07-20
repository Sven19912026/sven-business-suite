import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import DescriptionIcon from '@mui/icons-material/Description'
import EuroIcon from '@mui/icons-material/Euro'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from '../firebase'

const LEERER_VERTRAG = {
  name: '',
  anbieter: '',
  kategorie: 'Dienstleister',
  status: 'Aktiv',
  vertragsnummer: '',
  startdatum: '',
  enddatum: '',
  kuendigungsfristMonate: '3',
  automatischeVerlaengerung: true,
  kosten: '',
  kostenIntervall: 'Monatlich',
  ansprechpartner: '',
  email: '',
  telefon: '',
  notizen: '',
}

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
  const [vertraege, setVertraege] = useState([])
  const [fehler, setFehler] = useState('')
  const [suche, setSuche] = useState('')
  const [statusFilter, setStatusFilter] = useState('Aktiv')
  const [kategorieFilter, setKategorieFilter] = useState('Alle')
  const [dialogOffen, setDialogOffen] = useState(false)
  const [vertragId, setVertragId] = useState(null)
  const [form, setForm] = useState(LEERER_VERTRAG)
  const [speichert, setSpeichert] = useState(false)

  useEffect(() => {
    if (!user) return undefined
    const vertragsQuery = query(collection(db, 'suiteVertraege'), where('userId', '==', user.uid))
    return onSnapshot(
      vertragsQuery,
      (snapshot) => setVertraege(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => {
        console.error(error)
        setFehler('Verträge konnten nicht geladen werden. Prüfe die Firestore-Regeln.')
      },
    )
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

  async function vertragLoeschen(vertrag) {
    if (!window.confirm(`Vertrag „${vertrag.name}“ wirklich löschen?`)) return
    try {
      await deleteDoc(doc(db, 'suiteVertraege', vertrag.id))
    } catch (error) {
      console.error(error)
      setFehler('Vertrag konnte nicht gelöscht werden.')
    }
  }

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
          <Box>
            <Typography variant="overline" color="primary" fontWeight={800}>Version 1.0</Typography>
            <Typography variant="h4" fontWeight={800}>Vertragsverwaltung</Typography>
            <Typography color="text.secondary" mt={0.5}>
              Laufzeiten, Kündigungsfristen, Kosten und Ansprechpartner zentral verwalten.
            </Typography>
          </Box>
          <Button startIcon={<AddIcon />} variant="contained" onClick={neuerVertrag}>Neuer Vertrag</Button>
        </Stack>
      </Paper>

      {fehler && <Alert severity="error" onClose={() => setFehler('')}>{fehler}</Alert>}

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
        {!gefilterteVertraege.length && (
          <Paper sx={{ p: 5, textAlign: 'center' }}>
            <DescriptionIcon color="disabled" sx={{ fontSize: 56 }} />
            <Typography variant="h6" fontWeight={700} mt={1}>Keine Verträge gefunden</Typography>
            <Typography color="text.secondary">Lege deinen ersten Vertrag an oder ändere die Filter.</Typography>
          </Paper>
        )}

        {gefilterteVertraege.map((vertrag) => {
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
                    <Typography color="text.secondary" mt={0.5}>{vertrag.anbieter || 'Kein Anbieter eingetragen'}</Typography>

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 1.5, mt: 2 }}>
                      <Box><Typography variant="caption" color="text.secondary">Laufzeit</Typography><Typography fontWeight={700}>{datumFormatieren(vertrag.startdatum)} – {datumFormatieren(vertrag.enddatum)}</Typography></Box>
                      <Box><Typography variant="caption" color="text.secondary">Kündigungsfrist</Typography><Typography fontWeight={700} color={fristKritisch || fristAbgelaufen ? 'error.main' : 'text.primary'}>{frist ? datumFormatieren(frist) : 'Keine Frist'}</Typography></Box>
                      <Box><Typography variant="caption" color="text.secondary">Kosten</Typography><Typography fontWeight={700}>{geldFormatieren(vertrag.kosten)} {vertrag.kostenIntervall ? `/ ${vertrag.kostenIntervall}` : ''}</Typography></Box>
                      <Box><Typography variant="caption" color="text.secondary">Ansprechpartner</Typography><Typography fontWeight={700}>{vertrag.ansprechpartner || '–'}</Typography></Box>
                    </Box>

                    <Stack direction="row" gap={1} flexWrap="wrap" mt={2}>
                      {vertrag.automatischeVerlaengerung && <Chip size="small" icon={<AutorenewIcon />} label="Verlängert sich automatisch" color="warning" variant="outlined" />}
                      {vertrag.vertragsnummer && <Chip size="small" label={`Nr. ${vertrag.vertragsnummer}`} variant="outlined" />}
                      {fristKritisch && <Chip size="small" label="Kündigungsfrist beachten" color="error" />}
                      {fristAbgelaufen && <Chip size="small" label="Frist abgelaufen" color="error" />}
                    </Stack>
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

      <Dialog open={dialogOffen} onClose={() => !speichert && setDialogOffen(false)} fullWidth maxWidth="md">
        <DialogTitle>{vertragId ? 'Vertrag bearbeiten' : 'Neuen Vertrag anlegen'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2, pt: 1 }}>
            <TextField label="Vertragsname" value={form.name} onChange={(e) => feldAendern('name', e.target.value)} required fullWidth />
            <TextField label="Anbieter / Vertragspartner" value={form.anbieter} onChange={(e) => feldAendern('anbieter', e.target.value)} fullWidth />
            <TextField select label="Kategorie" value={form.kategorie} onChange={(e) => feldAendern('kategorie', e.target.value)} fullWidth>
              {['Dienstleister', 'Software', 'Versicherung', 'Leasing', 'Miete', 'Telefon / Internet', 'Energie', 'Wartung', 'Sonstiges'].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
            </TextField>
            <TextField select label="Status" value={form.status} onChange={(e) => feldAendern('status', e.target.value)} fullWidth>
              {['Aktiv', 'Gekündigt', 'Beendet', 'Entwurf'].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
            </TextField>
            <TextField label="Vertragsnummer" value={form.vertragsnummer} onChange={(e) => feldAendern('vertragsnummer', e.target.value)} fullWidth />
            <TextField select label="Automatische Verlängerung" value={form.automatischeVerlaengerung ? 'Ja' : 'Nein'} onChange={(e) => feldAendern('automatischeVerlaengerung', e.target.value === 'Ja')} fullWidth>
              <MenuItem value="Ja">Ja</MenuItem><MenuItem value="Nein">Nein</MenuItem>
            </TextField>
            <TextField label="Vertragsbeginn" type="date" value={form.startdatum} onChange={(e) => feldAendern('startdatum', e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Vertragsende" type="date" value={form.enddatum} onChange={(e) => feldAendern('enddatum', e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Kündigungsfrist in Monaten" type="number" inputProps={{ min: 0 }} value={form.kuendigungsfristMonate} onChange={(e) => feldAendern('kuendigungsfristMonate', e.target.value)} fullWidth />
            <TextField label="Berechneter Kündigungstermin" value={datumFormatieren(kuendigungsdatum(form.enddatum, form.kuendigungsfristMonate))} disabled fullWidth />
            <TextField label="Kosten" type="number" inputProps={{ min: 0, step: '0.01' }} value={form.kosten} onChange={(e) => feldAendern('kosten', e.target.value)} fullWidth />
            <TextField select label="Kostenintervall" value={form.kostenIntervall} onChange={(e) => feldAendern('kostenIntervall', e.target.value)} fullWidth>
              {['Monatlich', 'Quartalsweise', 'Halbjährlich', 'Jährlich', 'Einmalig'].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
            </TextField>
            <TextField label="Ansprechpartner" value={form.ansprechpartner} onChange={(e) => feldAendern('ansprechpartner', e.target.value)} fullWidth />
            <TextField label="E-Mail" type="email" value={form.email} onChange={(e) => feldAendern('email', e.target.value)} fullWidth />
            <TextField label="Telefon" value={form.telefon} onChange={(e) => feldAendern('telefon', e.target.value)} fullWidth />
            <TextField label="Notizen" value={form.notizen} onChange={(e) => feldAendern('notizen', e.target.value)} multiline minRows={3} fullWidth sx={{ gridColumn: { sm: '1 / -1' } }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOffen(false)} disabled={speichert}>Abbrechen</Button>
          <Button variant="contained" onClick={vertragSpeichern} disabled={speichert || !form.name.trim()}>{speichert ? 'Speichert …' : 'Speichern'}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
