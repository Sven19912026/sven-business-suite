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
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
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
  stundensatzVorher: '',
  letzteLohnerhoehung: '',
  gehalt: '',
  notizen: '',
}

function datum(value) {
  if (!value) return '—'

  const d = new Date(`${value}T00:00:00`)

  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('de-DE')
}

function zahl(value) {
  if (value === '' || value === null || value === undefined) {
    return 0
  }

  const normalisiert = String(value)
    .replace(/\s/g, '')
    .replace(',', '.')

  const ergebnis = Number(normalisiert)

  return Number.isFinite(ergebnis) ? ergebnis : 0
}

function euro(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(zahl(value))
}

function prozent(value) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value)
}

function lohnDifferenz(person) {
  const aktuell = zahl(person.stundensatz)
  const vorher = zahl(person.stundensatzVorher)

  if (aktuell <= 0 || vorher <= 0) {
    return {
      vorhanden: false,
      aktuell,
      vorher,
      differenz: 0,
      differenzProzent: 0,
    }
  }

  const differenz = aktuell - vorher
  const differenzProzent = (differenz / vorher) * 100

  return {
    vorhanden: true,
    aktuell,
    vorher,
    differenz,
    differenzProzent,
  }
}

export default function Mitarbeiter() {
  const [mitarbeiter, setMitarbeiter] = useState([])
  const [suche, setSuche] = useState('')
  const [dialogOffen, setDialogOffen] = useState(false)
  const [formular, setFormular] = useState(leer)
  const [bearbeitenId, setBearbeitenId] = useState(null)
  const [fehler, setFehler] = useState('')
  const [laden, setLaden] = useState(true)
  const [speichert, setSpeichert] = useState(false)

  useEffect(() => {
    const mitarbeiterQuery = query(
      collection(db, 'mitarbeiter'),
      orderBy('nachname', 'asc'),
    )

    const unsubscribe = onSnapshot(
      mitarbeiterQuery,
      (snapshot) => {
        setMitarbeiter(
          snapshot.docs.map((eintrag) => ({
            id: eintrag.id,
            ...eintrag.data(),
          })),
        )

        setLaden(false)
      },
      (error) => {
        console.error(error)
        setFehler(
          'Mitarbeiter konnten nicht geladen werden. Prüfe die Firestore-Regeln.',
        )
        setLaden(false)
      },
    )

    return unsubscribe
  }, [])

  const gefiltert = useMemo(() => {
    const text = suche.trim().toLowerCase()

    if (!text) return mitarbeiter

    return mitarbeiter.filter((person) =>
      [
        person.vorname,
        person.nachname,
        person.personalnummer,
        person.firma,
        person.abteilung,
        person.position,
        person.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(text),
    )
  }, [mitarbeiter, suche])

  function neu() {
    setFormular({ ...leer })
    setBearbeitenId(null)
    setFehler('')
    setDialogOffen(true)
  }

  function bearbeiten(person) {
    setFormular({
      ...leer,
      ...person,
    })

    setBearbeitenId(person.id)
    setFehler('')
    setDialogOffen(true)
  }

  function feldAendern(event) {
    const { name, value } = event.target

    setFormular((vorher) => ({
      ...vorher,
      [name]: value,
    }))
  }

  async function speichern() {
    if (!formular.vorname.trim() || !formular.nachname.trim()) {
      setFehler('Vorname und Nachname sind Pflichtfelder.')
      return
    }

    const aktuellerLohn = zahl(formular.stundensatz)
    const vorherigerLohn = zahl(formular.stundensatzVorher)

    if (aktuellerLohn < 0 || vorherigerLohn < 0) {
      setFehler('Stundenlöhne dürfen nicht negativ sein.')
      return
    }

    const benutzer = auth.currentUser

    if (!benutzer) {
      setFehler('Kein Benutzer angemeldet.')
      return
    }

    setFehler('')
    setSpeichert(true)

    const daten = {
      ...formular,
      vorname: formular.vorname.trim(),
      nachname: formular.nachname.trim(),
      stundensatz: aktuellerLohn || '',
      stundensatzVorher: vorherigerLohn || '',
      gehalt: zahl(formular.gehalt) || '',
      userId: benutzer.uid,
      geaendertAm: serverTimestamp(),
    }

    try {
      if (bearbeitenId) {
        await updateDoc(
          doc(db, 'mitarbeiter', bearbeitenId),
          daten,
        )
      } else {
        await addDoc(collection(db, 'mitarbeiter'), {
          ...daten,
          erstelltAm: serverTimestamp(),
        })
      }

      setDialogOffen(false)
      setFormular({ ...leer })
      setBearbeitenId(null)
    } catch (error) {
      console.error(error)
      setFehler(
        'Speichern fehlgeschlagen. Prüfe die Firestore-Regeln.',
      )
    } finally {
      setSpeichert(false)
    }
  }

  async function loeschen(person) {
    const bestaetigt = window.confirm(
      `${person.vorname} ${person.nachname} wirklich löschen?`,
    )

    if (!bestaetigt) return

    try {
      await deleteDoc(doc(db, 'mitarbeiter', person.id))
    } catch (error) {
      console.error(error)
      setFehler('Löschen fehlgeschlagen.')
    }
  }

  function formularFeld(name, label, props = {}) {
    return (
      <TextField
        name={name}
        label={label}
        value={formular[name] ?? ''}
        onChange={feldAendern}
        fullWidth
        {...props}
      />
    )
  }

  return (
    <Stack spacing={2.5}>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          alignItems: {
            xs: 'stretch',
            sm: 'center',
          },
          flexDirection: {
            xs: 'column',
            sm: 'row',
          },
        }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" fontWeight={800}>
            Mitarbeiter
          </Typography>

          <Typography color="text.secondary">
            Stammdaten, Kontaktdaten, Stundenlohn und Lohnentwicklung.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={neu}
          sx={{ minHeight: 46 }}
        >
          Mitarbeiter anlegen
        </Button>
      </Box>

      {fehler && (
        <Alert
          severity="error"
          onClose={() => setFehler('')}
        >
          {fehler}
        </Alert>
      )}

      <TextField
        placeholder="Name, Personalnummer, Abteilung oder Position suchen"
        value={suche}
        onChange={(event) => setSuche(event.target.value)}
        fullWidth
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      {laden ? (
        <Typography>Lade Mitarbeiter …</Typography>
      ) : gefiltert.length === 0 ? (
        <Card variant="outlined">
          <CardContent>
            <Typography color="text.secondary">
              Noch keine Mitarbeiter vorhanden.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
            },
            gap: 2,
          }}
        >
          {gefiltert.map((person) => {
            const lohn = lohnDifferenz(person)
            const positiv = lohn.differenz >= 0

            return (
              <Card
                key={person.id}
                variant="outlined"
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 1,
                      alignItems: 'flex-start',
                    }}
                  >
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography
                        variant="h6"
                        fontWeight={800}
                        noWrap
                      >
                        {person.vorname} {person.nachname}
                      </Typography>

                      <Typography
                        color="primary.main"
                        fontWeight={700}
                      >
                        {person.position || 'Keine Position'}
                      </Typography>
                    </Box>

                    <Tooltip title="Bearbeiten">
                      <IconButton
                        onClick={() => bearbeiten(person)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Löschen">
                      <IconButton
                        color="error"
                        onClick={() => loeschen(person)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Stack spacing={0.5} sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <b>Firma:</b> {person.firma || '—'}
                    </Typography>

                    <Typography variant="body2">
                      <b>Abteilung:</b> {person.abteilung || '—'}
                    </Typography>

                    <Typography variant="body2">
                      <b>Status:</b> {person.status || '—'}
                    </Typography>

                    <Typography variant="body2">
                      <b>Eintritt:</b> {datum(person.eintritt)}
                    </Typography>

                    <Typography variant="body2">
                      <b>Telefon:</b> {person.telefon || '—'}
                    </Typography>

                    <Typography variant="body2">
                      <b>E-Mail:</b> {person.email || '—'}
                    </Typography>
                  </Stack>

                  <Box
                    sx={{
                      mt: 2,
                      p: 2,
                      borderRadius: 3,
                      bgcolor: 'background.default',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      spacing={2}
                    >
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={700}
                        >
                          AKTUELLER STUNDENLOHN
                        </Typography>

                        <Typography
                          variant="h5"
                          fontWeight={850}
                          sx={{ mt: 0.3 }}
                        >
                          {lohn.aktuell > 0
                            ? euro(lohn.aktuell)
                            : '—'}
                        </Typography>
                      </Box>

                      {lohn.vorhanden && (
                        <Chip
                          icon={<TrendingUpIcon />}
                          color={positiv ? 'success' : 'error'}
                          label={`${positiv ? '+' : ''}${euro(
                            lohn.differenz,
                          )} / ${positiv ? '+' : ''}${prozent(
                            lohn.differenzProzent,
                          )} %`}
                        />
                      )}
                    </Stack>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '1fr',
                          sm: 'repeat(2, minmax(0, 1fr))',
                        },
                        gap: 1.5,
                        mt: 2,
                      }}
                    >
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          Vorheriger Stundenlohn
                        </Typography>

                        <Typography fontWeight={750}>
                          {lohn.vorher > 0
                            ? euro(lohn.vorher)
                            : '—'}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          Letzte Lohnerhöhung
                        </Typography>

                        <Typography fontWeight={750}>
                          {datum(person.letzteLohnerhoehung)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            )
          })}
        </Box>
      )}

      <Dialog
        open={dialogOffen}
        onClose={() => !speichert && setDialogOffen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {bearbeitenId
            ? 'Mitarbeiter bearbeiten'
            : 'Mitarbeiter anlegen'}
        </DialogTitle>

        <DialogContent>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
              },
              gap: 2,
              pt: 1,
            }}
          >
            {formularFeld('vorname', 'Vorname *')}
            {formularFeld('nachname', 'Nachname *')}
            {formularFeld('personalnummer', 'Personalnummer')}

            {formularFeld('firma', 'Firma', {
              select: true,
              children: ['OBG', 'ORG', 'OMT', 'Sonstige'].map(
                (wert) => (
                  <MenuItem key={wert} value={wert}>
                    {wert}
                  </MenuItem>
                ),
              ),
            })}

            {formularFeld('abteilung', 'Abteilung')}
            {formularFeld('position', 'Position')}

            {formularFeld('status', 'Status', {
              select: true,
              children: [
                'Aktiv',
                'Probezeit',
                'Krank',
                'Urlaub',
                'Ausgeschieden',
              ].map((wert) => (
                <MenuItem key={wert} value={wert}>
                  {wert}
                </MenuItem>
              )),
            })}

            {formularFeld('eintritt', 'Eintrittsdatum', {
              type: 'date',
              InputLabelProps: { shrink: true },
            })}

            {formularFeld('geburtstag', 'Geburtstag', {
              type: 'date',
              InputLabelProps: { shrink: true },
            })}

            {formularFeld('telefon', 'Telefon')}

            {formularFeld('email', 'E-Mail', {
              type: 'email',
            })}

            {formularFeld(
              'stundensatz',
              'Aktueller Stundenlohn in €',
              {
                type: 'number',
                inputProps: {
                  min: 0,
                  step: 0.01,
                },
              },
            )}

            {formularFeld(
              'stundensatzVorher',
              'Stundenlohn vor Erhöhung in €',
              {
                type: 'number',
                inputProps: {
                  min: 0,
                  step: 0.01,
                },
              },
            )}

            {formularFeld(
              'letzteLohnerhoehung',
              'Datum der letzten Lohnerhöhung',
              {
                type: 'date',
                InputLabelProps: { shrink: true },
              },
            )}

            {formularFeld('gehalt', 'Monatsgehalt', {
              type: 'number',
              inputProps: {
                min: 0,
                step: 0.01,
              },
            })}

            <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
              {formularFeld('notizen', 'Notizen', {
                multiline: true,
                minRows: 3,
              })}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setDialogOffen(false)}
            disabled={speichert}
          >
            Abbrechen
          </Button>

          <Button
            variant="contained"
            onClick={speichern}
            disabled={speichert}
          >
            {speichert ? 'Speichert …' : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}