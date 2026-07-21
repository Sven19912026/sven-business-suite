import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

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
  auftraggeberId: "",
  auftraggeberName: "",
  verhandlungstag: "",
  lieferantId: "",
  firma: "",
  verhandlungsgegenstand: "",
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

const leerEigeneFirma = {
  name: "",
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

let fahrzeugZeilenZaehler = 0;

function neuesFahrzeug() {
  fahrzeugZeilenZaehler += 1;
  return {
    id: `fahrzeug-${Date.now()}-${fahrzeugZeilenZaehler}`,
    hersteller: "",
    modell: "",
    ausstattung: "",
    anzahl: "1",
    listenpreis: "",
    angebotspreis: "",
    kennzeichenOderReferenz: "",
  };
}

const leerFahrzeugFormular = {
  lieferantId: "",
  firma: "",
  beschreibung: "",
  beschaffungsart: "Leasing",
  status: "Offen",
  prioritaet: "Mittel",
  ansprechpartner: "",
  telefon: "",
  email: "",
  bestelltermin: "",
  gewuenschterLiefertermin: "",
  voraussichtlicherLiefertermin: "",
  wiedervorlage: "",
  laufzeitMonate: "",
  leasingrate: "",
  kaufpreis: "",
  sonderzahlung: "",
  notizen: "",
  fahrzeuge: [],
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
function statusNormalisieren(status) {
  if (status === "Gewonnen") {
    return "Abgeschlossen";
  }

  return status || "Offen";
}

function statusIstAbgeschlossen(status) {
  return status === "Abgeschlossen" || status === "Gewonnen";
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

export default function Verhandlungen({
  initialNegotiationId = "",
  onInitialNegotiationOpened,
}) {
  const theme = useTheme();
  const istMobil = useMediaQuery(theme.breakpoints.down("md"));

  const [ansicht, setAnsicht] = useState("verhandlungen");
  const initialNegotiationOpenedRef = useRef("");

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

  const [eigeneFirmen, setEigeneFirmen] = useState([]);
  const [eigeneFirmenDialogOffen, setEigeneFirmenDialogOffen] = useState(false);
  const [eigeneFirmaFormular, setEigeneFirmaFormular] = useState(leerEigeneFirma);
  const [eigeneFirmaBearbeitungsId, setEigeneFirmaBearbeitungsId] = useState(null);

  const [suche, setSuche] = useState("");
  const [statusFilter, setStatusFilter] = useState("Alle");
  const [prioritaetFilter, setPrioritaetFilter] = useState("Alle");
  const [auftraggeberFilter, setAuftraggeberFilter] = useState("Alle");
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

  const [uebergabeDialogOffen, setUebergabeDialogOffen] = useState(false);
  const [uebergabeAuswahl, setUebergabeAuswahl] = useState([]);

  const [fahrzeugverhandlungen, setFahrzeugverhandlungen] = useState([]);
  const [fahrzeugFormular, setFahrzeugFormular] = useState({
    ...leerFahrzeugFormular,
    fahrzeuge: [neuesFahrzeug()],
  });
  const [fahrzeugDialogOffen, setFahrzeugDialogOffen] = useState(false);
  const [fahrzeugBearbeitungsId, setFahrzeugBearbeitungsId] = useState(null);
  const [fahrzeugSuche, setFahrzeugSuche] = useState("");

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

    const eigeneFirmenAbfrage = query(
      collection(db, "verhandlungsFirmen"),
      where("userId", "==", benutzer.uid)
    );

    const fahrzeugAbfrage = query(
      collection(db, "fahrzeugverhandlungen"),
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

    const eigeneFirmenAbmelden = onSnapshot(
      eigeneFirmenAbfrage,
      (snapshot) => {
        setEigeneFirmen(snapshot.docs.map((eintrag) => ({ id: eintrag.id, ...eintrag.data() })).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "de")));
      },
      (error) => { console.error(error); setFehler("Die eigenen Firmen konnten nicht geladen werden. Bitte Firestore-Regeln prüfen."); }
    );

    const fahrzeugAbmelden = onSnapshot(
      fahrzeugAbfrage,
      (snapshot) => {
        setFahrzeugverhandlungen(
          snapshot.docs.map((eintrag) => ({
            id: eintrag.id,
            ...eintrag.data(),
          }))
        );
      },
      (error) => {
        console.error(error);
        setFehler(
          "Die Fahrzeugverhandlungen konnten nicht geladen werden. Bitte Firestore-Regeln prüfen."
        );
      }
    );

    return () => {
      verhandlungenAbmelden();
      lieferantenAbmelden();
      eigeneFirmenAbmelden();
      fahrzeugAbmelden();
    };
  }, []);

  const kennzahlen = useMemo(() => {
    const offen = verhandlungen.filter(
      (eintrag) =>
        eintrag.status === "Offen" || eintrag.status === "In Verhandlung"
    ).length;

    const abgeschlossen = verhandlungen.filter(
  (eintrag) => statusIstAbgeschlossen(eintrag.status)
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
        !statusIstAbgeschlossen(eintrag.status) &&
eintrag.status !== "Verloren"
    ).length;

    return {
  offen,
  abgeschlossen,
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
  statusFilter === "Alle" ||
  statusNormalisieren(eintrag.status) === statusFilter;
      const passtPrioritaet =
        prioritaetFilter === "Alle" ||
        eintrag.prioritaet === prioritaetFilter;
      const passtAuftraggeber = auftraggeberFilter === "Alle" || eintrag.auftraggeberId === auftraggeberFilter;
      const passtSuche =
        suchbegriff === "" ||
        eintrag.firma?.toLowerCase().includes(suchbegriff) ||
        eintrag.auftraggeberName?.toLowerCase().includes(suchbegriff) ||
        eintrag.verhandlungsgegenstand
          ?.toLowerCase()
          .includes(suchbegriff) ||
        eintrag.ansprechpartner?.toLowerCase().includes(suchbegriff) ||
        eintrag.kategorie?.toLowerCase().includes(suchbegriff) ||
        eintrag.email?.toLowerCase().includes(suchbegriff) ||
        eintrag.notizen?.toLowerCase().includes(suchbegriff);

      return passtStatus && passtPrioritaet && passtAuftraggeber && passtSuche;
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
    auftraggeberFilter,
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

  const gefilterteFahrzeugverhandlungen = useMemo(() => {
    const suchbegriff = fahrzeugSuche.trim().toLowerCase();

    return [...fahrzeugverhandlungen]
      .filter((eintrag) => {
        const fahrzeugText = (eintrag.fahrzeuge || [])
          .map((fahrzeug) =>
            [fahrzeug.hersteller, fahrzeug.modell, fahrzeug.ausstattung]
              .filter(Boolean)
              .join(" ")
          )
          .join(" ")
          .toLowerCase();

        return (
          !suchbegriff ||
          eintrag.firma?.toLowerCase().includes(suchbegriff) ||
          eintrag.beschreibung?.toLowerCase().includes(suchbegriff) ||
          eintrag.beschaffungsart?.toLowerCase().includes(suchbegriff) ||
          eintrag.status?.toLowerCase().includes(suchbegriff) ||
          fahrzeugText.includes(suchbegriff)
        );
      })
      .sort((a, b) =>
        String(a.gewuenschterLiefertermin || "9999-12-31").localeCompare(
          String(b.gewuenschterLiefertermin || "9999-12-31")
        )
      );
  }, [fahrzeugverhandlungen, fahrzeugSuche]);

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

    if (name === "auftraggeberId") {
      const ausgewaehlt = eigeneFirmen.find((firma) => firma.id === value);
      setVerhandlungsFormular((vorher) => ({ ...vorher, auftraggeberId: value, auftraggeberName: ausgewaehlt?.name || "" }));
      return;
    }

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
    setVerhandlungsFormular({ ...leerVerhandlungsFormular, verhandlungstag: heuteText() });
    setVerhandlungsBearbeitungsId(null);
    setFehler("");
    setVerhandlungsDialogOffen(true);
  }

  function verhandlungBearbeitenOeffnen(eintrag) {
    setVerhandlungsFormular({
      auftraggeberId: eintrag.auftraggeberId ?? "",
      auftraggeberName: eintrag.auftraggeberName ?? "",
      verhandlungstag: eintrag.verhandlungstag ?? "",
      lieferantId: eintrag.lieferantId ?? "",
      firma: eintrag.firma ?? "",
      verhandlungsgegenstand: eintrag.verhandlungsgegenstand ?? "",
      ansprechpartner: eintrag.ansprechpartner ?? "",
      telefon: eintrag.telefon ?? "",
      email: eintrag.email ?? "",
      kategorie: eintrag.kategorie ?? "Material",
      status: statusNormalisieren(eintrag.status),
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

  useEffect(() => {
    if (!initialNegotiationId) {
      initialNegotiationOpenedRef.current = "";
      return;
    }

    if (
      initialNegotiationOpenedRef.current ===
      initialNegotiationId
    ) {
      return;
    }

    const eintrag = verhandlungen.find(
      (item) => item.id === initialNegotiationId
    );

    if (!eintrag) return;

    initialNegotiationOpenedRef.current =
      initialNegotiationId;

    setAnsicht("verhandlungen");
    verhandlungBearbeitenOeffnen(eintrag);
    onInitialNegotiationOpened?.();
  }, [
    initialNegotiationId,
    verhandlungen,
    onInitialNegotiationOpened,
  ]);

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
    if (!verhandlungsFormular.auftraggeberId) { setFehler("Bitte zuerst die Firma auswählen, für die verhandelt wird."); return; }

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
  status: statusNormalisieren(verhandlungsFormular.status),
  firma: verhandlungsFormular.firma.trim(),
      auftraggeberName: verhandlungsFormular.auftraggeberName.trim(),
      verhandlungsgegenstand:
        verhandlungsFormular.verhandlungsgegenstand.trim(),
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

  function eigeneFirmaBearbeiten(eintrag) {
    setEigeneFirmaFormular({ name: eintrag.name || "", notizen: eintrag.notizen || "" });
    setEigeneFirmaBearbeitungsId(eintrag.id);
  }

  async function eigeneFirmaSpeichern() {
    const name = eigeneFirmaFormular.name.trim();
    if (!name) { setFehler("Bitte einen Firmennamen eintragen."); return; }
    const benutzer = auth.currentUser;
    if (!benutzer) return;
    setSpeichert(true);
    try {
      const daten = { name, notizen: eigeneFirmaFormular.notizen.trim(), userId: benutzer.uid, geaendertAm: serverTimestamp() };
      if (eigeneFirmaBearbeitungsId) await updateDoc(doc(db, "verhandlungsFirmen", eigeneFirmaBearbeitungsId), daten);
      else await addDoc(collection(db, "verhandlungsFirmen"), { ...daten, erstelltAm: serverTimestamp() });
      setEigeneFirmaFormular(leerEigeneFirma);
      setEigeneFirmaBearbeitungsId(null);
      setFehler("");
    } catch (error) { console.error(error); setFehler("Die Firma konnte nicht gespeichert werden. Bitte Firestore-Regeln prüfen."); }
    finally { setSpeichert(false); }
  }

  async function eigeneFirmaLoeschen(eintrag) {
    if (!window.confirm(`Firma „${eintrag.name}“ wirklich löschen? Bestehende Verhandlungen bleiben erhalten.`)) return;
    try { await deleteDoc(doc(db, "verhandlungsFirmen", eintrag.id)); if (auftraggeberFilter === eintrag.id) setAuftraggeberFilter("Alle"); }
    catch (error) { console.error(error); setFehler("Die Firma konnte nicht gelöscht werden."); }
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

  function neuesFahrzeugVorhabenOeffnen() {
    setFahrzeugFormular({
      ...leerFahrzeugFormular,
      fahrzeuge: [neuesFahrzeug()],
    });
    setFahrzeugBearbeitungsId(null);
    setFehler("");
    setFahrzeugDialogOffen(true);
  }

  function fahrzeugVorhabenBearbeiten(eintrag) {
    setFahrzeugFormular({
      ...leerFahrzeugFormular,
      ...eintrag,
      fahrzeuge: (eintrag.fahrzeuge || []).length
        ? eintrag.fahrzeuge.map((fahrzeug) => ({
            ...neuesFahrzeug(),
            ...fahrzeug,
          }))
        : [neuesFahrzeug()],
    });
    setFahrzeugBearbeitungsId(eintrag.id);
    setFehler("");
    setFahrzeugDialogOffen(true);
  }

  function fahrzeugFeldAendern(event) {
    const { name, value } = event.target;

    if (name === "lieferantId") {
      const ausgewaehlt = lieferanten.find((lieferant) => lieferant.id === value);
      setFahrzeugFormular((vorher) => ({
        ...vorher,
        lieferantId: value,
        firma: ausgewaehlt?.firma || vorher.firma,
        ansprechpartner: ausgewaehlt?.ansprechpartner || vorher.ansprechpartner,
        telefon: ausgewaehlt?.mobil || ausgewaehlt?.telefon || vorher.telefon,
        email: ausgewaehlt?.kontaktEmail || ausgewaehlt?.email || vorher.email,
      }));
      return;
    }

    setFahrzeugFormular((vorher) => ({ ...vorher, [name]: value }));
  }

  function fahrzeugZeileAendern(id, feld, wert) {
    setFahrzeugFormular((vorher) => ({
      ...vorher,
      fahrzeuge: vorher.fahrzeuge.map((fahrzeug) =>
        fahrzeug.id === id ? { ...fahrzeug, [feld]: wert } : fahrzeug
      ),
    }));
  }

  function fahrzeugZeileHinzufuegen() {
    setFahrzeugFormular((vorher) => ({
      ...vorher,
      fahrzeuge: [...vorher.fahrzeuge, neuesFahrzeug()],
    }));
  }

  function fahrzeugZeileEntfernen(id) {
    setFahrzeugFormular((vorher) => ({
      ...vorher,
      fahrzeuge:
        vorher.fahrzeuge.length > 1
          ? vorher.fahrzeuge.filter((fahrzeug) => fahrzeug.id !== id)
          : vorher.fahrzeuge,
    }));
  }

  async function fahrzeugVorhabenSpeichern() {
    if (!fahrzeugFormular.firma.trim()) {
      setFehler("Bitte einen Händler oder Lieferanten eintragen.");
      return;
    }

    const fahrzeuge = fahrzeugFormular.fahrzeuge
      .map((fahrzeug) => ({
        ...fahrzeug,
        hersteller: fahrzeug.hersteller.trim(),
        modell: fahrzeug.modell.trim(),
        anzahl: Math.max(Number(fahrzeug.anzahl) || 1, 1),
        listenpreis: euroWert(fahrzeug.listenpreis),
        angebotspreis: euroWert(fahrzeug.angebotspreis),
      }))
      .filter((fahrzeug) => fahrzeug.hersteller || fahrzeug.modell);

    if (!fahrzeuge.length) {
      setFehler("Bitte mindestens ein Fahrzeug mit Hersteller oder Modell eintragen.");
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
      ...fahrzeugFormular,
      firma: fahrzeugFormular.firma.trim(),
      fahrzeuge,
      leasingrate: euroWert(fahrzeugFormular.leasingrate),
      kaufpreis: euroWert(fahrzeugFormular.kaufpreis),
      sonderzahlung: euroWert(fahrzeugFormular.sonderzahlung),
      userId: benutzer.uid,
      geaendertAm: serverTimestamp(),
    };

    try {
      if (fahrzeugBearbeitungsId) {
        await updateDoc(
          doc(db, "fahrzeugverhandlungen", fahrzeugBearbeitungsId),
          daten
        );
      } else {
        await addDoc(collection(db, "fahrzeugverhandlungen"), {
          ...daten,
          erstelltAm: serverTimestamp(),
        });
      }
      setFahrzeugDialogOffen(false);
      setFahrzeugBearbeitungsId(null);
    } catch (error) {
      console.error(error);
      setFehler("Die Fahrzeugverhandlung konnte nicht gespeichert werden.");
    } finally {
      setSpeichert(false);
    }
  }

  async function fahrzeugVorhabenLoeschen(eintrag) {
    if (!window.confirm(`Fahrzeugverhandlung mit "${eintrag.firma}" wirklich löschen?`)) return;
    try {
      await deleteDoc(doc(db, "fahrzeugverhandlungen", eintrag.id));
    } catch (error) {
      console.error(error);
      setFehler("Die Fahrzeugverhandlung konnte nicht gelöscht werden.");
    }
  }

  function prioritaetsFarbe(prioritaet) {
    if (prioritaet === "Hoch") return "error";
    if (prioritaet === "Mittel") return "warning";
    return "default";
  }

  const uebergabeVerhandlungen = useMemo(() => {
    const offen = verhandlungen
      .filter((eintrag) => eintrag.status === "Offen" || eintrag.status === "In Verhandlung")
      .sort((a, b) => String(a.wiedervorlage || "9999-12-31").localeCompare(String(b.wiedervorlage || "9999-12-31")));
    const erledigt = verhandlungen
      .filter(
  (eintrag) =>
    statusIstAbgeschlossen(eintrag.status) ||
    eintrag.status === "Verloren"
)
      .sort((a, b) => (b.aktualisiertAm?.seconds || b.erstelltAm?.seconds || 0) - (a.aktualisiertAm?.seconds || a.erstelltAm?.seconds || 0))
      .slice(0, 10);
    return [...offen, ...erledigt];
  }, [verhandlungen]);

  function uebergabeOeffnen() {
    setUebergabeAuswahl(uebergabeVerhandlungen.map((eintrag) => eintrag.id));
    setUebergabeDialogOffen(true);
  }

  function uebergabeUmschalten(id) {
    setUebergabeAuswahl((vorher) => vorher.includes(id)
      ? vorher.filter((wert) => wert !== id)
      : [...vorher, id]);
  }

  function htmlSicher(value) {
    return String(value ?? "").replace(/[&<>"']/g, (zeichen) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    }[zeichen]));
  }

  function uebergabeAlsPdfDrucken() {
    const auswahl = uebergabeVerhandlungen.filter((eintrag) => uebergabeAuswahl.includes(eintrag.id));
    if (!auswahl.length) return;
    const zeilen = auswahl.map((eintrag) => `
      <tr>
        <td>${htmlSicher(eintrag.status)}<br><small>${htmlSicher(eintrag.verhandlungstag ? datumFormat(eintrag.verhandlungstag) : "Kein Verhandlungstag")}</small></td>
        <td><small>Für: ${htmlSicher(eintrag.auftraggeberName || "—")}</small><br><strong>${htmlSicher(eintrag.firma)}</strong><br>${htmlSicher(eintrag.verhandlungsgegenstand || "Kein Gegenstand hinterlegt")}</td>
        <td><strong>${htmlSicher(eintrag.ansprechpartner || "—")}</strong><br><small>${htmlSicher(eintrag.telefon || "Keine Telefonnummer")}<br>${htmlSicher(eintrag.email || "Keine E-Mail")}</small></td>
        <td>${htmlSicher(eintrag.wiedervorlage ? datumFormat(eintrag.wiedervorlage) : "—")}</td>
        <td>${htmlSicher(euroFormat(eintrag.aktuellesAngebot))}<br><small>Ersparnis: ${htmlSicher(euroFormat(einsparung(eintrag)))} (${htmlSicher(prozentFormat(einsparungProzent(eintrag)))})</small></td>
        <td>${htmlSicher(eintrag.notizen || "—")}</td>
      </tr>`).join("");
    const druckHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Urlaubsübergabe Verhandlungen</title><style>body{font-family:Arial,sans-serif;color:#172033;margin:28px}h1{margin:0 0 6px}.meta{color:#667085;margin-bottom:22px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #d0d5dd;padding:8px;vertical-align:top;text-align:left}th{background:#f2f4f7}tr{page-break-inside:avoid}@page{size:landscape;margin:10mm}@media print{body{margin:0}}</style></head><body><h1>Urlaubsübergabe – Verhandlungen</h1><div class="meta">Erstellt am ${new Date().toLocaleString("de-DE")} · ${auswahl.length} ausgewählte Verhandlung(en)</div><table><thead><tr><th>Status</th><th>Firma / Gegenstand</th><th>Ansprechpartner / Kontakt</th><th>Wiedervorlage</th><th>Aktueller Stand</th><th>Notizen</th></tr></thead><tbody>${zeilen}</tbody></table></body></html>`;

    // Drucken über ein unsichtbares iFrame statt über window.open().
    // Dadurch wird kein Pop-up geöffnet und Chrome blockiert den PDF-Druck nicht.
    const vorhandenesIframe = document.getElementById("verhandlungen-druck-iframe");
    if (vorhandenesIframe) vorhandenesIframe.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "verhandlungen-druck-iframe";
    iframe.setAttribute("title", "Druckansicht Urlaubsübergabe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const druckDokument = iframe.contentDocument || iframe.contentWindow?.document;
    if (!druckDokument || !iframe.contentWindow) {
      iframe.remove();
      setFehler("Die Druckansicht konnte nicht erstellt werden.");
      return;
    }

    druckDokument.open();
    druckDokument.write(druckHtml);
    druckDokument.close();

    setUebergabeDialogOffen(false);
    setFehler("");

    window.setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {
        setFehler("Der Druckdialog konnte nicht geöffnet werden.");
      }
    }, 250);

    window.setTimeout(() => iframe.remove(), 60000);
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
  titel: "Abgeschlossen",
  wert: kennzahlen.abgeschlossen,
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
            Verhandlungen, Fahrzeuge & Lieferanten
          </Typography>
          <Typography color="text.secondary">
            Preise, Fahrzeuge, Liefertermine, Kontakte, Konditionen und
            Wiedervorlagen verwalten
          </Typography>
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignSelf={{ xs: "stretch", md: "center" }}
        >
          {ansicht === "verhandlungen" && (
            <Button variant="outlined" startIcon={<BusinessIcon />} onClick={() => { setEigeneFirmaFormular(leerEigeneFirma); setEigeneFirmaBearbeitungsId(null); setEigeneFirmenDialogOffen(true); }} sx={{ minHeight: 48, px: 2.5, whiteSpace: "nowrap" }}>
              Firmen verwalten
            </Button>
          )}
          {ansicht === "verhandlungen" && (
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={uebergabeOeffnen}
              sx={{ minHeight: 48, px: 2.5, whiteSpace: "nowrap" }}
            >
              Urlaubsübergabe PDF
            </Button>
          )}
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
                : ansicht === "fahrzeuge"
                  ? neuesFahrzeugVorhabenOeffnen
                  : neuerLieferantOeffnen
            }
            sx={{ minHeight: 48, px: 3, whiteSpace: "nowrap" }}
          >
            {ansicht === "verhandlungen"
              ? "Neue Verhandlung"
              : ansicht === "fahrzeuge"
                ? "Fahrzeug hinzufügen"
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
            value="fahrzeuge"
            icon={<DirectionsCarIcon />}
            iconPosition="start"
            label={`Fahrzeuge (${fahrzeugverhandlungen.length})`}
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

      {ansicht === "fahrzeuge" ? (
        <>
          <Grid container spacing={2} mb={3}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card><CardContent><Typography color="text.secondary" fontWeight={700}>Fahrzeugvorhaben</Typography><Typography variant="h4" fontWeight={800}>{fahrzeugverhandlungen.length}</Typography></CardContent></Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card><CardContent><Typography color="text.secondary" fontWeight={700}>Leasing</Typography><Typography variant="h4" fontWeight={800}>{fahrzeugverhandlungen.filter((eintrag) => eintrag.beschaffungsart === "Leasing").length}</Typography></CardContent></Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card><CardContent><Typography color="text.secondary" fontWeight={700}>Kauf</Typography><Typography variant="h4" fontWeight={800}>{fahrzeugverhandlungen.filter((eintrag) => eintrag.beschaffungsart === "Kauf").length}</Typography></CardContent></Card>
            </Grid>
          </Grid>

          <Paper sx={{ p: 2, mb: 2 }}>
            <TextField
              fullWidth
              label="Fahrzeuge suchen"
              placeholder="Händler, Hersteller, Modell, Leasing, Kauf oder Status"
              value={fahrzeugSuche}
              onChange={(event) => setFahrzeugSuche(event.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
            />
          </Paper>

          <Stack spacing={1.5}>
            {gefilterteFahrzeugverhandlungen.map((eintrag) => (
              <Accordion key={eintrag.id} disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", md: "center" }} sx={{ width: "100%", pr: 1 }}>
                    <DirectionsCarIcon color="primary" />
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography fontWeight={800}>{eintrag.firma}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {eintrag.beschreibung || `${(eintrag.fahrzeuge || []).length} Fahrzeug(e)`}
                      </Typography>
                    </Box>
                    <Chip size="small" label={eintrag.beschaffungsart || "—"} color="primary" variant="outlined" />
                    <Chip size="small" label={eintrag.status || "Offen"} color={statusFarbe(eintrag.status)} />
                    <Typography variant="body2" sx={{ minWidth: 180 }}>
                      Erwartet: {eintrag.voraussichtlicherLiefertermin ? datumFormat(eintrag.voraussichtlicherLiefertermin) : "nicht bekannt"}
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 3 }}><Typography variant="caption" color="text.secondary">Bestelltermin</Typography><Typography fontWeight={700}>{eintrag.bestelltermin ? datumFormat(eintrag.bestelltermin) : "—"}</Typography></Grid>
                    <Grid size={{ xs: 12, md: 3 }}><Typography variant="caption" color="text.secondary">Gewünschter Liefertermin</Typography><Typography fontWeight={700}>{eintrag.gewuenschterLiefertermin ? datumFormat(eintrag.gewuenschterLiefertermin) : "—"}</Typography></Grid>
                    <Grid size={{ xs: 12, md: 3 }}><Typography variant="caption" color="text.secondary">Voraussichtlicher Liefertermin</Typography><Typography fontWeight={700}>{eintrag.voraussichtlicherLiefertermin ? datumFormat(eintrag.voraussichtlicherLiefertermin) : "—"}</Typography></Grid>
                    <Grid size={{ xs: 12, md: 3 }}><Typography variant="caption" color="text.secondary">Ansprechpartner</Typography><Typography fontWeight={700}>{eintrag.ansprechpartner || "—"}</Typography></Grid>
                  </Grid>
                  <Divider sx={{ my: 2 }} />
                  <Stack spacing={1}>
                    {(eintrag.fahrzeuge || []).map((fahrzeug, index) => (
                      <Paper key={fahrzeug.id || index} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
                          <Box><Typography fontWeight={800}>{fahrzeug.hersteller || "Hersteller offen"} {fahrzeug.modell || ""}</Typography><Typography variant="body2" color="text.secondary">{fahrzeug.ausstattung || "Keine Ausstattung hinterlegt"} · Anzahl: {fahrzeug.anzahl || 1}</Typography></Box>
                          <Box textAlign={{ xs: "left", md: "right" }}><Typography variant="body2">Listenpreis: {euroFormat(fahrzeug.listenpreis)}</Typography><Typography fontWeight={800}>Angebot: {euroFormat(fahrzeug.angebotspreis)}</Typography></Box>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                  {(eintrag.leasingrate || eintrag.kaufpreis || eintrag.sonderzahlung) ? <Paper variant="outlined" sx={{ p: 1.5, mt: 2 }}><Stack direction={{ xs: "column", sm: "row" }} spacing={3}><Typography>Leasingrate: <strong>{euroFormat(eintrag.leasingrate)}</strong></Typography><Typography>Kaufpreis: <strong>{euroFormat(eintrag.kaufpreis)}</strong></Typography><Typography>Sonderzahlung: <strong>{euroFormat(eintrag.sonderzahlung)}</strong></Typography></Stack></Paper> : null}
                  {eintrag.notizen && <Typography sx={{ mt: 2, whiteSpace: "pre-wrap" }}>{eintrag.notizen}</Typography>}
                  <Stack direction="row" justifyContent="flex-end" spacing={1} mt={2}>
                    <Button startIcon={<EditIcon />} onClick={() => fahrzeugVorhabenBearbeiten(eintrag)}>Bearbeiten</Button>
                    <Button color="error" startIcon={<DeleteIcon />} onClick={() => fahrzeugVorhabenLoeschen(eintrag)}>Löschen</Button>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
            {!gefilterteFahrzeugverhandlungen.length && <Alert severity="info">Noch keine Fahrzeugverhandlung vorhanden.</Alert>}
          </Stack>
        </>
      ) : ansicht === "verhandlungen" ? (
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
              <Grid size={{ xs: 12, lg: 5 }}>
                <TextField
                  fullWidth
                  label="Suchen"
                  placeholder="Auftraggeber, Lieferant, Verhandlungsgegenstand, Ansprechpartner oder Notiz"
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

              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <TextField select fullWidth label="Firma (Auftraggeber)" value={auftraggeberFilter} onChange={(event) => setAuftraggeberFilter(event.target.value)}>
                  <MenuItem value="Alle">Alle Firmen</MenuItem>
                  {eigeneFirmen.map((firma) => <MenuItem key={firma.id} value={firma.id}>{firma.name}</MenuItem>)}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
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
                  <MenuItem value="Abgeschlossen">
  Abgeschlossen
</MenuItem>
                  <MenuItem value="Verloren">Verloren</MenuItem>
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, lg: 2 }}>
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
                        <Typography variant="caption" color="text.secondary">Für {eintrag.auftraggeberName || "keine Firma zugeordnet"} · Verhandlungstag: {datumFormat(eintrag.verhandlungstag)}</Typography>
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

                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        mt: 2,
                        bgcolor: "action.hover",
                        borderColor: "divider",
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight={700}
                      >
                        Verhandlungsgegenstand
                      </Typography>
                      <Typography
                        fontWeight={800}
                        sx={{ mt: 0.25, whiteSpace: "pre-wrap" }}
                      >
                        {eintrag.verhandlungsgegenstand || "Nicht hinterlegt"}
                      </Typography>
                    </Paper>

                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      mt={2}
                      useFlexGap
                    >
                      <Chip
                        label={statusNormalisieren(eintrag.status)}
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
                    <TableCell>Für Firma</TableCell>
                    <TableCell>Verhandlungstag</TableCell>
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
                    <TableCell>
                      <TableSortLabel
                        active={sortierung === "verhandlungsgegenstand"}
                        direction={
                          sortierung === "verhandlungsgegenstand"
                            ? sortRichtung
                            : "asc"
                        }
                        onClick={() => sortieren("verhandlungsgegenstand")}
                      >
                        Verhandlungsgegenstand
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
                      <TableCell><Typography fontWeight={700}>{eintrag.auftraggeberName || "—"}</Typography></TableCell>
                      <TableCell>{datumFormat(eintrag.verhandlungstag)}</TableCell>
                      <TableCell>
                        <Typography fontWeight={700}>
                          {eintrag.firma}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {eintrag.kategorie}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 240, maxWidth: 360 }}>
                        <Typography
                          fontWeight={700}
                          sx={{
                            whiteSpace: "normal",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {eintrag.verhandlungsgegenstand || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {eintrag.ansprechpartner || "—"}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={statusNormalisieren(eintrag.status)}
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
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField select required fullWidth label="Firma, für die verhandelt wird" name="auftraggeberId" value={verhandlungsFormular.auftraggeberId} onChange={verhandlungsFeldAendern} helperText={eigeneFirmen.length ? "Auftraggeber auswählen" : "Bitte zuerst über ‚Firmen verwalten‘ eine Firma anlegen"}>
                <MenuItem value="">Bitte auswählen</MenuItem>
                {eigeneFirmen.map((firma) => <MenuItem key={firma.id} value={firma.id}>{firma.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth type="date" label="Verhandlungstag" name="verhandlungstag" value={verhandlungsFormular.verhandlungstag} onChange={verhandlungsFeldAendern} InputLabelProps={{ shrink: true }} />
            </Grid>
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
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Verhandlungsgegenstand"
                name="verhandlungsgegenstand"
                value={verhandlungsFormular.verhandlungsgegenstand}
                onChange={verhandlungsFeldAendern}
                multiline
                minRows={2}
                placeholder="z. B. Jahreskonditionen, Fahrzeugkauf, Mietpreis oder Materialrabatt"
                helperText="Beschreibe kurz, worüber mit diesem Lieferanten verhandelt wird."
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
                <MenuItem value="Abgeschlossen">
  Abgeschlossen
</MenuItem>
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

      <Dialog open={eigeneFirmenDialogOffen} onClose={() => setEigeneFirmenDialogOffen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Firmen verwalten</DialogTitle>
        <DialogContent dividers>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Diese Firmen stehen anschließend beim Anlegen und Filtern von Verhandlungen als Auftraggeber zur Auswahl.</Typography>
          <Stack spacing={1.5}>
            <TextField fullWidth required label="Firmenname" value={eigeneFirmaFormular.name} onChange={(event) => setEigeneFirmaFormular((vorher) => ({ ...vorher, name: event.target.value }))} />
            <TextField fullWidth label="Notiz" value={eigeneFirmaFormular.notizen} onChange={(event) => setEigeneFirmaFormular((vorher) => ({ ...vorher, notizen: event.target.value }))} />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={eigeneFirmaSpeichern} disabled={speichert}>{eigeneFirmaBearbeitungsId ? "Änderung speichern" : "Firma anlegen"}</Button>
              {eigeneFirmaBearbeitungsId && <Button onClick={() => { setEigeneFirmaFormular(leerEigeneFirma); setEigeneFirmaBearbeitungsId(null); }}>Abbrechen</Button>}
            </Stack>
            <Divider />
            {!eigeneFirmen.length && <Alert severity="info">Noch keine Firmen angelegt.</Alert>}
            {eigeneFirmen.map((firma) => <Paper key={firma.id} variant="outlined" sx={{ p: 1.5 }}><Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}><Box><Typography fontWeight={800}>{firma.name}</Typography>{firma.notizen && <Typography variant="body2" color="text.secondary">{firma.notizen}</Typography>}</Box><Stack direction="row"><IconButton onClick={() => eigeneFirmaBearbeiten(firma)}><EditIcon /></IconButton><IconButton color="error" onClick={() => eigeneFirmaLoeschen(firma)}><DeleteIcon /></IconButton></Stack></Stack></Paper>)}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setEigeneFirmenDialogOffen(false)}>Schließen</Button></DialogActions>
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


      <Dialog open={fahrzeugDialogOffen} onClose={() => setFahrzeugDialogOffen(false)} fullWidth maxWidth="lg">
        <DialogTitle>{fahrzeugBearbeitungsId ? "Fahrzeugverhandlung bearbeiten" : "Neue Fahrzeugverhandlung"}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField select fullWidth label="Lieferant / Händler auswählen" name="lieferantId" value={fahrzeugFormular.lieferantId} onChange={fahrzeugFeldAendern}>
                <MenuItem value="">Manuell eintragen</MenuItem>
                {lieferanten.map((lieferant) => <MenuItem key={lieferant.id} value={lieferant.id}>{lieferant.firma}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth required label="Händler / Lieferant" name="firma" value={fahrzeugFormular.firma} onChange={fahrzeugFeldAendern} /></Grid>
            <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Verhandlungsgegenstand" placeholder="z. B. Ersatzbeschaffung Werkstattfahrzeuge" name="beschreibung" value={fahrzeugFormular.beschreibung} onChange={fahrzeugFeldAendern} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><TextField select fullWidth label="Beschaffungsart" name="beschaffungsart" value={fahrzeugFormular.beschaffungsart} onChange={fahrzeugFeldAendern}><MenuItem value="Leasing">Leasing</MenuItem><MenuItem value="Kauf">Kauf</MenuItem></TextField></Grid>
            <Grid size={{ xs: 6, md: 3 }}><TextField select fullWidth label="Status" name="status" value={fahrzeugFormular.status} onChange={fahrzeugFeldAendern}>{["Offen", "In Verhandlung", "Bestellt", "Geliefert", "Abgebrochen"].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="date" label="Bestelltermin" name="bestelltermin" value={fahrzeugFormular.bestelltermin} onChange={fahrzeugFeldAendern} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="date" label="Gewünschter Liefertermin" name="gewuenschterLiefertermin" value={fahrzeugFormular.gewuenschterLiefertermin} onChange={fahrzeugFeldAendern} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="date" label="Voraussichtlicher Liefertermin" name="voraussichtlicherLiefertermin" value={fahrzeugFormular.voraussichtlicherLiefertermin} onChange={fahrzeugFeldAendern} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="date" label="Wiedervorlage" name="wiedervorlage" value={fahrzeugFormular.wiedervorlage} onChange={fahrzeugFeldAendern} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Ansprechpartner" name="ansprechpartner" value={fahrzeugFormular.ansprechpartner} onChange={fahrzeugFeldAendern} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Telefon" name="telefon" value={fahrzeugFormular.telefon} onChange={fahrzeugFeldAendern} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="E-Mail" name="email" value={fahrzeugFormular.email} onChange={fahrzeugFeldAendern} /></Grid>
            <Grid size={{ xs: 12 }}><Divider><Chip icon={<DirectionsCarIcon />} label="Einzelne Fahrzeuge" /></Divider></Grid>
            {fahrzeugFormular.fahrzeuge.map((fahrzeug, index) => (
              <Grid size={{ xs: 12 }} key={fahrzeug.id}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}><Typography fontWeight={800}>Fahrzeug {index + 1}</Typography><IconButton color="error" disabled={fahrzeugFormular.fahrzeuge.length === 1} onClick={() => fahrzeugZeileEntfernen(fahrzeug.id)}><RemoveCircleOutlineIcon /></IconButton></Stack>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="Hersteller" value={fahrzeug.hersteller} onChange={(event) => fahrzeugZeileAendern(fahrzeug.id, "hersteller", event.target.value)} /></Grid>
                    <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="Modell" value={fahrzeug.modell} onChange={(event) => fahrzeugZeileAendern(fahrzeug.id, "modell", event.target.value)} /></Grid>
                    <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Ausstattung / Motorisierung" value={fahrzeug.ausstattung} onChange={(event) => fahrzeugZeileAendern(fahrzeug.id, "ausstattung", event.target.value)} /></Grid>
                    <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth type="number" label="Anzahl" value={fahrzeug.anzahl} onChange={(event) => fahrzeugZeileAendern(fahrzeug.id, "anzahl", event.target.value)} /></Grid>
                    <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label="Listenpreis (€)" value={fahrzeug.listenpreis} onChange={(event) => fahrzeugZeileAendern(fahrzeug.id, "listenpreis", event.target.value)} /></Grid>
                    <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label="Angebotspreis (€)" value={fahrzeug.angebotspreis} onChange={(event) => fahrzeugZeileAendern(fahrzeug.id, "angebotspreis", event.target.value)} /></Grid>
                    <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Kennzeichen / Referenz" value={fahrzeug.kennzeichenOderReferenz} onChange={(event) => fahrzeugZeileAendern(fahrzeug.id, "kennzeichenOderReferenz", event.target.value)} /></Grid>
                  </Grid>
                </Paper>
              </Grid>
            ))}
            <Grid size={{ xs: 12 }}><Button startIcon={<AddCircleOutlineIcon />} onClick={fahrzeugZeileHinzufuegen}>Weiteres Fahrzeug hinzufügen</Button></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Leasingrate monatlich (€)" name="leasingrate" value={fahrzeugFormular.leasingrate} onChange={fahrzeugFeldAendern} /></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Laufzeit (Monate)" name="laufzeitMonate" value={fahrzeugFormular.laufzeitMonate} onChange={fahrzeugFeldAendern} /></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Kaufpreis gesamt (€)" name="kaufpreis" value={fahrzeugFormular.kaufpreis} onChange={fahrzeugFeldAendern} /></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Sonderzahlung (€)" name="sonderzahlung" value={fahrzeugFormular.sonderzahlung} onChange={fahrzeugFeldAendern} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth multiline minRows={4} label="Notizen" name="notizen" value={fahrzeugFormular.notizen} onChange={fahrzeugFeldAendern} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setFahrzeugDialogOffen(false)}>Abbrechen</Button><Button variant="contained" onClick={fahrzeugVorhabenSpeichern} disabled={speichert}>{speichert ? "Speichert..." : "Speichern"}</Button></DialogActions>
      </Dialog>

      <Dialog open={uebergabeDialogOffen} onClose={() => setUebergabeDialogOffen(false)} fullWidth maxWidth="md">
        <DialogTitle>Urlaubsübergabe als PDF</DialogTitle>
        <DialogContent dividers>
          <Typography color="text.secondary" mb={2}>Wähle die offenen und zuletzt erledigten Verhandlungen aus. Im Druckdialog kannst du anschließend „Als PDF speichern“ auswählen.</Typography>
          <Stack direction="row" spacing={1} mb={2}>
            <Button size="small" onClick={() => setUebergabeAuswahl(uebergabeVerhandlungen.map((eintrag) => eintrag.id))}>Alle auswählen</Button>
            <Button size="small" onClick={() => setUebergabeAuswahl([])}>Auswahl löschen</Button>
          </Stack>
          <Stack spacing={1}>
            {uebergabeVerhandlungen.map((eintrag) => (
              <Paper key={eintrag.id} variant="outlined" sx={{ p: 1.25 }}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Checkbox checked={uebergabeAuswahl.includes(eintrag.id)} onChange={() => uebergabeUmschalten(eintrag.id)} />
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
                      <Box><Typography fontWeight={800}>{eintrag.firma}</Typography><Typography variant="body2">{eintrag.verhandlungsgegenstand || "Kein Verhandlungsgegenstand hinterlegt"}</Typography></Box>
                      <Chip size="small" label={statusNormalisieren(eintrag.status)} color={statusFarbe(eintrag.status)} sx={{ alignSelf: "flex-start" }} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">Wiedervorlage: {eintrag.wiedervorlage ? datumFormat(eintrag.wiedervorlage) : "—"} · Ansprechpartner: {eintrag.ansprechpartner || "—"}</Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
            {!uebergabeVerhandlungen.length && <Alert severity="info">Keine offenen oder zuletzt erledigten Verhandlungen vorhanden.</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setUebergabeDialogOffen(false)}>Abbrechen</Button><Button variant="contained" startIcon={<PictureAsPdfIcon />} onClick={uebergabeAlsPdfDrucken} disabled={!uebergabeAuswahl.length}>PDF-Druck öffnen</Button></DialogActions>
      </Dialog>
    </Box>
  );
}