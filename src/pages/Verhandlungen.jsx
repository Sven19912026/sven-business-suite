// UPDATE: Liefertermin-Auswahl plus zwei einklappbare Fahrzeugbereiche Offen und Archiv
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
  Timestamp,
  collection,
  deleteField,
  doc,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import {
  trackedAddDoc as addDoc,
  trackedDeleteDoc as deleteDoc,
  trackedOnSnapshot as onSnapshot,
  trackedUpdateDoc as updateDoc,
} from "../firebaseUsage";

import { auth, db } from "../firebase";
import Dokumentablage from "../components/Dokumentablage";
import { RichTextContent, RichTextEditor } from "../components/RichText";
import { cleanRichTextForStorage, richTextToPlainText } from "../utils/richText";
import {
  VERHANDLUNG_DOKUMENT_KATEGORIEN,
  addiereTage,
  alleDokumenteLoeschen,
  dokumentFristenSynchronisieren,
  dokumenteCollection,
  istAbgeschlossenerStatus,
  timestampZuDatum,
  verhandlungsFristInitialisieren,
} from "../services/dokumente";

const STANDARD_LIEFERANTEN_KATEGORIEN = [
  "Diesellieferanten",
  "Baustofflieferanten",
  "Stahllieferanten",
  "Elektrolieferanten",
  "Werkzeuglieferanten",
  "Material",
  "Maschine",
  "Fahrzeug",
  "Dienstleistung",
  "Personal",
  "Sonstiges",
];

const leerVerhandlungsFormular = {
  auftraggeberId: "",
  auftraggeberName: "",
  verhandlungstag: "",
  lieferantId: "",
  firma: "",
  verhandlungsgegenstand: "",
  vereinbarungen: "",
  vereinbarungenEinsparung: "",
  ansprechpartner: "",
  telefon: "",
  email: "",
  kategorie: "Material",
  status: "Offen",
  prioritaet: "Mittel",
  ausgangsangebot: "",
  aktuellesAngebot: "",
  skonto: "",
  zielpreis: "",
  schmerzgrenze: "",
  lieferterminArt: "datum",
  lieferterminDatum: "",
  lieferterminMonat: "",
  lieferterminQuartal: "1",
  lieferterminJahr: "",
  liefertermin: "",
  angeliefert: false,
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
  gewuenschterLieferterminArt: "datum",
  gewuenschterLieferterminDatum: "",
  gewuenschterLieferterminMonat: "",
  gewuenschterLieferterminQuartal: "1",
  gewuenschterLieferterminJahr: "",
  gewuenschterLiefertermin: "",
  voraussichtlicherLieferterminArt: "datum",
  voraussichtlicherLieferterminDatum: "",
  voraussichtlicherLieferterminMonat: "",
  voraussichtlicherLieferterminQuartal: "1",
  voraussichtlicherLieferterminJahr: "",
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
  if (wert === "" || wert === null || wert === undefined) return 0;
  const normalisiert = String(wert).replace(/\s/g, "").replace(",", ".");
  const zahl = Number(normalisiert);
  return Number.isFinite(zahl) ? zahl : 0;
}

function prozentWert(wert) {
  const treffer = String(wert ?? "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  const zahl = treffer ? Number(treffer[0]) : 0;
  return Math.min(Math.max(Number.isFinite(zahl) ? zahl : 0, 0), 100);
}

function betragNachSkonto(eintrag) {
  const verhandelt = Math.max(euroWert(eintrag.aktuellesAngebot), 0);
  return verhandelt * (1 - prozentWert(eintrag.skonto) / 100);
}

function skontoAbzug(eintrag) {
  return Math.max(euroWert(eintrag.aktuellesAngebot) - betragNachSkonto(eintrag), 0);
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

function zeitpunktFormat(wert) {
  if (!wert) return "—";

  const datum = timestampZuDatum(wert) ||
    (wert instanceof Date ? wert : new Date(wert));

  if (!(datum instanceof Date) || Number.isNaN(datum.getTime())) return "—";

  return datum.toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const VERHANDLUNGS_PHASE_FELDER = [
  "auftraggeberId",
  "auftraggeberName",
  "verhandlungstag",
  "lieferantId",
  "firma",
  "verhandlungsgegenstand",
  "vereinbarungen",
  "vereinbarungenEinsparung",
  "ansprechpartner",
  "telefon",
  "email",
  "kategorie",
  "status",
  "prioritaet",
  "ausgangsangebot",
  "aktuellesAngebot",
  "skonto",
  "zielpreis",
  "schmerzgrenze",
  "lieferterminArt",
  "lieferterminDatum",
  "lieferterminMonat",
  "lieferterminQuartal",
  "lieferterminJahr",
  "liefertermin",
  "angeliefert",
  "wiedervorlage",
  "notizen",
];

function verhandlungsPhaseDaten(eintrag = {}) {
  const daten = {};

  VERHANDLUNGS_PHASE_FELDER.forEach((feld) => {
    let wert = eintrag?.[feld];

    if (feld === "status") wert = statusNormalisieren(wert);
    if (feld === "angeliefert") wert = wert === true;
    if (["ausgangsangebot", "aktuellesAngebot", "vereinbarungenEinsparung", "zielpreis", "schmerzgrenze"].includes(feld)) {
      wert = euroWert(wert);
    }
    if (feld === "skonto") wert = prozentWert(wert);
    if (feld === "notizen") wert = cleanRichTextForStorage(wert || "");

    daten[feld] = wert ?? "";
  });

  const lieferArt = lieferterminArtErmitteln(eintrag, "liefertermin");
  daten.lieferterminArt = lieferArt;
  if (lieferArt === "datum") {
    const datum = eintrag?.lieferterminDatum || eintrag?.liefertermin || "";
    daten.lieferterminDatum = datum;
    daten.liefertermin = datum;
    daten.lieferterminMonat = "";
    daten.lieferterminQuartal = "";
    daten.lieferterminJahr = "";
  } else if (lieferArt === "monat") {
    daten.lieferterminDatum = "";
    daten.liefertermin = "";
    daten.lieferterminMonat = eintrag?.lieferterminMonat || "";
    daten.lieferterminQuartal = "";
    daten.lieferterminJahr = "";
  } else {
    daten.lieferterminDatum = "";
    daten.liefertermin = "";
    daten.lieferterminMonat = "";
    daten.lieferterminQuartal = String(eintrag?.lieferterminQuartal || "1").replace(/^Q/i, "");
    daten.lieferterminJahr = eintrag?.lieferterminJahr || "";
  }

  return daten;
}

function phasenDatenSindGleich(a, b) {
  const links = verhandlungsPhaseDaten(a);
  const rechts = verhandlungsPhaseDaten(b);
  return VERHANDLUNGS_PHASE_FELDER.every(
    (feld) => JSON.stringify(links[feld]) === JSON.stringify(rechts[feld])
  );
}

function gespeicherteVerhandlungsphasen(eintrag) {
  if (!Array.isArray(eintrag?.verhandlungsphasen)) return [];

  return eintrag.verhandlungsphasen
    .map((phase, index) => ({
      nummer: Number(phase?.nummer) || index + 1,
      gespeichertAm: phase?.gespeichertAm ?? phase?.erstelltAm ?? null,
      bearbeitetAm: phase?.bearbeitetAm ?? null,
      daten: verhandlungsPhaseDaten(phase?.daten ?? phase ?? {}),
    }))
    .sort((a, b) => a.nummer - b.nummer);
}

function aktuelleVerhandlungsphaseNummer(eintrag) {
  const phasen = gespeicherteVerhandlungsphasen(eintrag);
  if (Number(eintrag?.aktuelleVerhandlungsphase) > 0) {
    return Number(eintrag.aktuelleVerhandlungsphase);
  }
  if (phasen.length > 0) return phasen[phasen.length - 1].nummer;
  return 1;
}

function phaseBezeichnung(nummer) {
  return `${nummer}. Verhandlungsphase`;
}

function verhandlungsgegenstandHistorie(eintrag) {
  if (!Array.isArray(eintrag?.verhandlungsgegenstandHistorie)) return [];

  return eintrag.verhandlungsgegenstandHistorie
    .map((item) => ({
      stand: String(item?.stand ?? item?.text ?? item?.wert ?? "").trim(),
      ersetztAm: item?.ersetztAm ?? item?.geaendertAm ?? null,
    }))
    .filter((item) => item.stand);
}

function AlteGegenstandsHistorie({ eintrag, compact = false }) {
  const historie = verhandlungsgegenstandHistorie(eintrag);
  if (historie.length === 0) return null;

  return (
    <Accordion
      disableGutters
      variant="outlined"
      sx={{
        mt: compact ? 0.75 : 1.25,
        bgcolor: "background.paper",
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          minHeight: compact ? 34 : 42,
          px: compact ? 1 : 1.5,
          "& .MuiAccordionSummary-content": { my: compact ? 0.5 : 0.75 },
        }}
      >
        <Typography variant={compact ? "caption" : "body2"} fontWeight={800}>
          Ältere Gegenstands-Historie ({historie.length})
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: compact ? 1 : 1.5, pt: 0, pb: 1.25 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          Diese Einträge stammen aus der bisherigen Historie vor Einführung der vollständigen Verhandlungsphasen.
        </Typography>
        <Stack spacing={1}>
          {[...historie].reverse().map((item, index) => (
            <Box
              key={`${item.stand}-${index}`}
              sx={{ pl: 1.25, borderLeft: "3px solid", borderColor: "divider" }}
            >
              <Typography
                variant={compact ? "caption" : "body2"}
                sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              >
                {item.stand}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Ersetzt am {zeitpunktFormat(item.ersetztAm)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function phasenStatusFarbe(status) {
  const normalisiert = statusNormalisieren(status);
  if (normalisiert === "Abgeschlossen" || normalisiert === "Geliefert") return "success";
  if (normalisiert === "Offen" || normalisiert === "Abgebrochen") return "error";
  if (normalisiert === "In Verhandlung" || normalisiert === "Bestellt") return "warning";
  return "info";
}

function phasenPrioritaetsFarbe(prioritaet) {
  if (prioritaet === "Hoch") return "error";
  if (prioritaet === "Mittel") return "warning";
  return "default";
}

function VerhandlungsphaseDetails({ phase, compact = false }) {
  if (!phase?.daten) return null;
  const daten = phase.daten;

  return (
    <Paper variant="outlined" sx={{ p: compact ? 1.25 : 1.75, bgcolor: "action.hover" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={0.5}
        sx={{ mb: 1.25 }}
      >
        <Typography fontWeight={900}>{phaseBezeichnung(phase.nummer)}</Typography>
        <Typography variant="caption" color="text.secondary">
          Gespeichert: {zeitpunktFormat(phase.gespeichertAm)}
          {phase.bearbeitetAm ? ` · bearbeitet: ${zeitpunktFormat(phase.bearbeitetAm)}` : ""}
        </Typography>
      </Stack>

      <Grid container spacing={compact ? 1 : 1.5}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">Für Firma</Typography>
          <Typography fontWeight={700}>{daten.auftraggeberName || "—"}</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">Verhandlungstag</Typography>
          <Typography fontWeight={700}>{datumFormat(daten.verhandlungstag)}</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">Lieferant / Firma</Typography>
          <Typography fontWeight={700}>{daten.firma || "—"}</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">Kategorie</Typography>
          <Typography fontWeight={700}>{daten.kategorie || "—"}</Typography>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Typography variant="caption" color="text.secondary">Verhandlungsgegenstand</Typography>
          <Typography fontWeight={800} sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {daten.verhandlungsgegenstand || "—"}
          </Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 8 }}>
          <Typography variant="caption" color="text.secondary">Vereinbarungen / Zugaben / Kontingente</Typography>
          <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {daten.vereinbarungen || "—"}
          </Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Typography variant="caption" color="text.secondary">Einsparung Vereinbarungen</Typography>
          <Typography fontWeight={800} color="success.main">{euroFormat(vereinbarungenEinsparungWert(daten))}</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Typography variant="caption" color="text.secondary">Ansprechpartner</Typography>
          <Typography>{daten.ansprechpartner || "—"}</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Typography variant="caption" color="text.secondary">Telefon</Typography>
          <Typography>{daten.telefon || "—"}</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Typography variant="caption" color="text.secondary">E-Mail</Typography>
          <Typography sx={{ overflowWrap: "anywhere" }}>{daten.email || "—"}</Typography>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Typography variant="caption" color="text.secondary">Status</Typography>
          <Box sx={{ mt: 0.35 }}>
            <Chip size="small" label={statusNormalisieren(daten.status)} color={phasenStatusFarbe(daten.status)} />
          </Box>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Typography variant="caption" color="text.secondary">Priorität</Typography>
          <Box sx={{ mt: 0.35 }}>
            <Chip size="small" label={daten.prioritaet || "—"} color={phasenPrioritaetsFarbe(daten.prioritaet)} />
          </Box>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Typography variant="caption" color="text.secondary">Ausgang</Typography>
          <Typography fontWeight={700}>{euroFormat(daten.ausgangsangebot)}</Typography>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Typography variant="caption" color="text.secondary">Verhandelt</Typography>
          <Typography fontWeight={700}>{euroFormat(daten.aktuellesAngebot)}</Typography>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Typography variant="caption" color="text.secondary">Skonto</Typography>
          <Typography fontWeight={700}>{prozentFormat(prozentWert(daten.skonto))}</Typography>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Typography variant="caption" color="text.secondary">Nach Skonto</Typography>
          <Typography fontWeight={700}>{euroFormat(betragNachSkonto(daten))}</Typography>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Typography variant="caption" color="text.secondary">Zielpreis</Typography>
          <Typography fontWeight={700}>{euroFormat(daten.zielpreis)}</Typography>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Typography variant="caption" color="text.secondary">Schmerzgrenze</Typography>
          <Typography fontWeight={700}>{euroFormat(daten.schmerzgrenze)}</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">Liefertermin</Typography>
          <Typography fontWeight={700}>{lieferterminAnzeige(daten)}</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">Lieferstatus</Typography>
          <Box sx={{ mt: 0.35 }}><LieferstatusChip angeliefert={daten.angeliefert} /></Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">Wiedervorlage</Typography>
          <Typography fontWeight={700}>{datumFormat(daten.wiedervorlage)}</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">Nachlass inkl. Skonto</Typography>
          <Typography fontWeight={800}>{euroFormat(nachlassEinsparung(daten))}</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">Gesamtersparnis</Typography>
          <Typography fontWeight={900} color="success.main">{euroFormat(einsparung(daten))}</Typography>
        </Grid>
        {daten.notizen && (
          <Grid size={{ xs: 12 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>Notizen</Typography>
            <RichTextContent value={daten.notizen} sx={{ mt: 0.25, fontSize: compact ? "0.78rem" : "0.875rem" }} />
          </Grid>
        )}
      </Grid>
    </Paper>
  );
}

function VerhandlungsphasenHistorie({
  eintrag,
  compact = false,
  onPhaseBearbeiten,
  onPhaseLoeschen,
  allePhasen = false,
}) {
  const phasen = gespeicherteVerhandlungsphasen(eintrag);
  const aktuelleNummer = aktuelleVerhandlungsphaseNummer(eintrag);
  const frueherePhasen = phasen.filter((phase) => phase.nummer !== aktuelleNummer);
  const sichtbarePhasen = allePhasen ? phasen : frueherePhasen;
  const [auswahl, setAuswahl] = useState("");
  const effektiveAuswahl = sichtbarePhasen.some(
    (phase) => phase.nummer === Number(auswahl)
  )
    ? Number(auswahl)
    : (sichtbarePhasen.at(-1)?.nummer ?? "");

  const ausgewaehltePhase = sichtbarePhasen.find(
    (phase) => phase.nummer === Number(effektiveAuswahl)
  );
  const alteGegenstaende = verhandlungsgegenstandHistorie(eintrag);

  if (sichtbarePhasen.length === 0) {
    return alteGegenstaende.length > 0
      ? <AlteGegenstandsHistorie eintrag={eintrag} compact={compact} />
      : null;
  }

  return (
    <Accordion
      disableGutters
      variant="outlined"
      sx={{ mt: compact ? 0.75 : 1.25, "&:before": { display: "none" } }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          minHeight: compact ? 36 : 44,
          px: compact ? 1 : 1.5,
          "& .MuiAccordionSummary-content": { my: compact ? 0.5 : 0.75 },
        }}
      >
        <Typography variant={compact ? "caption" : "body2"} fontWeight={850}>
          {allePhasen
            ? `Verhandlungsphasen verwalten (${sichtbarePhasen.length})`
            : `Frühere Verhandlungsphasen (${sichtbarePhasen.length})`}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: compact ? 1 : 1.5, pt: 0, pb: 1.5 }}>
        <Stack spacing={1.25}>
          <TextField
            select
            size="small"
            fullWidth
            label="Phase auswählen"
            value={effektiveAuswahl}
            onChange={(event) => setAuswahl(Number(event.target.value))}
          >
            {[...sichtbarePhasen].reverse().map((phase) => (
              <MenuItem key={phase.nummer} value={phase.nummer}>
                {phaseBezeichnung(phase.nummer)}
                {phase.nummer === aktuelleNummer ? " · aktuell" : ""}
                {` · ${zeitpunktFormat(phase.gespeichertAm)}`}
              </MenuItem>
            ))}
          </TextField>

          {ausgewaehltePhase && (
            <>
              <VerhandlungsphaseDetails phase={ausgewaehltePhase} compact={compact} />
              {(onPhaseBearbeiten || onPhaseLoeschen) && (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  {onPhaseBearbeiten && (
                    <Button
                      variant="outlined"
                      size={compact ? "small" : "medium"}
                      startIcon={<EditIcon />}
                      onClick={(event) => {
                        event.stopPropagation();
                        onPhaseBearbeiten(ausgewaehltePhase);
                      }}
                    >
                      Phase direkt bearbeiten
                    </Button>
                  )}
                  {onPhaseLoeschen && (
                    <Button
                      variant="outlined"
                      color="error"
                      size={compact ? "small" : "medium"}
                      startIcon={<DeleteIcon />}
                      disabled={phasen.length <= 1}
                      onClick={(event) => {
                        event.stopPropagation();
                        onPhaseLoeschen(ausgewaehltePhase);
                      }}
                    >
                      Phase löschen
                    </Button>
                  )}
                </Stack>
              )}
              {phasen.length <= 1 && onPhaseLoeschen && (
                <Typography variant="caption" color="text.secondary">
                  Die einzige vorhandene Phase kann nicht einzeln gelöscht werden. Dafür bitte die gesamte Verhandlung löschen.
                </Typography>
              )}
            </>
          )}

          {alteGegenstaende.length > 0 && (
            <AlteGegenstandsHistorie eintrag={eintrag} compact={compact} />
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function lieferterminArtErmitteln(eintrag, praefix) {
  if (eintrag?.[`${praefix}Art`]) return eintrag[`${praefix}Art`];
  if (eintrag?.[`${praefix}Monat`]) return "monat";
  if (eintrag?.[`${praefix}Jahr`] || eintrag?.[`${praefix}Quartal`]) return "quartal";
  if (eintrag?.[`${praefix}Datum`] || eintrag?.[praefix]) return "datum";
  return "datum";
}

function lieferterminFormularwerte(eintrag, praefix) {
  return {
    [`${praefix}Art`]: lieferterminArtErmitteln(eintrag, praefix),
    [`${praefix}Datum`]: eintrag?.[`${praefix}Datum`] ?? eintrag?.[praefix] ?? "",
    [`${praefix}Monat`]: eintrag?.[`${praefix}Monat`] ?? "",
    [`${praefix}Quartal`]: String(eintrag?.[`${praefix}Quartal`] ?? "1").replace(/^Q/i, ""),
    [`${praefix}Jahr`]: eintrag?.[`${praefix}Jahr`] ?? "",
  };
}

function lieferterminAnzeige(eintrag, praefix = "liefertermin") {
  const art = lieferterminArtErmitteln(eintrag, praefix);
  const datum = eintrag?.[`${praefix}Datum`] || eintrag?.[praefix];
  const monat = eintrag?.[`${praefix}Monat`];
  const quartal = String(eintrag?.[`${praefix}Quartal`] || "").replace(/^Q/i, "");
  const jahr = eintrag?.[`${praefix}Jahr`];

  if (art === "monat" && monat) {
    const [monatJahr, monatNummer] = monat.split("-");
    const datumWert = new Date(Number(monatJahr), Number(monatNummer) - 1, 1);
    return datumWert.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  }

  if (art === "quartal" && quartal && jahr) return `Q${quartal} ${jahr}`;
  if (datum) return datumFormat(datum);
  return "—";
}

function lieferterminSortierwert(eintrag, praefix = "liefertermin") {
  const art = lieferterminArtErmitteln(eintrag, praefix);
  const datum = eintrag?.[`${praefix}Datum`] || eintrag?.[praefix];
  const monat = eintrag?.[`${praefix}Monat`];
  const quartal = Number(String(eintrag?.[`${praefix}Quartal`] || "").replace(/^Q/i, ""));
  const jahr = Number(eintrag?.[`${praefix}Jahr`]);

  if (art === "monat" && monat) return `${monat}-01`;
  if (art === "quartal" && quartal >= 1 && quartal <= 4 && jahr) {
    return `${jahr}-${String((quartal - 1) * 3 + 1).padStart(2, "0")}-01`;
  }
  return datum || "9999-12-31";
}

function verhandlungsFormularAusDaten(daten = {}) {
  return {
    ...leerVerhandlungsFormular,
    auftraggeberId: daten.auftraggeberId ?? "",
    auftraggeberName: daten.auftraggeberName ?? "",
    verhandlungstag: daten.verhandlungstag ?? "",
    lieferantId: daten.lieferantId ?? "",
    firma: daten.firma ?? "",
    verhandlungsgegenstand: daten.verhandlungsgegenstand ?? "",
    vereinbarungen: daten.vereinbarungen ?? "",
    vereinbarungenEinsparung: daten.vereinbarungenEinsparung ?? "",
    ansprechpartner: daten.ansprechpartner ?? "",
    telefon: daten.telefon ?? "",
    email: daten.email ?? "",
    kategorie: daten.kategorie ?? "Material",
    status: statusNormalisieren(daten.status),
    prioritaet: daten.prioritaet ?? "Mittel",
    ausgangsangebot: daten.ausgangsangebot ?? "",
    aktuellesAngebot: daten.aktuellesAngebot ?? "",
    skonto: daten.skonto ?? "",
    zielpreis: daten.zielpreis ?? "",
    schmerzgrenze: daten.schmerzgrenze ?? "",
    ...lieferterminFormularwerte(daten, "liefertermin"),
    liefertermin: daten.liefertermin ?? "",
    angeliefert: daten.angeliefert === true,
    wiedervorlage: daten.wiedervorlage ?? "",
    notizen: daten.notizen ?? "",
  };
}

function LieferterminEingabe({
  formular,
  praefix,
  label,
  onChange,
  statusName = "",
  onStatusChange,
}) {
  const art = formular[`${praefix}Art`] || "datum";

  return (
    <Grid size={{ xs: 12 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={1}
          sx={{ mb: 1.5 }}
        >
          <Typography fontWeight={800}>{label}</Typography>
          {statusName && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                type="button"
                size="small"
                color="success"
                variant={formular[statusName] === true ? "contained" : "outlined"}
                startIcon={<Box component="span" aria-hidden="true" sx={{ fontWeight: 900 }}>✓</Box>}
                onClick={() => onStatusChange?.(true)}
              >
                Angeliefert
              </Button>
              <Button
                type="button"
                size="small"
                color="error"
                variant={formular[statusName] === false ? "contained" : "outlined"}
                startIcon={<Box component="span" aria-hidden="true" sx={{ fontWeight: 900 }}>✕</Box>}
                onClick={() => onStatusChange?.(false)}
              >
                Noch nicht angeliefert
              </Button>
            </Stack>
          )}
        </Stack>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              select
              fullWidth
              label="Angabe als"
              name={`${praefix}Art`}
              value={art}
              onChange={onChange}
            >
              <MenuItem value="datum">Genaues Datum</MenuItem>
              <MenuItem value="monat">Monat</MenuItem>
              <MenuItem value="quartal">Quartal</MenuItem>
            </TextField>
          </Grid>

          {art === "datum" && (
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                fullWidth
                type="date"
                label="Genaues Datum"
                name={`${praefix}Datum`}
                value={formular[`${praefix}Datum`] || ""}
                onChange={onChange}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
          )}

          {art === "monat" && (
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                fullWidth
                type="month"
                label="Monat"
                name={`${praefix}Monat`}
                value={formular[`${praefix}Monat`] || ""}
                onChange={onChange}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
          )}

          {art === "quartal" && (
            <>
              <Grid size={{ xs: 6, sm: 4 }}>
                <TextField
                  select
                  fullWidth
                  label="Quartal"
                  name={`${praefix}Quartal`}
                  value={String(formular[`${praefix}Quartal`] || "1").replace(/^Q/i, "")}
                  onChange={onChange}
                >
                  {[1, 2, 3, 4].map((quartal) => (
                    <MenuItem key={quartal} value={String(quartal)}>Q{quartal}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 6, sm: 4 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Jahr"
                  name={`${praefix}Jahr`}
                  value={formular[`${praefix}Jahr`] || ""}
                  onChange={onChange}
                  inputProps={{ min: 2000, max: 2100, step: 1 }}
                  placeholder={String(new Date().getFullYear())}
                />
              </Grid>
            </>
          )}
        </Grid>
      </Paper>
    </Grid>
  );
}

function heuteText() {
  const heute = new Date();
  return [
    heute.getFullYear(),
    String(heute.getMonth() + 1).padStart(2, "0"),
    String(heute.getDate()).padStart(2, "0"),
  ].join("-");
}

function nachlassEinsparung(eintrag) {
  return Math.max(
    euroWert(eintrag.ausgangsangebot) - betragNachSkonto(eintrag),
    0
  );
}

function vereinbarungenEinsparungWert(eintrag) {
  return Math.max(euroWert(eintrag.vereinbarungenEinsparung), 0);
}

function einsparung(eintrag) {
  return nachlassEinsparung(eintrag) + vereinbarungenEinsparungWert(eintrag);
}
function statusNormalisieren(status) {
  if (status === "Gewonnen" || status === "Verloren") {
    return "Abgeschlossen";
  }

  return status || "Offen";
}

function statusIstAbgeschlossen(status) {
  return statusNormalisieren(status) === "Abgeschlossen";
}

function statusRahmenFarbe(status) {
  const normalisiert = statusNormalisieren(status);
  if (normalisiert === "Abgeschlossen") return "success.main";
  if (normalisiert === "In Verhandlung") return "warning.main";
  if (normalisiert === "Offen") return "error.main";
  return "divider";
}

function LieferstatusChip({ angeliefert }) {
  const istAngeliefert = angeliefert === true;
  return (
    <Chip
      size="small"
      variant="outlined"
      color={istAngeliefert ? "success" : "error"}
      icon={
        <Box component="span" aria-hidden="true" sx={{ fontWeight: 900 }}>
          {istAngeliefert ? "✓" : "✕"}
        </Box>
      }
      label={istAngeliefert ? "Angeliefert" : "Noch nicht angeliefert"}
    />
  );
}

function istPdfDokument(dokument) {
  return dokument?.contentType === "application/pdf"
    || String(dokument?.dateiname || "").toLowerCase().endsWith(".pdf");
}

function DirektesVerhandlungsPdf({ verhandlungId }) {
  const [pdfDokument, setPdfDokument] = useState(null);

  useEffect(() => {
    if (!verhandlungId) {
      setPdfDokument(null);
      return undefined;
    }

    return onSnapshot(
      dokumenteCollection("verhandlung", verhandlungId),
      (snapshot) => {
        const pdfs = snapshot.docs
          .map((eintrag) => ({ id: eintrag.id, ...eintrag.data() }))
          .filter((dokument) => istPdfDokument(dokument) && dokument.downloadUrl)
          .sort((a, b) => {
            const aZeit = timestampZuDatum(a.erstelltAm)?.getTime() || 0;
            const bZeit = timestampZuDatum(b.erstelltAm)?.getTime() || 0;
            return bZeit - aZeit;
          });

        setPdfDokument(pdfs[0] || null);
      },
      () => setPdfDokument(null)
    );
  }, [verhandlungId]);

  if (!pdfDokument?.downloadUrl) return null;

  return (
    <Tooltip title={`PDF öffnen: ${pdfDokument.titel || pdfDokument.dateiname || "Dokument"}`}>
      <Button
        component="a"
        href={pdfDokument.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        color="error"
        variant="outlined"
        size="small"
        aria-label="PDF der Verhandlung öffnen"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        sx={{
          alignSelf: "center",
          flexShrink: 0,
          minWidth: 0,
          mr: 1,
          px: 0.75,
          whiteSpace: "nowrap",
        }}
      >
        <PictureAsPdfIcon fontSize="small" />
        <Box component="span" sx={{ ml: 0.5, display: { xs: "none", sm: "inline" } }}>
          PDF
        </Box>
      </Button>
    </Tooltip>
  );
}

function fahrzeugStatusIstGeliefert(status) {
  return String(status || "").trim().toLocaleLowerCase("de-DE") === "geliefert";
}

function prozentFormat(wert) {
  const zahl = Number(wert);
  const sicher = Number.isFinite(zahl) ? zahl : 0;
  return `${new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(sicher)} %`;
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
  const istMobil = useMediaQuery(theme.breakpoints.down("lg"));

  const [ansicht, setAnsicht] = useState("verhandlungen");
  const initialNegotiationOpenedRef = useRef("");
  const initialisierteDokumentFristenRef = useRef(new Set());
  const verhandlungenListeRef = useRef(null);
  const verhandlungenArchivRef = useRef(null);

  const [verhandlungen, setVerhandlungen] = useState([]);
  const [verhandlungsFormular, setVerhandlungsFormular] = useState(
    leerVerhandlungsFormular
  );
  const [verhandlungsDialogOffen, setVerhandlungsDialogOffen] = useState(false);
  const [verhandlungsBearbeitungsId, setVerhandlungsBearbeitungsId] =
    useState(null);
  const [verhandlungsBasisPhase, setVerhandlungsBasisPhase] = useState(null);

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
  const [verhandlungenArchivAufgeklappt, setVerhandlungenArchivAufgeklappt] =
    useState(false);
  const [verhandlungsGruppenAufgeklappt, setVerhandlungsGruppenAufgeklappt] =
    useState({
      Offen: true,
      "In Verhandlung": true,
      Abgeschlossen: false,
    });

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
  const [fahrzeugStatusWirdGespeichert, setFahrzeugStatusWirdGespeichert] = useState("");
  const [fahrzeugOffenAufgeklappt, setFahrzeugOffenAufgeklappt] = useState(true);
  const [fahrzeugArchivAufgeklappt, setFahrzeugArchivAufgeklappt] = useState(false);

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

  useEffect(() => {
    verhandlungen
      .filter((eintrag) => istAbgeschlossenerStatus(statusNormalisieren(eintrag.status)))
      .forEach((eintrag) => {
        if (initialisierteDokumentFristenRef.current.has(eintrag.id)) return;
        initialisierteDokumentFristenRef.current.add(eintrag.id);
        verhandlungsFristInitialisieren(eintrag).catch((error) => {
          console.error(error);
          initialisierteDokumentFristenRef.current.delete(eintrag.id);
          setFehler("Die Aufbewahrungsfrist der Verhandlungsdokumente konnte nicht geprüft werden.");
        });
      });
  }, [verhandlungen]);

  const kennzahlen = useMemo(() => {
    const aktiveVerhandlungen = verhandlungen.filter(
      (eintrag) => eintrag.angeliefert !== true
    );

    const offen = aktiveVerhandlungen.filter((eintrag) => {
      const status = statusNormalisieren(eintrag.status);
      return status === "Offen" || status === "In Verhandlung";
    }).length;

    const abgeschlossen = aktiveVerhandlungen.filter((eintrag) =>
      statusIstAbgeschlossen(eintrag.status)
    ).length;

    const gesamtEinsparung = verhandlungen.reduce(
      (summe, eintrag) => summe + einsparung(eintrag),
      0
    );

    const ausgangsVolumen = verhandlungen.reduce((summe, eintrag) => {
      const ausgang = euroWert(eintrag.ausgangsangebot);
      return summe + (ausgang > 0 ? ausgang : 0);
    }, 0);

    const faellig = aktiveVerhandlungen.filter(
      (eintrag) =>
        eintrag.wiedervorlage &&
        eintrag.wiedervorlage <= heuteText() &&
        !statusIstAbgeschlossen(eintrag.status)
    ).length;

    return {
  offen,
  abgeschlossen,
  gesamtEinsparung,
  ausgangsVolumen,
  faellig,
};
  }, [verhandlungen]);

  const gefilterteVerhandlungenAlle = useMemo(() => {
    const suchbegriff = suche.trim().toLowerCase();

    const gefiltert = verhandlungen.filter((eintrag) => {
      const normalisierterStatus = statusNormalisieren(eintrag.status);
      const passtStatus =
        statusFilter === "Alle" ||
        (statusFilter === "Aktiv" &&
          (normalisierterStatus === "Offen" ||
            normalisierterStatus === "In Verhandlung")) ||
        normalisierterStatus === statusFilter;
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
        eintrag.vereinbarungen?.toLowerCase().includes(suchbegriff) ||
        eintrag.ansprechpartner?.toLowerCase().includes(suchbegriff) ||
        eintrag.kategorie?.toLowerCase().includes(suchbegriff) ||
        eintrag.email?.toLowerCase().includes(suchbegriff) ||
        lieferterminAnzeige(eintrag).toLowerCase().includes(suchbegriff) ||
        richTextToPlainText(eintrag.notizen).toLowerCase().includes(suchbegriff);

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

  const gefilterteVerhandlungen = useMemo(
    () =>
      gefilterteVerhandlungenAlle.filter(
        (eintrag) => eintrag.angeliefert !== true
      ),
    [gefilterteVerhandlungenAlle]
  );

  const verhandlungsGruppen = useMemo(
    () =>
      ["Offen", "In Verhandlung", "Abgeschlossen"]
        .map((status) => ({
          status,
          eintraege: gefilterteVerhandlungen.filter(
            (eintrag) => statusNormalisieren(eintrag.status) === status
          ),
        }))
        .filter((gruppe) => gruppe.eintraege.length > 0),
    [gefilterteVerhandlungen]
  );

  function verhandlungsGruppeSetzen(status, aufgeklappt) {
    setVerhandlungsGruppenAufgeklappt((bisher) => ({
      ...bisher,
      [status]: aufgeklappt,
    }));
  }

  const gefilterteArchivVerhandlungen = useMemo(
    () =>
      gefilterteVerhandlungenAlle.filter(
        (eintrag) => eintrag.angeliefert === true
      ),
    [gefilterteVerhandlungenAlle]
  );

  const archivVerhandlungenGesamt = useMemo(
    () => verhandlungen.filter((eintrag) => eintrag.angeliefert === true).length,
    [verhandlungen]
  );

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

  const lieferantenKategorien = useMemo(() => {
    const vorhandene = lieferanten
      .map((eintrag) => String(eintrag.kategorie || "").trim())
      .filter(Boolean);

    return [...new Set([...STANDARD_LIEFERANTEN_KATEGORIEN, ...vorhandene])]
      .sort((a, b) => a.localeCompare(b, "de"));
  }, [lieferanten]);

  const fahrzeugZaehler = useMemo(() => {
    return fahrzeugverhandlungen.reduce(
      (summe, eintrag) => {
        const anzahl = (eintrag.fahrzeuge || []).reduce(
          (gesamt, fahrzeug) =>
            gesamt + Math.max(Number(fahrzeug.anzahl) || 1, 1),
          0
        );

        if (fahrzeugStatusIstGeliefert(eintrag.status)) {
          summe.archiv += anzahl;
          summe.archivVorgaenge += 1;
        } else {
          summe.offen += anzahl;
          summe.offenVorgaenge += 1;
        }

        return summe;
      },
      { offen: 0, archiv: 0, offenVorgaenge: 0, archivVorgaenge: 0 }
    );
  }, [fahrzeugverhandlungen]);

  const gefilterteFahrzeugverhandlungen = useMemo(() => {
    const suchbegriff = fahrzeugSuche.trim().toLowerCase();

    const filtern = (archiviertGesucht) =>
      [...fahrzeugverhandlungen]
        .filter(
          (eintrag) =>
            fahrzeugStatusIstGeliefert(eintrag.status) === archiviertGesucht
        )
        .filter((eintrag) => {
          if (!suchbegriff) return true;

          const kopfText = [
            eintrag.firma,
            eintrag.beschreibung,
            eintrag.beschaffungsart,
            eintrag.status,
            eintrag.ansprechpartner,
            eintrag.notizen,
            lieferterminAnzeige(eintrag, "gewuenschterLiefertermin"),
            lieferterminAnzeige(eintrag, "voraussichtlicherLiefertermin"),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const fahrzeugText = (eintrag.fahrzeuge || [])
            .map((fahrzeug) =>
              [
                fahrzeug.hersteller,
                fahrzeug.modell,
                fahrzeug.ausstattung,
                fahrzeug.kennzeichenOderReferenz,
              ]
                .filter(Boolean)
                .join(" ")
            )
            .join(" ")
            .toLowerCase();

          return (
            kopfText.includes(suchbegriff) ||
            fahrzeugText.includes(suchbegriff)
          );
        })
        .map((eintrag) => ({
          ...eintrag,
          sichtbareFahrzeuge: eintrag.fahrzeuge || [],
        }))
        .sort((a, b) =>
          lieferterminSortierwert(a, "gewuenschterLiefertermin").localeCompare(
            lieferterminSortierwert(b, "gewuenschterLiefertermin")
          )
        );

    return {
      offen: filtern(false),
      archiv: filtern(true),
    };
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
        skonto: vorher.skonto || (prozentWert(ausgewaehlt?.skonto) || ""),
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
    setVerhandlungsBasisPhase(null);
    setFehler("");
    setVerhandlungsDialogOffen(true);
  }

  function verhandlungBearbeitenOeffnen(eintrag, phase = null) {
    const basisDaten = phase?.daten ?? eintrag;
    setVerhandlungsFormular(verhandlungsFormularAusDaten(basisDaten));
    setVerhandlungsBearbeitungsId(eintrag.id);
    setVerhandlungsBasisPhase(phase?.nummer ?? null);
    setFehler("");
    setVerhandlungsDialogOffen(true);
  }

  async function verhandlungsphaseLoeschen(eintrag, phase) {
    const phasen = gespeicherteVerhandlungsphasen(eintrag);
    if (phasen.length <= 1) {
      setFehler("Die einzige Verhandlungsphase kann nicht einzeln gelöscht werden. Bitte bei Bedarf die gesamte Verhandlung löschen.");
      return;
    }

    if (!window.confirm(`${phaseBezeichnung(phase.nummer)} wirklich löschen? Die verbleibenden Phasen werden anschließend neu nummeriert.`)) {
      return;
    }

    const verbleibendePhasen = phasen
      .filter((eintragPhase) => eintragPhase.nummer !== phase.nummer)
      .map((eintragPhase, index) => ({
        ...eintragPhase,
        nummer: index + 1,
      }));
    const letztePhase = verbleibendePhasen.at(-1);
    if (!letztePhase) return;

    const aktuellerStand = verhandlungsPhaseDaten(letztePhase.daten);
    const status = statusNormalisieren(aktuellerStand.status);
    const istBeendet = istAbgeschlossenerStatus(status);
    const vorhandeneFrist = timestampZuDatum(eintrag?.dokumentLoeschdatum);
    const dokumentLoeschdatum = istBeendet
      ? (vorhandeneFrist || addiereTage(new Date()))
      : null;

    const aktualisierung = {
      ...aktuellerStand,
      status,
      betragNachSkonto: betragNachSkonto(aktuellerStand),
      verhandlungsphasen: verbleibendePhasen,
      aktuelleVerhandlungsphase: letztePhase.nummer,
      geaendertAm: serverTimestamp(),
    };

    if (istBeendet) {
      aktualisierung.abgeschlossenAm = eintrag.abgeschlossenAm || serverTimestamp();
      aktualisierung.dokumentLoeschdatum = Timestamp.fromDate(dokumentLoeschdatum);
    } else {
      aktualisierung.abgeschlossenAm = deleteField();
      aktualisierung.dokumentLoeschdatum = deleteField();
    }

    try {
      await updateDoc(doc(db, "verhandlungen", eintrag.id), aktualisierung);
      await dokumentFristenSynchronisieren(eintrag.id, dokumentLoeschdatum);

      if (verhandlungsBearbeitungsId === eintrag.id) {
        setVerhandlungsDialogOffen(false);
        setVerhandlungsFormular(leerVerhandlungsFormular);
        setVerhandlungsBearbeitungsId(null);
        setVerhandlungsBasisPhase(null);
      }
      setFehler("");
    } catch (error) {
      console.error(error);
      setFehler("Die Verhandlungsphase konnte nicht gelöscht werden.");
    }
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

    const status = statusNormalisieren(verhandlungsFormular.status);
    const istBeendet = istAbgeschlossenerStatus(status);
    const bisherigerEintrag = verhandlungen.find(
      (eintrag) => eintrag.id === verhandlungsBearbeitungsId
    );
    const vorhandeneFrist = timestampZuDatum(bisherigerEintrag?.dokumentLoeschdatum);
    const dokumentLoeschdatum = istBeendet
      ? (vorhandeneFrist || addiereTage(new Date()))
      : null;

    const neuerVerhandlungsgegenstand =
      verhandlungsFormular.verhandlungsgegenstand.trim();

    const daten = {
      ...verhandlungsFormular,
      status,
      firma: verhandlungsFormular.firma.trim(),
      kategorie: String(verhandlungsFormular.kategorie || "").trim() || "Sonstiges",
      auftraggeberName: verhandlungsFormular.auftraggeberName.trim(),
      verhandlungsgegenstand: neuerVerhandlungsgegenstand,
      vereinbarungen: String(verhandlungsFormular.vereinbarungen || "").trim(),
      vereinbarungenEinsparung: euroWert(verhandlungsFormular.vereinbarungenEinsparung),
      notizen: cleanRichTextForStorage(verhandlungsFormular.notizen),
      userId: benutzer.uid,
      ausgangsangebot: euroWert(verhandlungsFormular.ausgangsangebot),
      aktuellesAngebot: euroWert(verhandlungsFormular.aktuellesAngebot),
      skonto: prozentWert(verhandlungsFormular.skonto),
      betragNachSkonto: betragNachSkonto(verhandlungsFormular),
      zielpreis: euroWert(verhandlungsFormular.zielpreis),
      schmerzgrenze: euroWert(verhandlungsFormular.schmerzgrenze),
      liefertermin:
        verhandlungsFormular.lieferterminArt === "datum"
          ? verhandlungsFormular.lieferterminDatum
          : "",
      angeliefert: verhandlungsFormular.angeliefert === true,
      geaendertAm: serverTimestamp(),
    };

    const neuePhaseDaten = verhandlungsPhaseDaten(daten);

    if (verhandlungsBearbeitungsId && bisherigerEintrag && verhandlungsBasisPhase) {
      const vorhandenePhasen = gespeicherteVerhandlungsphasen(bisherigerEintrag);
      const phaseVorhanden = vorhandenePhasen.some(
        (phase) => phase.nummer === Number(verhandlungsBasisPhase)
      );

      if (!phaseVorhanden) {
        setSpeichert(false);
        setFehler("Die ausgewählte Verhandlungsphase wurde nicht gefunden.");
        return;
      }

      const aktualisiertePhasen = vorhandenePhasen.map((phase) =>
        phase.nummer === Number(verhandlungsBasisPhase)
          ? { ...phase, bearbeitetAm: Timestamp.now(), daten: neuePhaseDaten }
          : phase
      );
      const aktuelleNummer = aktuelleVerhandlungsphaseNummer(bisherigerEintrag);
      const bearbeitetAktuellePhase = Number(verhandlungsBasisPhase) === aktuelleNummer;

      try {
        if (bearbeitetAktuellePhase) {
          daten.verhandlungsphasen = aktualisiertePhasen;
          daten.aktuelleVerhandlungsphase = aktuelleNummer;

          if (istBeendet) {
            daten.abgeschlossenAm = bisherigerEintrag?.abgeschlossenAm || serverTimestamp();
            daten.dokumentLoeschdatum = Timestamp.fromDate(dokumentLoeschdatum);
          } else {
            daten.abgeschlossenAm = deleteField();
            daten.dokumentLoeschdatum = deleteField();
          }

          await updateDoc(
            doc(db, "verhandlungen", verhandlungsBearbeitungsId),
            daten
          );
          await dokumentFristenSynchronisieren(
            verhandlungsBearbeitungsId,
            dokumentLoeschdatum
          );
        } else {
          await updateDoc(
            doc(db, "verhandlungen", verhandlungsBearbeitungsId),
            {
              verhandlungsphasen: aktualisiertePhasen,
              geaendertAm: serverTimestamp(),
            }
          );
        }

        setVerhandlungsDialogOffen(false);
        setVerhandlungsFormular(leerVerhandlungsFormular);
        setVerhandlungsBearbeitungsId(null);
        setVerhandlungsBasisPhase(null);
        setFehler("");
      } catch (error) {
        console.error(error);
        setFehler("Die Verhandlungsphase konnte nicht gespeichert werden.");
      } finally {
        setSpeichert(false);
      }
      return;
    }

    if (verhandlungsBearbeitungsId && bisherigerEintrag) {
      const vorhandenePhasen = gespeicherteVerhandlungsphasen(bisherigerEintrag);
      const aktuellerStand = verhandlungsPhaseDaten(bisherigerEintrag);
      const wurdeGeaendert = !phasenDatenSindGleich(aktuellerStand, neuePhaseDaten);

      if (wurdeGeaendert) {
        const phasenMitAusgangsstand = vorhandenePhasen.length > 0
          ? vorhandenePhasen
          : [
              {
                nummer: 1,
                gespeichertAm:
                  bisherigerEintrag.erstelltAm ||
                  bisherigerEintrag.geaendertAm ||
                  Timestamp.now(),
                daten: aktuellerStand,
              },
            ];
        const naechsteNummer =
          Math.max(...phasenMitAusgangsstand.map((phase) => phase.nummer), 0) + 1;

        daten.verhandlungsphasen = [
          ...phasenMitAusgangsstand,
          {
            nummer: naechsteNummer,
            gespeichertAm: Timestamp.now(),
            daten: neuePhaseDaten,
          },
        ];
        daten.aktuelleVerhandlungsphase = naechsteNummer;
      }
    } else {
      daten.verhandlungsphasen = [
        {
          nummer: 1,
          gespeichertAm: Timestamp.now(),
          daten: neuePhaseDaten,
        },
      ];
      daten.aktuelleVerhandlungsphase = 1;
    }

    if (istBeendet) {
      daten.abgeschlossenAm = bisherigerEintrag?.abgeschlossenAm || serverTimestamp();
      daten.dokumentLoeschdatum = Timestamp.fromDate(dokumentLoeschdatum);
    } else if (verhandlungsBearbeitungsId) {
      daten.abgeschlossenAm = deleteField();
      daten.dokumentLoeschdatum = deleteField();
    }

    try {
      let gespeicherteId = verhandlungsBearbeitungsId;
      if (verhandlungsBearbeitungsId) {
        await updateDoc(
          doc(db, "verhandlungen", verhandlungsBearbeitungsId),
          daten
        );
      } else {
        const ref = await addDoc(collection(db, "verhandlungen"), {
          ...daten,
          erstelltAm: serverTimestamp(),
        });
        gespeicherteId = ref.id;
      }

      await dokumentFristenSynchronisieren(
        gespeicherteId,
        dokumentLoeschdatum
      );

      setVerhandlungsDialogOffen(false);
      setVerhandlungsFormular(leerVerhandlungsFormular);
      setVerhandlungsBearbeitungsId(null);
      setVerhandlungsBasisPhase(null);

      if (daten.angeliefert) {
        setStatusFilter("Alle");
        setVerhandlungenArchivAufgeklappt(true);
        window.setTimeout(() => {
          verhandlungenArchivRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 250);
      }
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
      firma: lieferantenFormular.firma.trim(),
      kategorie: String(lieferantenFormular.kategorie || "").trim() || "Sonstiges",
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
      await alleDokumenteLoeschen("verhandlung", eintrag.id);
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
      { bezeichnung: "Verhandelter Betrag", wert: verhandlungsFormular.aktuellesAngebot },
      { bezeichnung: "Betrag nach Skonto", wert: betragNachSkonto(verhandlungsFormular) },
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
        { bezeichnung: "Verhandelter Betrag", wert: eintrag.aktuellesAngebot },
        { bezeichnung: "Betrag nach Skonto", wert: betragNachSkonto(eintrag) },
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
      ...lieferterminFormularwerte(eintrag, "gewuenschterLiefertermin"),
      ...lieferterminFormularwerte(eintrag, "voraussichtlicherLiefertermin"),
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

  async function fahrzeugVorhabenWiederherstellen(eintrag) {
    setFahrzeugStatusWirdGespeichert(eintrag.id);
    setFehler("");

    try {
      await updateDoc(doc(db, "fahrzeugverhandlungen", eintrag.id), {
        status: "Offen",
        geaendertAm: serverTimestamp(),
      });
      setFahrzeugverhandlungen((aktuell) =>
        aktuell.map((item) =>
          item.id === eintrag.id
            ? { ...item, status: "Offen", geaendertAm: new Date() }
            : item
        )
      );
      setFahrzeugOffenAufgeklappt(true);
    } catch (error) {
      console.error(error);
      setFehler(
        "Die Fahrzeugverhandlung konnte nicht wiederhergestellt werden. Bitte Firestore-Regeln prüfen."
      );
    } finally {
      setFahrzeugStatusWirdGespeichert("");
    }
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
      status: String(fahrzeugFormular.status || "Offen").trim(),
      fahrzeuge,
      leasingrate: euroWert(fahrzeugFormular.leasingrate),
      kaufpreis: euroWert(fahrzeugFormular.kaufpreis),
      sonderzahlung: euroWert(fahrzeugFormular.sonderzahlung),
      gewuenschterLiefertermin:
        fahrzeugFormular.gewuenschterLieferterminArt === "datum"
          ? fahrzeugFormular.gewuenschterLieferterminDatum
          : "",
      voraussichtlicherLiefertermin:
        fahrzeugFormular.voraussichtlicherLieferterminArt === "datum"
          ? fahrzeugFormular.voraussichtlicherLieferterminDatum
          : "",
      userId: benutzer.uid,
      geaendertAm: serverTimestamp(),
    };

    try {
      if (fahrzeugBearbeitungsId) {
        await updateDoc(
          doc(db, "fahrzeugverhandlungen", fahrzeugBearbeitungsId),
          daten
        );
        setFahrzeugverhandlungen((aktuell) =>
          aktuell.map((eintrag) =>
            eintrag.id === fahrzeugBearbeitungsId
              ? { ...eintrag, ...daten, geaendertAm: new Date() }
              : eintrag
          )
        );
      } else {
        const ref = await addDoc(collection(db, "fahrzeugverhandlungen"), {
          ...daten,
          erstelltAm: serverTimestamp(),
        });
        setFahrzeugverhandlungen((aktuell) => [
          ...aktuell,
          {
            id: ref.id,
            ...daten,
            erstelltAm: new Date(),
            geaendertAm: new Date(),
          },
        ]);
      }

      if (fahrzeugStatusIstGeliefert(daten.status)) {
        setFahrzeugArchivAufgeklappt(true);
      } else {
        setFahrzeugOffenAufgeklappt(true);
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
      .filter((eintrag) => {
        const status = statusNormalisieren(eintrag.status);
        return status === "Offen" || status === "In Verhandlung";
      })
      .sort((a, b) => String(a.wiedervorlage || "9999-12-31").localeCompare(String(b.wiedervorlage || "9999-12-31")));
    const erledigt = verhandlungen
      .filter((eintrag) => statusIstAbgeschlossen(eintrag.status))
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

  function htmlSicherMitZeilenumbruechen(value) {
    return htmlSicher(value).replace(/\r?\n/g, "<br>");
  }

  function uebergabeAlsPdfDrucken() {
    const auswahl = uebergabeVerhandlungen.filter((eintrag) => uebergabeAuswahl.includes(eintrag.id));
    if (!auswahl.length) return;
    const zeilen = auswahl.map((eintrag) => `
      <tr>
        <td>${htmlSicher(eintrag.status)}<br><small>${htmlSicher(eintrag.verhandlungstag ? datumFormat(eintrag.verhandlungstag) : "Kein Verhandlungstag")}</small></td>
        <td><small>Für: ${htmlSicher(eintrag.auftraggeberName || "—")}</small><br><strong>${htmlSicher(eintrag.firma)}</strong><br>${htmlSicher(eintrag.verhandlungsgegenstand || "Kein Gegenstand hinterlegt")}${eintrag.vereinbarungen ? `<br><small><strong>Vereinbarungen:</strong> ${htmlSicherMitZeilenumbruechen(eintrag.vereinbarungen)}</small>` : ""}</td>
        <td><strong>${htmlSicher(eintrag.ansprechpartner || "—")}</strong><br><small>${htmlSicher(eintrag.telefon || "Keine Telefonnummer")}<br>${htmlSicher(eintrag.email || "Keine E-Mail")}</small></td>
        <td>${htmlSicher(lieferterminAnzeige(eintrag))}</td>
        <td>${htmlSicher(eintrag.wiedervorlage ? datumFormat(eintrag.wiedervorlage) : "—")}</td>
        <td>${htmlSicher(euroFormat(eintrag.aktuellesAngebot))}<br><small>Skonto: ${htmlSicher(prozentFormat(prozentWert(eintrag.skonto)))} · nach Skonto: ${htmlSicher(euroFormat(betragNachSkonto(eintrag)))}</small><br><small>Nachlass: ${htmlSicher(euroFormat(nachlassEinsparung(eintrag)))} · Vereinbarungen: ${htmlSicher(euroFormat(vereinbarungenEinsparungWert(eintrag)))}</small><br><strong>Gesamtersparnis: ${htmlSicher(euroFormat(einsparung(eintrag)))}</strong></td>
        <td>${htmlSicherMitZeilenumbruechen(richTextToPlainText(eintrag.notizen) || "—")}</td>
      </tr>`).join("");
    const druckHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Urlaubsübergabe Verhandlungen</title><style>body{font-family:Arial,sans-serif;color:#172033;margin:28px}h1{margin:0 0 6px}.meta{color:#667085;margin-bottom:22px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #d0d5dd;padding:8px;vertical-align:top;text-align:left}th{background:#f2f4f7}tr{page-break-inside:avoid}@page{size:landscape;margin:10mm}@media print{body{margin:0}}</style></head><body><h1>Urlaubsübergabe – Verhandlungen</h1><div class="meta">Erstellt am ${new Date().toLocaleString("de-DE")} · ${auswahl.length} ausgewählte Verhandlung(en)</div><table><thead><tr><th>Status</th><th>Firma / Gegenstand</th><th>Ansprechpartner / Kontakt</th><th>Liefertermin</th><th>Wiedervorlage</th><th>Aktueller Stand</th><th>Notizen</th></tr></thead><tbody>${zeilen}</tbody></table></body></html>`;

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

  function zuVerhandlungenSpringen(filter) {
    setAnsicht("verhandlungen");
    setSuche("");
    setAuftraggeberFilter("Alle");
    setPrioritaetFilter("Alle");
    setStatusFilter(filter);
    setVerhandlungenArchivAufgeklappt(false);
    if (filter === "Abgeschlossen") {
      verhandlungsGruppeSetzen("Abgeschlossen", true);
    } else if (filter === "Aktiv") {
      verhandlungsGruppeSetzen("Offen", true);
      verhandlungsGruppeSetzen("In Verhandlung", true);
    } else if (["Offen", "In Verhandlung"].includes(filter)) {
      verhandlungsGruppeSetzen(filter, true);
    }

    window.setTimeout(() => {
      verhandlungenListeRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function statusFarbe(status) {
    const normalisiert = statusNormalisieren(status);
    if (normalisiert === "Abgeschlossen" || normalisiert === "Geliefert") return "success";
    if (normalisiert === "Offen" || normalisiert === "Abgebrochen") return "error";
    if (normalisiert === "In Verhandlung" || normalisiert === "Bestellt") return "warning";
    return "info";
  }

  const karten = [
    {
      titel: "Offene Verhandlungen",
      wert: kennzahlen.offen,
      icon: <HandshakeIcon fontSize="large" />,
      filter: "Aktiv",
    },
    {
      titel: "Abgeschlossen",
      wert: kennzahlen.abgeschlossen,
      icon: <EmojiEventsIcon fontSize="large" />,
      filter: "Abgeschlossen",
    },
    {
      titel: "Gesamte Einsparung",
      wert: euroFormat(kennzahlen.gesamtEinsparung),
      zusatz: `Gesamtvolumen: ${euroFormat(kennzahlen.ausgangsVolumen)}`,
      icon: <SavingsIcon fontSize="large" />,
    },
    {
      titel: "Fällige Wiedervorlagen",
      wert: kennzahlen.faellig,
      icon: <EventNoteIcon fontSize="large" />,
    },
  ];


  function fahrzeugVorhabenListe(eintraege, leertext, archiviert = false) {
    return (
      <Stack spacing={1.5}>
        {eintraege.map((eintrag) => (
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
                  Erwartet: {lieferterminAnzeige(eintrag, "voraussichtlicherLiefertermin") === "—" ? "nicht bekannt" : lieferterminAnzeige(eintrag, "voraussichtlicherLiefertermin")}
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}><Typography variant="caption" color="text.secondary">Bestelltermin</Typography><Typography fontWeight={700}>{eintrag.bestelltermin ? datumFormat(eintrag.bestelltermin) : "—"}</Typography></Grid>
                <Grid size={{ xs: 12, md: 3 }}><Typography variant="caption" color="text.secondary">Gewünschter Liefertermin</Typography><Typography fontWeight={700}>{lieferterminAnzeige(eintrag, "gewuenschterLiefertermin")}</Typography></Grid>
                <Grid size={{ xs: 12, md: 3 }}><Typography variant="caption" color="text.secondary">Voraussichtlicher Liefertermin</Typography><Typography fontWeight={700}>{lieferterminAnzeige(eintrag, "voraussichtlicherLiefertermin")}</Typography></Grid>
                <Grid size={{ xs: 12, md: 3 }}><Typography variant="caption" color="text.secondary">Ansprechpartner</Typography><Typography fontWeight={700}>{eintrag.ansprechpartner || "—"}</Typography></Grid>
              </Grid>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={1}>
                {(eintrag.fahrzeuge || []).map((fahrzeug, index) => (
                  <Paper key={fahrzeug.id || `${eintrag.id}-${index}`} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} gap={1}>
                      <Box>
                        <Typography fontWeight={800}>
                          {fahrzeug.hersteller || "Hersteller offen"} {fahrzeug.modell || ""}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {fahrzeug.ausstattung || "Keine Ausstattung hinterlegt"}
                          {" · "}Anzahl: {fahrzeug.anzahl || 1}
                          {fahrzeug.kennzeichenOderReferenz ? ` · ${fahrzeug.kennzeichenOderReferenz}` : ""}
                        </Typography>
                      </Box>
                      <Box textAlign={{ xs: "left", md: "right" }}>
                        <Typography variant="body2">Listenpreis: {euroFormat(fahrzeug.listenpreis)}</Typography>
                        <Typography fontWeight={800}>Angebot: {euroFormat(fahrzeug.angebotspreis)}</Typography>
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
              {(eintrag.leasingrate || eintrag.kaufpreis || eintrag.sonderzahlung) ? <Paper variant="outlined" sx={{ p: 1.5, mt: 2 }}><Stack direction={{ xs: "column", sm: "row" }} spacing={3}><Typography>Leasingrate: <strong>{euroFormat(eintrag.leasingrate)}</strong></Typography><Typography>Kaufpreis: <strong>{euroFormat(eintrag.kaufpreis)}</strong></Typography><Typography>Sonderzahlung: <strong>{euroFormat(eintrag.sonderzahlung)}</strong></Typography></Stack></Paper> : null}
              {eintrag.notizen && <Typography sx={{ mt: 2, whiteSpace: "pre-wrap" }}>{eintrag.notizen}</Typography>}
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="flex-end" spacing={1} mt={2}>
                {archiviert && (
                  <Button
                    variant="outlined"
                    onClick={() => fahrzeugVorhabenWiederherstellen(eintrag)}
                    disabled={fahrzeugStatusWirdGespeichert === eintrag.id}
                  >
                    {fahrzeugStatusWirdGespeichert === eintrag.id
                      ? "Wird wiederhergestellt..."
                      : "Wiederherstellen"}
                  </Button>
                )}
                <Button startIcon={<EditIcon />} onClick={() => fahrzeugVorhabenBearbeiten(eintrag)}>Bearbeiten</Button>
                <Button color="error" startIcon={<DeleteIcon />} onClick={() => fahrzeugVorhabenLoeschen(eintrag)}>Löschen</Button>
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}
        {!eintraege.length && <Alert severity="info">{leertext}</Alert>}
      </Stack>
    );
  }

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
              <Card><CardContent><Typography color="text.secondary" fontWeight={700}>Offene Fahrzeugverhandlungen</Typography><Typography variant="h4" fontWeight={800}>{fahrzeugZaehler.offenVorgaenge}</Typography></CardContent></Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card><CardContent><Typography color="text.secondary" fontWeight={700}>Geliefert / Archiv</Typography><Typography variant="h4" fontWeight={800}>{fahrzeugZaehler.archivVorgaenge}</Typography></CardContent></Card>
            </Grid>
          </Grid>

          <Paper sx={{ p: 2, mb: 2 }}>
            <TextField
              fullWidth
              label="Fahrzeuge suchen"
              placeholder="Händler, Hersteller, Modell, Ausstattung oder Referenz"
              value={fahrzeugSuche}
              onChange={(event) => setFahrzeugSuche(event.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
            />
          </Paper>

          <Stack spacing={2}>
            <Accordion
              disableGutters
              expanded={fahrzeugOffenAufgeklappt}
              onChange={(_, aufgeklappt) =>
                setFahrzeugOffenAufgeklappt(aufgeklappt)
              }
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box>
                  <Typography fontWeight={850}>
                    Offen ({fahrzeugZaehler.offenVorgaenge})
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Alle Fahrzeugverhandlungen ausser Status Geliefert
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {fahrzeugVorhabenListe(
                  gefilterteFahrzeugverhandlungen.offen,
                  "Keine offenen Fahrzeugverhandlungen gefunden."
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion
              disableGutters
              expanded={fahrzeugArchivAufgeklappt}
              onChange={(_, aufgeklappt) =>
                setFahrzeugArchivAufgeklappt(aufgeklappt)
              }
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box>
                  <Typography fontWeight={850}>
                    Archiv / Geliefert ({fahrzeugZaehler.archivVorgaenge})
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Ausschliesslich Fahrzeugverhandlungen mit Status Geliefert
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {fahrzeugVorhabenListe(
                  gefilterteFahrzeugverhandlungen.archiv,
                  "Keine gelieferten Fahrzeugverhandlungen gefunden.",
                  true
                )}
              </AccordionDetails>
            </Accordion>
          </Stack>
        </>
      ) : ansicht === "verhandlungen" ? (
        <>
          <Grid container spacing={2} mb={3}>
            {karten.map((karte) => (
              <Grid size={{ xs: 12, sm: 6, xl: 3 }} key={karte.titel}>
                <Card
                  onClick={
                    karte.filter
                      ? () => zuVerhandlungenSpringen(karte.filter)
                      : undefined
                  }
                  onKeyDown={(event) => {
                    if (!karte.filter) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      zuVerhandlungenSpringen(karte.filter);
                    }
                  }}
                  role={karte.filter ? "button" : undefined}
                  tabIndex={karte.filter ? 0 : undefined}
                  sx={{
                    height: "100%",
                    cursor: karte.filter ? "pointer" : "default",
                    transition: "transform 150ms ease, box-shadow 150ms ease",
                    "&:hover": karte.filter
                      ? {
                          transform: "translateY(-2px)",
                          boxShadow: 5,
                        }
                      : undefined,
                    "&:focus-visible": karte.filter
                      ? {
                          outline: "3px solid",
                          outlineColor: "primary.main",
                          outlineOffset: 2,
                        }
                      : undefined,
                  }}
                >
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
                  placeholder="Auftraggeber, Lieferant, Gegenstand, Vereinbarungen, Ansprechpartner oder Notiz"
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
                  <MenuItem value="Aktiv">Offen &amp; in Verhandlung</MenuItem>
                  <MenuItem value="Offen">Nur Offen</MenuItem>
                  <MenuItem value="In Verhandlung">Nur In Verhandlung</MenuItem>
                  <MenuItem value="Abgeschlossen">Abgeschlossen</MenuItem>
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

          <Box ref={verhandlungenListeRef} sx={{ scrollMarginTop: 24 }}>
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
          ) : (
            <Stack spacing={1.5}>
              {verhandlungsGruppen.map((gruppe) => (
                <Accordion
                  key={gruppe.status}
                  disableGutters
                  expanded={verhandlungsGruppenAufgeklappt[gruppe.status] !== false}
                  onChange={(_, aufgeklappt) =>
                    verhandlungsGruppeSetzen(gruppe.status, aufgeklappt)
                  }
                  variant="outlined"
                  sx={{
                    border: "2px solid",
                    borderColor: statusRahmenFarbe(gruppe.status),
                    borderRadius: "14px !important",
                    overflow: "hidden",
                    "&:before": { display: "none" },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      bgcolor: "action.hover",
                      px: { xs: 1.5, md: 2 },
                      "& .MuiAccordionSummary-content": {
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                      },
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{ minWidth: 0 }}
                    >
                      <Typography fontWeight={900}>{gruppe.status}</Typography>
                      <Chip
                        size="small"
                        color={statusFarbe(gruppe.status)}
                        label={gruppe.eintraege.length}
                      />
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: { xs: "none", sm: "block" }, pr: 1 }}
                    >
                      {gruppe.eintraege.length === 1
                        ? "1 Verhandlung"
                        : `${gruppe.eintraege.length} Verhandlungen`}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: { xs: 1, md: 1.5 } }}>
                    {istMobil ? (
            <Stack spacing={1.5}>
              {gruppe.eintraege.map((eintrag) => (
                <Accordion
                  key={eintrag.id}
                  disableGutters
                  variant="outlined"
                  sx={{
                    border: "2px solid",
                    borderColor: statusRahmenFarbe(eintrag.status),
                    borderRadius: "12px !important",
                    overflow: "hidden",
                    "&:before": { display: "none" },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "stretch", minWidth: 0 }}>
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{
                        flexGrow: 1,
                        minWidth: 0,
                        px: 1.5,
                        py: 0.25,
                        "& .MuiAccordionSummary-content": {
                          my: 1,
                          minWidth: 0,
                        },
                      }}
                    >
                      <Box sx={{ minWidth: 0, width: "100%", pr: 1 }}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        spacing={1}
                      >
                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Typography variant="h6" fontWeight={800} noWrap>
                            {eintrag.firma}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            noWrap
                            sx={{ mt: 0.15 }}
                          >
                            {eintrag.verhandlungsgegenstand || "Kein Verhandlungsgegenstand"}
                          </Typography>
                        </Box>
                        <Chip
                          label={statusNormalisieren(eintrag.status)}
                          color={statusFarbe(eintrag.status)}
                          size="small"
                          sx={{ flexShrink: 0 }}
                        />
                      </Stack>

                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        spacing={1}
                        sx={{ mt: 0.75 }}
                      >
                        <Typography variant="caption" color="text.secondary" noWrap>
                          Für {eintrag.auftraggeberName || "keine Firma zugeordnet"}
                          {" · "}{phaseBezeichnung(aktuelleVerhandlungsphaseNummer(eintrag))}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="success.main"
                          fontWeight={800}
                          sx={{ flexShrink: 0 }}
                        >
                          {euroFormat(einsparung(eintrag))}
                        </Typography>
                      </Stack>
                      </Box>
                    </AccordionSummary>
                    <DirektesVerhandlungsPdf verhandlungId={eintrag.id} />
                  </Box>

                  <AccordionDetails sx={{ px: 1.5, pt: 0, pb: 1.5 }}>
                    <Divider sx={{ mb: 1.5 }} />

                    <Stack
                      direction="row"
                      justifyContent="flex-end"
                      spacing={0.5}
                      sx={{ mb: 1 }}
                    >
                      <Tooltip title="Ersparnis berechnen">
                        <IconButton
                          size="small"
                          onClick={() => eintragRechnerOeffnen(eintrag)}
                        >
                          <CalculateIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Bearbeiten">
                        <IconButton
                          size="small"
                          onClick={() => verhandlungBearbeitenOeffnen(eintrag)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Löschen">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => verhandlungLoeschen(eintrag)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>

                    <Typography color="text.secondary">
                      {eintrag.ansprechpartner || "Kein Ansprechpartner"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Verhandlungstag: {datumFormat(eintrag.verhandlungstag)}
                    </Typography>

                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        mt: 1.5,
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

                    {(eintrag.vereinbarungen || vereinbarungenEinsparungWert(eintrag) > 0) && (
                      <Paper variant="outlined" sx={{ p: 1.5, mt: 1.5, bgcolor: "success.50" }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={700}>
                          Vereinbarungen / Zugaben / Kontingente
                        </Typography>
                        <Typography sx={{ mt: 0.25, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                          {eintrag.vereinbarungen || "Keine Beschreibung hinterlegt"}
                        </Typography>
                        <Typography variant="body2" color="success.main" fontWeight={800} sx={{ mt: 0.75 }}>
                          Einsparung / Gegenwert: {euroFormat(vereinbarungenEinsparungWert(eintrag))}
                        </Typography>
                      </Paper>
                    )}

                    <VerhandlungsphasenHistorie
                      eintrag={eintrag}
                      onPhaseBearbeiten={(phase) => verhandlungBearbeitenOeffnen(eintrag, phase)}
                      onPhaseLoeschen={(phase) => verhandlungsphaseLoeschen(eintrag, phase)}
                    />

                    {eintrag.notizen && (
                      <Paper variant="outlined" sx={{ p: 1.5, mt: 1.5 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={700}
                        >
                          Notizen
                        </Typography>
                        <RichTextContent
                          value={eintrag.notizen}
                          sx={{ mt: 0.25, fontSize: "0.875rem" }}
                        />
                      </Paper>
                    )}

                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      mt={2}
                      useFlexGap
                    >
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
                          Verhandelt
                        </Typography>
                        <Typography fontWeight={700}>
                          {euroFormat(eintrag.aktuellesAngebot)}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Nach Skonto ({prozentFormat(prozentWert(eintrag.skonto))})
                        </Typography>
                        <Typography fontWeight={800} color="primary.main">
                          {euroFormat(betragNachSkonto(eintrag))}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Nachlass inkl. Skonto
                        </Typography>
                        <Typography fontWeight={800}>
                          {euroFormat(nachlassEinsparung(eintrag))}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Vereinbarungen / Zugaben
                        </Typography>
                        <Typography fontWeight={800}>
                          {euroFormat(vereinbarungenEinsparungWert(eintrag))}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="caption" color="text.secondary">
                          Gesamtersparnis
                        </Typography>
                        <Typography fontWeight={900} color="success.main">
                          {euroFormat(einsparung(eintrag))}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Liefertermin
                        </Typography>
                        <Typography fontWeight={700} sx={{ mb: 0.75 }}>
                          {lieferterminAnzeige(eintrag)}
                        </Typography>
                        <LieferstatusChip angeliefert={eintrag.angeliefert} />
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
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
                    ) : (
            <TableContainer component={Paper} sx={{ width: "100%", overflowX: "hidden" }}>
              <Table
                stickyHeader
                size="small"
                sx={{
                  width: "100%",
                  tableLayout: "fixed",
                  "& .MuiTableCell-root": {
                    px: 0.75,
                    py: 1,
                    fontSize: "0.78rem",
                    lineHeight: 1.35,
                    verticalAlign: "top",
                    whiteSpace: "normal",
                    overflowWrap: "anywhere",
                  },
                  "& .MuiTableCell-head": {
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    lineHeight: 1.2,
                  },
                  "& .MuiChip-root": { maxWidth: "100%" },
                  "& .MuiChip-label": {
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  },
                }}
              >
                <colgroup>
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "11%" }} />
                </colgroup>
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
                    <TableCell align="right">Verhandelt</TableCell>
                    <TableCell align="right">Gesamtersparnis</TableCell>
                    <TableCell>Liefertermin</TableCell>
                    <TableCell>Wiedervorlage</TableCell>
                    <TableCell align="right">Aktionen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gruppe.eintraege.map((eintrag) => (
                    <TableRow
                      hover
                      key={eintrag.id}
                      sx={{
                        "& > .MuiTableCell-root": {
                          borderTop: "2px solid",
                          borderBottom: "2px solid",
                          borderColor: statusRahmenFarbe(eintrag.status),
                        },
                        "& > .MuiTableCell-root:first-of-type": {
                          borderLeft: "2px solid",
                          borderColor: statusRahmenFarbe(eintrag.status),
                        },
                        "& > .MuiTableCell-root:last-of-type": {
                          borderRight: "2px solid",
                          borderColor: statusRahmenFarbe(eintrag.status),
                        },
                      }}
                    >
                      <TableCell><Typography fontWeight={700}>{eintrag.auftraggeberName || "—"}</Typography></TableCell>
                      <TableCell>{datumFormat(eintrag.verhandlungstag)}</TableCell>
                      <TableCell>
                        <Typography fontWeight={700}>
                          {eintrag.firma}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {eintrag.kategorie}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          {phaseBezeichnung(aktuelleVerhandlungsphaseNummer(eintrag))}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ overflowWrap: "anywhere" }}>
                        <Typography
                          fontWeight={700}
                          sx={{
                            whiteSpace: "normal",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {eintrag.verhandlungsgegenstand || "—"}
                        </Typography>
                        {(gespeicherteVerhandlungsphasen(eintrag).length > 1 || verhandlungsgegenstandHistorie(eintrag).length > 0) && (
                          <Button
                            size="small"
                            variant="text"
                            sx={{ mt: 0.5, px: 0, minWidth: 0 }}
                            onClick={() => verhandlungBearbeitenOeffnen(eintrag)}
                          >
                            Verhandlungsphasen ansehen
                          </Button>
                        )}
                        {(eintrag.vereinbarungen || vereinbarungenEinsparungWert(eintrag) > 0) && (
                          <Box sx={{ mt: 0.75, pt: 0.75, borderTop: 1, borderColor: 'divider' }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={700}>
                              Vereinbarungen / Zugaben
                            </Typography>
                            {eintrag.vereinbarungen && (
                              <Typography variant="caption" sx={{ display: "block", whiteSpace: "normal", overflowWrap: "anywhere" }}>
                                {eintrag.vereinbarungen}
                              </Typography>
                            )}
                            <Typography variant="caption" color="success.main" fontWeight={800}>
                              + {euroFormat(vereinbarungenEinsparungWert(eintrag))}
                            </Typography>
                          </Box>
                        )}
                        {eintrag.notizen && (
                          <Box sx={{ mt: 0.75, pt: 0.75, borderTop: 1, borderColor: 'divider' }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={700}>
                              Notizen
                            </Typography>
                            <RichTextContent
                              value={eintrag.notizen}
                              sx={{ mt: 0.15, fontSize: '0.75rem', maxHeight: '6em', overflow: 'hidden' }}
                            />
                          </Box>
                        )}
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
                        <Typography fontWeight={700}>{euroFormat(eintrag.aktuellesAngebot)}</Typography>
                        <Typography variant="caption" color="primary.main" fontWeight={700}>
                          nach {prozentFormat(prozentWert(eintrag.skonto))} Skonto: {euroFormat(betragNachSkonto(eintrag))}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={900} color="success.main">
                          {euroFormat(einsparung(eintrag))}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          Nachlass: {euroFormat(nachlassEinsparung(eintrag))}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          Vereinbarungen: {euroFormat(vereinbarungenEinsparungWert(eintrag))}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                          {lieferterminAnzeige(eintrag)}
                        </Typography>
                        <LieferstatusChip angeliefert={eintrag.angeliefert} />
                      </TableCell>
                      <TableCell>
                        {datumFormat(eintrag.wiedervorlage)}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title="Ersparnis berechnen">
                          <IconButton size="small" onClick={() => eintragRechnerOeffnen(eintrag)}>
                            <CalculateIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Bearbeiten">
                          <IconButton
                            size="small"
                            onClick={() =>
                              verhandlungBearbeitenOeffnen(eintrag)
                            }
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Löschen">
                          <IconButton
                            size="small"
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
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          )}
          </Box>

          <Box
            ref={verhandlungenArchivRef}
            sx={{ mt: 3, scrollMarginTop: 24 }}
          >
            <Accordion
              disableGutters
              expanded={verhandlungenArchivAufgeklappt}
              onChange={(_, aufgeklappt) =>
                setVerhandlungenArchivAufgeklappt(aufgeklappt)
              }
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box>
                  <Typography fontWeight={850}>
                    Archiv / angeliefert ({archivVerhandlungenGesamt})
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Verhandlungen werden hierher verschoben, sobald „Angeliefert“ gesetzt ist.
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {gefilterteArchivVerhandlungen.length === 0 ? (
                  <Alert severity="info">
                    Keine angelieferten Verhandlungen für die aktuellen Filter gefunden.
                  </Alert>
                ) : (
                  <Stack spacing={1.5}>
                    {gefilterteArchivVerhandlungen.map((eintrag) => (
                      <Paper
                        key={eintrag.id}
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderWidth: 2,
                          borderColor: "success.main",
                        }}
                      >
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          justifyContent="space-between"
                          alignItems={{ xs: "stretch", md: "center" }}
                          spacing={2}
                        >
                          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              flexWrap="wrap"
                              useFlexGap
                            >
                              <Typography fontWeight={850}>
                                {eintrag.firma}
                              </Typography>
                              <Chip
                                size="small"
                                label={statusNormalisieren(eintrag.status)}
                                color={statusFarbe(eintrag.status)}
                              />
                              <LieferstatusChip angeliefert />
                            </Stack>
                            <Typography sx={{ mt: 0.75 }} fontWeight={700}>
                              {eintrag.verhandlungsgegenstand || "Kein Verhandlungsgegenstand"}
                            </Typography>
                            <VerhandlungsphasenHistorie
                              eintrag={eintrag}
                              compact
                              onPhaseBearbeiten={(phase) => verhandlungBearbeitenOeffnen(eintrag, phase)}
                              onPhaseLoeschen={(phase) => verhandlungsphaseLoeschen(eintrag, phase)}
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                              Für {eintrag.auftraggeberName || "keine Firma zugeordnet"}
                              {" · "}{phaseBezeichnung(aktuelleVerhandlungsphaseNummer(eintrag))}
                              {" · "}Liefertermin: {lieferterminAnzeige(eintrag)}
                              {" · "}Gesamtersparnis: {euroFormat(einsparung(eintrag))}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Bearbeiten / aus Archiv zurückholen">
                              <IconButton
                                onClick={() => verhandlungBearbeitenOeffnen(eintrag)}
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
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </AccordionDetails>
            </Accordion>
          </Box>
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
                        lieferant.ansprechpartner
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
                  {lieferantenKategorien.map((kategorie) => (
                    <MenuItem key={kategorie} value={kategorie}>{kategorie}</MenuItem>
                  ))}
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
            ? `Verhandlung bearbeiten${verhandlungsBasisPhase ? ` – ${phaseBezeichnung(verhandlungsBasisPhase)} direkt bearbeiten` : ""}`
            : "Neue Verhandlung anlegen"}
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Grid container spacing={2}>
            {verhandlungsBearbeitungsId && (() => {
              const eintrag = verhandlungen.find(
                (item) => item.id === verhandlungsBearbeitungsId
              );
              if (!eintrag) return null;
              const aktuelleNummer = aktuelleVerhandlungsphaseNummer(eintrag);
              return (
                <Grid size={{ xs: 12 }}>
                  <Alert severity={verhandlungsBasisPhase ? "warning" : "info"} sx={{ mb: 1.25 }}>
                    {verhandlungsBasisPhase
                      ? `${phaseBezeichnung(verhandlungsBasisPhase)} wird direkt nachträglich bearbeitet. Beim Speichern wird genau diese Phase aktualisiert und keine neue Phase erzeugt. Bei einer älteren Phase bleibt der aktuelle Endstand unverändert.`
                      : `Aktueller Stand: ${phaseBezeichnung(aktuelleNummer)}. Änderungen am normalen aktuellen Stand erzeugen weiterhin automatisch eine neue ${phaseBezeichnung(aktuelleNummer + 1)}.`}
                  </Alert>
                  <VerhandlungsphasenHistorie
                    eintrag={eintrag}
                    allePhasen
                    onPhaseBearbeiten={(phase) =>
                      verhandlungBearbeitenOeffnen(eintrag, phase)
                    }
                    onPhaseLoeschen={(phase) =>
                      verhandlungsphaseLoeschen(eintrag, phase)
                    }
                  />
                </Grid>
              );
            })()}
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
                helperText={
                  verhandlungsBearbeitungsId
                    ? "Wie bei allen Feldern erzeugt eine tatsächliche Änderung beim Speichern automatisch eine neue Verhandlungsphase."
                    : "Beschreibe kurz, worüber mit diesem Lieferanten verhandelt wird."
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                fullWidth
                label="Vereinbarungen / Zugaben / Kontingente"
                name="vereinbarungen"
                value={verhandlungsFormular.vereinbarungen}
                onChange={verhandlungsFeldAendern}
                multiline
                minRows={2}
                placeholder="z. B. kostenlose Zusatzmenge, Freikontingent, Gratislieferung oder sonstige Zugabe"
                helperText="Der geldwerte Vorteil kann rechts separat als Einsparung erfasst werden."
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Einsparung Vereinbarungen (€)"
                type="number"
                name="vereinbarungenEinsparung"
                value={verhandlungsFormular.vereinbarungenEinsparung}
                onChange={verhandlungsFeldAendern}
                inputProps={{ min: 0, step: 0.01 }}
                helperText="Wird zur Nachlass-Einsparung addiert."
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
                fullWidth
                label="Kategorie"
                name="kategorie"
                value={verhandlungsFormular.kategorie}
                onChange={verhandlungsFeldAendern}
                placeholder="z. B. Diesellieferanten"
                helperText="Freie Kategorie; vorhandene Kategorien werden vorgeschlagen."
                inputProps={{ list: "verhandlungs-kategorien" }}
              />
              <datalist id="verhandlungs-kategorien">
                {lieferantenKategorien.map((kategorie) => (
                  <option key={kategorie} value={kategorie} />
                ))}
              </datalist>
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
                <MenuItem value="Abgeschlossen">Abgeschlossen</MenuItem>
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
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Ausgangsangebot"
                type="number"
                name="ausgangsangebot"
                value={verhandlungsFormular.ausgangsangebot}
                onChange={verhandlungsFeldAendern}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Verhandelter Betrag"
                type="number"
                name="aktuellesAngebot"
                value={verhandlungsFormular.aktuellesAngebot}
                onChange={verhandlungsFeldAendern}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Skonto in %"
                type="number"
                name="skonto"
                value={verhandlungsFormular.skonto}
                onChange={verhandlungsFeldAendern}
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                helperText="Wird automatisch vom verhandelten Betrag abgezogen."
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Zielpreis"
                type="number"
                name="zielpreis"
                value={verhandlungsFormular.zielpreis}
                onChange={verhandlungsFeldAendern}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Schmerzgrenze"
                type="number"
                name="schmerzgrenze"
                value={verhandlungsFormular.schmerzgrenze}
                onChange={verhandlungsFeldAendern}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={800}>SKONTOABZUG</Typography>
                    <Typography fontWeight={850}>{euroFormat(skontoAbzug(verhandlungsFormular))}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={800}>BETRAG NACH SKONTO</Typography>
                    <Typography fontWeight={900} color="primary.main">{euroFormat(betragNachSkonto(verhandlungsFormular))}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={800}>NACHLASS INKL. SKONTO</Typography>
                    <Typography fontWeight={850}>{euroFormat(nachlassEinsparung(verhandlungsFormular))}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={800}>VEREINBARUNGEN / ZUGABEN</Typography>
                    <Typography fontWeight={850}>{euroFormat(vereinbarungenEinsparungWert(verhandlungsFormular))}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Divider sx={{ my: 0.5 }} />
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                      <Typography fontWeight={900}>GESAMTERSPARNIS</Typography>
                      <Typography variant="h6" fontWeight={950} color="success.main">
                        {euroFormat(einsparung(verhandlungsFormular))}
                      </Typography>
                    </Stack>
                  </Grid>
                </Grid>
              </Paper>
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
            <LieferterminEingabe
              formular={verhandlungsFormular}
              praefix="liefertermin"
              label="Liefertermin"
              onChange={verhandlungsFeldAendern}
              statusName="angeliefert"
              onStatusChange={(angeliefert) =>
                setVerhandlungsFormular((vorher) => ({ ...vorher, angeliefert }))
              }
            />
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
              <RichTextEditor
                label="Notizen"
                value={verhandlungsFormular.notizen}
                onChange={(value) => setVerhandlungsFormular((vorher) => ({ ...vorher, notizen: value }))}
                minHeight={140}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              {verhandlungsBearbeitungsId ? (
                <Accordion defaultExpanded={false} disableGutters>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box>
                      <Typography fontWeight={850}>Dokumente der Verhandlung</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Angebote, Vereinbarungen und weitere Dateien direkt zuordnen
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Dokumentablage
                      ownerType="verhandlung"
                      ownerId={verhandlungsBearbeitungsId}
                      ownerLabel={verhandlungsFormular.firma}
                      categories={VERHANDLUNG_DOKUMENT_KATEGORIEN}
                      deleteAfter={
                        verhandlungen.find(
                          (eintrag) => eintrag.id === verhandlungsBearbeitungsId
                        )?.dokumentLoeschdatum
                      }
                      compact
                    />
                  </AccordionDetails>
                </Accordion>
              ) : (
                <Alert severity="info">
                  Die Dokumentablage ist nach dem ersten Speichern der Verhandlung verfügbar.
                </Alert>
              )}
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
                fullWidth
                label="Kategorie"
                name="kategorie"
                value={lieferantenFormular.kategorie}
                onChange={lieferantenFeldAendern}
                placeholder="z. B. Diesellieferanten"
                helperText="Neue Kategorien können frei eingetragen werden."
                inputProps={{ list: "lieferanten-kategorien-verhandlungen" }}
              />
              <datalist id="lieferanten-kategorien-verhandlungen">
                {lieferantenKategorien.map((kategorie) => (
                  <option key={kategorie} value={kategorie} />
                ))}
              </datalist>
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
            <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth type="date" label="Bestelltermin" name="bestelltermin" value={fahrzeugFormular.bestelltermin} onChange={fahrzeugFeldAendern} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
            <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth type="date" label="Wiedervorlage" name="wiedervorlage" value={fahrzeugFormular.wiedervorlage} onChange={fahrzeugFeldAendern} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
            <LieferterminEingabe
              formular={fahrzeugFormular}
              praefix="gewuenschterLiefertermin"
              label="Gewünschter Liefertermin"
              onChange={fahrzeugFeldAendern}
            />
            <LieferterminEingabe
              formular={fahrzeugFormular}
              praefix="voraussichtlicherLiefertermin"
              label="Voraussichtlicher Liefertermin"
              onChange={fahrzeugFeldAendern}
            />
            <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Ansprechpartner" name="ansprechpartner" value={fahrzeugFormular.ansprechpartner} onChange={fahrzeugFeldAendern} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Telefon" name="telefon" value={fahrzeugFormular.telefon} onChange={fahrzeugFeldAendern} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="E-Mail" name="email" value={fahrzeugFormular.email} onChange={fahrzeugFeldAendern} /></Grid>
            <Grid size={{ xs: 12 }}><Divider><Chip icon={<DirectionsCarIcon />} label="Einzelne Fahrzeuge" /></Divider></Grid>
            {fahrzeugFormular.fahrzeuge.map((fahrzeug, index) => (
              <Grid size={{ xs: 12 }} key={fahrzeug.id}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography fontWeight={800}>Fahrzeug {index + 1}</Typography>
                    <IconButton color="error" disabled={fahrzeugFormular.fahrzeuge.length === 1} onClick={() => fahrzeugZeileEntfernen(fahrzeug.id)}><RemoveCircleOutlineIcon /></IconButton>
                  </Stack>
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
