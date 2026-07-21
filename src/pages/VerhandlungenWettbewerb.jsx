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
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'

import AddIcon from '@mui/icons-material/Add'
import BusinessIcon from '@mui/icons-material/Business'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import SearchIcon from '@mui/icons-material/Search'
import StarIcon from '@mui/icons-material/Star'

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

let anbieterZaehler = 0

function neueAnbieterZeile() {
  anbieterZaehler += 1

  return {
    id: `anbieter-${Date.now()}-${anbieterZaehler}`,
    lieferantId: '',
    firma: '',
    preis: '',
    rabatt: '',
    skonto: '',
    transportkosten: '',
    nebenkosten: '',
    lieferzeit: '',
    zahlungsziel: '',
    notizen: '',
  }
}

const leerWettbewerb = {
  titel: '',
  beschreibung: '',
  status: 'Offen',
  bevorzugterAnbieterId: '',
  vergabeBegruendung: '',
  anbieter: [],
}

function zahl(value) {
  if (
    value === '' ||
    value === null ||
    value === undefined
  ) {
    return 0
  }

  const normalisiert = String(value)
    .replace(/\s/g, '')
    .replace(',', '.')

  const ergebnis = Number(normalisiert)

  return Number.isFinite(ergebnis)
    ? ergebnis
    : 0
}

function euro(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(zahl(value))
}

function gesamtkosten(anbieter) {
  const preis = Math.max(zahl(anbieter.preis), 0)

  const rabatt = Math.min(
    Math.max(zahl(anbieter.rabatt), 0),
    100,
  )

  const skonto = Math.min(
    Math.max(zahl(anbieter.skonto), 0),
    100,
  )

  const transportkosten = Math.max(
    zahl(anbieter.transportkosten),
    0,
  )

  const nebenkosten = Math.max(
    zahl(anbieter.nebenkosten),
    0,
  )

  const preisNachRabatt =
    preis * (1 - rabatt / 100)

  const preisNachSkonto =
    preisNachRabatt * (1 - skonto / 100)

  return (
    preisNachSkonto +
    transportkosten +
    nebenkosten
  )
}

function billigsterAnbieter(anbieter = []) {
  const gueltigeAnbieter = anbieter
    .filter((eintrag) => eintrag.firma?.trim())
    .filter((eintrag) => zahl(eintrag.preis) > 0)
    .map((eintrag) => ({
      ...eintrag,
      berechneteGesamtkosten:
        gesamtkosten(eintrag),
    }))

  if (!gueltigeAnbieter.length) {
    return null
  }

  return gueltigeAnbieter.reduce(
    (guenstigster, aktuell) =>
      aktuell.berechneteGesamtkosten <
      guenstigster.berechneteGesamtkosten
        ? aktuell
        : guenstigster,
  )
}

function statusIstAbgeschlossen(status) {
  return status === 'Abgeschlossen' || status === 'Gewonnen'
}

function statusFarbe(status) {
  if (statusIstAbgeschlossen(status)) return "success";
  if (status === "Verloren") return "error";
  if (status === "In Verhandlung") return "warning";
  return "info";
}

export default function VerhandlungenWettbewerb() {
  const theme = useTheme()

  const istMobil = useMediaQuery(
    theme.breakpoints.down('md'),
  )

  const [wettbewerbe, setWettbewerbe] =
    useState([])

  const [lieferanten, setLieferanten] =
    useState([])

  const [formular, setFormular] =
    useState(leerWettbewerb)

  const [bearbeitungsId, setBearbeitungsId] =
    useState(null)

  const [dialogOffen, setDialogOffen] =
    useState(false)

  const [suche, setSuche] = useState('')
  const [fehler, setFehler] = useState('')
  const [speichert, setSpeichert] =
    useState(false)

  const [laden, setLaden] = useState(true)

  useEffect(() => {
    const benutzer = auth.currentUser

    if (!benutzer) {
      return undefined
    }

    const wettbewerbeQuery = query(
      collection(
        db,
        'verhandlungsWettbewerbe',
      ),
      where('userId', '==', benutzer.uid),
    )

    const lieferantenQuery = query(
      collection(db, 'lieferanten'),
      where('userId', '==', benutzer.uid),
    )

    const wettbewerbeAbmelden = onSnapshot(
      wettbewerbeQuery,
      (snapshot) => {
        const daten = snapshot.docs
          .map((eintrag) => ({
            id: eintrag.id,
            ...eintrag.data(),
          }))
          .sort((a, b) =>
            String(a.titel || '').localeCompare(
              String(b.titel || ''),
              'de',
            ),
          )

        setWettbewerbe(daten)
        setLaden(false)
      },
      (error) => {
        console.error(error)

        setFehler(
          'Wettbewerbe konnten nicht geladen werden. Prüfe die Firestore-Regeln.',
        )

        setLaden(false)
      },
    )

    const lieferantenAbmelden = onSnapshot(
      lieferantenQuery,
      (snapshot) => {
        const daten = snapshot.docs
          .map((eintrag) => ({
            id: eintrag.id,
            ...eintrag.data(),
          }))
          .sort((a, b) =>
            String(a.firma || '').localeCompare(
              String(b.firma || ''),
              'de',
            ),
          )

        setLieferanten(daten)
      },
      (error) => {
        console.error(error)
      },
    )

    return () => {
      wettbewerbeAbmelden()
      lieferantenAbmelden()
    }
  }, [])

  const gefilterteWettbewerbe = useMemo(
    () => {
      const suchbegriff = suche
        .trim()
        .toLowerCase()

      if (!suchbegriff) {
        return wettbewerbe
      }

      return wettbewerbe.filter(
        (wettbewerb) => {
          const anbieterText = (
            wettbewerb.anbieter || []
          )
            .map(
              (anbieter) =>
                anbieter.firma || '',
            )
            .join(' ')
            .toLowerCase()

          return (
            wettbewerb.titel
              ?.toLowerCase()
              .includes(suchbegriff) ||
            wettbewerb.beschreibung
              ?.toLowerCase()
              .includes(suchbegriff) ||
            wettbewerb.status
              ?.toLowerCase()
              .includes(suchbegriff) ||
            anbieterText.includes(
              suchbegriff,
            )
          )
        },
      )
    },
    [wettbewerbe, suche],
  )

  const billigsterImFormular = useMemo(
    () =>
      billigsterAnbieter(
        formular.anbieter,
      ),
    [formular.anbieter],
  )

  function neu() {
    setFormular({
      ...leerWettbewerb,
      anbieter: [
        neueAnbieterZeile(),
        neueAnbieterZeile(),
      ],
    })

    setBearbeitungsId(null)
    setFehler('')
    setDialogOffen(true)
  }

  function bearbeiten(wettbewerb) {
    const vorhandeneAnbieter =
      Array.isArray(wettbewerb.anbieter)
        ? wettbewerb.anbieter.map(
            (eintrag) => ({
              ...eintrag,
              id:
                eintrag.id ||
                neueAnbieterZeile().id,
            }),
          )
        : []

    const anbieter = [
      ...vorhandeneAnbieter,
    ]

    while (anbieter.length < 2) {
      anbieter.push(neueAnbieterZeile())
    }

    setFormular({
      ...leerWettbewerb,
      ...wettbewerb,
      anbieter,
    })

    setBearbeitungsId(wettbewerb.id)
    setFehler('')
    setDialogOffen(true)
  }

  function hauptfeldAendern(event) {
    const { name, value } = event.target

    setFormular((vorher) => ({
      ...vorher,
      [name]: value,
    }))
  }

  function anbieterHinzufuegen() {
    setFormular((vorher) => ({
      ...vorher,
      anbieter: [
        ...vorher.anbieter,
        neueAnbieterZeile(),
      ],
    }))
  }

  function anbieterEntfernen(id) {
    setFormular((vorher) => {
      const neueAnbieter =
        vorher.anbieter.filter(
          (anbieter) => anbieter.id !== id,
        )

      return {
        ...vorher,
        anbieter: neueAnbieter,
        bevorzugterAnbieterId:
          vorher.bevorzugterAnbieterId ===
          id
            ? ''
            : vorher.bevorzugterAnbieterId,
      }
    })
  }

  function anbieterAendern(
    id,
    feld,
    value,
  ) {
    setFormular((vorher) => ({
      ...vorher,

      anbieter: vorher.anbieter.map(
        (anbieter) => {
          if (anbieter.id !== id) {
            return anbieter
          }

          if (feld === 'lieferantId') {
            const lieferant =
              lieferanten.find(
                (eintrag) =>
                  eintrag.id === value,
              )

            return {
              ...anbieter,
              lieferantId: value,

              firma:
                lieferant?.firma ||
                anbieter.firma,

              zahlungsziel:
                anbieter.zahlungsziel ||
                lieferant?.zahlungsziel ||
                '',

              skonto:
                anbieter.skonto ||
                lieferant?.skonto ||
                '',
            }
          }

          return {
            ...anbieter,
            [feld]: value,
          }
        },
      ),
    }))
  }

  async function speichern() {
    const titel = formular.titel.trim()

    if (!titel) {
      setFehler(
        'Bitte einen Namen für den Wettbewerb eintragen.',
      )
      return
    }

    const gueltigeAnbieter =
      formular.anbieter.filter(
        (anbieter) =>
          anbieter.firma.trim(),
      )

    if (gueltigeAnbieter.length < 2) {
      setFehler(
        'Bitte mindestens zwei Anbieter für den Wettbewerb eintragen.',
      )
      return
    }

    const benutzer = auth.currentUser

    if (!benutzer) {
      setFehler('Kein Benutzer angemeldet.')
      return
    }

    setSpeichert(true)
    setFehler('')

    const anbieterDaten =
      gueltigeAnbieter.map(
        (anbieter) => ({
          ...anbieter,

          firma: anbieter.firma.trim(),

          preis: zahl(anbieter.preis),

          rabatt: zahl(
            anbieter.rabatt,
          ),

          skonto: zahl(
            anbieter.skonto,
          ),

          transportkosten: zahl(
            anbieter.transportkosten,
          ),

          nebenkosten: zahl(
            anbieter.nebenkosten,
          ),

          lieferzeit:
            anbieter.lieferzeit,

          zahlungsziel:
            anbieter.zahlungsziel,

          gesamtkosten:
            gesamtkosten(anbieter),
        }),
      )

    const bevorzugterAnbieter =
      anbieterDaten.find(
        (anbieter) =>
          anbieter.id ===
          formular.bevorzugterAnbieterId,
      )

    const daten = {
      titel,

      beschreibung:
        formular.beschreibung.trim(),

      status: formular.status,

      anbieter: anbieterDaten,

      bevorzugterAnbieterId:
        bevorzugterAnbieter?.id || '',

      bevorzugterAnbieterName:
        bevorzugterAnbieter?.firma || '',

      vergabeBegruendung:
        formular.vergabeBegruendung.trim(),

      userId: benutzer.uid,

      geaendertAm: serverTimestamp(),
    }

    try {
      if (bearbeitungsId) {
        await updateDoc(
          doc(
            db,
            'verhandlungsWettbewerbe',
            bearbeitungsId,
          ),
          daten,
        )
      } else {
        await addDoc(
          collection(
            db,
            'verhandlungsWettbewerbe',
          ),
          {
            ...daten,
            erstelltAm:
              serverTimestamp(),
          },
        )
      }

      setDialogOffen(false)
      setFormular(leerWettbewerb)
      setBearbeitungsId(null)
    } catch (error) {
      console.error(error)

      setFehler(
        'Der Wettbewerb konnte nicht gespeichert werden. Prüfe die Firestore-Regeln.',
      )
    } finally {
      setSpeichert(false)
    }
  }

  async function loeschen(wettbewerb) {
    const bestaetigt = window.confirm(
      `Wettbewerb „${wettbewerb.titel}“ wirklich löschen?`,
    )

    if (!bestaetigt) {
      return
    }

    try {
      await deleteDoc(
        doc(
          db,
          'verhandlungsWettbewerbe',
          wettbewerb.id,
        ),
      )
    } catch (error) {
      console.error(error)

      setFehler(
        'Der Wettbewerb konnte nicht gelöscht werden.',
      )
    }
  }

  return (
    <Stack spacing={2.5}>
      <Box
        sx={{
          display: 'flex',

          flexDirection: {
            xs: 'column',
            sm: 'row',
          },

          alignItems: {
            xs: 'stretch',
            sm: 'center',
          },

          gap: 2,
        }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Typography
            variant="h4"
            fontWeight={850}
          >
            Verhandlungen – Wettbewerb
          </Typography>

          <Typography color="text.secondary">
            Angebote vergleichen,
            Gesamtkosten berechnen und
            Vergabeentscheidungen
            dokumentieren.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={neu}
        >
          Wettbewerb anlegen
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
        fullWidth
        label="Wettbewerbe durchsuchen"
        placeholder="Bezeichnung, Anbieter, Beschreibung oder Status"
        value={suche}
        onChange={(event) =>
          setSuche(event.target.value)
        }
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      {laden ? (
        <Typography>
          Wettbewerbe werden geladen …
        </Typography>
      ) : gefilterteWettbewerbe.length ===
        0 ? (
        <Card variant="outlined">
          <CardContent
            sx={{
              textAlign: 'center',
              py: 6,
            }}
          >
            <CompareArrowsIcon
              color="primary"
              sx={{ fontSize: 48 }}
            />

            <Typography
              variant="h6"
              fontWeight={800}
              sx={{ mt: 1 }}
            >
              Noch kein Wettbewerb
              vorhanden
            </Typography>

            <Typography
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Lege mindestens zwei
              Anbieter an und vergleiche
              deren Gesamtkosten.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {gefilterteWettbewerbe.map(
            (wettbewerb) => {
              const anbieter =
                wettbewerb.anbieter || []

              const guenstigster =
                billigsterAnbieter(anbieter)

              return (
                <Card
                  key={wettbewerb.id}
                  variant="outlined"
                >
                  <CardContent>
                    <Stack
                      direction={{
                        xs: 'column',
                        md: 'row',
                      }}
                      justifyContent="space-between"
                      alignItems={{
                        xs: 'stretch',
                        md: 'flex-start',
                      }}
                      spacing={2}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          flexWrap="wrap"
                          useFlexGap
                        >
                          <Typography
                            variant="h6"
                            fontWeight={850}
                          >
                            {wettbewerb.titel}
                          </Typography>

                          <Chip
                            size="small"
                            label={
                              wettbewerb.status ||
                              'Offen'
                            }
                            color={statusFarbe(
                              wettbewerb.status,
                            )}
                          />
                        </Stack>

                        {wettbewerb.beschreibung && (
                          <Typography
                            color="text.secondary"
                            sx={{ mt: 0.6 }}
                          >
                            {
                              wettbewerb.beschreibung
                            }
                          </Typography>
                        )}
                      </Box>

                      <Stack
                        direction="row"
                        spacing={0.5}
                      >
                        <Tooltip title="Bearbeiten">
                          <IconButton
                            onClick={() =>
                              bearbeiten(
                                wettbewerb,
                              )
                            }
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Löschen">
                          <IconButton
                            color="error"
                            onClick={() =>
                              loeschen(
                                wettbewerb,
                              )
                            }
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>

                    <TableContainer
                      component={Paper}
                      variant="outlined"
                      sx={{ mt: 2 }}
                    >
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>
                              Anbieter
                            </TableCell>

                            <TableCell align="right">
                              Preis
                            </TableCell>

                            <TableCell align="right">
                              Rabatt
                            </TableCell>

                            <TableCell align="right">
                              Skonto
                            </TableCell>

                            <TableCell align="right">
                              Transport
                            </TableCell>

                            <TableCell align="right">
                              Nebenkosten
                            </TableCell>

                            <TableCell align="right">
                              Gesamtkosten
                            </TableCell>

                            <TableCell>
                              Lieferzeit
                            </TableCell>

                            <TableCell>
                              Zahlungsziel
                            </TableCell>
                          </TableRow>
                        </TableHead>

                        <TableBody>
                          {anbieter.map(
                            (eintrag) => {
                              const istGuenstigster =
                                guenstigster?.id ===
                                eintrag.id

                              const istBevorzugt =
                                wettbewerb.bevorzugterAnbieterId ===
                                eintrag.id

                              return (
                                <TableRow
                                  key={
                                    eintrag.id
                                  }
                                >
                                  <TableCell>
                                    <Stack
                                      direction="row"
                                      spacing={0.7}
                                      alignItems="center"
                                      flexWrap="wrap"
                                      useFlexGap
                                    >
                                      <BusinessIcon
                                        fontSize="small"
                                        color="action"
                                      />

                                      <Typography
                                        fontWeight={
                                          750
                                        }
                                      >
                                        {
                                          eintrag.firma
                                        }
                                      </Typography>

                                      {istGuenstigster && (
                                        <Chip
                                          size="small"
                                          color="success"
                                          icon={
                                            <EmojiEventsIcon />
                                          }
                                          label="Günstigster"
                                        />
                                      )}

                                      {istBevorzugt && (
                                        <Chip
                                          size="small"
                                          color="primary"
                                          icon={
                                            <StarIcon />
                                          }
                                          label="Bevorzugt"
                                        />
                                      )}
                                    </Stack>
                                  </TableCell>

                                  <TableCell align="right">
                                    {euro(
                                      eintrag.preis,
                                    )}
                                  </TableCell>

                                  <TableCell align="right">
                                    {zahl(
                                      eintrag.rabatt,
                                    )}{' '}
                                    %
                                  </TableCell>

                                  <TableCell align="right">
                                    {zahl(
                                      eintrag.skonto,
                                    )}{' '}
                                    %
                                  </TableCell>

                                  <TableCell align="right">
                                    {euro(
                                      eintrag.transportkosten,
                                    )}
                                  </TableCell>

                                  <TableCell align="right">
                                    {euro(
                                      eintrag.nebenkosten,
                                    )}
                                  </TableCell>

                                  <TableCell
                                    align="right"
                                    sx={{
                                      fontWeight:
                                        850,

                                      color:
                                        istGuenstigster
                                          ? 'success.main'
                                          : 'text.primary',
                                    }}
                                  >
                                    {euro(
                                      gesamtkosten(
                                        eintrag,
                                      ),
                                    )}
                                  </TableCell>

                                  <TableCell>
                                    {eintrag.lieferzeit
                                      ? `${eintrag.lieferzeit} Tage`
                                      : '—'}
                                  </TableCell>

                                  <TableCell>
                                    {eintrag.zahlungsziel
                                      ? `${eintrag.zahlungsziel} Tage`
                                      : '—'}
                                  </TableCell>
                                </TableRow>
                              )
                            },
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    <Box
                      sx={{
                        display: 'grid',

                        gridTemplateColumns: {
                          xs: '1fr',
                          md: 'repeat(2, minmax(0, 1fr))',
                        },

                        gap: 2,
                        mt: 2,
                      }}
                    >
                      <Paper
                        variant="outlined"
                        sx={{ p: 2 }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={800}
                        >
                          BEVORZUGTER ANBIETER
                        </Typography>

                        <Typography
                          fontWeight={850}
                          sx={{ mt: 0.5 }}
                        >
                          {wettbewerb.bevorzugterAnbieterName ||
                            'Noch nicht festgelegt'}
                        </Typography>
                      </Paper>

                      <Paper
                        variant="outlined"
                        sx={{ p: 2 }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={800}
                        >
                          VERGABEBEGRÜNDUNG
                        </Typography>

                        <Typography
                          sx={{ mt: 0.5 }}
                        >
                          {wettbewerb.vergabeBegruendung ||
                            'Noch keine Begründung hinterlegt.'}
                        </Typography>
                      </Paper>
                    </Box>
                  </CardContent>
                </Card>
              )
            },
          )}
        </Stack>
      )}

      <Dialog
        open={dialogOffen}
        onClose={() =>
          !speichert &&
          setDialogOffen(false)
        }
        fullWidth
        maxWidth="xl"
        fullScreen={istMobil}
      >
        <DialogTitle>
          {bearbeitungsId
            ? 'Wettbewerb bearbeiten'
            : 'Wettbewerb anlegen'}
        </DialogTitle>

        <DialogContent>
          <Stack
            spacing={2.5}
            sx={{ pt: 1 }}
          >
            <Box
              sx={{
                display: 'grid',

                gridTemplateColumns: {
                  xs: '1fr',
                  md: '2fr 1fr',
                },

                gap: 2,
              }}
            >
              <TextField
                name="titel"
                label="Bezeichnung des Wettbewerbs *"
                value={formular.titel}
                onChange={
                  hauptfeldAendern
                }
                fullWidth
              />

              <TextField
                name="status"
                label="Status"
                value={formular.status}
                onChange={
                  hauptfeldAendern
                }
                select
                fullWidth
              >
                <MenuItem value="Offen">
                  Offen
                </MenuItem>

                <MenuItem value="In Prüfung">
                  In Prüfung
                </MenuItem>

                <MenuItem value="Abgeschlossen">
                  Abgeschlossen
                </MenuItem>
              </TextField>
            </Box>

            <TextField
              name="beschreibung"
              label="Beschreibung / Gegenstand"
              value={formular.beschreibung}
              onChange={hauptfeldAendern}
              fullWidth
              multiline
              minRows={2}
            />

            <Divider />

            <Stack
              direction={{
                xs: 'column',
                sm: 'row',
              }}
              justifyContent="space-between"
              alignItems={{
                xs: 'stretch',
                sm: 'center',
              }}
              spacing={1}
            >
              <Box>
                <Typography
                  variant="h6"
                  fontWeight={850}
                >
                  Anbieter
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Mindestens zwei Anbieter
                  eintragen.
                </Typography>
              </Box>

              <Button
                startIcon={<AddIcon />}
                onClick={
                  anbieterHinzufuegen
                }
              >
                Anbieter hinzufügen
              </Button>
            </Stack>

            {formular.anbieter.map(
              (anbieter, index) => {
                const istGuenstigster =
                  billigsterImFormular?.id ===
                  anbieter.id

                return (
                  <Paper
                    key={anbieter.id}
                    variant="outlined"
                    sx={{
                      p: {
                        xs: 2,
                        md: 2.5,
                      },

                      borderColor:
                        istGuenstigster
                          ? 'success.main'
                          : 'divider',
                    }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      spacing={1}
                      sx={{ mb: 2 }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Typography
                          fontWeight={850}
                        >
                          Anbieter {index + 1}
                        </Typography>

                        {istGuenstigster && (
                          <Chip
                            size="small"
                            color="success"
                            icon={
                              <EmojiEventsIcon />
                            }
                            label="Aktuell günstigster"
                          />
                        )}
                      </Stack>

                      <Tooltip title="Anbieter entfernen">
                        <span>
                          <IconButton
                            color="error"
                            onClick={() =>
                              anbieterEntfernen(
                                anbieter.id,
                              )
                            }
                            disabled={
                              formular.anbieter
                                .length <= 2
                            }
                          >
                            <DeleteIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>

                    <Box
                      sx={{
                        display: 'grid',

                        gridTemplateColumns: {
                          xs: '1fr',
                          md: 'repeat(3, minmax(0, 1fr))',
                        },

                        gap: 2,
                      }}
                    >
                      <TextField
                        select
                        fullWidth
                        label="Bestehender Lieferant"
                        value={
                          anbieter.lieferantId
                        }
                        onChange={(event) =>
                          anbieterAendern(
                            anbieter.id,
                            'lieferantId',
                            event.target.value,
                          )
                        }
                      >
                        <MenuItem value="">
                          Manuell eintragen
                        </MenuItem>

                        {lieferanten.map(
                          (lieferant) => (
                            <MenuItem
                              key={
                                lieferant.id
                              }
                              value={
                                lieferant.id
                              }
                            >
                              {
                                lieferant.firma
                              }
                            </MenuItem>
                          ),
                        )}
                      </TextField>

                      <TextField
                        fullWidth
                        required
                        label="Firma"
                        value={anbieter.firma}
                        onChange={(event) =>
                          anbieterAendern(
                            anbieter.id,
                            'firma',
                            event.target.value,
                          )
                        }
                      />

                      <TextField
                        fullWidth
                        label="Preis netto"
                        type="number"
                        value={anbieter.preis}
                        onChange={(event) =>
                          anbieterAendern(
                            anbieter.id,
                            'preis',
                            event.target.value,
                          )
                        }
                        inputProps={{
                          min: 0,
                          step: 0.01,
                        }}
                      />

                      <TextField
                        fullWidth
                        label="Rabatt in %"
                        type="number"
                        value={
                          anbieter.rabatt
                        }
                        onChange={(event) =>
                          anbieterAendern(
                            anbieter.id,
                            'rabatt',
                            event.target.value,
                          )
                        }
                        inputProps={{
                          min: 0,
                          max: 100,
                          step: 0.01,
                        }}
                      />

                      <TextField
                        fullWidth
                        label="Skonto in %"
                        type="number"
                        value={
                          anbieter.skonto
                        }
                        onChange={(event) =>
                          anbieterAendern(
                            anbieter.id,
                            'skonto',
                            event.target.value,
                          )
                        }
                        inputProps={{
                          min: 0,
                          max: 100,
                          step: 0.01,
                        }}
                      />

                      <TextField
                        fullWidth
                        label="Transportkosten"
                        type="number"
                        value={
                          anbieter.transportkosten
                        }
                        onChange={(event) =>
                          anbieterAendern(
                            anbieter.id,
                            'transportkosten',
                            event.target.value,
                          )
                        }
                        inputProps={{
                          min: 0,
                          step: 0.01,
                        }}
                      />

                      <TextField
                        fullWidth
                        label="Nebenkosten"
                        type="number"
                        value={
                          anbieter.nebenkosten
                        }
                        onChange={(event) =>
                          anbieterAendern(
                            anbieter.id,
                            'nebenkosten',
                            event.target.value,
                          )
                        }
                        inputProps={{
                          min: 0,
                          step: 0.01,
                        }}
                      />

                      <TextField
                        fullWidth
                        label="Lieferzeit in Tagen"
                        type="number"
                        value={
                          anbieter.lieferzeit
                        }
                        onChange={(event) =>
                          anbieterAendern(
                            anbieter.id,
                            'lieferzeit',
                            event.target.value,
                          )
                        }
                        inputProps={{
                          min: 0,
                        }}
                      />

                      <TextField
                        fullWidth
                        label="Zahlungsziel in Tagen"
                        type="number"
                        value={
                          anbieter.zahlungsziel
                        }
                        onChange={(event) =>
                          anbieterAendern(
                            anbieter.id,
                            'zahlungsziel',
                            event.target.value,
                          )
                        }
                        inputProps={{
                          min: 0,
                        }}
                      />

                      <TextField
                        fullWidth
                        label="Notizen"
                        value={
                          anbieter.notizen
                        }
                        onChange={(event) =>
                          anbieterAendern(
                            anbieter.id,
                            'notizen',
                            event.target.value,
                          )
                        }
                        sx={{
                          gridColumn: {
                            md: 'span 2',
                          },
                        }}
                      />

                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.5,

                          display: 'flex',

                          flexDirection:
                            'column',

                          justifyContent:
                            'center',

                          bgcolor:
                            istGuenstigster
                              ? 'success.light'
                              : 'background.default',
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={800}
                        >
                          GESAMTKOSTEN
                        </Typography>

                        <Typography
                          variant="h6"
                          fontWeight={900}
                        >
                          {euro(
                            gesamtkosten(
                              anbieter,
                            ),
                          )}
                        </Typography>
                      </Paper>
                    </Box>
                  </Paper>
                )
              },
            )}

            <Divider />

            <Box
              sx={{
                display: 'grid',

                gridTemplateColumns: {
                  xs: '1fr',
                  md: '1fr 2fr',
                },

                gap: 2,
              }}
            >
              <TextField
                select
                fullWidth
                name="bevorzugterAnbieterId"
                label="Bevorzugter Anbieter"
                value={
                  formular.bevorzugterAnbieterId
                }
                onChange={
                  hauptfeldAendern
                }
              >
                <MenuItem value="">
                  Noch nicht festgelegt
                </MenuItem>

                {formular.anbieter
                  .filter((anbieter) =>
                    anbieter.firma.trim(),
                  )
                  .map((anbieter) => (
                    <MenuItem
                      key={anbieter.id}
                      value={anbieter.id}
                    >
                      {anbieter.firma}
                    </MenuItem>
                  ))}
              </TextField>

              <TextField
                fullWidth
                name="vergabeBegruendung"
                label="Vergabebegründung"
                value={
                  formular.vergabeBegruendung
                }
                onChange={
                  hauptfeldAendern
                }
                multiline
                minRows={2}
              />
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() =>
              setDialogOffen(false)
            }
            disabled={speichert}
          >
            Abbrechen
          </Button>

          <Button
            variant="contained"
            onClick={speichern}
            disabled={speichert}
          >
            {speichert
              ? 'Speichert …'
              : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

