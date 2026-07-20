import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BusinessIcon from "@mui/icons-material/Business";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import EventIcon from "@mui/icons-material/Event";
import HistoryIcon from "@mui/icons-material/History";
import PersonIcon from "@mui/icons-material/Person";
import SearchIcon from "@mui/icons-material/Search";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
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
} from "firebase/firestore";
import { auth, db } from "../firebase";

const leerLieferant = {
  firma: "",
  kategorie: "Material",
  status: "Aktiv",
  kundennummer: "",
  strasse: "",
  plz: "",
  ort: "",
  website: "",
  telefon: "",
  email: "",
  zahlungsziel: "",
  skonto: "",
  lieferbedingungen: "",
  standardrabatt: "",
  bonusvereinbarung: "",
  notizen: "",
};

const leerKontakt = {
  name: "",
  position: "",
  telefon: "",
  mobil: "",
  email: "",
  geburtstag: "",
  notizen: "",
};

const leerAufgabe = {
  titel: "",
  faelligAm: "",
  prioritaet: "Mittel",
  status: "Offen",
  notizen: "",
};

function formatDatum(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("de-DE");
}

function heute() {
  return new Date().toISOString().slice(0, 10);
}

function sortByName(a, b) {
  return String(a.firma || "").localeCompare(String(b.firma || ""), "de");
}

function InfoCard({ label, value, icon }) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography color="text.secondary" fontWeight={600}>{label}</Typography>
            <Typography variant="h4" fontWeight={800} mt={1}>{value}</Typography>
          </Box>
          {icon}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function CRM() {
  const theme = useTheme();
  const mobil = useMediaQuery(theme.breakpoints.down("md"));
  const user = auth.currentUser;

  const [lieferanten, setLieferanten] = useState([]);
  const [kontakte, setKontakte] = useState([]);
  const [aufgaben, setAufgaben] = useState([]);
  const [verhandlungen, setVerhandlungen] = useState([]);
  const [historie, setHistorie] = useState([]);
  const [auswahl, setAuswahl] = useState(null);
  const [detailTab, setDetailTab] = useState(0);
  const [suche, setSuche] = useState("");
  const [statusFilter, setStatusFilter] = useState("Alle");
  const [fehler, setFehler] = useState("");
  const [speichert, setSpeichert] = useState(false);

  const [lieferantDialog, setLieferantDialog] = useState(false);
  const [lieferantForm, setLieferantForm] = useState(leerLieferant);
  const [lieferantId, setLieferantId] = useState(null);

  const [kontaktDialog, setKontaktDialog] = useState(false);
  const [kontaktForm, setKontaktForm] = useState(leerKontakt);
  const [kontaktId, setKontaktId] = useState(null);

  const [aufgabeDialog, setAufgabeDialog] = useState(false);
  const [aufgabeForm, setAufgabeForm] = useState(leerAufgabe);
  const [aufgabeId, setAufgabeId] = useState(null);

  useEffect(() => {
    if (!user) {
      setFehler("Kein Benutzer angemeldet.");
      return undefined;
    }

    const unsub = [];
    const listen = (collectionName, setter) => {
      const q = query(collection(db, collectionName), where("userId", "==", user.uid));
      unsub.push(onSnapshot(q, (snapshot) => {
        setter(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, (error) => {
        console.error(error);
        setFehler(`Daten aus ${collectionName} konnten nicht geladen werden.`);
      }));
    };

    listen("lieferanten", setLieferanten);
    listen("ansprechpartner", setKontakte);
    listen("aufgaben", setAufgaben);
    listen("verhandlungen", setVerhandlungen);
    listen("historie", setHistorie);

    return () => unsub.forEach((fn) => fn());
  }, [user]);

  useEffect(() => {
    if (!auswahl) return;
    const aktuell = lieferanten.find((x) => x.id === auswahl.id);
    if (aktuell) setAuswahl(aktuell);
  }, [lieferanten, auswahl?.id]);

  const gefiltert = useMemo(() => {
    const term = suche.trim().toLowerCase();
    return [...lieferanten]
      .filter((x) => statusFilter === "Alle" || x.status === statusFilter)
      .filter((x) => {
        if (!term) return true;
        return [x.firma, x.kategorie, x.ort, x.kundennummer, x.email, x.notizen]
          .some((v) => String(v || "").toLowerCase().includes(term));
      })
      .sort(sortByName);
  }, [lieferanten, suche, statusFilter]);

  const offeneAufgaben = aufgaben.filter((x) => x.status !== "Erledigt");
  const faelligeAufgaben = offeneAufgaben.filter((x) => x.faelligAm && x.faelligAm <= heute());
  const aktiveLieferanten = lieferanten.filter((x) => x.status === "Aktiv").length;

  const lieferantenKontakte = kontakte.filter((x) => x.lieferantId === auswahl?.id);
  const lieferantenAufgaben = aufgaben
    .filter((x) => x.lieferantId === auswahl?.id)
    .sort((a, b) => String(a.faelligAm || "9999").localeCompare(String(b.faelligAm || "9999")));
  const lieferantenVerhandlungen = verhandlungen.filter((x) => x.lieferantId === auswahl?.id);
  const lieferantenHistorie = historie
    .filter((x) => x.lieferantId === auswahl?.id)
    .sort((a, b) => (b.erstelltAm?.seconds || 0) - (a.erstelltAm?.seconds || 0));

  async function historieSchreiben(lieferant, text) {
    if (!user || !lieferant) return;
    await addDoc(collection(db, "historie"), {
      userId: user.uid,
      lieferantId: lieferant.id,
      firma: lieferant.firma,
      text,
      erstelltAm: serverTimestamp(),
    });
  }

  function lieferantNeu() {
    setLieferantId(null);
    setLieferantForm(leerLieferant);
    setLieferantDialog(true);
  }

  function lieferantBearbeiten(lieferant) {
    setLieferantId(lieferant.id);
    setLieferantForm({ ...leerLieferant, ...lieferant });
    setLieferantDialog(true);
  }

  async function lieferantSpeichern() {
    if (!user || !lieferantForm.firma.trim()) return;
    setSpeichert(true);
    try {
      if (lieferantId) {
        await updateDoc(doc(db, "lieferanten", lieferantId), {
          ...lieferantForm,
          userId: user.uid,
          aktualisiertAm: serverTimestamp(),
        });
        await historieSchreiben({ id: lieferantId, firma: lieferantForm.firma }, "Lieferantendaten bearbeitet");
      } else {
        const ref = await addDoc(collection(db, "lieferanten"), {
          ...lieferantForm,
          userId: user.uid,
          erstelltAm: serverTimestamp(),
          aktualisiertAm: serverTimestamp(),
        });
        await historieSchreiben({ id: ref.id, firma: lieferantForm.firma }, "Lieferant angelegt");
      }
      setLieferantDialog(false);
    } catch (error) {
      console.error(error);
      setFehler("Lieferant konnte nicht gespeichert werden.");
    } finally {
      setSpeichert(false);
    }
  }

  async function lieferantLoeschen(lieferant) {
    if (!window.confirm(`${lieferant.firma} wirklich löschen?`)) return;
    try {
      await deleteDoc(doc(db, "lieferanten", lieferant.id));
      if (auswahl?.id === lieferant.id) setAuswahl(null);
    } catch (error) {
      console.error(error);
      setFehler("Lieferant konnte nicht gelöscht werden.");
    }
  }

  function kontaktNeu() {
    setKontaktId(null);
    setKontaktForm(leerKontakt);
    setKontaktDialog(true);
  }

  function kontaktBearbeiten(kontakt) {
    setKontaktId(kontakt.id);
    setKontaktForm({ ...leerKontakt, ...kontakt });
    setKontaktDialog(true);
  }

  async function kontaktSpeichern() {
    if (!user || !auswahl || !kontaktForm.name.trim()) return;
    setSpeichert(true);
    try {
      const data = {
        ...kontaktForm,
        userId: user.uid,
        lieferantId: auswahl.id,
        firma: auswahl.firma,
        aktualisiertAm: serverTimestamp(),
      };
      if (kontaktId) await updateDoc(doc(db, "ansprechpartner", kontaktId), data);
      else await addDoc(collection(db, "ansprechpartner"), { ...data, erstelltAm: serverTimestamp() });
      await historieSchreiben(auswahl, kontaktId ? "Ansprechpartner bearbeitet" : `Ansprechpartner ${kontaktForm.name} hinzugefügt`);
      setKontaktDialog(false);
    } catch (error) {
      console.error(error);
      setFehler("Ansprechpartner konnte nicht gespeichert werden.");
    } finally {
      setSpeichert(false);
    }
  }

  async function kontaktLoeschen(kontakt) {
    if (!window.confirm(`${kontakt.name} wirklich löschen?`)) return;
    await deleteDoc(doc(db, "ansprechpartner", kontakt.id));
    await historieSchreiben(auswahl, `Ansprechpartner ${kontakt.name} gelöscht`);
  }

  function aufgabeNeu() {
    setAufgabeId(null);
    setAufgabeForm(leerAufgabe);
    setAufgabeDialog(true);
  }

  function aufgabeBearbeiten(aufgabe) {
    setAufgabeId(aufgabe.id);
    setAufgabeForm({ ...leerAufgabe, ...aufgabe });
    setAufgabeDialog(true);
  }

  async function aufgabeSpeichern() {
    if (!user || !auswahl || !aufgabeForm.titel.trim()) return;
    setSpeichert(true);
    try {
      const data = {
        ...aufgabeForm,
        userId: user.uid,
        lieferantId: auswahl.id,
        firma: auswahl.firma,
        aktualisiertAm: serverTimestamp(),
      };
      if (aufgabeId) await updateDoc(doc(db, "aufgaben", aufgabeId), data);
      else await addDoc(collection(db, "aufgaben"), { ...data, erstelltAm: serverTimestamp() });
      await historieSchreiben(auswahl, aufgabeId ? "Aufgabe bearbeitet" : `Aufgabe erstellt: ${aufgabeForm.titel}`);
      setAufgabeDialog(false);
    } catch (error) {
      console.error(error);
      setFehler("Aufgabe konnte nicht gespeichert werden.");
    } finally {
      setSpeichert(false);
    }
  }

  async function aufgabeStatus(aufgabe, erledigt) {
    await updateDoc(doc(db, "aufgaben", aufgabe.id), {
      status: erledigt ? "Erledigt" : "Offen",
      erledigtAm: erledigt ? serverTimestamp() : null,
      aktualisiertAm: serverTimestamp(),
    });
    await historieSchreiben(auswahl, erledigt ? `Aufgabe erledigt: ${aufgabe.titel}` : `Aufgabe wieder geöffnet: ${aufgabe.titel}`);
  }

  async function aufgabeLoeschen(aufgabe) {
    if (!window.confirm(`Aufgabe „${aufgabe.titel}“ löschen?`)) return;
    await deleteDoc(doc(db, "aufgaben", aufgabe.id));
    await historieSchreiben(auswahl, `Aufgabe gelöscht: ${aufgabe.titel}`);
  }

  if (auswahl) {
    return (
      <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
        {fehler && <Alert severity="error" sx={{ mb: 2 }}>{fehler}</Alert>}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" mb={2}>
          <Box>
            <Button startIcon={<ArrowBackIcon />} onClick={() => setAuswahl(null)} sx={{ mb: 1 }}>Zurück zur Übersicht</Button>
            <Typography variant={mobil ? "h5" : "h4"} fontWeight={900}>{auswahl.firma}</Typography>
            <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
              <Chip label={auswahl.kategorie || "Ohne Kategorie"} />
              <Chip label={auswahl.status || "Aktiv"} color={auswahl.status === "Aktiv" ? "success" : "default"} />
              {auswahl.kundennummer && <Chip label={`Kd.-Nr. ${auswahl.kundennummer}`} variant="outlined" />}
            </Stack>
          </Box>
          <Button variant="outlined" startIcon={<EditIcon />} onClick={() => lieferantBearbeiten(auswahl)}>Stammdaten bearbeiten</Button>
        </Stack>

        <Paper sx={{ mb: 3, overflowX: "auto" }}>
          <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)} variant="scrollable" scrollButtons="auto">
            <Tab label="Übersicht" />
            <Tab label={`Ansprechpartner (${lieferantenKontakte.length})`} />
            <Tab label={`Aufgaben (${lieferantenAufgaben.filter((x) => x.status !== "Erledigt").length})`} />
            <Tab label={`Verhandlungen (${lieferantenVerhandlungen.length})`} />
            <Tab label="Konditionen" />
            <Tab label="Historie" />
          </Tabs>
        </Paper>

        {detailTab === 0 && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={800} mb={2}>Stammdaten</Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">Adresse</Typography><Typography>{[auswahl.strasse, [auswahl.plz, auswahl.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"}</Typography></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">Telefon</Typography><Typography>{auswahl.telefon || "—"}</Typography></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">E-Mail</Typography><Typography sx={{ overflowWrap: "anywhere" }}>{auswahl.email || "—"}</Typography></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">Website</Typography><Typography sx={{ overflowWrap: "anywhere" }}>{auswahl.website || "—"}</Typography></Grid>
                  </Grid>
                  <Divider sx={{ my: 2 }} />
                  <Typography color="text.secondary">Notizen</Typography>
                  <Typography sx={{ whiteSpace: "pre-wrap" }}>{auswahl.notizen || "Keine Notizen hinterlegt."}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Stack spacing={2}>
                <InfoCard label="Ansprechpartner" value={lieferantenKontakte.length} icon={<PersonIcon color="primary" fontSize="large" />} />
                <InfoCard label="Offene Aufgaben" value={lieferantenAufgaben.filter((x) => x.status !== "Erledigt").length} icon={<TaskAltIcon color="warning" fontSize="large" />} />
                <InfoCard label="Verhandlungen" value={lieferantenVerhandlungen.length} icon={<BusinessIcon color="success" fontSize="large" />} />
              </Stack>
            </Grid>
          </Grid>
        )}

        {detailTab === 1 && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight={800}>Ansprechpartner</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={kontaktNeu}>Hinzufügen</Button>
            </Stack>
            <Grid container spacing={2}>
              {lieferantenKontakte.map((kontakt) => (
                <Grid key={kontakt.id} size={{ xs: 12, md: 6 }}>
                  <Card>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between">
                        <Box><Typography variant="h6" fontWeight={800}>{kontakt.name}</Typography><Typography color="text.secondary">{kontakt.position || "Keine Position"}</Typography></Box>
                        <Box><IconButton onClick={() => kontaktBearbeiten(kontakt)}><EditIcon /></IconButton><IconButton color="error" onClick={() => kontaktLoeschen(kontakt)}><DeleteIcon /></IconButton></Box>
                      </Stack>
                      <Divider sx={{ my: 2 }} />
                      <Typography>Telefon: {kontakt.telefon || "—"}</Typography>
                      <Typography>Mobil: {kontakt.mobil || "—"}</Typography>
                      <Typography sx={{ overflowWrap: "anywhere" }}>E-Mail: {kontakt.email || "—"}</Typography>
                      <Typography>Geburtstag: {formatDatum(kontakt.geburtstag)}</Typography>
                      {kontakt.notizen && <Typography mt={1} color="text.secondary">{kontakt.notizen}</Typography>}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {lieferantenKontakte.length === 0 && <Grid size={{ xs: 12 }}><Alert severity="info">Noch keine Ansprechpartner hinterlegt.</Alert></Grid>}
            </Grid>
          </Box>
        )}

        {detailTab === 2 && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight={800}>Aufgaben und Wiedervorlagen</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={aufgabeNeu}>Aufgabe</Button>
            </Stack>
            <Stack spacing={1.5}>
              {lieferantenAufgaben.map((aufgabe) => {
                const ueberfaellig = aufgabe.status !== "Erledigt" && aufgabe.faelligAm && aufgabe.faelligAm < heute();
                return (
                  <Card key={aufgabe.id} variant="outlined">
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Checkbox checked={aufgabe.status === "Erledigt"} onChange={(e) => aufgabeStatus(aufgabe, e.target.checked)} />
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography fontWeight={800} sx={{ textDecoration: aufgabe.status === "Erledigt" ? "line-through" : "none" }}>{aufgabe.titel}</Typography>
                          <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
                            <Chip size="small" label={aufgabe.prioritaet} color={aufgabe.prioritaet === "Hoch" ? "error" : aufgabe.prioritaet === "Mittel" ? "warning" : "default"} />
                            <Chip size="small" label={aufgabe.faelligAm ? `Fällig ${formatDatum(aufgabe.faelligAm)}` : "Ohne Fälligkeit"} color={ueberfaellig ? "error" : "default"} variant="outlined" />
                          </Stack>
                          {aufgabe.notizen && <Typography mt={1} color="text.secondary">{aufgabe.notizen}</Typography>}
                        </Box>
                        <IconButton onClick={() => aufgabeBearbeiten(aufgabe)}><EditIcon /></IconButton>
                        <IconButton color="error" onClick={() => aufgabeLoeschen(aufgabe)}><DeleteIcon /></IconButton>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
              {lieferantenAufgaben.length === 0 && <Alert severity="info">Noch keine Aufgaben vorhanden.</Alert>}
            </Stack>
          </Box>
        )}

        {detailTab === 3 && (
          <Stack spacing={1.5}>
            {lieferantenVerhandlungen.map((v) => (
              <Card key={v.id} variant="outlined"><CardContent><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}><Box><Typography fontWeight={800}>{v.firma || auswahl.firma}</Typography><Typography color="text.secondary">{v.notizen || "Keine Notiz"}</Typography></Box><Stack direction="row" spacing={1}><Chip label={v.status || "Offen"} /><Chip label={v.prioritaet || "Mittel"} variant="outlined" /></Stack></Stack></CardContent></Card>
            ))}
            {lieferantenVerhandlungen.length === 0 && <Alert severity="info">Noch keine Verhandlung mit diesem Lieferanten verknüpft.</Alert>}
          </Stack>
        )}

        {detailTab === 4 && (
          <Card><CardContent><Typography variant="h6" fontWeight={800} mb={2}>Konditionen</Typography><Grid container spacing={2}><Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">Zahlungsziel</Typography><Typography>{auswahl.zahlungsziel || "—"}</Typography></Grid><Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">Skonto</Typography><Typography>{auswahl.skonto || "—"}</Typography></Grid><Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">Standardrabatt</Typography><Typography>{auswahl.standardrabatt || "—"}</Typography></Grid><Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">Bonusvereinbarung</Typography><Typography>{auswahl.bonusvereinbarung || "—"}</Typography></Grid><Grid size={{ xs: 12 }}><Typography color="text.secondary">Lieferbedingungen</Typography><Typography>{auswahl.lieferbedingungen || "—"}</Typography></Grid></Grid></CardContent></Card>
        )}

        {detailTab === 5 && (
          <Stack spacing={1.5}>
            {lieferantenHistorie.map((h) => <Card key={h.id} variant="outlined"><CardContent><Stack direction="row" spacing={2} alignItems="center"><HistoryIcon color="action" /><Box><Typography fontWeight={700}>{h.text}</Typography><Typography color="text.secondary" variant="body2">{h.erstelltAm?.toDate ? h.erstelltAm.toDate().toLocaleString("de-DE") : "Gerade eben"}</Typography></Box></Stack></CardContent></Card>)}
            {lieferantenHistorie.length === 0 && <Alert severity="info">Noch keine Historieneinträge vorhanden.</Alert>}
          </Stack>
        )}

        <LieferantDialog open={lieferantDialog} onClose={() => setLieferantDialog(false)} form={lieferantForm} setForm={setLieferantForm} onSave={lieferantSpeichern} editing={Boolean(lieferantId)} saving={speichert} />
        <KontaktDialog open={kontaktDialog} onClose={() => setKontaktDialog(false)} form={kontaktForm} setForm={setKontaktForm} onSave={kontaktSpeichern} editing={Boolean(kontaktId)} saving={speichert} />
        <AufgabeDialog open={aufgabeDialog} onClose={() => setAufgabeDialog(false)} form={aufgabeForm} setForm={setAufgabeForm} onSave={aufgabeSpeichern} editing={Boolean(aufgabeId)} saving={speichert} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
      {fehler && <Alert severity="error" sx={{ mb: 2 }}>{fehler}</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2} mb={3}>
        <Box><Typography variant={mobil ? "h5" : "h4"} fontWeight={900}>Lieferanten-CRM</Typography><Typography color="text.secondary">Lieferanten, Ansprechpartner, Aufgaben und Verhandlungen zentral verwalten.</Typography></Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={lieferantNeu}>Neuer Lieferant</Button>
      </Stack>

      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><InfoCard label="Lieferanten" value={lieferanten.length} icon={<BusinessIcon color="primary" fontSize="large" />} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><InfoCard label="Aktiv" value={aktiveLieferanten} icon={<CheckCircleIcon color="success" fontSize="large" />} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><InfoCard label="Offene Aufgaben" value={offeneAufgaben.length} icon={<TaskAltIcon color="warning" fontSize="large" />} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><InfoCard label="Fällig/überfällig" value={faelligeAufgaben.length} icon={<EventIcon color="error" fontSize="large" />} /></Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth label="Lieferanten suchen" value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Firma, Ort, Kundennummer, E-Mail oder Notiz" slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} /></Grid>
          <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><MenuItem value="Alle">Alle</MenuItem><MenuItem value="Aktiv">Aktiv</MenuItem><MenuItem value="Inaktiv">Inaktiv</MenuItem></TextField></Grid>
        </Grid>
      </Paper>

      <Grid container spacing={2}>
        {gefiltert.map((lieferant) => {
          const offen = aufgaben.filter((a) => a.lieferantId === lieferant.id && a.status !== "Erledigt").length;
          const anzahlKontakte = kontakte.filter((k) => k.lieferantId === lieferant.id).length;
          return (
            <Grid key={lieferant.id} size={{ xs: 12, md: 6, lg: 4 }}>
              <Card sx={{ height: "100%", cursor: "pointer", transition: "0.2s", "&:hover": { transform: "translateY(-2px)", boxShadow: 4 } }} onClick={() => { setAuswahl(lieferant); setDetailTab(0); }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Box sx={{ minWidth: 0 }}><Typography variant="h6" fontWeight={900}>{lieferant.firma}</Typography><Typography color="text.secondary">{[lieferant.plz, lieferant.ort].filter(Boolean).join(" ") || "Kein Ort"}</Typography></Box>
                    <Box onClick={(e) => e.stopPropagation()}><Tooltip title="Bearbeiten"><IconButton onClick={() => lieferantBearbeiten(lieferant)}><EditIcon /></IconButton></Tooltip><Tooltip title="Löschen"><IconButton color="error" onClick={() => lieferantLoeschen(lieferant)}><DeleteIcon /></IconButton></Tooltip></Box>
                  </Stack>
                  <Stack direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap><Chip size="small" label={lieferant.kategorie || "Sonstiges"} /><Chip size="small" label={lieferant.status || "Aktiv"} color={lieferant.status === "Aktiv" ? "success" : "default"} /></Stack>
                  <Divider sx={{ my: 2 }} />
                  <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Ansprechpartner</Typography><Typography fontWeight={700}>{anzahlKontakte}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Offene Aufgaben</Typography><Typography fontWeight={700}>{offen}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Verhandlungen</Typography><Typography fontWeight={700}>{verhandlungen.filter((v) => v.lieferantId === lieferant.id).length}</Typography></Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
        {gefiltert.length === 0 && <Grid size={{ xs: 12 }}><Alert severity="info">Keine Lieferanten gefunden.</Alert></Grid>}
      </Grid>

      <LieferantDialog open={lieferantDialog} onClose={() => setLieferantDialog(false)} form={lieferantForm} setForm={setLieferantForm} onSave={lieferantSpeichern} editing={Boolean(lieferantId)} saving={speichert} />
    </Box>
  );
}

function LieferantDialog({ open, onClose, form, setForm, onSave, editing, saving }) {
  const change = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const field = (name, label, extra = {}) => <TextField fullWidth name={name} label={label} value={form[name] || ""} onChange={change} {...extra} />;
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md"><DialogTitle>{editing ? "Lieferant bearbeiten" : "Neuen Lieferanten anlegen"}</DialogTitle><DialogContent><Grid container spacing={2} mt={0.5}><Grid size={{ xs: 12, md: 8 }}>{field("firma", "Firma", { required: true })}</Grid><Grid size={{ xs: 12, md: 4 }}>{field("status", "Status", { select: true, children: [<MenuItem key="a" value="Aktiv">Aktiv</MenuItem>, <MenuItem key="i" value="Inaktiv">Inaktiv</MenuItem>] })}</Grid><Grid size={{ xs: 12, md: 6 }}>{field("kategorie", "Kategorie", { select: true, children: ["Material", "Maschine", "Fahrzeug", "Dienstleistung", "Personal", "Sonstiges"].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>) })}</Grid><Grid size={{ xs: 12, md: 6 }}>{field("kundennummer", "Kundennummer")}</Grid><Grid size={{ xs: 12 }}>{field("strasse", "Straße und Hausnummer")}</Grid><Grid size={{ xs: 12, sm: 4 }}>{field("plz", "PLZ")}</Grid><Grid size={{ xs: 12, sm: 8 }}>{field("ort", "Ort")}</Grid><Grid size={{ xs: 12, md: 6 }}>{field("telefon", "Telefon")}</Grid><Grid size={{ xs: 12, md: 6 }}>{field("email", "E-Mail")}</Grid><Grid size={{ xs: 12 }}>{field("website", "Website")}</Grid><Grid size={{ xs: 12, md: 6 }}>{field("zahlungsziel", "Zahlungsziel")}</Grid><Grid size={{ xs: 12, md: 6 }}>{field("skonto", "Skonto")}</Grid><Grid size={{ xs: 12, md: 6 }}>{field("standardrabatt", "Standardrabatt")}</Grid><Grid size={{ xs: 12, md: 6 }}>{field("bonusvereinbarung", "Bonusvereinbarung")}</Grid><Grid size={{ xs: 12 }}>{field("lieferbedingungen", "Lieferbedingungen")}</Grid><Grid size={{ xs: 12 }}>{field("notizen", "Notizen", { multiline: true, minRows: 3 })}</Grid></Grid></DialogContent><DialogActions><Button onClick={onClose}>Abbrechen</Button><Button variant="contained" onClick={onSave} disabled={saving || !form.firma.trim()}>{saving ? "Speichert…" : "Speichern"}</Button></DialogActions></Dialog>;
}

function KontaktDialog({ open, onClose, form, setForm, onSave, editing, saving }) {
  const change = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>{editing ? "Ansprechpartner bearbeiten" : "Ansprechpartner hinzufügen"}</DialogTitle><DialogContent><Stack spacing={2} mt={1}><TextField name="name" label="Name" required value={form.name} onChange={change} /><TextField name="position" label="Position" value={form.position} onChange={change} /><TextField name="telefon" label="Telefon" value={form.telefon} onChange={change} /><TextField name="mobil" label="Mobil" value={form.mobil} onChange={change} /><TextField name="email" label="E-Mail" value={form.email} onChange={change} /><TextField name="geburtstag" label="Geburtstag" type="date" value={form.geburtstag} onChange={change} slotProps={{ inputLabel: { shrink: true } }} /><TextField name="notizen" label="Notizen" multiline minRows={3} value={form.notizen} onChange={change} /></Stack></DialogContent><DialogActions><Button onClick={onClose}>Abbrechen</Button><Button variant="contained" onClick={onSave} disabled={saving || !form.name.trim()}>Speichern</Button></DialogActions></Dialog>;
}

function AufgabeDialog({ open, onClose, form, setForm, onSave, editing, saving }) {
  const change = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>{editing ? "Aufgabe bearbeiten" : "Aufgabe anlegen"}</DialogTitle><DialogContent><Stack spacing={2} mt={1}><TextField name="titel" label="Aufgabe" required value={form.titel} onChange={change} /><TextField name="faelligAm" label="Fällig am" type="date" value={form.faelligAm} onChange={change} slotProps={{ inputLabel: { shrink: true } }} /><TextField select name="prioritaet" label="Priorität" value={form.prioritaet} onChange={change}>{["Niedrig", "Mittel", "Hoch"].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField><TextField select name="status" label="Status" value={form.status} onChange={change}>{["Offen", "In Bearbeitung", "Erledigt"].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField><TextField name="notizen" label="Notizen" multiline minRows={3} value={form.notizen} onChange={change} /></Stack></DialogContent><DialogActions><Button onClick={onClose}>Abbrechen</Button><Button variant="contained" onClick={onSave} disabled={saving || !form.titel.trim()}>Speichern</Button></DialogActions></Dialog>;
}
