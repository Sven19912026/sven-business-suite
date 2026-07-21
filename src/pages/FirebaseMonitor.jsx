import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import {
  collection,
  getCountFromServer,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  getFirebaseUsage,
  resetFirebaseUsage,
  subscribeFirebaseUsage,
} from "../firebaseUsage";

const READ_LIMIT = 50000;
const WRITE_LIMIT = 20000;
const DELETE_LIMIT = 20000;

const COLLECTIONS = [
  { name: "suiteAufgaben", label: "Aufgaben", scoped: true },
  {
    name: "aufgabenKategorien",
    label: "Aufgabenkategorien",
    scoped: true,
  },
  { name: "lieferanten", label: "Lieferanten", scoped: true },
  {
    name: "ansprechpartner",
    label: "Ansprechpartner",
    scoped: true,
  },
  {
    name: "suiteVertraege",
    label: "Verträge",
    scoped: true,
  },
  {
    name: "vertraege",
    label: "Verträge – bisheriger CRM-Bestand",
    scoped: true,
  },
  {
    name: "verhandlungen",
    label: "Verhandlungen",
    scoped: true,
  },
  {
    name: "fahrzeugverhandlungen",
    label: "Fahrzeugverhandlungen",
    scoped: true,
  },
  {
    name: "verhandlungsWettbewerbe",
    label: "Verhandlungen – Wettbewerb",
    scoped: true,
  },
  {
    name: "verhandlungsFirmen",
    label: "Eigene Firmen",
    scoped: true,
  },
  { name: "aufgaben", label: "Lieferantenaufgaben", scoped: true },
  { name: "historie", label: "Historie", scoped: true },
  { name: "mitarbeiter", label: "Mitarbeiter", scoped: false },
];

function dateKey() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function numberFormat(value) {
  return new Intl.NumberFormat("de-DE").format(Number(value || 0));
}

function percent(value, limit) {
  if (!limit) return 0;
  return Math.min((Number(value || 0) / limit) * 100, 100);
}

function UsageCard({ title, value, limit, icon, color = "primary" }) {
  const progress = percent(value, limit);

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Typography color="text.secondary" fontWeight={700}>
              {title}
            </Typography>

            <Typography variant="h4" fontWeight={900} mt={0.8}>
              {numberFormat(value)}
            </Typography>

            {limit ? (
              <Typography variant="body2" color="text.secondary" mt={0.4}>
                von {numberFormat(limit)} pro Tag
              </Typography>
            ) : null}
          </Box>

          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 3,
              display: "grid",
              placeItems: "center",
              bgcolor: `${color}.light`,
              color: `${color}.main`,
            }}
          >
            {icon}
          </Box>
        </Stack>

        {limit ? (
          <LinearProgress
            variant="determinate"
            value={progress}
            color={
              progress >= 90
                ? "error"
                : progress >= 70
                  ? "warning"
                  : color
            }
            sx={{ mt: 2.5, height: 8, borderRadius: 99 }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function FirebaseMonitor() {
  const [usage, setUsage] = useState(() => getFirebaseUsage());
  const [counts, setCounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => subscribeFirebaseUsage(setUsage), []);

  async function loadCounts() {
    const user = auth.currentUser;

    if (!user) {
      setError("Kein Benutzer angemeldet.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const results = await Promise.all(
        COLLECTIONS.map(async (item) => {
          try {
            const reference = collection(db, item.name);
            const source = item.scoped
              ? query(reference, where("userId", "==", user.uid))
              : reference;

            const snapshot = await getCountFromServer(source);

            return {
              ...item,
              count: snapshot.data().count,
              available: true,
            };
          } catch (collectionError) {
            console.warn(
              `Sammlung ${item.name} konnte nicht gezählt werden.`,
              collectionError
            );

            return {
              ...item,
              count: 0,
              available: false,
            };
          }
        })
      );

      setCounts(results);
    } catch (loadError) {
      console.error(loadError);
      setError("Die Firestore-Dokumentzahlen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCounts();
  }, []);

  const today = usage.days?.[dateKey()] || {
    reads: 0,
    writes: 0,
    deletes: 0,
  };

  const currentMonth = dateKey().slice(0, 7);
  const month = usage.months?.[currentMonth] || {
    reads: 0,
    writes: 0,
    deletes: 0,
  };

  const totalDocuments = useMemo(
    () =>
      counts
        .filter((item) => item.available)
        .reduce((sum, item) => sum + Number(item.count || 0), 0),
    [counts]
  );

  function resetCounter() {
    if (
      !window.confirm(
        "Den lokal erfassten Read-/Write-/Delete-Zähler zurücksetzen? Die eigentlichen Firestore-Daten werden nicht gelöscht."
      )
    ) {
      return;
    }

    resetFirebaseUsage();
    setUsage(getFirebaseUsage());
  }

  return (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 3.5 },
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Typography variant="h4" fontWeight={900}>
              Firebase Monitor
            </Typography>

            <Typography color="text.secondary" mt={0.8}>
              Dokumentbestand und von der Business Suite ausgelöste
              Firestore-Vorgänge.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              variant="outlined"
              startIcon={<DeleteSweepRoundedIcon />}
              onClick={resetCounter}
            >
              Zähler zurücksetzen
            </Button>

            <Button
              variant="contained"
              startIcon={<RefreshRoundedIcon />}
              onClick={loadCounts}
              disabled={loading}
            >
              Aktualisieren
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Alert severity="info">
        Der Read-/Write-/Delete-Zähler ist ein App-Zähler. Er erfasst die
        Vorgänge, die diese Business Suite in diesem Browser ausführt. Die
        endgültige Abrechnung in Firebase kann zusätzlich Indexabfragen,
        Sicherheitsregeln, erneute Verbindungen und Zugriffe anderer Geräte
        enthalten.
      </Alert>

      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        <UsageCard
          title="Firestore-Dokumente"
          value={totalDocuments}
          icon={<StorageRoundedIcon />}
        />

        <UsageCard
          title="Reads heute"
          value={today.reads}
          limit={READ_LIMIT}
          icon={<VisibilityRoundedIcon />}
        />

        <UsageCard
          title="Writes heute"
          value={today.writes}
          limit={WRITE_LIMIT}
          icon={<EditRoundedIcon />}
          color="success"
        />

        <UsageCard
          title="Deletes heute"
          value={today.deletes}
          limit={DELETE_LIMIT}
          icon={<DeleteRoundedIcon />}
          color="warning"
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.4fr) 360px" },
          gap: 2,
        }}
      >
        <Paper
          elevation={0}
          sx={{ border: "1px solid", borderColor: "divider" }}
        >
          <Box sx={{ p: 2.5 }}>
            <Typography variant="h6" fontWeight={850}>
              Dokumente nach Bereich
            </Typography>

            <Typography variant="body2" color="text.secondary" mt={0.4}>
              Live-Zählung der vorhandenen Firestore-Dokumente.
            </Typography>
          </Box>

          <Divider />

          {loading ? (
            <Box sx={{ p: 5, display: "grid", placeItems: "center" }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Bereich</TableCell>
                    <TableCell align="right">Dokumente</TableCell>
                    <TableCell align="right">Status</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {counts.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell>
                        <Typography fontWeight={750}>
                          {item.label}
                        </Typography>

                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          {item.name}
                        </Typography>
                      </TableCell>

                      <TableCell align="right">
                        {item.available
                          ? numberFormat(item.count)
                          : "–"}
                      </TableCell>

                      <TableCell align="right">
                        <Chip
                          size="small"
                          color={item.available ? "success" : "default"}
                          variant={
                            item.available ? "filled" : "outlined"
                          }
                          label={
                            item.available ? "Verfügbar" : "Nicht lesbar"
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        <Stack spacing={2}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="h6" fontWeight={850}>
              Aktueller Monat
            </Typography>

            <Stack spacing={1.5} mt={2}>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Reads</Typography>
                <Typography fontWeight={850}>
                  {numberFormat(month.reads)}
                </Typography>
              </Stack>

              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Writes</Typography>
                <Typography fontWeight={850}>
                  {numberFormat(month.writes)}
                </Typography>
              </Stack>

              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Deletes</Typography>
                <Typography fontWeight={850}>
                  {numberFormat(month.deletes)}
                </Typography>
              </Stack>
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="h6" fontWeight={850}>
              Firebase Storage
            </Typography>

            <Typography color="text.secondary" mt={1} lineHeight={1.7}>
              Die Datei- und Speicherplatzanzeige wird zusammen mit dem
              Upload für Verträge, Preislisten und Angebote aktiviert.
            </Typography>

            <Chip
              label="Folgt mit Storage-Phase"
              variant="outlined"
              sx={{ mt: 2 }}
            />
          </Paper>

          <Typography variant="caption" color="text.secondary">
            Letzte lokale Zähleraktualisierung:{" "}
            {usage.updatedAt
              ? new Date(usage.updatedAt).toLocaleString("de-DE")
              : "Noch keine Vorgänge erfasst"}
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
}
