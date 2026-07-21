import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
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
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from "firebase/storage";
import {
  trackedAddDoc as addDoc,
  trackedOnSnapshot as onSnapshot,
} from "../firebaseUsage";
import { auth, storage } from "../firebase";
import {
  DOKUMENT_KATEGORIEN,
  dokumentLoeschen,
  dokumenteCollection,
  timestampZuDatum,
} from "../services/dokumente";

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

export default function Dokumentablage({
  ownerType,
  ownerId,
  ownerLabel,
  categories = DOKUMENT_KATEGORIEN,
  deleteAfter = null,
  compact = false,
}) {
  const inputRef = useRef(null);
  const [dokumente, setDokumente] = useState([]);
  const [kategorie, setKategorie] = useState(categories[0] || "Sonstiges");
  const [uploadFortschritt, setUploadFortschritt] = useState(0);
  const [uploadLaeuft, setUploadLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");
  const [meldung, setMeldung] = useState("");
  const [loeschId, setLoeschId] = useState("");

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

  async function dateiHochladen(datei) {
    const benutzer = auth.currentUser;
    if (!benutzer || !ownerId || !datei) return;

    if (datei.size > MAX_DATEIGROESSE) {
      setFehler("Die Datei ist größer als 30 MB.");
      return;
    }

    setFehler("");
    setMeldung("");
    setUploadLaeuft(true);
    setUploadFortschritt(0);

    const sichererName = dateinameSichern(datei.name);
    const storagePath = `business-suite/${benutzer.uid}/${ownerType}/${ownerId}/${Date.now()}-${sichererName}`;
    const dateiRef = storageRef(storage, storagePath);
    let uploadErfolgreich = false;

    try {
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
            setUploadFortschritt(
              Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            );
          },
          reject,
          resolve
        );
      });
      uploadErfolgreich = true;

      const downloadUrl = await getDownloadURL(dateiRef);
      const daten = {
        userId: benutzer.uid,
        ownerType,
        ownerId,
        ownerLabel: ownerLabel || "",
        kategorie,
        dateiname: datei.name,
        contentType: datei.type || "application/octet-stream",
        groesse: datei.size,
        storagePath,
        downloadUrl,
        erstelltAm: serverTimestamp(),
        aktualisiertAm: serverTimestamp(),
      };

      if (deleteAfterDate) {
        daten.deleteAfter = Timestamp.fromDate(deleteAfterDate);
      }

      await addDoc(dokumenteCollection(ownerType, ownerId), daten);
      setMeldung(`„${datei.name}“ wurde gespeichert.`);
    } catch (error) {
      console.error(error);
      if (uploadErfolgreich) {
        try {
          await deleteObject(dateiRef);
        } catch (cleanupError) {
          console.error(cleanupError);
        }
      }
      setFehler("Upload fehlgeschlagen. Bitte Storage-Regeln und Internetverbindung prüfen.");
    } finally {
      setUploadLaeuft(false);
      setUploadFortschritt(0);
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

  return (
    <Paper variant="outlined" sx={{ p: compact ? 1.5 : 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant={compact ? "subtitle1" : "h6"} fontWeight={850}>
            Dokumentablage
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Dateien liegen in Firebase Storage; Metadaten werden in Firestore gespeichert.
          </Typography>
        </Box>

        {deleteAfterDate && (
          <Alert severity="warning">
            Diese Verhandlung ist beendet. Dokumente werden am {deleteAfterDate.toLocaleDateString("de-DE")} automatisch gelöscht.
          </Alert>
        )}
        {fehler && <Alert severity="error" onClose={() => setFehler("")}>{fehler}</Alert>}
        {meldung && <Alert severity="success" onClose={() => setMeldung("")}>{meldung}</Alert>}

        <input
          ref={inputRef}
          type="file"
          hidden
          onChange={(event) => {
            dateiHochladen(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
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
          <Button
            variant="contained"
            startIcon={uploadLaeuft ? <CircularProgress size={18} color="inherit" /> : <CloudUploadIcon />}
            onClick={() => inputRef.current?.click()}
            disabled={uploadLaeuft || !ownerId}
          >
            {uploadLaeuft ? "Wird hochgeladen…" : "Datei hochladen"}
          </Button>
          <Typography variant="caption" color="text.secondary">Maximal 30 MB pro Datei</Typography>
        </Stack>

        {uploadLaeuft && (
          <Box>
            <LinearProgress variant="determinate" value={uploadFortschritt} />
            <Typography variant="caption" color="text.secondary">{uploadFortschritt} %</Typography>
          </Box>
        )}

        <Divider />

        <Stack spacing={1}>
          {dokumente.map((dokument) => (
            <Paper key={dokument.id} variant="outlined" sx={{ p: 1.25 }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <DescriptionIcon color="action" />
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography fontWeight={800} noWrap title={dokument.dateiname}>
                    {dokument.dateiname}
                  </Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap mt={0.5}>
                    <Chip size="small" label={dokument.kategorie || "Sonstiges"} />
                    <Chip size="small" variant="outlined" label={dateigroesseFormat(dokument.groesse)} />
                    <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
                      {datumFormat(dokument.erstelltAm)}
                    </Typography>
                  </Stack>
                </Box>
                <Tooltip title="Öffnen">
                  <span>
                    <IconButton
                      component="a"
                      href={dokument.downloadUrl || undefined}
                      target="_blank"
                      rel="noreferrer"
                      disabled={!dokument.downloadUrl}
                    >
                      <OpenInNewIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Löschen">
                  <span>
                    <IconButton
                      color="error"
                      onClick={() => dokumentEntfernen(dokument)}
                      disabled={loeschId === dokument.id}
                    >
                      {loeschId === dokument.id ? <CircularProgress size={20} /> : <DeleteIcon />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Paper>
          ))}
          {!dokumente.length && (
            <Alert severity="info">Noch keine Dokumente hinterlegt.</Alert>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
