import { useEffect, useMemo, useState } from "react";
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
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutlined";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import HandshakeIcon from "@mui/icons-material/Handshake";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import SavingsIcon from "@mui/icons-material/Savings";
import EventNoteIcon from "@mui/icons-material/EventNote";
import BusinessIcon from "@mui/icons-material/Business";
import CalculateIcon from "@mui/icons-material/Calculate";
import PersonIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutlined";

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

const leerVerhandlungsFormular = {
  lieferantId: "",
  firma: "",
  ansprechpartner: "",
  telefon: "",
  email: "",
  kategorie: "Material",
  status: "Offen",
  prioritaet: "Mittel",
  ausgangsangebot: "",
  aktuellesAngebot: "",
  zielpreis: "",
  schmerzgrenze: "",
  wiedervorlage: "",
  notizen: "",
};

const leerLieferantenFormular = {
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
  ansprechpartner: "",
  position: "",
  mobil: "",
  kontaktEmail: "",
  zahlungsziel: "",
  skonto: "",
  lieferbedingungen: "",
  notizen: "",
};

function euroWert(wert) {
  const zahl = Number(wert);
  return Number.isFinite(zahl) ? zahl : 0;
}

function euroFormat(wert) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(euroWert(wert));
}

function datumFormat(wert) {
  if (!wert) return "—";
  return new Date(`${wert}T00:00:00`).toLocaleDateString("de-DE");
}

function heuteText() {
  const heute = new Date();
  return [
    heute.getFullYear(),
    String(heute.getMonth() + 1).padStart(2, "0"),
    String(heute.getDate()).padStart(2, "0"),
  ].join("-");
}

function einsparung(eintrag) {
  return Math.max(
    euroWert(eintrag.ausgangsangebot) - euroWert(eintrag.aktuellesAngebot),
    0
  );
}

function prozentFormat(wert) {
  const zahl = Number(wert);
  const sicher = Number.isFinite(zahl) ? zahl : 0;
  return `${new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(sicher)} %`;
}

function einsparungProzent(eintrag) {
  const ausgang = euroWert(eintrag.ausgangsangebot);
  if (ausgang <= 0) return 0;
  return (einsparung(eintrag) / ausgang) * 100;
}

function preisvergleich(ausgangswert, zielwert) {
  const ausgang = euroWert(ausgangswert);
  const ziel = euroWert(zielwert);
  const differenz = ausgang - ziel;
  const prozent = ausgang > 0 ? (differenz / ausgang) * 100 : 0;
  return { ausgang, ziel, differenz, prozent };
}

let vergleichszeilenZaehler = 0;

function neueVergleichszeile(bezeichnung = "Zielpreis", wert = "") {
  vergleichszeilenZaehler += 1;
  return {
    id: `vergleich-${Date.now()}-${vergleichszeilenZaehler}`,
    bezeichnung,
    wert: wert === null || wert === undefined ? "" : String(wert),
  };
}

export default function Verhandlungen() {
  const theme = useTheme();
  const istMobil = useMediaQuery(theme.breakpoints.down("md"));

  const [ansicht, setAnsicht] = useState("verhandlungen");

  const [verhandlungen, setVerhandlungen] = useState([]);
  const [verhandlungsFormular, setVerhandlungsFormular] = useState(
    leerVerhandlungsFormular
  );
  const [verhandlungsDialogOffen, setVerhandlungsDialogOffen] = useState(false);
  const [verhandlungsBearbeitungsId, setVerhandlungsBearbeitungsId] =
    useState(null);

  const [lieferanten, setLieferanten] = useState([]);
  const [lieferantenFormular, setLieferantenFormular] = useState(
    leerLieferantenFormular
  );
  const [lieferantenDialogOffen, setLieferantenDialogOffen] = useState(false);
  const [lieferantenBearbeitungsId, setLieferantenBearbeitungsId] =
    useState(null);

  const [suche, setSuche] = useState("");
  const [statusFilter, setStatusFilter] = useState("Alle");
  const [prioritaetFilter, setPrioritaetFilter] = useState("Alle");
  const [sortierung, setSortierung] = useState("firma");
  const [sortRichtung, setSortRichtung] = useState("asc");

  const [lieferantenSuche, setLieferantenSuche] = useState("");
  const [lieferantenKategorieFilter, setLieferantenKategorieFilter] =
    useState("Alle");
  const [lieferantenStatusFilter, setLieferantenStatusFilter] =
    useState("Alle");

  const [fehler, setFehler] = useState("");
  const [speichert, setSpeichert] = useState(false);

  const [rechnerOffen, setRechnerOffen] = useState(false);
  const [rechnerAusgang, setRechnerAusgang] = useState("");
  const [rechnerVergleiche, setRechnerVergleiche] = useState([
    neueVergleichszeile("Zielpreis 1"),
    neueVergleichszeile("Zielpreis 2"),
  ]);
  const [rechnerKontext, setRechnerKontext] = useState("frei");

  useEffect(() => {
    const benutzer = auth.currentUser;

    if (!benutzer) {
      setFehler("Kein Benutzer angemeldet.");
      return undefined;
    }

    const verhandlungenAbfrage = query(
      collection(db, "verhandlungen"),
      where("userId", "==", benutzer.uid)
    );

    const lieferantenAbfrage = query(
      collection(db, "lieferanten"),
      where("userId", "==", benutzer.uid)
    );

    const verhandlungenAbmelden = onSnapshot(
      verhandlungenAbfrage,
      (snapshot) => {
        setVerhandlungen(
          snapshot.docs.map((eintrag) => ({
            id: eintrag.id,
            ...eintrag.data(),
          }))
        );
        setFehler("");
      },
      (error) => {
        console.error(error);
        setFehler("Die Verhandlungen konnten nicht geladen werden.");
      }
    );

    const lieferantenAbmelden = onSnapshot(
      lieferantenAbfrage,
      (snapshot) => {
        setLieferanten(
          snapshot.docs.map((eintrag) => ({
            id: eintrag.id,
            ...eintrag.data(),
          }))
        );
      },
      (error) => {
        console.error(error);
        setFehler(
          "Die Lieferanten konnten nicht geladen werden. Bitte Firestore-Regeln prüfen."
        );
      }
    );

    return () => {
      verhandlungenAbmelden();
      lieferantenAbmelden();
    };
  }, []);

  const kennzahlen = useMemo(() => {
    const offen = verhandlungen.filter(
      (eintrag) =>
        eintrag.status === "Offen" || eintrag.status === "In Verhandlung"
    ).length;

    const gewonnen = verhandlungen.filter(
      (eintrag) => eintrag.status === "Gewonnen"
    ).length;

    const gesamtEinsparung = verhandlungen.reduce(
      (summe, eintrag) => summe + einsparung(eintrag),
      0
    );

    const ausgangsVolumen = verhandlungen.reduce((summe, eintrag) => {
      const ausgang = euroWert(eintrag.ausgangsangebot);
      return summe + (ausgang > 0 ? ausgang : 0);
    }, 0);

    const gesamtEinsparungProzent =
      ausgangsVolumen > 0 ? (gesamtEinsparung / ausgangsVolumen) * 100 : 0;

    const faellig = verhandlungen.filter(
      (eintrag) =>
        eintrag.wiedervorlage &&
        eintrag.wiedervorlage <= heuteText() &&
        eintrag.status !== "Gewonnen" &&
        eintrag.status !== "Verloren"
    ).length;

    return {
      offen,
      gewonnen,
      gesamtEinsparung,
      gesamtEinsparungProzent,
      ausgangsVolumen,
      faellig,
    };
  }, [verhandlungen]);

  const gefilterteVerhandlungen = useMemo(() => {
    const suchbegriff = suche.trim().toLowerCase();

    const gefiltert = verhandlungen.filter((eintrag) => {
      const passtStatus =
        statusFilter === "Alle" || eintrag.status === statusFilter;
      const passtPrioritaet =
        prioritaetFilter === "Alle" ||
        eintrag.prioritaet === prioritaetFilter;
      const passtSuche =
        suchbegriff === "" ||
        eintrag.firma?.toLowerCase().includes(suchbegriff) ||
        eintrag.ansprechpartner?.toLowerCase().includes(suchbegriff) ||
        eintrag.kategorie?.toLowerCase().includes(suchbegriff) ||
        eintrag.email?.toLowerCase().includes(suchbegriff) ||
        eintrag.notizen?.toLowerCase().includes(suchbegriff);

      return passtStatus && passtPrioritaet && passtSuche;
    });

    return [...gefiltert].sort((a, b) => {
      let wertA;
      let wertB;

      if (sortierung === "einsparung") {
        wertA = einsparung(a);
        wertB = einsparung(b);
      } else if (
        sortierung === "ausgangsangebot" ||
        sortierung === "aktuellesAngebot"
      ) {
        wertA = euroWert(a[sortierung]);
        wertB = euroWert(b[sortierung]);
      } else {
        wertA = String(a[sortierung] ?? "").toLowerCase();
        wertB = String(b[sortierung] ?? "").toLowerCase();
      }

      if (wertA < wertB) return sortRichtung === "asc" ? -1 : 1;
      if (wertA > wertB) return sortRichtung === "asc" ? 1 : -1;
      return 0;
    });
  }, [
    verhandlungen,
    suche,
    statusFilter,
    prioritaetFilter,
    sortierung,
    sortRichtung,
  ]);

  const gefilterteLieferanten = useMemo(() => {
    const suchbegriff = lieferantenSuche.trim().toLowerCase();

    return [...lieferanten]
      .filter((eintrag) => {
        const passtKategorie =
          lieferantenKategorieFilter === "Alle" ||
          eintrag.kategorie === lieferantenKategorieFilter;
        const passtStatus =
          lieferantenStatusFilter === "Alle" ||
          eintrag.status === lieferantenStatusFilter;
        const passtSuche =
          suchbegriff === "" ||
          eintrag.firma?.toLowerCase().includes(suchbegriff) ||
          eintrag.ansprechpartner?.toLowerCase().includes(suchbegriff) ||
          eintrag.ort?.toLowerCase().includes(suchbegriff) ||
          eintrag.email?.toLowerCase().includes(suchbegriff) ||
          eintrag.kontaktEmail?.toLowerCase().includes(suchbegriff) ||
          eintrag.notizen?.toLowerCase().includes(suchbegriff);

        return passtKategorie && passtStatus && passtSuche;
      })
      .sort((a, b) =>
        String(a.firma ?? "").localeCompare(String(b.firma ?? ""), "de")
      );
  }, [
    lieferanten,
    lieferantenSuche,
    lieferantenKategorieFilter,
    lieferantenStatusFilter,
  ]);

  function sortieren(feld) {
    if (sortierung === feld) {
      setSortRichtung((aktuell) => (aktuell === "asc" ? "desc" : "asc"));
    } else {
      setSortierung(feld);
      setSortRichtung("asc");
    }
  }

  function verhandlungsFeldAendern(event) {
    const { name, value } = event.target;

    if (name === "lieferantId") {
      const ausgewaehlt = lieferanten.find((lieferant) => lieferant.id === value);

      setVerhandlungsFormular((vorher) => ({
        ...vorher,
        lieferantId: value,
        firma: ausgewaehlt?.firma ?? vorher.firma,
        ansprechpartner:
          ausgewaehlt?.ansprechpartner ?? vorher.ansprechpartner,
        telefon:
          ausgewaehlt?.mobil ||
          ausgewaehlt?.telefon ||
          vorher.telefon,
        email:
          ausgewaehlt?.kontaktEmail ||
          ausgewaehlt?.email ||
          vorher.email,
        kategorie: ausgewaehlt?.kategorie ?? vorher.kategorie,
      }));
      return;
    }

    setVerhandlungsFormular((vorher) => ({ ...vorher, [name]: value }));
  }

  function lieferantenFeldAendern(event) {
    const { name, value } = event.target;
    setLieferantenFormular((vorher) => ({ ...vorher, [name]: value }));
  }

  function neueVerhandlungOeffnen() {
    setVerhandlungsFormular(leerVerhandlungsFormular);
    setVerhandlungsBearbeitungsId(null);
    setFehler("");
    setVerhandlungsDialogOffen(true);
  }

  function verhandlungBearbeitenOeffnen(eintrag) {
    setVerhandlungsFormular({
      lieferantId: eintrag.lieferantId ?? "",
      firma: eintrag.firma ?? "",
      ansprechpartner: eintrag.ansprechpartner ?? "",
      telefon: eintrag.telefon ?? "",
      email: eintrag.email ?? "",
      kategorie: eintrag.kategorie ?? "Material",
      status: eintrag.status ?? "Offen",
      prioritaet: eintrag.prioritaet ?? "Mittel",
      ausgangsangebot: eintrag.ausgangsangebot ?? "",
      aktuellesAngebot: eintrag.aktuellesAngebot ?? "",
      zielpreis: eintrag.zielpreis ?? "",
      schmerzgrenze: eintrag.schmerzgrenze ?? "",
      wiedervorlage: eintrag.wiedervorlage ?? "",
      notizen: eintrag.notizen ?? "",
    });

    setVerhandlungsBearbeitungsId(eintrag.id);
    setFehler("");
    setVerhandlungsDialogOffen(true);
  }

  function neuerLieferantOeffnen() {
    setLieferantenFormular(leerLieferantenFormular);
    setLieferantenBearbeitungsId(null);
    setFehler("");
    setLieferantenDialogOffen(true);
  }

  function lieferantBearbeitenOeffnen(eintrag) {
    setLieferantenFormular({
      firma: eintrag.firma ?? "",
      kategorie: eintrag.kategorie ?? "Material",
      status: eintrag.status ?? "Aktiv",
      kundennummer: eintrag.kundennummer ?? "",
      strasse: eintrag.strasse ?? "",
      plz: eintrag.plz ?? "",
      ort: eintrag.ort ?? "",
      website: eintrag.website ?? "",
      telefon: eintrag.telefon ?? "",
      email: eintrag.email ?? "",
      ansprechpartner: eintrag.ansprechpartner ?? "",
      position: eintrag.position ?? "",
      mobil: eintrag.mobil ?? "",
      kontaktEmail: eintrag.kontaktEmail ?? "",
      zahlungsziel: eintrag.zahlungsziel ?? "",
      skonto: eintrag.skonto ?? "",
      lieferbedingungen: eintrag.lieferbedingungen ?? "",
      notizen: eintrag.notizen ?? "",
    });

    setLieferantenBearbeitungsId(eintrag.id);
    setFehler("");
    setLieferantenDialogOffen(true);
  }

  async function verhandlungSpeichern() {
    if (!verhandlungsFormular.firma.trim()) {
      setFehler("Bitte eine Firma eintragen oder einen Lieferanten auswählen.");
      return;
    }

    const benutzer = auth.currentUser;
    if (!benutzer) {
      setFehler("Kein Benutzer angemeldet.");
      return;
    }

    setSpeichert(true);
    setFehler("");

    const daten = {
      ...verhandlungsFormular,
      userId: benutzer.uid,
      ausgangsangebot: euroWert(verhandlungsFormular.ausgangsangebot),
      aktuellesAngebot: euroWert(verhandlungsFormular.aktuellesAngebot),
      zielpreis: euroWert(verhandlungsFormular.zielpreis),
      schmerzgrenze: euroWert(verhandlungsFormular.schmerzgrenze),
      geaendertAm: serverTimestamp(),
    };

    try {
      if (verhandlungsBearbeitungsId) {
        await updateDoc(
          doc(db, "verhandlungen", verhandlungsBearbeitungsId),
          daten
        );
      } else {
        await addDoc(collection(db, "verhandlungen"), {
          ...daten,
          erstelltAm: serverTimestamp(),
        });
      }

      setVerhandlungsDialogOffen(false);
      setVerhandlungsFormular(leerVerhandlungsFormular);
      setVerhandlungsBearbeitungsId(null);
    } catch (error) {
      console.error(error);
      setFehler("Speichern fehlgeschlagen. Bitte Firestore-Regeln prüfen.");
    } finally {
      setSpeichert(false);
    }
  }

  async function lieferantSpeichern() {
    if (!lieferantenFormular.firma.trim()) {
      setFehler("Bitte einen Firmennamen eintragen.");
      return;
    }

    const benutzer = auth.currentUser;
    if (!benutzer) {
      setFehler("Kein Benutzer angemeldet.");
      return;
    }

    setSpeichert(true);
    setFehler("");

    const daten = {
      ...lieferantenFormular,
      userId: benutzer.uid,
      geaendertAm: serverTimestamp(),
    };

    try {
      if (lieferantenBearbeitungsId) {
        await updateDoc(
          doc(db, "lieferanten", lieferantenBearbeitungsId),
          daten
        );
      } else {
        await addDoc(collection(db, "lieferanten"), {
          ...daten,
          erstelltAm: serverTimestamp(),
        });
      }

      setLieferantenDialogOffen(false);
      setLieferantenFormular(leerLieferantenFormular);
      setLieferantenBearbeitungsId(null);
    } catch (error) {
      console.error(error);
      setFehler(
        "Lieferant konnte nicht gespeichert werden. Bitte Firestore-Regeln prüfen."
      );
    } finally {
      setSpeichert(false);
    }
  }

  async function verhandlungLoeschen(eintrag) {
    if (!window.confirm(`Verhandlung mit "${eintrag.firma}" wirklich löschen?`))
      return;

    try {
      await deleteDoc(doc(db, "verhandlungen", eintrag.id));
    } catch (error) {
      console.error(error);
      setFehler("Die Verhandlung konnte nicht gelöscht werden.");
    }
  }

  async function lieferantLoeschen(eintrag) {
    if (!window.confirm(`Lieferant "${eintrag.firma}" wirklich löschen?`))
      return;

    try {
      await deleteDoc(doc(db, "lieferanten", eintrag.id));
    } catch (error) {
      console.error(error);
      setFehler("Der Lieferant konnte nicht gelöscht werden.");
    }
  }

  function rechnerOeffnen({ ausgang = "", vergleiche = [], kontext = "frei" } = {}) {
    const vorbereiteteVergleiche = vergleiche
      .filter((eintrag) => eintrag.wert !== null && eintrag.wert !== undefined)
      .map((eintrag) =>
        neueVergleichszeile(eintrag.bezeichnung || "Zielpreis", eintrag.wert)
      );

    setRechnerAusgang(ausgang === null || ausgang === undefined ? "" : String(ausgang));
    setRechnerVergleiche(
      vorbereiteteVergleiche.length
        ? vorbereiteteVergleiche
        : [neueVergleichszeile("Zielpreis 1"), neueVergleichszeile("Zielpreis 2")]
    );
    setRechnerKontext(kontext);
    setRechnerOffen(true);
  }

  function freierRechnerOeffnen() {
    rechnerOeffnen();
  }

  function formularRechnerOeffnen() {
    const kandidaten = [
      { bezeichnung: "Aktuelles Angebot", wert: verhandlungsFormular.aktuellesAngebot },
      { bezeichnung: "Zielpreis", wert: verhandlungsFormular.zielpreis },
      { bezeichnung: "Schmerzgrenze", wert: verhandlungsFormular.schmerzgrenze },
    ].filter((eintrag) => String(eintrag.wert ?? "").trim() !== "");

    rechnerOeffnen({
      ausgang: verhandlungsFormular.ausgangsangebot,
      vergleiche: kandidaten,
      kontext: "formular",
    });
  }

  function eintragRechnerOeffnen(eintrag) {
    rechnerOeffnen({
      ausgang: eintrag.ausgangsangebot,
      vergleiche: [
        { bezeichnung: "Aktuelles Angebot", wert: eintrag.aktuellesAngebot },
        { bezeichnung: "Zielpreis", wert: eintrag.zielpreis },
        { bezeichnung: "Schmerzgrenze", wert: eintrag.schmerzgrenze },
      ].filter((vergleich) => String(vergleich.wert ?? "").trim() !== ""),
      kontext: "eintrag",
    });
  }

  function vergleichHinzufuegen() {
    setRechnerVergleiche((aktuell) => [
      ...aktuell,
      neueVergleichszeile(`Zielpreis ${aktuell.length + 1}`),
    ]);
  }

  function vergleichAendern(id, feld, wert) {
    setRechnerVergleiche((aktuell) =>
      aktuell.map((eintrag) =>
        eintrag.id === id ? { ...eintrag, [feld]: wert } : eintrag
      )
    );
  }

  function vergleichLoeschen(id) {
    setRechnerVergleiche((aktuell) => {
      const naechsterStand = aktuell.filter((eintrag) => eintrag.id !== id);
      return naechsterStand.length
        ? naechsterStand
        : [neueVergleichszeile("Zielpreis 1")];
    });
  }

  function vergleichAlsZielpreisUebernehmen(wert) {
    setVerhandlungsFormular((aktuell) => ({ ...aktuell, zielpreis: wert }));
    setRechnerOffen(false);
  }

  function prioritaetsFarbe(prioritaet) {
    if (prioritaet === "Hoch") return "error";
    if (prioritaet === "Mittel") return "warning";
    return "default";
  }

  function statusFarbe(status) {
    if (status === "Gewonnen") return "success";
    if (status === "Verloren") return "error";
    if (status === "In Verhandlung") return "warning";
    return "info";
  }

  const karten = [
    {
      titel: "Offene Verhandlungen",
      wert: kennzahlen.offen,
      icon: <HandshakeIcon fontSize="large" />,
    },
    {
      titel: "Gewonnen",
      wert: kennzahlen.gewonnen,
      icon: <EmojiEventsIcon fontSize="large" />,
    },
    {
      titel: "Gesamte Einsparung",
      wert: euroFormat(kennzahlen.gesamtEinsparung),
      zusatz: `${prozentFormat(kennzahlen.gesamtEinsparungProzent)} vom Ausgangsvolumen`,
      icon: <SavingsIcon fontSize="large" />,
    },
    {
      titel: "Fällige Wiedervorlagen",
      wert: kennzahlen.faellig,
      icon: <EventNoteIcon fontSize="large" />,
    },
  ];

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        spacing={2}
        mb={2}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Verhandlungen & Lieferanten
          </Typography>
          <Typography color="text.secondary">
            Preise, Kontakte, Konditionen und Wiedervorlagen verwalten
          </Typography>
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignSelf={{ xs: "stretch", md: "center" }}
        >
          {ansicht === "verhandlungen" && (
            <Button
              variant="outlined"
              startIcon={<CalculateIcon />}
              onClick={freierRechnerOeffnen}
              sx={{ minHeight: 48, px: 2.5, whiteSpace: "nowrap" }}
            >
              Ersparnis-Rechner
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={
              ansicht === "verhandlungen"
                ? neueVerhandlungOeffnen
                : neuerLieferantOeffnen
            }
            sx={{ minHeight: 48, px: 3, whiteSpace: "nowrap" }}
          >
            {ansicht === "verhandlungen"
              ? "Neue Verhandlung"
              : "Neuer Lieferant"}
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={ansicht}
          onChange={(_, neuerWert) => setAnsicht(neuerWert)}
          variant={istMobil ? "fullWidth" : "standard"}
        >
          <Tab
            value="verhandlungen"
            label={`Verhandlungen (${verhandlungen.length})`}
          />
          <Tab
            value="lieferanten"
            label={`Lieferanten (${lieferanten.length})`}
          />
        </Tabs>
      </Paper>

      {fehler && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {fehler}
        </Alert>
      )}

      {ansicht === "verhandlungen" ? (
        <>
          <Grid container spacing={2} mb={3}>
            {karten.map((karte) => (
              <Grid size={{ xs: 12, sm: 6, xl: 3 }} key={karte.titel}>
                <Card sx={{ height: "100%" }}>
                  <CardContent>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      spacing={2}
                    >
                      <Box>
                        <Typography color="text.secondary" fontWeight={600}>
                          {karte.titel}
                        </Typography>
                        <Typography variant="h4" fontWeight={800} mt={1}>
                          {karte.wert}
                        </Typography>
                        {karte.zusatz && (
                          <Typography variant="body2" color="success.main" fontWeight={700} mt={0.5}>
                            {karte.zusatz}
                          </Typography>
                        )}
                      </Box>
                      <Box color="primary.main">{karte.icon}</Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Suchen"
                  placeholder="Firma, Ansprechpartner, Kategorie, E-Mail oder Notiz"
                  value={suche}
                  onChange={(event) => setSuche(event.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  select
                  fullWidth
                  label="Status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <MenuItem value="Alle">Alle</MenuItem>
                  <MenuItem value="Offen">Offen</MenuItem>
                  <MenuItem value="In Verhandlung">In Verhandlung</MenuItem>
                  <MenuItem value="Gewonnen">Gewonnen</MenuItem>
                  <MenuItem value="Verloren">Verloren</MenuItem>
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  select
                  fullWidth
                  label="Priorität"
                  value={prioritaetFilter}
                  onChange={(event) => setPrioritaetFilter(event.target.value)}
                >
                  <MenuItem value="Alle">Alle</MenuItem>
                  <MenuItem value="Hoch">Hoch</MenuItem>
                  <MenuItem value="Mittel">Mittel</MenuItem>
                  <MenuItem value="Niedrig">Niedrig</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </Paper>

          {gefilterteVerhandlungen.length === 0 ? (
            <Card>
              <CardContent>
                <Typography fontWeight={700}>
                  Keine Verhandlungen gefunden.
                </Typography>
                <Typography color="text.secondary">
                  Lege eine neue Verhandlung an oder passe die Filter an.
                </Typography>
              </CardContent>
            </Card>
          ) : istMobil ? (
            <Stack spacing={2}>
              {gefilterteVerhandlungen.map((eintrag) => (
                <Card key={eintrag.id}>
                  <CardContent>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" fontWeight={800}>
                          {eintrag.firma}
                        </Typography>
                        <Typography color="text.secondary">
                          {eintrag.ansprechpartner || "Kein Ansprechpartner"}
                        </Typography>
                      </Box>
                      <Box sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title="Ersparnis berechnen">
                          <IconButton onClick={() => eintragRechnerOeffnen(eintrag)}>
                            <CalculateIcon />
                          </IconButton>
                        </Tooltip>
                        <IconButton
                          onClick={() => verhandlungBearbeitenOeffnen(eintrag)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => verhandlungLoeschen(eintrag)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Stack>

                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      mt={2}
                      useFlexGap
                    >
                      <Chip
                        label={eintrag.status}
                        color={statusFarbe(eintrag.status)}
                        size="small"
                      />
                      <Chip
                        label={`Priorität: ${eintrag.prioritaet}`}
                        color={prioritaetsFarbe(eintrag.prioritaet)}
                        size="small"
                      />
                      <Chip
                        label={eintrag.kategorie}
                        variant="outlined"
                        size="small"
                      />
                    </Stack>

                    <Grid container spacing={2} mt={0.5}>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Ausgang
                        </Typography>
                        <Typography fontWeight={700}>
                          {euroFormat(eintrag.ausgangsangebot)}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Aktuell
                        </Typography>
                        <Typography fontWeight={700}>
                          {euroFormat(eintrag.aktuellesAngebot)}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Einsparung
                        </Typography>
                        <Typography fontWeight={800} color="success.main">
                          {euroFormat(einsparung(eintrag))}
                        </Typography>
                        <Typography variant="caption" color="success.main" fontWeight={700}>
                          {prozentFormat(einsparungProzent(eintrag))}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Wiedervorlage
                        </Typography>
                        <Typography fontWeight={700}>
                          {datumFormat(eintrag.wiedervorlage)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <TableContainer component={Paper}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TableSortLabel
                        active={sortierung === "firma"}
                        direction={
                          sortierung === "firma" ? sortRichtung : "asc"
                        }
                        onClick={() => sortieren("firma")}
                      >
                        Firma
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Ansprechpartner</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Priorität</TableCell>
                    <TableCell align="right">Ausgang</TableCell>
                    <TableCell align="right">Aktuell</TableCell>
                    <TableCell align="right">Einsparung</TableCell>
                    <TableCell>Wiedervorlage</TableCell>
                    <TableCell align="right">Aktionen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gefilterteVerhandlungen.map((eintrag) => (
                    <TableRow hover key={eintrag.id}>
                      <TableCell>
                        <Typography fontWeight={700}>
                          {eintrag.firma}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {eintrag.kategorie}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {eintrag.ansprechpartner || "—"}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={eintrag.status}
                          color={statusFarbe(eintrag.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={eintrag.prioritaet}
                          color={prioritaetsFarbe(eintrag.prioritaet)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {euroFormat(eintrag.ausgangsangebot)}
                      </TableCell>
                      <TableCell align="right">
                        {euroFormat(eintrag.aktuellesAngebot)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={800} color="success.main">
                          {euroFormat(einsparung(eintrag))}
                        </Typography>
                        <Typography variant="caption" color="success.main" fontWeight={700}>
                          {prozentFormat(einsparungProzent(eintrag))}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {datumFormat(eintrag.wiedervorlage)}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Ersparnis berechnen">
                          <IconButton onClick={() => eintragRechnerOeffnen(eintrag)}>
                            <CalculateIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Bearbeiten">
                          <IconButton
                            onClick={() =>
                              verhandlungBearbeitenOeffnen(eintrag)
                            }
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Löschen">
                          <IconButton
                            color="error"
                            onClick={() => verhandlungLoeschen(eintrag)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      ) : (
        <>
          <Grid container spacing={2} mb={3}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between">
                    <Box>
                      <Typography color="text.secondary" fontWeight={600}>
                        Lieferanten gesamt
                      </Typography>
                      <Typography variant="h4" fontWeight={800} mt={1}>
                        {lieferanten.length}
                      </Typography>
                    </Box>
                    <BusinessIcon fontSize="large" color="primary" />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" fontWeight={600}>
                    Aktive Lieferanten
                  </Typography>
                  <Typography variant="h4" fontWeight={800} mt={1}>
                    {
                      lieferanten.filter(
                        (lieferant) => lieferant.status === "Aktiv"
                      ).length
                    }
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" fontWeight={600}>
                    Mit Ansprechpartner
                  </Typography>
                  <Typography variant="h4" fontWeight={800} mt={1}>
                    {
                      lieferanten.filter((lieferant) =>
                        Boolean(lieferant.ansprechpartner)
                      ).length
                    }
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Lieferanten suchen"
                  placeholder="Firma, Ansprechpartner, Ort, E-Mail oder Notiz"
                  value={lieferantenSuche}
                  onChange={(event) => setLieferantenSuche(event.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  select
                  fullWidth
                  label="Kategorie"
                  value={lieferantenKategorieFilter}
                  onChange={(event) =>
                    setLieferantenKategorieFilter(event.target.value)
                  }
                >
                  <MenuItem value="Alle">Alle</MenuItem>
                  <MenuItem value="Material">Material</MenuItem>
                  <MenuItem value="Maschine">Maschine</MenuItem>
                  <MenuItem value="Fahrzeug">Fahrzeug</MenuItem>
                  <MenuItem value="Dienstleistung">Dienstleistung</MenuItem>
                  <MenuItem value="Personal">Personal</MenuItem>
                  <MenuItem value="Sonstiges">Sonstiges</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  select
                  fullWidth
                  label="Status"
                  value={lieferantenStatusFilter}
                  onChange={(event) =>
                    setLieferantenStatusFilter(event.target.value)
                  }
                >
                  <MenuItem value="Alle">Alle</MenuItem>
                  <MenuItem value="Aktiv">Aktiv</MenuItem>
                  <MenuItem value="Inaktiv">Inaktiv</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </Paper>

          {gefilterteLieferanten.length === 0 ? (
            <Card>
              <CardContent>
                <Typography fontWeight={700}>
                  Keine Lieferanten gefunden.
                </Typography>
                <Typography color="text.secondary">
                  Lege den ersten Lieferanten an oder passe die Filter an.
                </Typography>
              </CardContent>
            </Card>
          ) : istMobil ? (
            <Stack spacing={2}>
              {gefilterteLieferanten.map((lieferant) => (
                <Card key={lieferant.id}>
                  <CardContent>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" fontWeight={800}>
                          {lieferant.firma}
                        </Typography>
                        <Typography color="text.secondary">
                          {[lieferant.plz, lieferant.ort]
                            .filter(Boolean)
                            .join(" ") || "Kein Ort hinterlegt"}
                        </Typography>
                      </Box>
                      <Box sx={{ whiteSpace: "nowrap" }}>
                        <IconButton
                          onClick={() =>
                            lieferantBearbeitenOeffnen(lieferant)
                          }
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => lieferantLoeschen(lieferant)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Stack>

                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                      mt={2}
                    >
                      <Chip label={lieferant.kategorie} size="small" />
                      <Chip
                        label={lieferant.status}
                        color={
                          lieferant.status === "Aktiv" ? "success" : "default"
                        }
                        size="small"
                      />
                      {lieferant.kundennummer && (
                        <Chip
                          label={`Kd.-Nr. ${lieferant.kundennummer}`}
                          variant="outlined"
                          size="small"
                        />
                      )}
                    </Stack>

                    <Stack spacing={1} mt={2}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PersonIcon fontSize="small" color="action" />
                        <Typography>
                          {lieferant.ansprechpartner || "Kein Ansprechpartner"}
                          {lieferant.position
                            ? ` – ${lieferant.position}`
                            : ""}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PhoneIcon fontSize="small" color="action" />
                        <Typography>
                          {lieferant.mobil ||
                            lieferant.telefon ||
                            "Keine Telefonnummer"}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <EmailIcon fontSize="small" color="action" />
                        <Typography sx={{ overflowWrap: "anywhere" }}>
                          {lieferant.kontaktEmail ||
                            lieferant.email ||
                            "Keine E-Mail-Adresse"}
                        </Typography>
                      </Stack>
                    </Stack>

                    {(lieferant.zahlungsziel ||
                      lieferant.skonto ||
                      lieferant.notizen) && (
                      <Paper variant="outlined" sx={{ p: 1.5, mt: 2 }}>
                        {lieferant.zahlungsziel && (
                          <Typography variant="body2">
                            <strong>Zahlungsziel:</strong>{" "}
                            {lieferant.zahlungsziel}
                          </Typography>
                        )}
                        {lieferant.skonto && (
                          <Typography variant="body2">
                            <strong>Skonto:</strong> {lieferant.skonto}
                          </Typography>
                        )}
                        {lieferant.notizen && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1, whiteSpace: "pre-wrap" }}
                          >
                            {lieferant.notizen}
                          </Typography>
                        )}
                      </Paper>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <TableContainer component={Paper}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Lieferant</TableCell>
                    <TableCell>Ansprechpartner</TableCell>
                    <TableCell>Kontakt</TableCell>
                    <TableCell>Kategorie</TableCell>
                    <TableCell>Konditionen</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Aktionen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gefilterteLieferanten.map((lieferant) => (
                    <TableRow hover key={lieferant.id}>
                      <TableCell>
                        <Typography fontWeight={700}>
                          {lieferant.firma}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {[lieferant.plz, lieferant.ort]
                            .filter(Boolean)
                            .join(" ") || "—"}
                          {lieferant.kundennummer
                            ? ` · Kd.-Nr. ${lieferant.kundennummer}`
                            : ""}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography>
                          {lieferant.ansprechpartner || "—"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {lieferant.position || ""}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {lieferant.mobil || lieferant.telefon || "—"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {lieferant.kontaktEmail || lieferant.email || ""}
                        </Typography>
                      </TableCell>
                      <TableCell>{lieferant.kategorie}</TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {lieferant.zahlungsziel || "—"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {lieferant.skonto
                            ? `Skonto: ${lieferant.skonto}`
                            : ""}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={lieferant.status}
                          color={
                            lieferant.status === "Aktiv"
                              ? "success"
                              : "default"
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Bearbeiten">
                          <IconButton
                            onClick={() =>
                              lieferantBearbeitenOeffnen(lieferant)
                            }
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Löschen">
                          <IconButton
                            color="error"
                            onClick={() => lieferantLoeschen(lieferant)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      <Dialog
        open={verhandlungsDialogOffen}
        onClose={() => setVerhandlungsDialogOffen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {verhandlungsBearbeitungsId
            ? "Verhandlung bearbeiten"
            : "Neue Verhandlung anlegen"}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} mt={0.5}>
            <Grid size={{ xs: 12 }}>
              <TextField
                select
                fullWidth
                label="Lieferant auswählen"
                name="lieferantId"
                value={verhandlungsFormular.lieferantId}
                onChange={verhandlungsFeldAendern}
                helperText="Kontaktdaten werden automatisch übernommen. Freie Eingabe bleibt möglich."
              >
                <MenuItem value="">Kein gespeicherter Lieferant</MenuItem>
                {lieferanten
                  .filter((lieferant) => lieferant.status !== "Inaktiv")
                  .sort((a, b) =>
                    String(a.firma).localeCompare(String(b.firma), "de")
                  )
                  .map((lieferant) => (
                    <MenuItem key={lieferant.id} value={lieferant.id}>
                      {lieferant.firma}
                    </MenuItem>
                  ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                required
                label="Firma"
                name="firma"
                value={verhandlungsFormular.firma}
                onChange={verhandlungsFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Ansprechpartner"
                name="ansprechpartner"
                value={verhandlungsFormular.ansprechpartner}
                onChange={verhandlungsFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Telefon"
                name="telefon"
                value={verhandlungsFormular.telefon}
                onChange={verhandlungsFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="E-Mail"
                type="email"
                name="email"
                value={verhandlungsFormular.email}
                onChange={verhandlungsFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                fullWidth
                label="Kategorie"
                name="kategorie"
                value={verhandlungsFormular.kategorie}
                onChange={verhandlungsFeldAendern}
              >
                <MenuItem value="Material">Material</MenuItem>
                <MenuItem value="Maschine">Maschine</MenuItem>
                <MenuItem value="Fahrzeug">Fahrzeug</MenuItem>
                <MenuItem value="Dienstleistung">Dienstleistung</MenuItem>
                <MenuItem value="Personal">Personal</MenuItem>
                <MenuItem value="Sonstiges">Sonstiges</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                fullWidth
                label="Status"
                name="status"
                value={verhandlungsFormular.status}
                onChange={verhandlungsFeldAendern}
              >
                <MenuItem value="Offen">Offen</MenuItem>
                <MenuItem value="In Verhandlung">In Verhandlung</MenuItem>
                <MenuItem value="Gewonnen">Gewonnen</MenuItem>
                <MenuItem value="Verloren">Verloren</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                fullWidth
                label="Priorität"
                name="prioritaet"
                value={verhandlungsFormular.prioritaet}
                onChange={verhandlungsFeldAendern}
              >
                <MenuItem value="Niedrig">Niedrig</MenuItem>
                <MenuItem value="Mittel">Mittel</MenuItem>
                <MenuItem value="Hoch">Hoch</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="Ausgangsangebot"
                type="number"
                name="ausgangsangebot"
                value={verhandlungsFormular.ausgangsangebot}
                onChange={verhandlungsFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="Aktuelles Angebot"
                type="number"
                name="aktuellesAngebot"
                value={verhandlungsFormular.aktuellesAngebot}
                onChange={verhandlungsFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="Zielpreis"
                type="number"
                name="zielpreis"
                value={verhandlungsFormular.zielpreis}
                onChange={verhandlungsFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="Schmerzgrenze"
                type="number"
                name="schmerzgrenze"
                value={verhandlungsFormular.schmerzgrenze}
                onChange={verhandlungsFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Button
                variant="outlined"
                startIcon={<CalculateIcon />}
                onClick={formularRechnerOeffnen}
                disabled={!euroWert(verhandlungsFormular.ausgangsangebot)}
              >
                Ersparnis in Prozent berechnen und Zielpreise vergleichen
              </Button>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Wiedervorlage"
                type="date"
                name="wiedervorlage"
                value={verhandlungsFormular.wiedervorlage}
                onChange={verhandlungsFeldAendern}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                minRows={4}
                label="Notizen"
                name="notizen"
                value={verhandlungsFormular.notizen}
                onChange={verhandlungsFeldAendern}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerhandlungsDialogOffen(false)}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            onClick={verhandlungSpeichern}
            disabled={speichert}
          >
            {speichert ? "Speichert..." : "Speichern"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={rechnerOffen}
        onClose={() => setRechnerOffen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Ersparnis- und Zielpreisrechner</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} mt={0.5}>
            <Alert severity="info">
              Formel: (Ausgangspreis − Vergleichspreis) ÷ Ausgangspreis × 100.
              Der Rechner speichert keine Daten in Firebase.
            </Alert>

            <TextField
              fullWidth
              label="Ausgangspreis"
              type="number"
              inputProps={{ min: 0, step: "0.01" }}
              value={rechnerAusgang}
              onChange={(event) => setRechnerAusgang(event.target.value)}
              helperText="Das ursprüngliche Angebot oder der Listenpreis."
              autoFocus
            />

            {euroWert(rechnerAusgang) <= 0 && (
              <Alert severity="warning">Bitte zuerst einen Ausgangspreis größer als 0 eintragen.</Alert>
            )}

            <Stack spacing={1.5}>
              {rechnerVergleiche.map((vergleich, index) => {
                const ergebnis = preisvergleich(rechnerAusgang, vergleich.wert);
                const positiv = ergebnis.differenz >= 0;
                return (
                  <Paper key={vergleich.id} variant="outlined" sx={{ p: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField
                          fullWidth
                          label={`Bezeichnung ${index + 1}`}
                          value={vergleich.bezeichnung}
                          onChange={(event) =>
                            vergleichAendern(vergleich.id, "bezeichnung", event.target.value)
                          }
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 3 }}>
                        <TextField
                          fullWidth
                          label="Preis / Zielpreis"
                          type="number"
                          inputProps={{ min: 0, step: "0.01" }}
                          value={vergleich.wert}
                          onChange={(event) =>
                            vergleichAendern(vergleich.id, "wert", event.target.value)
                          }
                        />
                      </Grid>
                      <Grid size={{ xs: 10, sm: 4 }}>
                        <Stack spacing={0.25}>
                          <Typography variant="caption" color="text.secondary">
                            {positiv ? "Ersparnis" : "Mehrkosten"}
                          </Typography>
                          <Typography fontWeight={900} color={positiv ? "success.main" : "error.main"}>
                            {euroFormat(Math.abs(ergebnis.differenz))}
                          </Typography>
                          <Typography variant="body2" fontWeight={800} color={positiv ? "success.main" : "error.main"}>
                            {positiv ? "−" : "+"}{prozentFormat(Math.abs(ergebnis.prozent))}
                          </Typography>
                        </Stack>
                      </Grid>
                      <Grid size={{ xs: 2, sm: 1 }}>
                        <Tooltip title="Vergleich entfernen">
                          <IconButton color="error" onClick={() => vergleichLoeschen(vergleich.id)}>
                            <RemoveCircleOutlineIcon />
                          </IconButton>
                        </Tooltip>
                      </Grid>
                      {rechnerKontext === "formular" && euroWert(vergleich.wert) > 0 && (
                        <Grid size={{ xs: 12 }}>
                          <Button
                            size="small"
                            onClick={() => vergleichAlsZielpreisUebernehmen(vergleich.wert)}
                          >
                            Diesen Wert als Zielpreis übernehmen
                          </Button>
                        </Grid>
                      )}
                    </Grid>
                  </Paper>
                );
              })}
            </Stack>

            <Button
              variant="outlined"
              startIcon={<AddCircleOutlineIcon />}
              onClick={vergleichHinzufuegen}
              sx={{ alignSelf: "flex-start" }}
            >
              Weiteren Zielpreis vergleichen
            </Button>

            <Divider />
            <Typography variant="body2" color="text.secondary">
              Positive Werte zeigen die Ersparnis. Liegt ein Vergleichspreis über dem Ausgangspreis,
              werden die Mehrkosten rot dargestellt.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRechnerOffen(false)}>Schließen</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={lieferantenDialogOffen}
        onClose={() => setLieferantenDialogOffen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {lieferantenBearbeitungsId
            ? "Lieferant bearbeiten"
            : "Neuen Lieferanten anlegen"}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} mt={0.5}>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                fullWidth
                required
                label="Firmenname"
                name="firma"
                value={lieferantenFormular.firma}
                onChange={lieferantenFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Kundennummer"
                name="kundennummer"
                value={lieferantenFormular.kundennummer}
                onChange={lieferantenFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                fullWidth
                label="Kategorie"
                name="kategorie"
                value={lieferantenFormular.kategorie}
                onChange={lieferantenFeldAendern}
              >
                <MenuItem value="Material">Material</MenuItem>
                <MenuItem value="Maschine">Maschine</MenuItem>
                <MenuItem value="Fahrzeug">Fahrzeug</MenuItem>
                <MenuItem value="Dienstleistung">Dienstleistung</MenuItem>
                <MenuItem value="Personal">Personal</MenuItem>
                <MenuItem value="Sonstiges">Sonstiges</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                fullWidth
                label="Status"
                name="status"
                value={lieferantenFormular.status}
                onChange={lieferantenFeldAendern}
              >
                <MenuItem value="Aktiv">Aktiv</MenuItem>
                <MenuItem value="Inaktiv">Inaktiv</MenuItem>
              </TextField>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" fontWeight={800} mt={1}>
                Firmenanschrift und allgemeiner Kontakt
              </Typography>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Straße und Hausnummer"
                name="strasse"
                value={lieferantenFormular.strasse}
                onChange={lieferantenFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="PLZ"
                name="plz"
                value={lieferantenFormular.plz}
                onChange={lieferantenFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                fullWidth
                label="Ort"
                name="ort"
                value={lieferantenFormular.ort}
                onChange={lieferantenFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Allgemeine Telefonnummer"
                name="telefon"
                value={lieferantenFormular.telefon}
                onChange={lieferantenFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="email"
                label="Allgemeine E-Mail"
                name="email"
                value={lieferantenFormular.email}
                onChange={lieferantenFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Website"
                name="website"
                value={lieferantenFormular.website}
                onChange={lieferantenFeldAendern}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" fontWeight={800} mt={1}>
                Hauptansprechpartner
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Name"
                name="ansprechpartner"
                value={lieferantenFormular.ansprechpartner}
                onChange={lieferantenFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Position / Abteilung"
                name="position"
                value={lieferantenFormular.position}
                onChange={lieferantenFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Mobilnummer"
                name="mobil"
                value={lieferantenFormular.mobil}
                onChange={lieferantenFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="email"
                label="Persönliche E-Mail"
                name="kontaktEmail"
                value={lieferantenFormular.kontaktEmail}
                onChange={lieferantenFeldAendern}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" fontWeight={800} mt={1}>
                Konditionen
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Zahlungsziel"
                placeholder="z. B. 30 Tage netto"
                name="zahlungsziel"
                value={lieferantenFormular.zahlungsziel}
                onChange={lieferantenFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Skonto"
                placeholder="z. B. 3 % innerhalb 10 Tagen"
                name="skonto"
                value={lieferantenFormular.skonto}
                onChange={lieferantenFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Lieferbedingungen"
                name="lieferbedingungen"
                value={lieferantenFormular.lieferbedingungen}
                onChange={lieferantenFeldAendern}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                minRows={4}
                label="Notizen"
                placeholder="Rabatte, Besonderheiten, Erfahrungen, Absprachen ..."
                name="notizen"
                value={lieferantenFormular.notizen}
                onChange={lieferantenFeldAendern}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLieferantenDialogOffen(false)}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            onClick={lieferantSpeichern}
            disabled={speichert}
          >
            {speichert ? "Speichert..." : "Speichern"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}