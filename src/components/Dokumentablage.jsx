import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import DescriptionIcon from "@mui/icons-material/Description";
import EditIcon from "@mui/icons-material/Edit";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { Timestamp, serverTimestamp } from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from "firebase/storage";
import {
  trackedAddDoc as addDoc,
  trackedOnSnapshot as onSnapshot,
  trackedUpdateDoc as updateDoc,
} from "../firebaseUsage";
import { auth, storage } from "../firebase";
import {
  DOKUMENT_KATEGORIEN,
  dokumentLoeschen,
  dokumenteCollection,
  timestampZuDatum,
} from "../services/dokumente";
import { dokumentTextExtrahieren } from "../services/dokumentText";

const MAX_DATEIGROESSE = 30 * 1024 * 1024;

function dateinameSichern(name) {
  return String(name || "dokument")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "dokument";
}

function dateigroesseFormat(bytes) {
  const zahl = Number(bytes || 0);
  if (zahl < 1024) return `${zahl} B`;
  if (zahl < 1024 * 1024) return `${(zahl / 1024).toFixed(1)} KB`;
  return `${(zahl / 1024 / 1024).toFixed(1)} MB`;
}

function datumFormat(wert) {
  const datum = timestampZuDatum(wert);
  return datum ? datum.toLocaleString("de-DE") : "Gerade eben";
}

function tagsAusText(value) {
  return [...new Set(
    String(value || "")
      .split(/[,;\n]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20)
  )];
}

function istPdf(dokument) {
  return dokument?.contentType === "application/pdf"
    || String(dokument?.dateiname || "").toLowerCase().endsWith(".pdf");
}

function istBild(dokument) {
  return String(dokument?.contentType || "").startsWith("image/")
    || /\.(png|jpe?g|webp|gif)$/i.test(String(dokument?.dateiname || ""));
}

export default function Dokumentablage({
  ownerType,
  ownerId,
  ownerLabel,
  title = "Dokumentablage",
  description = "Drag & Drop, mobile Kamera, Tags, Volltextsuche und PDF-Vorschau.",
  categories = DOKUMENT_KATEGORIEN,
  deleteAfter = null,
  compact = false,
}) {
  const inputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [dokumente, setDokumente] = useState([]);
  const [kategorie, setKategorie] = useState(categories[0] || "Sonstiges");
  const [tagsText, setTagsText] = useState("");
  const [suche, setSuche] = useState("");
  const [kategorieFilter, setKategorieFilter] = useState("Alle");
  const [uploadFortschritt, setUploadFortschritt] = useState(0);
  const [uploadLaeuft, setUploadLaeuft] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [dragAktiv, setDragAktiv] = useState(false);
  const [fehler, setFehler] = useState("");
  const [meldung, setMeldung] = useState("");
  const [loeschId, setLoeschId] = useState("");
  const [indexId, setIndexId] = useState("");
  const [indexFortschritt, setIndexFortschritt] = useState(0);
  const [vorschau, setVorschau] = useState(null);
  const [bearbeitung, setBearbeitung] = useState(null);
  const [bearbeitungForm, setBearbeitungForm] = useState({
    titel: "",
    beschreibung: "",
    kategorie: "Sonstiges",
    tags: "",
  });
  const [bearbeitungSpeichert, setBearbeitungSpeichert] = useState(false);

  const deleteAfterDate = useMemo(() => timestampZuDatum(deleteAfter), [deleteAfter]);

  useEffect(() => {
    if (!ownerId) return undefined;

    return onSnapshot(
      dokumenteCollection(ownerType, ownerId),
      (snapshot) => {
        setDokumente(
          snapshot.docs
            .map((eintrag) => ({ id: eintrag.id, ref: eintrag.ref, ...eintrag.data() }))
            .sort((a, b) => {
              const aZeit = timestampZuDatum(a.erstelltAm)?.getTime() || 0;
              const bZeit = timestampZuDatum(b.erstelltAm)?.getTime() || 0;
              return bZeit - aZeit;
            })
        );
        setFehler("");
      },
      (error) => {
        console.error(error);
        setFehler("Dokumente konnten nicht geladen werden. Bitte Firebase-Regeln prüfen.");
      }
    );
  }, [ownerId, ownerType]);

  const gefilterteDokumente = useMemo(() => {
    const term = suche.trim().toLowerCase();
    return dokumente.filter((dokument) => {
      if (kategorieFilter !== "Alle" && dokument.kategorie !== kategorieFilter) return false;
      if (!term) return true;
      const suchfelder = [
        dokument.dateiname,
        dokument.titel,
        dokument.beschreibung,
        dokument.kategorie,
        ...(Array.isArray(dokument.tags) ? dokument.tags : []),
        dokument.suchtext,
      ];
      return suchfelder.some((wert) => String(wert || "").toLowerCase().includes(term));
    });
  }, [dokumente, suche, kategorieFilter]);

  const bekannteTags = useMemo(
    () => [...new Set(dokumente.flatMap((dokument) => (Array.isArray(dokument.tags) ? dokument.tags : [])))].sort((a, b) => a.localeCompare(b, "de")),
    [dokumente]
  );

  async function einzelneDateiHochladen(datei, position, gesamt) {
    const benutzer = auth.currentUser;
    if (!benutzer || !ownerId || !datei) return { erfolgreich: false, name: datei?.name || "Datei" };

    if (datei.size > MAX_DATEIGROESSE) {
      throw new Error(`„${datei.name}“ ist größer als 30 MB.`);
    }

    const sichererName = dateinameSichern(datei.name);
    const storagePath = `business-suite/${benutzer.uid}/${ownerType}/${ownerId}/${Date.now()}-${position}-${sichererName}`;
    const dateiRef = storageRef(storage, storagePath);
    let uploadErfolgreich = false;

    try {
      setUploadStatus(`${position} von ${gesamt}: ${datei.name} wird hochgeladen`);
      const task = uploadBytesResumable(dateiRef, datei, {
        contentType: datei.type || "application/octet-stream",
        customMetadata: {
          userId: benutzer.uid,
          ownerType,
          ownerId,
          kategorie,
        },
      });

      await new Promise((resolve, reject) => {
        task.on(
          "state_changed",
          (snapshot) => {
            const dateiProzent = snapshot.totalBytes
              ? snapshot.bytesTransferred / snapshot.totalBytes
              : 0;
            setUploadFortschritt(Math.round((((position - 1) + dateiProzent * 0.75) / gesamt) * 100));
          },
          reject,
          resolve
        );
      });
      uploadErfolgreich = true;

      let suchtext = "";
      let textIndexQuelle = "nicht-unterstuetzt";
      let textIndexStatus = "nicht-verfuegbar";
      try {
        setUploadStatus(`${position} von ${gesamt}: Suchindex für ${datei.name} wird erstellt`);
        const indexErgebnis = await dokumentTextExtrahieren(datei, (indexProzent) => {
          const anteil = 0.75 + (indexProzent / 100) * 0.25;
          setUploadFortschritt(Math.round((((position - 1) + anteil) / gesamt) * 100));
        });
        suchtext = indexErgebnis.text || "";
        textIndexQuelle = indexErgebnis.quelle || "nicht-unterstuetzt";
        textIndexStatus = suchtext ? "fertig" : "nicht-verfuegbar";
      } catch (indexError) {
        console.warn("Dokument konnte nicht indexiert werden", indexError);
        textIndexStatus = "fehlgeschlagen";
      }

      const downloadUrl = await getDownloadURL(dateiRef);
      const daten = {
        userId: benutzer.uid,
        ownerType,
        ownerId,
        ownerLabel: ownerLabel || "",
        kategorie,
        tags: tagsAusText(tagsText),
        titel: datei.name.replace(/\.[^.]+$/, ""),
        beschreibung: "",
        dateiname: datei.name,
        contentType: datei.type || "application/octet-stream",
        groesse: datei.size,
        storagePath,
        downloadUrl,
        suchtext,
        textIndexQuelle,
        textIndexStatus,
        erstelltAm: serverTimestamp(),
        aktualisiertAm: serverTimestamp(),
      };

      if (deleteAfterDate) daten.deleteAfter = Timestamp.fromDate(deleteAfterDate);
      await addDoc(dokumenteCollection(ownerType, ownerId), daten);
      return { erfolgreich: true, name: datei.name };
    } catch (error) {
      if (uploadErfolgreich) {
        try {
          await deleteObject(dateiRef);
        } catch (cleanupError) {
          console.error(cleanupError);
        }
      }
      throw error;
    }
  }

  async function dateienHochladen(dateien) {
    const liste = Array.from(dateien || []).filter(Boolean);
    if (!liste.length || uploadLaeuft) return;

    setFehler("");
    setMeldung("");
    setUploadLaeuft(true);
    setUploadFortschritt(0);
    let erfolgreich = 0;
    const fehlerListe = [];

    try {
      for (let index = 0; index < liste.length; index += 1) {
        try {
          await einzelneDateiHochladen(liste[index], index + 1, liste.length);
          erfolgreich += 1;
        } catch (error) {
          console.error(error);
          fehlerListe.push(error?.message || `${liste[index].name}: Upload fehlgeschlagen`);
        }
      }

      if (erfolgreich) {
        setMeldung(`${erfolgreich} Dokument${erfolgreich === 1 ? "" : "e"} wurde${erfolgreich === 1 ? "" : "n"} gespeichert und für die Volltextsuche indexiert.`);
      }
      if (fehlerListe.length) setFehler(fehlerListe.join(" "));
    } finally {
      setUploadLaeuft(false);
      setUploadFortschritt(0);
      setUploadStatus("");
    }
  }

  async function dokumentEntfernen(dokument) {
    if (!window.confirm(`Dokument „${dokument.dateiname}“ wirklich löschen?`)) return;

    setLoeschId(dokument.id);
    setFehler("");
    try {
      await dokumentLoeschen(dokument.ref, dokument);
      setMeldung(`„${dokument.dateiname}“ wurde gelöscht.`);
    } catch (error) {
      console.error(error);
      setFehler("Das Dokument konnte nicht vollständig gelöscht werden.");
    } finally {
      setLoeschId("");
    }
  }

  async function dokumentNeuIndexieren(dokument) {
    if (!dokument?.downloadUrl || !dokument?.ref || indexId) return;
    setIndexId(dokument.id);
    setIndexFortschritt(0);
    setFehler("");
    setMeldung("");
    try {
      const antwort = await fetch(dokument.downloadUrl);
      if (!antwort.ok) throw new Error("Datei konnte nicht geladen werden.");
      const blob = await antwort.blob();
      const datei = new File([blob], dokument.dateiname || "dokument", {
        type: dokument.contentType || blob.type || "application/octet-stream",
      });
      const ergebnis = await dokumentTextExtrahieren(datei, setIndexFortschritt);
      await updateDoc(dokument.ref, {
        suchtext: ergebnis.text || "",
        textIndexQuelle: ergebnis.quelle || "nicht-unterstuetzt",
        textIndexStatus: ergebnis.text ? "fertig" : "nicht-verfuegbar",
        aktualisiertAm: serverTimestamp(),
      });
      setMeldung(ergebnis.text
        ? `„${dokument.dateiname}“ wurde für die Volltextsuche neu indexiert.`
        : `Für „${dokument.dateiname}“ konnte kein durchsuchbarer Text erkannt werden.`);
    } catch (error) {
      console.error(error);
      setFehler("Der Volltextindex konnte nicht neu erstellt werden.");
    } finally {
      setIndexId("");
      setIndexFortschritt(0);
    }
  }

  function bearbeitungOeffnen(dokument) {
    setBearbeitung(dokument);
    setBearbeitungForm({
      titel: dokument.titel || dokument.dateiname || "",
      beschreibung: dokument.beschreibung || "",
      kategorie: dokument.kategorie || categories[0] || "Sonstiges",
      tags: (dokument.tags || []).join(", "),
    });
  }

  async function bearbeitungSpeichern() {
    if (!bearbeitung?.ref) return;
    setBearbeitungSpeichert(true);
    setFehler("");
    try {
      await updateDoc(bearbeitung.ref, {
        titel: bearbeitungForm.titel.trim(),
        beschreibung: bearbeitungForm.beschreibung.trim(),
        kategorie: bearbeitungForm.kategorie,
        tags: tagsAusText(bearbeitungForm.tags),
        aktualisiertAm: serverTimestamp(),
      });
      setBearbeitung(null);
      setMeldung("Dokumentdaten wurden aktualisiert.");
    } catch (error) {
      console.error(error);
      setFehler("Titel, Beschreibung oder Tags konnten nicht gespeichert werden.");
    } finally {
      setBearbeitungSpeichert(false);
    }
  }

  function dateienAusEvent(event) {
    const dateien = event.target.files;
    dateienHochladen(dateien);
    event.target.value = "";
  }

  return (
    <Paper variant="outlined" sx={{ p: compact ? 1.5 : 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant={compact ? "subtitle1" : "h6"} fontWeight={850}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>

        {deleteAfterDate && (
          <Alert severity="warning">
            Diese Verhandlung ist beendet. Dokumente werden am {deleteAfterDate.toLocaleDateString("de-DE")} automatisch gelöscht.
          </Alert>
        )}
        {fehler && <Alert severity="error" onClose={() => setFehler("")}>{fehler}</Alert>}
        {meldung && <Alert severity="success" onClose={() => setMeldung("")}>{meldung}</Alert>}

        <input ref={inputRef} type="file" hidden multiple onChange={dateienAusEvent} />
        <input
          ref={cameraInputRef}
          type="file"
          hidden
          accept="image/*"
          capture="environment"
          onChange={dateienAusEvent}
        />

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            select
            size="small"
            label="Dokumentart"
            value={kategorie}
            onChange={(event) => setKategorie(event.target.value)}
            sx={{ minWidth: 210 }}
          >
            {categories.map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
          </TextField>
          <TextField
            size="small"
            label="Tags für neue Uploads"
            placeholder="z. B. 2026, Rahmenvertrag, wichtig"
            value={tagsText}
            onChange={(event) => setTagsText(event.target.value)}
            sx={{ flexGrow: 1 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><LocalOfferIcon fontSize="small" /></InputAdornment> }}
          />
        </Stack>

        <Paper
          variant="outlined"
          onDragEnter={(event) => { event.preventDefault(); setDragAktiv(true); }}
          onDragOver={(event) => { event.preventDefault(); setDragAktiv(true); }}
          onDragLeave={(event) => { event.preventDefault(); setDragAktiv(false); }}
          onDrop={(event) => {
            event.preventDefault();
            setDragAktiv(false);
            dateienHochladen(event.dataTransfer.files);
          }}
          sx={{
            p: 2.5,
            borderStyle: "dashed",
            borderWidth: 2,
            borderColor: dragAktiv ? "primary.main" : "divider",
            bgcolor: dragAktiv ? "action.hover" : "transparent",
            transition: "0.18s",
            textAlign: "center",
          }}
        >
          <Stack spacing={1.25} alignItems="center">
            <CloudUploadIcon color="primary" sx={{ fontSize: 42 }} />
            <Box>
              <Typography fontWeight={850}>Dateien hier ablegen</Typography>
              <Typography variant="body2" color="text.secondary">Mehrere Dateien gleichzeitig, maximal 30 MB je Datei</Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="contained"
                startIcon={uploadLaeuft ? <CircularProgress size={18} color="inherit" /> : <CloudUploadIcon />}
                onClick={() => inputRef.current?.click()}
                disabled={uploadLaeuft || !ownerId}
              >
                {uploadLaeuft ? "Verarbeitung läuft…" : "Dateien auswählen"}
              </Button>
              <Button
                variant="outlined"
                startIcon={<PhotoCameraIcon />}
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploadLaeuft || !ownerId}
              >
                Mit Handy scannen
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {uploadLaeuft && (
          <Box>
            <LinearProgress variant="determinate" value={uploadFortschritt} />
            <Typography variant="caption" color="text.secondary">{uploadFortschritt} % · {uploadStatus}</Typography>
          </Box>
        )}

        <Divider />

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            size="small"
            label="Volltextsuche"
            placeholder="Dateiname, Beschreibung, Tag oder Text im Dokument"
            value={suche}
            onChange={(event) => setSuche(event.target.value)}
            fullWidth
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          />
          <TextField
            select
            size="small"
            label="Kategorie"
            value={kategorieFilter}
            onChange={(event) => setKategorieFilter(event.target.value)}
            sx={{ minWidth: 190 }}
          >
            <MenuItem value="Alle">Alle</MenuItem>
            {categories.map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
          </TextField>
        </Stack>

        {bekannteTags.length > 0 && (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {bekannteTags.map((tag) => (
              <Chip
                key={tag}
                size="small"
                icon={<LocalOfferIcon />}
                label={tag}
                variant={suche === tag ? "filled" : "outlined"}
                color={suche === tag ? "primary" : "default"}
                onClick={() => setSuche(suche === tag ? "" : tag)}
              />
            ))}
          </Stack>
        )}

        <Stack spacing={1}>
          {gefilterteDokumente.map((dokument) => (
            <Paper key={dokument.id} variant="outlined" sx={{ p: 1.25 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ sm: "center" }}>
                {istPdf(dokument) ? <PictureAsPdfIcon color="error" /> : <DescriptionIcon color="action" />}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography fontWeight={800} noWrap title={dokument.titel || dokument.dateiname}>
                    {dokument.titel || dokument.dateiname}
                  </Typography>
                  {dokument.beschreibung && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      {dokument.beschreibung}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap mt={0.5}>
                    <Chip size="small" label={dokument.kategorie || "Sonstiges"} />
                    <Chip size="small" variant="outlined" label={dateigroesseFormat(dokument.groesse)} />
                    {(dokument.tags || []).map((tag) => <Chip key={tag} size="small" variant="outlined" icon={<LocalOfferIcon />} label={tag} />)}
                    {dokument.textIndexStatus === "fertig" && <Chip size="small" color="success" variant="outlined" label="Volltext indexiert" />}
                    <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
                      {datumFormat(dokument.erstelltAm)}
                    </Typography>
                  </Stack>
                </Box>
                <Stack direction="row" spacing={0.25} alignSelf={{ xs: "flex-end", sm: "center" }}>
                  <Tooltip title={dokument.textIndexStatus === "fertig" ? "Volltextindex erneuern" : "Für Volltextsuche indexieren"}>
                    <span>
                      <IconButton onClick={() => dokumentNeuIndexieren(dokument)} disabled={!dokument.downloadUrl || Boolean(indexId)}>
                        {indexId === dokument.id ? <CircularProgress size={20} variant={indexFortschritt ? "determinate" : "indeterminate"} value={indexFortschritt || undefined} /> : <ManageSearchIcon />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Vorschau">
                    <span>
                      <IconButton onClick={() => setVorschau(dokument)} disabled={!dokument.downloadUrl}>
                        <VisibilityIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Dokumentdaten bearbeiten">
                    <IconButton onClick={() => bearbeitungOeffnen(dokument)}><EditIcon /></IconButton>
                  </Tooltip>
                  <Tooltip title="In neuem Fenster öffnen">
                    <span>
                      <IconButton component="a" href={dokument.downloadUrl || undefined} target="_blank" rel="noreferrer" disabled={!dokument.downloadUrl}>
                        <OpenInNewIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Löschen">
                    <span>
                      <IconButton color="error" onClick={() => dokumentEntfernen(dokument)} disabled={loeschId === dokument.id}>
                        {loeschId === dokument.id ? <CircularProgress size={20} /> : <DeleteIcon />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
            </Paper>
          ))}
          {dokumente.length === 0 && (
            <Typography variant="body2" color="text.secondary">Noch keine Dokumente gespeichert.</Typography>
          )}
          {dokumente.length > 0 && gefilterteDokumente.length === 0 && (
            <Alert severity="info">Keine Dokumente passen zur Suche oder zum Filter.</Alert>
          )}
        </Stack>
      </Stack>

      <Dialog open={Boolean(vorschau)} onClose={() => setVorschau(null)} fullWidth maxWidth="lg">
        <DialogTitle>{vorschau?.titel || vorschau?.dateiname || "Dokumentvorschau"}</DialogTitle>
        <DialogContent dividers sx={{ minHeight: { xs: 420, md: 680 }, p: 1 }}>
          {vorschau && istPdf(vorschau) && (
            <Box component="iframe" title={vorschau.dateiname} src={vorschau.downloadUrl} sx={{ border: 0, width: "100%", height: { xs: 410, md: 660 } }} />
          )}
          {vorschau && istBild(vorschau) && (
            <Box component="img" src={vorschau.downloadUrl} alt={vorschau.dateiname} sx={{ display: "block", maxWidth: "100%", maxHeight: { xs: 620, md: 760 }, mx: "auto" }} />
          )}
          {vorschau && !istPdf(vorschau) && !istBild(vorschau) && (
            <Alert severity="info">Für diesen Dateityp ist keine direkte Vorschau verfügbar.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVorschau(null)}>Schließen</Button>
          {vorschau?.downloadUrl && <Button component="a" href={vorschau.downloadUrl} target="_blank" rel="noreferrer" startIcon={<OpenInNewIcon />}>Extern öffnen</Button>}
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(bearbeitung)} onClose={() => setBearbeitung(null)} fullWidth maxWidth="sm">
        <DialogTitle>Dokumentdaten bearbeiten</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Titel" value={bearbeitungForm.titel} onChange={(event) => setBearbeitungForm((vorher) => ({ ...vorher, titel: event.target.value }))} />
            <TextField select label="Dokumentart" value={bearbeitungForm.kategorie} onChange={(event) => setBearbeitungForm((vorher) => ({ ...vorher, kategorie: event.target.value }))}>
              {categories.map((wert) => <MenuItem key={wert} value={wert}>{wert}</MenuItem>)}
            </TextField>
            <TextField label="Tags" helperText="Mehrere Tags mit Komma trennen" value={bearbeitungForm.tags} onChange={(event) => setBearbeitungForm((vorher) => ({ ...vorher, tags: event.target.value }))} />
            <TextField multiline minRows={3} label="Beschreibung" value={bearbeitungForm.beschreibung} onChange={(event) => setBearbeitungForm((vorher) => ({ ...vorher, beschreibung: event.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBearbeitung(null)}>Abbrechen</Button>
          <Button variant="contained" onClick={bearbeitungSpeichern} disabled={bearbeitungSpeichert}>
            {bearbeitungSpeichert ? "Speichert…" : "Speichern"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
