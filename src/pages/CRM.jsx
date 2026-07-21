import { useEffect, useMemo, useRef, useState } from "react";
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
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BusinessIcon from "@mui/icons-material/Business";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import EventIcon from "@mui/icons-material/Event";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HistoryIcon from "@mui/icons-material/History";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import PersonIcon from "@mui/icons-material/Person";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DescriptionIcon from "@mui/icons-material/Description";
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
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { auth, db } from "../firebase";

GlobalWorkerOptions.workerSrc = pdfWorker;

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

const leerVertrag = {
  name: "",
  vertragsnummer: "",
  kategorie: "Dienstleistung",
  status: "Aktiv",
  startdatum: "",
  enddatum: "",
  kuendigungsfrist: "",
  automatischeVerlaengerung: true,
  kosten: "",
  kostenIntervall: "Monatlich",
  ansprechpartner: "",
  notizen: "",
};


const NEUER_LIEFERANT = "__neu__";
const MAX_DATEIGROESSE = 20 * 1024 * 1024;
const MAX_PDF_SEITEN = 80;
const MAX_OCR_PDF_SEITEN = 5;
const MIN_PDF_TEXTLAENGE = 120;

function textNormalisieren(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function zeilenAusText(text) {
  return text
    .split(/\r?\n/)
    .map((zeile) => zeile.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function ersterTreffer(text, muster) {
  for (const regex of muster) {
    const treffer = text.match(regex);
    const wert = treffer?.[1]?.trim();
    if (wert) return wert.replace(/[|;]+$/, "").trim();
  }
  return "";
}

function dateinameBereinigen(name) {
  return String(name || "")
    .replace(/\.(pdf|png|jpe?g|webp)$/i, "")
    .replace(/\b(scan|screenshot|bild|image|dokument|rechnung|angebot|vertrag|brief)\b/gi, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firmaBereinigen(value) {
  return String(value || "")
    .replace(/^(?:firma|lieferant|anbieter|auftragnehmer|verkäufer|rechnungssteller|vertragspartner)\s*[:–—-]?\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[|,;]+$/, "")
    .trim();
}

function firmaErkennen(text, dateiname) {
  const beschriftet = ersterTreffer(text, [
    /(?:Firma|Lieferant|Anbieter|Auftragnehmer|Verkäufer|Rechnungssteller|Vertragspartner|Aussteller)\s*[:–—-]\s*([^\n]{2,120})/i,
    /(?:von|durch)\s+([^\n]{2,100}?(?:GmbH(?:\s*&\s*Co\.?\s*KG)?|AG|KG|OHG|UG(?:\s*\(haftungsbeschränkt\))?|GbR|e\.?\s*K\.?|SE))\b/i,
  ]);
  if (beschriftet) return firmaBereinigen(beschriftet);

  const ausschluss = /bank|sparkasse|iban|bic|ust-id|steuer|amtsgericht|geschäftsführer|rechnungsempfänger|kunde/i;
  const rechtsform = /\b(?:GmbH(?:\s*&\s*Co\.?\s*KG)?|AG|KG|OHG|UG(?:\s*\(haftungsbeschränkt\))?|GbR|e\.?\s*K\.?|SE)\b/i;
  const zeile = zeilenAusText(text).find((eintrag) => (
    eintrag.length >= 3
    && eintrag.length <= 130
    && rechtsform.test(eintrag)
    && !ausschluss.test(eintrag)
  ));
  if (zeile) return firmaBereinigen(zeile);

  const ausDatei = dateinameBereinigen(dateiname);
  return ausDatei.length >= 3 && ausDatei.length <= 100 ? ausDatei : "";
}

function adresseErkennen(text) {
  const zeilen = zeilenAusText(text);
  const strassenMuster = /\b(?:straße|strasse|str\.|weg|allee|platz|ring|gasse|chaussee|damm|ufer|markt|promenade|steig|pfad)\s*\d+[a-zA-Z]?\b/i;
  const strasse = zeilen.find((zeile) => strassenMuster.test(zeile)) || "";

  const plzOrtTreffer = text.match(/\b(\d{5})\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß .\-/]{2,60})/);
  const ort = plzOrtTreffer?.[2]
    ?.replace(/\s{2,}.*/, "")
    .replace(/[|,;]+$/, "")
    .trim() || "";

  return {
    strasse: strasse.replace(/^.*?[:–—-]\s*/, "").trim(),
    plz: plzOrtTreffer?.[1] || "",
    ort,
  };
}

function kategorieErkennen(text) {
  const klein = text.toLowerCase();
  if (/bagger|radlader|kran|maschine|maschinenbau|baumaschine/.test(klein)) return "Maschine";
  if (/fahrzeug|autohaus|kfz|lkw|pkw|transporter|fuhrpark/.test(klein)) return "Fahrzeug";
  if (/personal|zeitarbeit|arbeitnehmerüberlassung|recruiting/.test(klein)) return "Personal";
  if (/dienstleistung|beratung|service|wartung|software|versicherung|miete|leasing/.test(klein)) return "Dienstleistung";
  if (/material|baustoff|stahl|beton|holz|elektro|werkzeug|lieferung|waren/.test(klein)) return "Material";
  return "Sonstiges";
}

function kontaktErkennen(text) {
  const alleEmails = [...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])];
  const name = ersterTreffer(text, [
    /(?:Ihr\s+Ansprechpartner|Ansprechpartner(?:in)?|Kontaktperson|Kontakt|Sachbearbeiter(?:in)?|Bearbeiter(?:in)?)\s*[:–—-]\s*(?:Herrn?|Frau)?\s*([^\n,;|]{3,80})/i,
    /(?:Herr|Frau)\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){1,3})/,
  ]);
  const position = ersterTreffer(text, [
    /(?:Position|Funktion|Abteilung)\s*[:–—-]\s*([^\n,;|]{2,80})/i,
  ]);
  const mobil = ersterTreffer(text, [
    /(?:Mobil|Handy|Mobile)\s*[:–—-]?\s*((?:\+49|0)[\d\s()\-/]{7,25})/i,
  ]);
  const telefon = ersterTreffer(text, [
    /(?:Telefon|Tel\.?|Durchwahl)\s*[:–—-]?\s*((?:\+49|0)[\d\s()\-/]{7,25})/i,
  ]);
  const kontaktEmail = ersterTreffer(text, [
    /(?:E-?Mail\s+(?:Ansprechpartner|Kontakt)|persönliche\s+E-?Mail)\s*[:–—-]?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  ]) || alleEmails[1] || "";

  return {
    name: name.replace(/\s{2,}/g, " ").trim(),
    position,
    telefon,
    mobil,
    email: kontaktEmail,
    geburtstag: "",
    notizen: "",
  };
}

function lieferantAusText(text, dateiname) {
  const normalisiert = textNormalisieren(text);
  const adresse = adresseErkennen(normalisiert);
  const kontakt = kontaktErkennen(normalisiert);
  const emails = [...new Set(normalisiert.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])];

  const website = ersterTreffer(normalisiert, [
    /(?:Website|Web|Internet)\s*[:–—-]?\s*((?:https?:\/\/|www\.)[^\s,;]+)/i,
    /\b((?:https?:\/\/|www\.)[A-Z0-9.-]+\.[A-Z]{2,}(?:\/[^\s]*)?)/i,
  ]);
  const telefon = ersterTreffer(normalisiert, [
    /(?:Telefon|Tel\.?|Zentrale)\s*[:–—-]?\s*((?:\+49|0)[\d\s()\-/]{7,25})/i,
  ]);
  const kundennummer = ersterTreffer(normalisiert, [
    /(?:Kunden(?:nummer|nr\.?|konto)|Kd\.?-?Nr\.?|Debitoren(?:nummer|nr\.?))\s*[:#–—-]?\s*([A-Z0-9._\-/]{2,40})/i,
  ]);
  const zahlungsziel = ersterTreffer(normalisiert, [
    /(?:Zahlungsziel|Zahlungsbedingungen?)\s*[:–—-]\s*([^\n]{3,120})/i,
    /((?:zahlbar|fällig)\s+(?:innerhalb\s+)?\d+\s+Tage[^\n]{0,80})/i,
    /((?:\d+\s+Tage\s+netto)[^\n]{0,60})/i,
  ]);
  const skonto = ersterTreffer(normalisiert, [
    /(?:Skonto)\s*[:–—-]?\s*([^\n]{2,100})/i,
    /(\d+(?:[,.]\d+)?\s*%\s*Skonto[^\n]{0,80})/i,
  ]);
  const standardrabatt = ersterTreffer(normalisiert, [
    /(?:Standardrabatt|Grundrabatt|Rabatt)\s*[:–—-]?\s*(\d+(?:[,.]\d+)?\s*%[^\n]{0,60})/i,
  ]);
  const bonusvereinbarung = ersterTreffer(normalisiert, [
    /(?:Bonusvereinbarung|Jahresbonus|Umsatzbonus|Bonus)\s*[:–—-]?\s*([^\n]{2,120})/i,
  ]);
  const lieferbedingungen = ersterTreffer(normalisiert, [
    /(?:Lieferbedingungen|Lieferkonditionen|Incoterms?)\s*[:–—-]?\s*([^\n]{2,120})/i,
    /\b((?:frei\s+Haus|ab\s+Werk|EXW|FCA|CPT|CIP|DAP|DPU|DDP|FOB|CFR|CIF)[^\n]{0,80})/i,
  ]);

  const firma = firmaErkennen(normalisiert, dateiname);
  const warnungen = [];
  if (!firma) warnungen.push("Firmenname wurde nicht sicher erkannt.");
  if (!adresse.plz && !adresse.ort) warnungen.push("Ort und PLZ wurden nicht sicher erkannt.");
  if (!emails.length && !telefon) warnungen.push("Keine allgemeinen Kontaktdaten sicher erkannt.");

  return {
    lieferant: {
      ...leerLieferant,
      firma,
      kategorie: kategorieErkennen(normalisiert),
      kundennummer,
      strasse: adresse.strasse,
      plz: adresse.plz,
      ort: adresse.ort,
      website,
      telefon: telefon || kontakt.telefon,
      email: emails[0] || "",
      zahlungsziel,
      skonto,
      lieferbedingungen,
      standardrabatt,
      bonusvereinbarung,
      notizen: "",
    },
    kontakt,
    warnungen,
  };
}

function firmaNormalisieren(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "und")
    .replace(/\b(gmbh|ag|kg|ohg|ug|haftungsbeschränkt|gbr|se|e\.?\s*k\.?)\b/g, "")
    .replace(/[^a-z0-9äöüß]/g, "")
    .trim();
}

function passendenLieferantenFinden(lieferanten, firma) {
  const gesucht = firmaNormalisieren(firma);
  if (!gesucht) return null;
  return lieferanten.find((item) => firmaNormalisieren(item.firma) === gesucht)
    || lieferanten.find((item) => {
      const vergleich = firmaNormalisieren(item.firma);
      return vergleich.length >= 5 && (vergleich.includes(gesucht) || gesucht.includes(vergleich));
    })
    || null;
}

function canvasAlsBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Die Bildseite konnte nicht für OCR vorbereitet werden."));
    }, "image/png");
  });
}

function ocrStatusDeutsch(status) {
  const texte = {
    "loading tesseract core": "OCR-Modul wird geladen",
    "initializing tesseract": "OCR wird initialisiert",
    "loading language traineddata": "Deutsche Spracherkennung wird geladen",
    "initializing api": "Texterkennung wird vorbereitet",
    "recognizing text": "Text wird erkannt",
  };
  return texte[status] || "Dokument wird analysiert";
}

async function ocrWorkerErstellen(fortschritt) {
  const { createWorker } = await import("tesseract.js");
  return createWorker("deu+eng", undefined, {
    logger: (meldung) => fortschritt?.(meldung),
  });
}

async function bildTextAuslesen(datei, statusSetzen, prozentSetzen) {
  const worker = await ocrWorkerErstellen((meldung) => {
    statusSetzen(ocrStatusDeutsch(meldung.status));
    if (Number.isFinite(meldung.progress)) prozentSetzen(Math.round(meldung.progress * 100));
  });
  try {
    const ergebnis = await worker.recognize(datei);
    return textNormalisieren(ergebnis.data.text);
  } finally {
    await worker.terminate();
  }
}

async function pdfTextAuslesen(datei, statusSetzen, prozentSetzen) {
  const ladevorgang = getDocument({ data: new Uint8Array(await datei.arrayBuffer()) });
  const pdf = await ladevorgang.promise;
  try {
    if (pdf.numPages > MAX_PDF_SEITEN) {
      throw new Error(`Das PDF hat ${pdf.numPages} Seiten. Erlaubt sind maximal ${MAX_PDF_SEITEN} Seiten.`);
    }

    const teile = [];
    statusSetzen("PDF-Text wird lokal ausgelesen");
    for (let seitenNummer = 1; seitenNummer <= pdf.numPages; seitenNummer += 1) {
      const seite = await pdf.getPage(seitenNummer);
      const inhalt = await seite.getTextContent();
      teile.push(inhalt.items.map((item) => item.str).join(" "));
      prozentSetzen(Math.round((seitenNummer / pdf.numPages) * 55));
    }

    const nativerText = textNormalisieren(teile.join("\n"));
    if (nativerText.length >= MIN_PDF_TEXTLAENGE) return nativerText;

    statusSetzen("Scan-PDF erkannt – OCR wird vorbereitet");
    const seitenAnzahl = Math.min(pdf.numPages, MAX_OCR_PDF_SEITEN);
    const worker = await ocrWorkerErstellen((meldung) => {
      statusSetzen(ocrStatusDeutsch(meldung.status));
    });
    try {
      const ocrTeile = [];
      for (let seitenNummer = 1; seitenNummer <= seitenAnzahl; seitenNummer += 1) {
        statusSetzen(`OCR: Seite ${seitenNummer} von ${seitenAnzahl}`);
        const seite = await pdf.getPage(seitenNummer);
        const viewport = seite.getViewport({ scale: 1.7 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await seite.render({ canvasContext: context, viewport }).promise;
        const blob = await canvasAlsBlob(canvas);
        const ergebnis = await worker.recognize(blob);
        ocrTeile.push(ergebnis.data.text);
        canvas.width = 1;
        canvas.height = 1;
        prozentSetzen(55 + Math.round((seitenNummer / seitenAnzahl) * 45));
      }
      return textNormalisieren(ocrTeile.join("\n"));
    } finally {
      await worker.terminate();
    }
  } finally {
    await pdf.destroy();
  }
}

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

export default function CRM({ onOpenNegotiation }) {
  const theme = useTheme();
  const mobil = useMediaQuery(theme.breakpoints.down("md"));
  const user = auth.currentUser;

  const [lieferanten, setLieferanten] = useState([]);
  const [kontakte, setKontakte] = useState([]);
  const [aufgaben, setAufgaben] = useState([]);
  const [verhandlungen, setVerhandlungen] = useState([]);
  const [historie, setHistorie] = useState([]);
  const [crmVertraege, setCrmVertraege] = useState([]);
  const [suiteVertraege, setSuiteVertraege] = useState([]);

  const vertraege = useMemo(
    () => [
      ...crmVertraege.map((vertrag) => ({
        ...vertrag,
        _sourceCollection: "vertraege",
      })),
      ...suiteVertraege.map((vertrag) => ({
        ...vertrag,
        _sourceCollection: "suiteVertraege",
      })),
    ],
    [crmVertraege, suiteVertraege]
  );
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

  const [vertragDialog, setVertragDialog] = useState(false);
  const [vertragForm, setVertragForm] = useState(leerVertrag);
  const [vertragId, setVertragId] = useState(null);
  const [vertragQuelle, setVertragQuelle] = useState("suiteVertraege");
  const [offeneVertraege, setOffeneVertraege] = useState({});

  const [pdfDialog, setPdfDialog] = useState(false);
  const [pdfAuswahl, setPdfAuswahl] = useState([]);

  const [meldung, setMeldung] = useState("");
  const [importDialog, setImportDialog] = useState(false);
  const [importLaedt, setImportLaedt] = useState(false);
  const [importFortschritt, setImportFortschritt] = useState(0);
  const [importStatus, setImportStatus] = useState("");
  const [importFehler, setImportFehler] = useState("");
  const [importDateiname, setImportDateiname] = useState("");
  const [importText, setImportText] = useState("");
  const [importRohtextOffen, setImportRohtextOffen] = useState(false);
  const [importWarnungen, setImportWarnungen] = useState([]);
  const [importLieferant, setImportLieferant] = useState(leerLieferant);
  const [importKontakt, setImportKontakt] = useState(leerKontakt);
  const [importZiel, setImportZiel] = useState(NEUER_LIEFERANT);
  const [importKontaktAnlegen, setImportKontaktAnlegen] = useState(true);

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
    listen("vertraege", setCrmVertraege);
    listen("suiteVertraege", setSuiteVertraege);

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
  const lieferantenVertraege = vertraege
    .filter((x) => x.lieferantId === auswahl?.id)
    .sort((a, b) => String(a.enddatum || "9999-12-31").localeCompare(String(b.enddatum || "9999-12-31")));
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


  function vertragNeu() {
    if (!auswahl) return;
    setVertragId(null);
    setVertragQuelle("suiteVertraege");
    setVertragForm(leerVertrag);
    setVertragDialog(true);
  }

  function vertragBearbeiten(vertrag) {
    setVertragId(vertrag.id);
    setVertragQuelle(
      vertrag._sourceCollection || "suiteVertraege"
    );
    setVertragForm({
      ...leerVertrag,
      ...vertrag,
      kuendigungsfrist:
        vertrag.kuendigungsfrist ||
        vertrag.kuendigungsfristText ||
        (vertrag.kuendigungsfristMonate
          ? `${vertrag.kuendigungsfristMonate} Monate`
          : ""),
    });
    setVertragDialog(true);
  }

  async function vertragSpeichern() {
    if (!user || !auswahl || !vertragForm.name.trim()) return;
    setSpeichert(true);
    try {
      const vertragsFormularDaten = { ...vertragForm };
delete vertragsFormularDaten._sourceCollection;

      const daten = {
        ...vertragsFormularDaten,
        kuendigungsfristText:
          vertragForm.kuendigungsfristText ||
          vertragForm.kuendigungsfrist || "",
        kosten: String(vertragForm.kosten || ""),
        userId: user.uid,
        lieferantId: auswahl.id,
        anbieter: auswahl.firma,
        aktualisiertAm: serverTimestamp(),
      };
      if (vertragId) {
        await updateDoc(doc(db, vertragQuelle, vertragId), daten);
      } else {
        await addDoc(collection(db, "suiteVertraege"), { ...daten, erstelltAm: serverTimestamp() });
      }
      await historieSchreiben(auswahl, vertragId ? `Vertrag bearbeitet: ${vertragForm.name}` : `Vertrag angelegt: ${vertragForm.name}`);
      setVertragDialog(false);
    } catch (error) {
      console.error(error);
      setFehler("Vertrag konnte nicht gespeichert werden.");
    } finally {
      setSpeichert(false);
    }
  }

  async function vertragLoeschen(vertrag) {
    if (!window.confirm(`Vertrag „${vertrag.name}“ wirklich löschen?`)) return;
    try {
      await deleteDoc(
        doc(
          db,
          vertrag._sourceCollection || "suiteVertraege",
          vertrag.id
        )
      );
      await historieSchreiben(auswahl, `Vertrag gelöscht: ${vertrag.name}`);
    } catch (error) {
      console.error(error);
      setFehler("Vertrag konnte nicht gelöscht werden.");
    }
  }

  function vertragAufklappen(id) {
    setOffeneVertraege((vorher) => ({ ...vorher, [id]: !vorher[id] }));
  }

  function htmlSicher(value) {
    return String(value ?? "").replace(/[&<>"']/g, (zeichen) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    }[zeichen]));
  }

  function lieferantenPdfOeffnen() {
    setPdfAuswahl(gefiltert.map((lieferant) => lieferant.id));
    setPdfDialog(true);
  }

  function pdfAuswahlUmschalten(id) {
    setPdfAuswahl((vorher) => vorher.includes(id) ? vorher.filter((wert) => wert !== id) : [...vorher, id]);
  }

  function lieferantenAlsPdfDrucken() {
    const ausgewaehlt = lieferanten.filter((lieferant) => pdfAuswahl.includes(lieferant.id)).sort(sortByName);
    if (!ausgewaehlt.length) return;
    const bloecke = ausgewaehlt.map((lieferant) => {
      const lieferantKontakte = kontakte.filter((kontakt) => kontakt.lieferantId === lieferant.id);
      const lieferantVertraege = vertraege.filter((vertrag) => vertrag.lieferantId === lieferant.id);
      const kontakteHtml = lieferantKontakte.length ? lieferantKontakte.map((kontakt) => `<li>${htmlSicher(kontakt.name)}${kontakt.position ? ` – ${htmlSicher(kontakt.position)}` : ""}${kontakt.telefon ? ` · ${htmlSicher(kontakt.telefon)}` : ""}${kontakt.email ? ` · ${htmlSicher(kontakt.email)}` : ""}</li>`).join("") : "<li>Keine Ansprechpartner hinterlegt</li>";
      const vertraegeHtml = lieferantVertraege.length ? lieferantVertraege.map((vertrag) => `<li><strong>${htmlSicher(vertrag.name)}</strong> · ${htmlSicher(vertrag.status || "Aktiv")} · Ende: ${htmlSicher(vertrag.enddatum ? formatDatum(vertrag.enddatum) : "unbefristet")} · ${htmlSicher(vertrag.kosten || "—")} ${htmlSicher(vertrag.kostenIntervall || "")}</li>`).join("") : "<li>Keine Verträge hinterlegt</li>";
      return `<section><h2>${htmlSicher(lieferant.firma)}</h2><div class="grid"><div><b>Kategorie:</b> ${htmlSicher(lieferant.kategorie || "—")}</div><div><b>Status:</b> ${htmlSicher(lieferant.status || "—")}</div><div><b>Kundennummer:</b> ${htmlSicher(lieferant.kundennummer || "—")}</div><div><b>Adresse:</b> ${htmlSicher([lieferant.strasse, [lieferant.plz, lieferant.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—")}</div><div><b>Telefon:</b> ${htmlSicher(lieferant.telefon || "—")}</div><div><b>E-Mail:</b> ${htmlSicher(lieferant.email || "—")}</div><div><b>Zahlungsziel:</b> ${htmlSicher(lieferant.zahlungsziel || "—")}</div><div><b>Skonto:</b> ${htmlSicher(lieferant.skonto || "—")}</div></div><h3>Ansprechpartner</h3><ul>${kontakteHtml}</ul><h3>Verträge</h3><ul>${vertraegeHtml}</ul>${lieferant.notizen ? `<p><b>Notizen:</b> ${htmlSicher(lieferant.notizen)}</p>` : ""}</section>`;
    }).join("");
    const druckHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Lieferantenübersicht</title><style>body{font-family:Arial,sans-serif;color:#172033;margin:28px}h1{margin-bottom:4px}.meta{color:#667085;margin-bottom:20px}section{border:1px solid #d0d5dd;border-radius:8px;padding:16px;margin-bottom:16px;page-break-inside:avoid}h2{margin:0 0 12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:7px 18px;font-size:12px}h3{font-size:13px;margin:14px 0 5px}ul{margin:0;padding-left:18px;font-size:12px}p{font-size:12px}@page{margin:10mm}@media print{body{margin:0}}</style></head><body><h1>Lieferantenübersicht</h1><div class="meta">Erstellt am ${new Date().toLocaleString("de-DE")} · ${ausgewaehlt.length} Lieferant(en)</div>${bloecke}</body></html>`;

    const vorhandenesIframe = document.getElementById("crm-druck-iframe");
    if (vorhandenesIframe) vorhandenesIframe.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "crm-druck-iframe";
    iframe.setAttribute("title", "Druckansicht Lieferantenübersicht");
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
    setPdfDialog(false);
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

  function importZuruecksetzen() {
    setImportLaedt(false);
    setImportFortschritt(0);
    setImportStatus("");
    setImportFehler("");
    setImportDateiname("");
    setImportText("");
    setImportRohtextOffen(false);
    setImportWarnungen([]);
    setImportLieferant(leerLieferant);
    setImportKontakt(leerKontakt);
    setImportZiel(NEUER_LIEFERANT);
    setImportKontaktAnlegen(true);
  }

  function importOeffnen() {
    importZuruecksetzen();
    setImportDialog(true);
  }

  async function dokumentVerarbeiten(datei) {
    if (!datei) return;
    setImportFehler("");
    setMeldung("");

    const istPdf = datei.type === "application/pdf" || datei.name.toLowerCase().endsWith(".pdf");
    const istBild = datei.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(datei.name);
    if (!istPdf && !istBild) {
      setImportFehler("Bitte wähle ein PDF, JPG, PNG oder WebP aus.");
      return;
    }
    if (datei.size > MAX_DATEIGROESSE) {
      setImportFehler("Die Datei ist größer als 20 MB.");
      return;
    }

    setImportLaedt(true);
    setImportFortschritt(1);
    setImportDateiname(datei.name);
    setImportStatus(istPdf ? "PDF wird vorbereitet" : "Bild-OCR wird vorbereitet");

    try {
      const text = istPdf
        ? await pdfTextAuslesen(datei, setImportStatus, setImportFortschritt)
        : await bildTextAuslesen(datei, setImportStatus, setImportFortschritt);

      if (text.length < 20) {
        throw new Error("Es konnte kein ausreichend lesbarer Text erkannt werden. Nutze möglichst ein scharfes, gerades Bild.");
      }

      const erkannt = lieferantAusText(text, datei.name);
      const passenderLieferant = passendenLieferantenFinden(lieferanten, erkannt.lieferant.firma);
      setImportText(text);
      setImportLieferant(erkannt.lieferant);
      setImportKontakt(erkannt.kontakt);
      setImportWarnungen([
        ...erkannt.warnungen,
        ...(istPdf && text.length < MIN_PDF_TEXTLAENGE
          ? ["Das PDF wurde per OCR verarbeitet. Bitte alle Angaben besonders sorgfältig prüfen."]
          : []),
      ]);
      setImportZiel(passenderLieferant?.id || NEUER_LIEFERANT);
      setImportKontaktAnlegen(Boolean(erkannt.kontakt.name));
      setImportFortschritt(100);
      setImportStatus("Daten erkannt – bitte prüfen");
    } catch (error) {
      console.error(error);
      setImportFehler(error.message || "Das Dokument konnte nicht verarbeitet werden.");
    } finally {
      setImportLaedt(false);
    }
  }

  async function importDatenSpeichern() {
    if (!user || !importLieferant.firma.trim()) {
      setImportFehler("Bitte trage einen Firmennamen ein.");
      return;
    }

    setSpeichert(true);
    setImportFehler("");
    try {
      const lieferantDaten = {
        ...importLieferant,
        firma: importLieferant.firma.trim(),
        userId: user.uid,
        aktualisiertAm: serverTimestamp(),
      };

      let lieferantIdNeu = importZiel;
      let lieferantFuerHistorie;
      if (importZiel === NEUER_LIEFERANT) {
        const ref = await addDoc(collection(db, "lieferanten"), {
          ...lieferantDaten,
          erstelltAm: serverTimestamp(),
        });
        lieferantIdNeu = ref.id;
        lieferantFuerHistorie = { id: ref.id, firma: lieferantDaten.firma };
        await historieSchreiben(lieferantFuerHistorie, "Lieferant per lokalem Dokumentenimport angelegt");
      } else {
        const bestehend = lieferanten.find((item) => item.id === importZiel);
        const aktualisierung = Object.fromEntries(
          Object.entries(lieferantDaten).filter(([schluessel, wert]) => (
            ["userId", "aktualisiertAm", "status", "kategorie"].includes(schluessel)
            || String(wert ?? "").trim()
          )),
        );
        await updateDoc(doc(db, "lieferanten", importZiel), aktualisierung);
        lieferantFuerHistorie = { id: importZiel, firma: lieferantDaten.firma || bestehend?.firma || "Lieferant" };
        await historieSchreiben(lieferantFuerHistorie, "Lieferantendaten per lokalem Dokumentenimport aktualisiert");
      }

      if (importKontaktAnlegen && importKontakt.name.trim()) {
        await addDoc(collection(db, "ansprechpartner"), {
          ...importKontakt,
          name: importKontakt.name.trim(),
          userId: user.uid,
          lieferantId: lieferantIdNeu,
          firma: lieferantDaten.firma,
          erstelltAm: serverTimestamp(),
          aktualisiertAm: serverTimestamp(),
        });
        await historieSchreiben(lieferantFuerHistorie, `Ansprechpartner ${importKontakt.name.trim()} per Dokumentenimport angelegt`);
      }

      setImportDialog(false);
      setMeldung(`Lieferantendaten erfolgreich ${importZiel === NEUER_LIEFERANT ? "angelegt" : "aktualisiert"}. Die Datei wurde nicht gespeichert.`);
    } catch (error) {
      console.error(error);
      setImportFehler("Die erkannten Lieferantendaten konnten nicht gespeichert werden.");
    } finally {
      setSpeichert(false);
    }
  }

  if (auswahl) {
    return (
      <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
        {fehler && <Alert severity="error" sx={{ mb: 2 }}>{fehler}</Alert>}
        {meldung && <Alert severity="success" onClose={() => setMeldung("")} sx={{ mb: 2 }}>{meldung}</Alert>}
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
            <Tab label={`Verträge (${lieferantenVertraege.length})`} />
            <Tab label={`Verhandlungen (${lieferantenVerhandlungen.length})`} />
            <Tab label={`Aufgaben (${lieferantenAufgaben.filter((x) => x.status !== "Erledigt").length})`} />
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
                <InfoCard label="Verträge" value={lieferantenVertraege.length} icon={<DescriptionIcon color="info" fontSize="large" />} />
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

        {detailTab === 4 && (
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
              <Card key={v.id} variant="outlined">
                <CardContent>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    spacing={2}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={900}>
                        {v.verhandlungsgegenstand ||
                          v.firma ||
                          auswahl.firma}
                      </Typography>

                      <Typography
                        color="text.secondary"
                        sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}
                      >
                        {v.notizen || "Keine Notiz"}
                      </Typography>

                      <Stack
                        direction="row"
                        spacing={1}
                        mt={1.5}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Chip
                          size="small"
                          label={v.status || "Offen"}
                        />
                        <Chip
                          size="small"
                          label={v.prioritaet || "Mittel"}
                          variant="outlined"
                        />
                      </Stack>
                    </Box>

                    <Button
                      variant="outlined"
                      startIcon={<OpenInNewIcon />}
                      onClick={() => onOpenNegotiation?.(v.id)}
                      sx={{ flexShrink: 0, alignSelf: { md: "center" } }}
                    >
                      Verhandlung öffnen
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ))}

            {lieferantenVerhandlungen.length === 0 && (
              <Alert severity="info">
                Noch keine Verhandlung mit diesem Lieferanten
                verknüpft.
              </Alert>
            )}
          </Stack>
        )}

        {detailTab === 2 && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Box><Typography variant="h6" fontWeight={800}>Verträge</Typography><Typography variant="body2" color="text.secondary">Mehrere Verträge je Dienstleister oder Lieferant verwalten.</Typography></Box>
              <Button variant="contained" startIcon={<AddIcon />} onClick={vertragNeu}>Vertrag</Button>
            </Stack>
            <Stack spacing={1.5}>
              {lieferantenVertraege.map((vertrag) => {
                const istOffen = Boolean(offeneVertraege[vertrag.id]);
                return <Paper key={vertrag.id} variant="outlined">
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.5, cursor: "pointer" }} onClick={() => vertragAufklappen(vertrag.id)}>
                    <IconButton size="small">{istOffen ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}><Typography fontWeight={800}>{vertrag.name}</Typography><Typography variant="body2" color="text.secondary">{vertrag.vertragsnummer ? `Nr. ${vertrag.vertragsnummer} · ` : ""}{vertrag.enddatum ? `Ende ${formatDatum(vertrag.enddatum)}` : "Unbefristet"}</Typography></Box>
                    <Chip size="small" label={vertrag.status || "Aktiv"} color={vertrag.status === "Aktiv" ? "success" : "default"} />
                    <Box onClick={(event) => event.stopPropagation()}><IconButton onClick={() => vertragBearbeiten(vertrag)}><EditIcon /></IconButton><IconButton color="error" onClick={() => vertragLoeschen(vertrag)}><DeleteIcon /></IconButton></Box>
                  </Stack>
                  <Collapse in={istOffen}>
                    <Divider />
                    <Grid container spacing={2} sx={{ p: 2 }}>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">Kategorie</Typography><Typography>{vertrag.kategorie || "—"}</Typography></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">Laufzeit</Typography><Typography>{formatDatum(vertrag.startdatum)} bis {vertrag.enddatum ? formatDatum(vertrag.enddatum) : "unbefristet"}</Typography></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">Kündigungsfrist</Typography><Typography>{vertrag.kuendigungsfrist ||
                          vertrag.kuendigungsfristText ||
                          (vertrag.kuendigungsfristMonate
                            ? `${vertrag.kuendigungsfristMonate} Monate`
                            : "—")}</Typography></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">Kosten</Typography><Typography>{vertrag.kosten || "—"} {vertrag.kostenIntervall || ""}</Typography></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">Automatische Verlängerung</Typography><Typography>{vertrag.automatischeVerlaengerung ? "Ja" : "Nein"}</Typography></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">Ansprechpartner</Typography><Typography>{vertrag.ansprechpartner || "—"}</Typography></Grid>
                      {vertrag.notizen && <Grid size={{ xs: 12 }}><Typography color="text.secondary">Notizen</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{vertrag.notizen}</Typography></Grid>}
                    </Grid>
                  </Collapse>
                </Paper>;
              })}
              {!lieferantenVertraege.length && <Alert severity="info">Noch keine Verträge hinterlegt.</Alert>}
            </Stack>
          </Box>
        )}

        {detailTab === 5 && (
          <Card><CardContent><Typography variant="h6" fontWeight={800} mb={2}>Konditionen</Typography><Grid container spacing={2}><Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">Zahlungsziel</Typography><Typography>{auswahl.zahlungsziel || "—"}</Typography></Grid><Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">Skonto</Typography><Typography>{auswahl.skonto || "—"}</Typography></Grid><Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">Standardrabatt</Typography><Typography>{auswahl.standardrabatt || "—"}</Typography></Grid><Grid size={{ xs: 12, sm: 6 }}><Typography color="text.secondary">Bonusvereinbarung</Typography><Typography>{auswahl.bonusvereinbarung || "—"}</Typography></Grid><Grid size={{ xs: 12 }}><Typography color="text.secondary">Lieferbedingungen</Typography><Typography>{auswahl.lieferbedingungen || "—"}</Typography></Grid></Grid></CardContent></Card>
        )}

        {detailTab === 6 && (
          <Stack spacing={1.5}>
            {lieferantenHistorie.map((h) => <Card key={h.id} variant="outlined"><CardContent><Stack direction="row" spacing={2} alignItems="center"><HistoryIcon color="action" /><Box><Typography fontWeight={700}>{h.text}</Typography><Typography color="text.secondary" variant="body2">{h.erstelltAm?.toDate ? h.erstelltAm.toDate().toLocaleString("de-DE") : "Gerade eben"}</Typography></Box></Stack></CardContent></Card>)}
            {lieferantenHistorie.length === 0 && <Alert severity="info">Noch keine Historieneinträge vorhanden.</Alert>}
          </Stack>
        )}

        <LieferantDialog open={lieferantDialog} onClose={() => setLieferantDialog(false)} form={lieferantForm} setForm={setLieferantForm} onSave={lieferantSpeichern} editing={Boolean(lieferantId)} saving={speichert} />
        <KontaktDialog open={kontaktDialog} onClose={() => setKontaktDialog(false)} form={kontaktForm} setForm={setKontaktForm} onSave={kontaktSpeichern} editing={Boolean(kontaktId)} saving={speichert} />
        <AufgabeDialog open={aufgabeDialog} onClose={() => setAufgabeDialog(false)} form={aufgabeForm} setForm={setAufgabeForm} onSave={aufgabeSpeichern} editing={Boolean(aufgabeId)} saving={speichert} />
        <VertragDialog open={vertragDialog} onClose={() => setVertragDialog(false)} form={vertragForm} setForm={setVertragForm} onSave={vertragSpeichern} editing={Boolean(vertragId)} saving={speichert} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
      {fehler && <Alert severity="error" sx={{ mb: 2 }}>{fehler}</Alert>}
      {meldung && <Alert severity="success" onClose={() => setMeldung("")} sx={{ mb: 2 }}>{meldung}</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2} mb={3}>
        <Box><Typography variant={mobil ? "h5" : "h4"} fontWeight={900}>Dienstleister & Lieferanten</Typography><Typography color="text.secondary">Dienstleister, Lieferanten, Ansprechpartner, Verträge, Aufgaben und Verhandlungen kompakt in einer Akte verwalten.</Typography></Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" startIcon={<AutoFixHighIcon />} onClick={importOeffnen}>Dokument einlesen</Button>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={lieferantenPdfOeffnen}>Lieferanten-PDF</Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={lieferantNeu}>Neuer Lieferant</Button>
          </Stack>
        </Stack>
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
                  <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Verträge</Typography><Typography fontWeight={700}>{vertraege.filter((v) => v.lieferantId === lieferant.id).length}</Typography></Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
        {gefiltert.length === 0 && <Grid size={{ xs: 12 }}><Alert severity="info">Keine Lieferanten gefunden.</Alert></Grid>}
      </Grid>

      <Dialog open={pdfDialog} onClose={() => setPdfDialog(false)} fullWidth maxWidth="md">
        <DialogTitle>Lieferanten als PDF ausgeben</DialogTitle>
        <DialogContent dividers>
          <Typography color="text.secondary" mb={2}>Wähle die Lieferanten aus. Im Druckdialog kannst du anschließend „Als PDF speichern“ wählen.</Typography>
          <Stack direction="row" spacing={1} mb={2}><Button size="small" onClick={() => setPdfAuswahl(gefiltert.map((lieferant) => lieferant.id))}>Gefilterte auswählen</Button><Button size="small" onClick={() => setPdfAuswahl([])}>Auswahl löschen</Button></Stack>
          <Stack spacing={1}>{gefiltert.map((lieferant) => <Paper key={lieferant.id} variant="outlined" sx={{ p: 1 }}><FormControlLabel control={<Checkbox checked={pdfAuswahl.includes(lieferant.id)} onChange={() => pdfAuswahlUmschalten(lieferant.id)} />} label={<Box><Typography fontWeight={800}>{lieferant.firma}</Typography><Typography variant="body2" color="text.secondary">{lieferant.kategorie || "—"} · {lieferant.ort || "Kein Ort"} · {vertraege.filter((vertrag) => vertrag.lieferantId === lieferant.id).length} Vertrag/Verträge</Typography></Box>} /></Paper>)}</Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setPdfDialog(false)}>Abbrechen</Button><Button variant="contained" startIcon={<PictureAsPdfIcon />} onClick={lieferantenAlsPdfDrucken} disabled={!pdfAuswahl.length}>PDF-Druck öffnen</Button></DialogActions>
      </Dialog>

      <LieferantenImportDialog
        open={importDialog}
        onClose={() => setImportDialog(false)}
        loading={importLaedt}
        progress={importFortschritt}
        statusText={importStatus}
        error={importFehler}
        filename={importDateiname}
        rawText={importText}
        rawTextOpen={importRohtextOffen}
        setRawTextOpen={setImportRohtextOffen}
        warnings={importWarnungen}
        supplier={importLieferant}
        setSupplier={setImportLieferant}
        contact={importKontakt}
        setContact={setImportKontakt}
        target={importZiel}
        setTarget={setImportZiel}
        suppliers={lieferanten}
        createContact={importKontaktAnlegen}
        setCreateContact={setImportKontaktAnlegen}
        onFile={dokumentVerarbeiten}
        onSave={importDatenSpeichern}
        saving={speichert}
      />
      <LieferantDialog open={lieferantDialog} onClose={() => setLieferantDialog(false)} form={lieferantForm} setForm={setLieferantForm} onSave={lieferantSpeichern} editing={Boolean(lieferantId)} saving={speichert} />
    </Box>
  );
}


function LieferantenImportDialog({
  open,
  onClose,
  loading,
  progress,
  statusText,
  error,
  filename,
  rawText,
  rawTextOpen,
  setRawTextOpen,
  warnings,
  supplier,
  setSupplier,
  contact,
  setContact,
  target,
  setTarget,
  suppliers,
  createContact,
  setCreateContact,
  onFile,
  onSave,
  saving,
}) {
  const dateiInput = useRef(null);
  const [dragAktiv, setDragAktiv] = useState(false);
  const supplierChange = (event) => setSupplier((vorher) => ({ ...vorher, [event.target.name]: event.target.value }));
  const contactChange = (event) => setContact((vorher) => ({ ...vorher, [event.target.name]: event.target.value }));
  const hatErgebnis = Boolean(rawText);

  function dateiUebernehmen(datei) {
    if (datei) onFile(datei);
  }

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <AutoFixHighIcon color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={900}>Lieferantendaten automatisch erkennen</Typography>
            <Typography variant="body2" color="text.secondary">PDF, JPG, PNG oder Screenshot lokal auslesen und vor dem Speichern prüfen.</Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Die Datei wird nur in deinem Browser verarbeitet. Weder die Datei noch der vollständige erkannte Text werden in Firebase gespeichert.
        </Alert>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {warnings.map((warnung) => <Alert key={warnung} severity="warning" sx={{ mb: 1 }}>{warnung}</Alert>)}

        <input
          ref={dateiInput}
          type="file"
          hidden
          accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp"
          onChange={(event) => {
            dateiUebernehmen(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <Paper
          variant="outlined"
          onClick={() => !loading && dateiInput.current?.click()}
          onDragEnter={(event) => { event.preventDefault(); setDragAktiv(true); }}
          onDragOver={(event) => { event.preventDefault(); setDragAktiv(true); }}
          onDragLeave={(event) => { event.preventDefault(); setDragAktiv(false); }}
          onDrop={(event) => {
            event.preventDefault();
            setDragAktiv(false);
            if (!loading) dateiUebernehmen(event.dataTransfer.files?.[0]);
          }}
          sx={{
            p: 3,
            mb: 2,
            textAlign: "center",
            cursor: loading ? "default" : "pointer",
            borderStyle: "dashed",
            borderWidth: 2,
            borderColor: dragAktiv ? "primary.main" : "divider",
            bgcolor: dragAktiv ? "action.hover" : "background.paper",
          }}
        >
          {loading ? (
            <Stack spacing={1.5} alignItems="center">
              <CircularProgress size={38} />
              <Typography fontWeight={800}>{statusText || "Dokument wird verarbeitet"}</Typography>
              <LinearProgress variant="determinate" value={progress} sx={{ width: "100%", maxWidth: 440 }} />
              <Typography variant="body2" color="text.secondary">{progress} %</Typography>
            </Stack>
          ) : (
            <Stack spacing={1} alignItems="center">
              <Stack direction="row" spacing={1}>
                <PictureAsPdfIcon color="error" fontSize="large" />
                <ImageSearchIcon color="primary" fontSize="large" />
              </Stack>
              <Typography variant="h6" fontWeight={900}>Dokument hier ablegen oder anklicken</Typography>
              <Typography color="text.secondary">PDF, JPG, PNG oder WebP – maximal 20 MB</Typography>
              {filename && <Chip label={filename} color="primary" variant="outlined" />}
            </Stack>
          )}
        </Paper>

        {hatErgebnis && (
          <Stack spacing={2.5}>
            <TextField
              select
              fullWidth
              label="Speicherziel"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              <MenuItem value={NEUER_LIEFERANT}>Neuen Lieferanten anlegen</MenuItem>
              {suppliers.map((item) => <MenuItem key={item.id} value={item.id}>Bestehenden aktualisieren: {item.firma}</MenuItem>)}
            </TextField>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" fontWeight={900} mb={2}>Erkannte Lieferantendaten</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth required name="firma" label="Firma" value={supplier.firma} onChange={supplierChange} /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth select name="status" label="Status" value={supplier.status} onChange={supplierChange}><MenuItem value="Aktiv">Aktiv</MenuItem><MenuItem value="Inaktiv">Inaktiv</MenuItem></TextField></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth select name="kategorie" label="Kategorie" value={supplier.kategorie} onChange={supplierChange}>{["Material", "Maschine", "Fahrzeug", "Dienstleistung", "Personal", "Sonstiges"].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}</TextField></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth name="kundennummer" label="Kundennummer" value={supplier.kundennummer} onChange={supplierChange} /></Grid>
                <Grid size={{ xs: 12 }}><TextField fullWidth name="strasse" label="Straße und Hausnummer" value={supplier.strasse} onChange={supplierChange} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth name="plz" label="PLZ" value={supplier.plz} onChange={supplierChange} /></Grid>
                <Grid size={{ xs: 12, sm: 8 }}><TextField fullWidth name="ort" label="Ort" value={supplier.ort} onChange={supplierChange} /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth name="telefon" label="Telefon" value={supplier.telefon} onChange={supplierChange} /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth name="email" type="email" label="E-Mail" value={supplier.email} onChange={supplierChange} /></Grid>
                <Grid size={{ xs: 12 }}><TextField fullWidth name="website" label="Website" value={supplier.website} onChange={supplierChange} /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth name="zahlungsziel" label="Zahlungsziel" value={supplier.zahlungsziel} onChange={supplierChange} /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth name="skonto" label="Skonto" value={supplier.skonto} onChange={supplierChange} /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth name="standardrabatt" label="Standardrabatt" value={supplier.standardrabatt} onChange={supplierChange} /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth name="bonusvereinbarung" label="Bonusvereinbarung" value={supplier.bonusvereinbarung} onChange={supplierChange} /></Grid>
                <Grid size={{ xs: 12 }}><TextField fullWidth name="lieferbedingungen" label="Lieferbedingungen" value={supplier.lieferbedingungen} onChange={supplierChange} /></Grid>
                <Grid size={{ xs: 12 }}><TextField fullWidth multiline minRows={2} name="notizen" label="Notizen" value={supplier.notizen} onChange={supplierChange} /></Grid>
              </Grid>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <FormControlLabel
                control={<Switch checked={createContact} onChange={(event) => setCreateContact(event.target.checked)} />}
                label="Erkannten Ansprechpartner ebenfalls anlegen"
              />
              <Collapse in={createContact}>
                <Grid container spacing={2} mt={0.5}>
                  <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth name="name" label="Name" value={contact.name} onChange={contactChange} /></Grid>
                  <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth name="position" label="Position / Abteilung" value={contact.position} onChange={contactChange} /></Grid>
                  <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth name="telefon" label="Telefon" value={contact.telefon} onChange={contactChange} /></Grid>
                  <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth name="mobil" label="Mobil" value={contact.mobil} onChange={contactChange} /></Grid>
                  <Grid size={{ xs: 12 }}><TextField fullWidth name="email" type="email" label="E-Mail" value={contact.email} onChange={contactChange} /></Grid>
                </Grid>
              </Collapse>
            </Paper>

            <Button
              variant="text"
              startIcon={rawTextOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setRawTextOpen(!rawTextOpen)}
              sx={{ alignSelf: "flex-start" }}
            >
              Erkannten Text kontrollieren
            </Button>
            <Collapse in={rawTextOpen}>
              <TextField fullWidth multiline minRows={8} value={rawText} slotProps={{ input: { readOnly: true } }} />
            </Collapse>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Abbrechen</Button>
        <Button
          variant="contained"
          startIcon={<CloudUploadIcon />}
          onClick={onSave}
          disabled={!hatErgebnis || loading || saving || !supplier.firma.trim()}
        >
          {saving ? "Speichert…" : target === NEUER_LIEFERANT ? "Lieferant anlegen" : "Lieferant aktualisieren"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function LieferantDialog({ open, onClose, form, setForm, onSave, editing, saving }) {
  const change = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const field = (name, label, extra = {}) => <TextField fullWidth name={name} label={label} value={form[name] || ""} onChange={change} {...extra} />;
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md"><DialogTitle>{editing ? "Lieferant bearbeiten" : "Neuen Lieferanten anlegen"}</DialogTitle><DialogContent><Grid container spacing={2} mt={0.5}><Grid size={{ xs: 12, md: 8 }}>{field("firma", "Firma", { required: true })}</Grid><Grid size={{ xs: 12, md: 4 }}>{field("status", "Status", { select: true, children: [<MenuItem key="a" value="Aktiv">Aktiv</MenuItem>, <MenuItem key="i" value="Inaktiv">Inaktiv</MenuItem>] })}</Grid><Grid size={{ xs: 12, md: 6 }}>{field("kategorie", "Kategorie", { select: true, children: ["Material", "Maschine", "Fahrzeug", "Dienstleistung", "Personal", "Sonstiges"].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>) })}</Grid><Grid size={{ xs: 12, md: 6 }}>{field("kundennummer", "Kundennummer")}</Grid><Grid size={{ xs: 12 }}>{field("strasse", "Straße und Hausnummer")}</Grid><Grid size={{ xs: 12, sm: 4 }}>{field("plz", "PLZ")}</Grid><Grid size={{ xs: 12, sm: 8 }}>{field("ort", "Ort")}</Grid><Grid size={{ xs: 12, md: 6 }}>{field("telefon", "Telefon")}</Grid><Grid size={{ xs: 12, md: 6 }}>{field("email", "E-Mail")}</Grid><Grid size={{ xs: 12 }}>{field("website", "Website")}</Grid><Grid size={{ xs: 12, md: 6 }}>{field("zahlungsziel", "Zahlungsziel")}</Grid><Grid size={{ xs: 12, md: 6 }}>{field("skonto", "Skonto")}</Grid><Grid size={{ xs: 12, md: 6 }}>{field("standardrabatt", "Standardrabatt")}</Grid><Grid size={{ xs: 12, md: 6 }}>{field("bonusvereinbarung", "Bonusvereinbarung")}</Grid><Grid size={{ xs: 12 }}>{field("lieferbedingungen", "Lieferbedingungen")}</Grid><Grid size={{ xs: 12 }}>{field("notizen", "Notizen", { multiline: true, minRows: 3 })}</Grid></Grid></DialogContent><DialogActions><Button onClick={onClose}>Abbrechen</Button><Button variant="contained" onClick={onSave} disabled={saving || !form.firma.trim()}>{saving ? "Speichert…" : "Speichern"}</Button></DialogActions></Dialog>;
}

function VertragDialog({ open, onClose, form, setForm, onSave, editing, saving }) {
  const change = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((vorher) => ({ ...vorher, [name]: type === "checkbox" ? checked : value }));
  };
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md"><DialogTitle>{editing ? "Vertrag bearbeiten" : "Vertrag hinzufügen"}</DialogTitle><DialogContent><Grid container spacing={2} mt={0.5}><Grid size={{ xs: 12, md: 8 }}><TextField fullWidth required name="name" label="Vertragsbezeichnung" value={form.name} onChange={change} /></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth name="vertragsnummer" label="Vertragsnummer" value={form.vertragsnummer} onChange={change} /></Grid><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth name="kategorie" label="Vertragsart" value={form.kategorie} onChange={change} /></Grid><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth select name="status" label="Status" value={form.status} onChange={change}>{["Aktiv", "Gekündigt", "Abgelaufen", "Entwurf"].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="date" name="startdatum" label="Vertragsbeginn" value={form.startdatum} onChange={change} slotProps={{ inputLabel: { shrink: true } }} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="date" name="enddatum" label="Vertragsende" value={form.enddatum} onChange={change} slotProps={{ inputLabel: { shrink: true } }} /></Grid><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth name="kuendigungsfrist" label="Kündigungsfrist" placeholder="z. B. 3 Monate zum Laufzeitende" value={form.kuendigungsfrist} onChange={change} /></Grid><Grid size={{ xs: 12, md: 6 }}><FormControlLabel control={<Switch name="automatischeVerlaengerung" checked={Boolean(form.automatischeVerlaengerung)} onChange={change} />} label="Automatische Verlängerung" /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth name="kosten" label="Kosten" placeholder="z. B. 1250,00 €" value={form.kosten} onChange={change} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth select name="kostenIntervall" label="Kostenintervall" value={form.kostenIntervall} onChange={change}>{["Monatlich", "Quartalsweise", "Jährlich", "Einmalig"].map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12 }}><TextField fullWidth name="ansprechpartner" label="Ansprechpartner" value={form.ansprechpartner} onChange={change} /></Grid><Grid size={{ xs: 12 }}><TextField fullWidth multiline minRows={3} name="notizen" label="Notizen" value={form.notizen} onChange={change} /></Grid></Grid></DialogContent><DialogActions><Button onClick={onClose}>Abbrechen</Button><Button variant="contained" onClick={onSave} disabled={saving || !form.name.trim()}>{saving ? "Speichert…" : "Speichern"}</Button></DialogActions></Dialog>;
}

function KontaktDialog({ open, onClose, form, setForm, onSave, editing, saving }) {
  const change = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>{editing ? "Ansprechpartner bearbeiten" : "Ansprechpartner hinzufügen"}</DialogTitle><DialogContent><Stack spacing={2} mt={1}><TextField name="name" label="Name" required value={form.name} onChange={change} /><TextField name="position" label="Position" value={form.position} onChange={change} /><TextField name="telefon" label="Telefon" value={form.telefon} onChange={change} /><TextField name="mobil" label="Mobil" value={form.mobil} onChange={change} /><TextField name="email" label="E-Mail" value={form.email} onChange={change} /><TextField name="geburtstag" label="Geburtstag" type="date" value={form.geburtstag} onChange={change} slotProps={{ inputLabel: { shrink: true } }} /><TextField name="notizen" label="Notizen" multiline minRows={3} value={form.notizen} onChange={change} /></Stack></DialogContent><DialogActions><Button onClick={onClose}>Abbrechen</Button><Button variant="contained" onClick={onSave} disabled={saving || !form.name.trim()}>Speichern</Button></DialogActions></Dialog>;
}

function AufgabeDialog({ open, onClose, form, setForm, onSave, editing, saving }) {
  const change = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>{editing ? "Aufgabe bearbeiten" : "Aufgabe anlegen"}</DialogTitle><DialogContent><Stack spacing={2} mt={1}><TextField name="titel" label="Aufgabe" required value={form.titel} onChange={change} /><TextField name="faelligAm" label="Fällig am" type="date" value={form.faelligAm} onChange={change} slotProps={{ inputLabel: { shrink: true } }} /><TextField select name="prioritaet" label="Priorität" value={form.prioritaet} onChange={change}>{["Niedrig", "Mittel", "Hoch"].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField><TextField select name="status" label="Status" value={form.status} onChange={change}>{["Offen", "In Bearbeitung", "Erledigt"].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField><TextField name="notizen" label="Notizen" multiline minRows={3} value={form.notizen} onChange={change} /></Stack></DialogContent><DialogActions><Button onClick={onClose}>Abbrechen</Button><Button variant="contained" onClick={onSave} disabled={saving || !form.titel.trim()}>Speichern</Button></DialogActions></Dialog>;
}
