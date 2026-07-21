import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AppBar,
  Avatar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Chip,
  CircularProgress,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  TextField,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
  createTheme,
} from '@mui/material'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import BoltRoundedIcon from '@mui/icons-material/BoltRounded'
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded'
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded'
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import DataUsageRoundedIcon from '@mui/icons-material/DataUsageRounded'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded'
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import Aufgaben from './pages/Aufgaben'
import CRM from './pages/CRM'
import FirebaseMonitor from './pages/FirebaseMonitor'
import Mitarbeiter from './pages/Mitarbeiter'
import Verhandlungen from './pages/Verhandlungen'
import VerhandlungenWettbewerb from './pages/VerhandlungenWettbewerb'

const drawerWidth = 288
const headerHeight = 76

function createAppTheme(mode) {
  const dark = mode === 'dark'

  return createTheme({
    palette: {
      mode,
      primary: {
        main: dark ? '#7da2ff' : '#2457d6',
        dark: dark ? '#a9c0ff' : '#173c9f',
        light: dark ? '#1d315f' : '#eaf0ff',
        contrastText: dark ? '#0d1730' : '#ffffff',
      },
      secondary: {
        main: dark ? '#5fd2c7' : '#0d9488',
        dark: dark ? '#8de0d8' : '#0f766e',
        light: dark ? '#153c3b' : '#e6f7f5',
      },
      background: {
        default: dark ? '#0e1420' : '#f4f7fb',
        paper: dark ? '#171f2d' : '#ffffff',
      },
      text: {
        primary: dark ? '#edf2fb' : '#172033',
        secondary: dark ? '#a9b4c7' : '#667085',
      },
      divider: dark ? '#2a3547' : '#e5eaf2',
      success: { main: dark ? '#57c79c' : '#16865f' },
      warning: { main: dark ? '#f0b45d' : '#c77a12' },
      error: { main: dark ? '#ff8585' : '#d14343' },
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h2: { fontWeight: 850, letterSpacing: '-0.055em' },
      h3: { fontWeight: 850, letterSpacing: '-0.045em' },
      h4: { fontWeight: 820, letterSpacing: '-0.035em' },
      h5: { fontWeight: 800, letterSpacing: '-0.025em' },
      h6: { fontWeight: 780, letterSpacing: '-0.015em' },
      button: { textTransform: 'none', fontWeight: 750 },
      overline: { fontWeight: 800, letterSpacing: '0.12em' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: dark ? '#0e1420' : '#f4f7fb',
            colorScheme: mode,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderColor: dark ? '#2a3547' : '#e4e9f1',
            boxShadow: '0 1px 2px rgba(16, 24, 40, 0.02)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            minHeight: 42,
            borderRadius: 12,
            boxShadow: 'none',
          },
          contained: {
            boxShadow: dark ? '0 8px 18px rgba(0,0,0,.28)' : '0 8px 18px rgba(36, 87, 214, 0.18)',
            '&:hover': {
              boxShadow: dark ? '0 10px 22px rgba(0,0,0,.36)' : '0 10px 22px rgba(36, 87, 214, 0.24)',
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: dark ? '#111927' : '#ffffff',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 20 },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 700 },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: dark ? '#2a3547' : '#e8ecf3' },
          head: {
            fontWeight: 800,
            color: dark ? '#dbe3f1' : '#344054',
            backgroundColor: dark ? '#111927' : '#f8fafc',
          },
        },
      },
      MuiTooltip: {
        defaultProps: { arrow: true },
      },
    },
  })
}


const navigation = [
  {
    title: 'Dashboard',
    icon: DashboardRoundedIcon,
    description: 'Zentrale Übersicht',
  },
  {
    title: 'Aufgaben',
    icon: TaskAltRoundedIcon,
    description: 'Planung und Prioritäten',
  },
  
  {
    title: 'Verhandlungen',
    icon: HandshakeRoundedIcon,
    description: 'Angebote und Ergebnisse',
  },
  {
    title: 'Verhandlungen – Wettbewerb',
    icon: CompareArrowsRoundedIcon,
    description: 'Anbieter und Gesamtkosten',
  },
  {
    title: 'Dienstleister und Lieferanten',
    page: 'CRM',
    icon: BusinessRoundedIcon,
    description: 'Firmen, Kontakte und Verträge',
  },
  {
    title: 'Mitarbeiter',
    icon: GroupsRoundedIcon,
    description: 'Stammdaten und Lohnentwicklung',
  },  {
    title: 'Firebase Monitor',
    icon: DataUsageRoundedIcon,
    description: 'Firestore-Nutzung und Datenzähler',
  },
]

const pageMeta = Object.fromEntries(
  navigation.map((item) => [
    item.page || item.title,
    item,
  ]),
)

const moduleCards = [
  {
    title: 'Aufgaben',
    icon: TaskAltRoundedIcon,
    eyebrow: 'Organisation',
    description: 'Prioritäten, Fälligkeiten, Zuständigkeiten und Wiedervorlagen zentral steuern.',
    sourceKey: 'tasks',
    countLabel: 'offen',
    accent: '#2457d6',
    soft: '#eaf0ff',
  },
  {
    
    icon: DescriptionRoundedIcon,
    accent: '#7c3aed',
    soft: '#f2ecff',
  },
  {
    title: 'Verhandlungen',
    icon: HandshakeRoundedIcon,
    eyebrow: 'Einkauf',
    description: 'Angebote, Zielpreise, Gesprächsnotizen und Ergebnisse strukturiert dokumentieren.',
    sourceKey: 'negotiations',
    countLabel: 'laufend',
    accent: '#c26b12',
    soft: '#fff4e6',
  },
  {
    title: 'Dienstleister und Lieferanten',
    page: 'CRM',
    icon: BusinessRoundedIcon,
    eyebrow: 'Kontakte',
    description: 'Dienstleister, Lieferanten, Kontakte, Aufgaben und Vorgänge in einer gemeinsamen Ansicht pflegen.',
    sourceKey: 'suppliers',
    countLabel: 'aktiv',
    accent: '#0f766e',
    soft: '#e8f7f4',
  },
  {
    title: 'Mitarbeiter',
    icon: GroupsRoundedIcon,
    eyebrow: 'Personal',
    description: 'Stammdaten, Zuständigkeiten und wichtige Termine übersichtlich verwalten.',
    sourceKey: 'employees',
    countLabel: 'geführt',
    accent: '#b4236b',
    soft: '#fcebf4',
  },
]

const dashboardSources = [
  { key: 'tasks', collectionName: 'suiteAufgaben', scoped: true },
  { key: 'categories', collectionName: 'aufgabenKategorien', scoped: true },
  { key: 'negotiations', collectionName: 'verhandlungen', scoped: true },
  { key: 'suppliers', collectionName: 'lieferanten', scoped: true },
  { key: 'employees', collectionName: 'mitarbeiter', scoped: false },
]

function initialDashboardState() {
  return Object.fromEntries(
    dashboardSources.map((source) => [source.key, { status: 'loading', items: [] }]),
  )
}

function initialsFor(user) {
  const source = user?.displayName || user?.email || 'SB'
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'SB'
}

function displayNameFor() {
  return 'Sven'
}

function currentGreeting() {
  const hour = new Date().getHours()
  if (hour < 11) return 'Guten Morgen'
  if (hour < 18) return 'Guten Tag'
  return 'Guten Abend'
}

function todayIso() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10)
}

function formatDate(value, options = {}) {
  if (!value) return 'Ohne Termin'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('de-DE', options).format(date)
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (loginError) {
      console.error(loginError)
      const messages = {
        'auth/invalid-credential': 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
        'auth/wrong-password': 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
        'auth/user-not-found': 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
        'auth/too-many-requests': 'Zu viele Anmeldeversuche. Bitte versuche es später erneut.',
        'auth/network-request-failed': 'Keine Verbindung zu Firebase. Prüfe deine Internetverbindung.',
      }
      setError(messages[loginError.code] || `Anmeldung fehlgeschlagen: ${loginError.code}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(520px, 1.1fr) minmax(440px, .9fr)' },
        bgcolor: '#eef3fb',
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', lg: 'flex' },
          position: 'relative',
          overflow: 'hidden',
          p: { lg: 6, xl: 8 },
          color: 'white',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(145deg, #0f2553 0%, #173c91 48%, #2457d6 100%)',
        }}
      >
        <Box sx={{ position: 'absolute', inset: 0, opacity: 0.55, backgroundImage: 'radial-gradient(circle at 16% 18%, rgba(255,255,255,.18) 0, transparent 24%), radial-gradient(circle at 86% 78%, rgba(87,153,255,.34) 0, transparent 30%)' }} />
        <Box sx={{ position: 'absolute', width: 460, height: 460, border: '80px solid rgba(255,255,255,.045)', borderRadius: '50%', right: -170, top: -175 }} />
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ position: 'relative' }}>
          <Box sx={{ width: 48, height: 48, borderRadius: 3.5, display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.13)', border: '1px solid rgba(255,255,255,.2)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12)' }}>
            <ShieldRoundedIcon />
          </Box>
          <Box>
            <Typography variant="h6" lineHeight={1.15}>Sven Business Suite</Typography>
            <Typography variant="caption" sx={{ opacity: 0.72, letterSpacing: '.08em' }}>VERSION 5.0</Typography>
          </Box>
        </Stack>

        <Box sx={{ position: 'relative', maxWidth: 690, py: 8 }}>
          <Chip
            icon={<BoltRoundedIcon />}
            label="Arbeitsalltag zentral organisiert"
            sx={{ mb: 3, color: 'white', bgcolor: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.16)', '& .MuiChip-icon': { color: '#c8dcff' } }}
          />
          <Typography variant="h2" sx={{ fontSize: { lg: '3.75rem', xl: '4.6rem' }, lineHeight: 1.02 }}>
            Klarer arbeiten.<br />Schneller entscheiden.
          </Typography>
          <Typography sx={{ mt: 3, maxWidth: 610, opacity: 0.78, fontSize: '1.12rem', lineHeight: 1.75 }}>
            Aufgaben, Lieferantenakten, Verträge, Verhandlungen und Mitarbeiter in einer modernen, synchronisierten Arbeitsoberfläche.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 4.5 }}>
            {['Firebase-Synchronisierung', 'Responsive Oberfläche', 'Zentrale Module'].map((label) => (
              <Stack key={label} direction="row" spacing={0.8} alignItems="center">
                <CheckCircleRoundedIcon sx={{ fontSize: 18, color: '#9fc1ff' }} />
                <Typography variant="body2" sx={{ opacity: 0.82 }}>{label}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Typography variant="body2" sx={{ position: 'relative', opacity: 0.62 }}>
          Beruflich. Übersichtlich. Sicher synchronisiert.
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', placeItems: 'center', px: { xs: 2, sm: 4, lg: 6 }, py: 5, position: 'relative' }}>
        <Stack direction="row" alignItems="center" spacing={1.2} sx={{ position: 'absolute', top: 24, left: 24, display: { lg: 'none' } }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 3, display: 'grid', placeItems: 'center', color: 'white', bgcolor: 'primary.main' }}>
            <ShieldRoundedIcon fontSize="small" />
          </Box>
          <Box>
            <Typography fontWeight={850} lineHeight={1.1}>Sven Business Suite</Typography>
            <Typography variant="caption" color="text.secondary">Version 5.0</Typography>
          </Box>
        </Stack>

        <Paper
          component="form"
          onSubmit={handleLogin}
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 480,
            mt: { xs: 8, lg: 0 },
            p: { xs: 3, sm: 5 },
            border: '1px solid #e1e7f0',
            boxShadow: '0 28px 80px rgba(28, 48, 89, .13)',
          }}
        >
          <Stack spacing={3}>
            <Box>
              <Typography variant="overline" color="primary.main">ANMELDUNG</Typography>
              <Typography variant="h4" sx={{ mt: 0.3 }}>Willkommen zurück</Typography>
              <Typography color="text.secondary" sx={{ mt: 1, lineHeight: 1.65 }}>
                Melde dich mit deinem bestehenden Firebase-Konto an.
              </Typography>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="E-Mail-Adresse"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoFocus
              required
              fullWidth
            />
            <TextField
              label="Passwort"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              fullWidth
            />
            <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ minHeight: 54 }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sicher anmelden'}
            </Button>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
              <ShieldRoundedIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">Zugriff ausschließlich für autorisierte Benutzer</Typography>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Box>
  )
}

function useDashboardData(user) {
  const [state, setState] = useState(initialDashboardState)

  useEffect(() => {
    if (!user) return undefined

    const unsubscribers = dashboardSources.map((source) => {
      const sourceCollection = collection(db, source.collectionName)
      const sourceQuery = source.scoped
        ? query(sourceCollection, where('userId', '==', user.uid))
        : query(sourceCollection)

      return onSnapshot(
        sourceQuery,
        (snapshot) => {
          setState((previous) => ({
            ...previous,
            [source.key]: {
              status: 'ready',
              items: snapshot.docs.map((document) => ({ id: document.id, ...document.data() })),
            },
          }))
        },
        (error) => {
          console.warn(`Dashboard-Daten konnten nicht geladen werden: ${source.collectionName}`, error)
          setState((previous) => ({
            ...previous,
            [source.key]: { status: 'error', items: [] },
          }))
        },
      )
    })

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [user])

  return state
}

function DueStatus({ date }) {
  const today = todayIso()
  let label = formatDate(date, { day: '2-digit', month: '2-digit', year: 'numeric' })
  let color = 'default'
  let icon = <CalendarMonthRoundedIcon sx={{ fontSize: 16 }} />

  if (date < today) {
    label = 'Überfällig'
    color = 'error'
    icon = <WarningAmberRoundedIcon sx={{ fontSize: 16 }} />
  } else if (date === today) {
    label = 'Heute'
    color = 'warning'
    icon = <AccessTimeRoundedIcon sx={{ fontSize: 16 }} />
  }

  return <Chip size="small" color={color} icon={icon} label={label} variant={color === 'default' ? 'outlined' : 'filled'} />
}

function WorkAreas({ data, counts, openPage }) {
  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5">Arbeitsbereiche</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.6 }}>
          Direkter Zugriff auf alle eingerichteten Geschäftsmodule.
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 2.1 }}>
        {moduleCards.map((item) => {
          const Icon = item.icon
          const sourceStatus = data[item.sourceKey].status
          return (
            <Paper
              key={item.title}
              component="button"
              type="button"
              onClick={() => openPage(item.page || item.title)}
              elevation={0}
              sx={{
                p: 2.6,
                minHeight: 205,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                color: 'text.primary',
                display: 'flex',
                flexDirection: 'column',
                textAlign: 'left',
                font: 'inherit',
                transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 18px 40px rgba(31,45,78,.11)',
                  borderColor: item.accent,
                },
              }}
            >
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                <Box sx={{ width: 48, height: 48, borderRadius: 3, display: 'grid', placeItems: 'center', color: item.accent, bgcolor: item.soft }}>
                  <Icon />
                </Box>
                <Stack direction="row" spacing={0.6} alignItems="baseline">
                  {sourceStatus === 'loading' ? (
                    <Skeleton width={34} />
                  ) : (
                    <Typography variant="h5" color="text.primary">{sourceStatus === 'error' ? '–' : counts[item.sourceKey]}</Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">{item.countLabel}</Typography>
                </Stack>
              </Stack>
              <Typography variant="overline" sx={{ mt: 2.2, color: item.accent }}>{item.eyebrow}</Typography>
              <Typography variant="h6" sx={{ mt: -0.15 }}>{item.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7, lineHeight: 1.6, flexGrow: 1 }}>{item.description}</Typography>
              <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mt: 2, color: item.accent }}>
                <Typography variant="body2" fontWeight={800}>Öffnen</Typography>
                <ArrowForwardRoundedIcon sx={{ fontSize: 18 }} />
              </Stack>
            </Paper>
          )
        })}
      </Box>
    </Box>
  )
}

function Dashboard({ user, openPage }) {
  const data = useDashboardData(user)
  const today = todayIso()
  const tasks = data.tasks.items
  const negotiations = data.negotiations.items
  const suppliers = data.suppliers.items
  const employees = data.employees.items

  const openTasks = useMemo(
    () => tasks.filter((item) => !item.erledigt && item.status !== 'Erledigt'),
    [tasks],
  )
  const activeNegotiations = useMemo(
    () => negotiations.filter((item) => item.status === 'Offen' || item.status === 'In Verhandlung'),
    [negotiations],
  )
  const activeSuppliers = useMemo(
    () => suppliers.filter((item) => item.status !== 'Inaktiv'),
    [suppliers],
  )
  const activeEmployees = useMemo(
    () => employees.filter((item) => item.status !== 'Ausgeschieden'),
    [employees],
  )
  const overdueTasks = useMemo(
    () => openTasks.filter((item) => item.faelligAm && item.faelligAm < today),
    [openTasks, today],
  )
  const focusTasks = useMemo(
    () => openTasks
      .filter((item) => item.faelligAm)
      .sort((a, b) => String(a.faelligAm).localeCompare(String(b.faelligAm)))
      .slice(0, 5),
    [openTasks],
  )
  const categoryNames = useMemo(
    () => Object.fromEntries(data.categories.items.map((item) => [item.id, item.name])),
    [data.categories.items],
  )

  const counts = {
    tasks: openTasks.length,
    negotiations: activeNegotiations.length,
    suppliers: activeSuppliers.length,
    employees: activeEmployees.length,
  }

  return (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          position: 'relative',
          overflow: 'hidden',
          p: { xs: 3, sm: 4, lg: 4.5 },
          minHeight: { lg: 270 },
          color: 'white',
          background: 'linear-gradient(125deg, #102858 0%, #1e4bb8 58%, #3674ed 100%)',
          boxShadow: '0 20px 48px rgba(31, 78, 184, .24)',
        }}
      >
        <Box sx={{ position: 'absolute', width: 360, height: 360, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.075)', top: -220, right: -55 }} />
        <Box sx={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', border: '42px solid rgba(255,255,255,.055)', bottom: -150, right: { xs: -80, md: 250 } }} />
        <Box sx={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(105deg, transparent 0 66%, rgba(255,255,255,.04) 66% 67%, transparent 67%)' }} />

        <Box sx={{ position: 'relative', display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 320px' }, gap: 4, alignItems: 'center' }}>
          <Box sx={{ maxWidth: 760 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Chip size="small" label="BUSINESS SUITE 5.0" sx={{ color: '#dbe8ff', bgcolor: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.14)' }} />
              <Typography variant="caption" sx={{ opacity: 0.68 }}>{formatDate(today, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</Typography>
            </Stack>
            <Typography variant="h3" sx={{ fontSize: { xs: '2rem', sm: '2.55rem', lg: '3rem' } }}>
              {currentGreeting()}, {displayNameFor(user)}.
            </Typography>
            <Typography sx={{ mt: 1.5, opacity: 0.8, fontSize: { xs: '1rem', md: '1.08rem' }, lineHeight: 1.7, maxWidth: 650 }}>
              Hier findest du deine wichtigsten Vorgänge und gelangst direkt in alle geschäftlichen Arbeitsbereiche.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 3 }}>
              <Button
                variant="contained"
                onClick={() => openPage('Aufgaben')}
                endIcon={<ArrowForwardRoundedIcon />}
                sx={{ bgcolor: 'white', color: '#173c9f', '&:hover': { bgcolor: '#f4f7ff' } }}
              >
                Aufgaben öffnen
              </Button>
              <Button
                variant="outlined"
                onClick={() => openPage('Verhandlungen')}
                sx={{ color: 'white', borderColor: 'rgba(255,255,255,.35)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,.08)' } }}
              >
                Zu den Verhandlungen
              </Button>
            </Stack>
          </Box>

          <Paper elevation={0} sx={{ display: { xs: 'none', lg: 'block' }, p: 2.5, bgcolor: 'rgba(9, 31, 73, .34)', color: 'white', border: '1px solid rgba(255,255,255,.13)', backdropFilter: 'blur(10px)' }}>
            <Typography variant="overline" sx={{ opacity: 0.65 }}>HEUTE IM BLICK</Typography>
            <Stack spacing={1.25} sx={{ mt: 1.25 }}>
             <Box
  sx={{
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 52px',
    alignItems: 'center',
    columnGap: 2,
    minHeight: 42,
  }}
>
  <Typography
    sx={{
      opacity: 0.78,
      lineHeight: 1.25,
    }}
  >
    Offene Aufgaben
  </Typography>

  <Typography
    component="span"
    sx={{
      width: 52,
      height: 42,
      display: 'grid',
      placeItems: 'center end',
      fontSize: '1.5rem',
      fontWeight: 850,
      lineHeight: 1,
      letterSpacing: '-0.02em',
      fontVariantNumeric: 'tabular-nums',
      m: 0,
      p: 0,
    }}
  >
    {data.tasks.status === 'ready' ? openTasks.length : '–'}
  </Typography>
</Box>

<Divider sx={{ borderColor: 'rgba(255,255,255,.12)' }} />

<Box
  sx={{
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 52px',
    alignItems: 'center',
    columnGap: 2,
    minHeight: 42,
  }}
>
  <Typography
    sx={{
      opacity: 0.78,
      lineHeight: 1.25,
    }}
  >
    Überfällig
  </Typography>

  <Typography
    component="span"
    color={overdueTasks.length ? '#ffd0c8' : 'inherit'}
    sx={{
      width: 52,
      height: 42,
      display: 'grid',
      placeItems: 'center end',
      fontSize: '1.5rem',
      fontWeight: 850,
      lineHeight: 1,
      letterSpacing: '-0.02em',
      fontVariantNumeric: 'tabular-nums',
      m: 0,
      p: 0,
    }}
  >
    {data.tasks.status === 'ready' ? overdueTasks.length : '–'}
  </Typography>
</Box>
 
              <Divider sx={{ borderColor: 'rgba(255,255,255,.12)' }} />
              <Stack direction="row" spacing={1} alignItems="center">
                <CloudDoneRoundedIcon sx={{ color: '#9edbc8' }} />
                <Box>
                  <Typography fontWeight={800}>Synchronisiert</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.65 }}>Firebase ist verbunden</Typography>
                </Box>
              </Stack>
            </Stack>
          </Paper>
        </Box>
      </Paper>

      <WorkAreas data={data} counts={counts} openPage={openPage} />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.45fr) minmax(340px, .55fr)' }, gap: 2.25 }}>
        <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, border: '1px solid #e4e9f1' }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h6">Nächste Aufgaben</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>Offene Aufgaben mit dem nächsten Fälligkeitstermin.</Typography>
            </Box>
            <Button size="small" onClick={() => openPage('Aufgaben')} endIcon={<KeyboardArrowRightRoundedIcon />}>Alle öffnen</Button>
          </Stack>

          <Box sx={{ mt: 2.25 }}>
            {data.tasks.status === 'loading' && (
              <Stack spacing={1.2}>{[1, 2, 3].map((item) => <Skeleton key={item} height={70} variant="rounded" />)}</Stack>
            )}
            {data.tasks.status === 'error' && (
              <Alert severity="info">Die Aufgabenübersicht ist aktuell nicht verfügbar. Das Aufgabenmodul kann weiterhin direkt geöffnet werden.</Alert>
            )}
            {data.tasks.status === 'ready' && focusTasks.length === 0 && (
              <Box sx={{ py: 5, textAlign: 'center', border: '1px dashed #dce3ed', borderRadius: 3, bgcolor: '#fafbfd' }}>
                <CheckCircleRoundedIcon sx={{ fontSize: 38, color: 'success.main' }} />
                <Typography fontWeight={800} sx={{ mt: 1 }}>Keine terminierten offenen Aufgaben</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Der aktuelle Aufgabenstand ist aufgeräumt.</Typography>
              </Box>
            )}
            {data.tasks.status === 'ready' && focusTasks.length > 0 && (
              <Stack divider={<Divider flexItem />}>
                {focusTasks.map((task) => (
                  <Stack
                    key={task.id}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    alignItems={{ sm: 'center' }}
                    onClick={() => openPage('Aufgaben')}
                    sx={{ py: 1.55, cursor: 'pointer', borderRadius: 2, px: 1, mx: -1, '&:hover': { bgcolor: '#f7f9fc' } }}
                  >
                    <Box sx={{ width: 38, height: 38, flexShrink: 0, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: task.faelligAm < today ? '#fff0ed' : '#edf3ff', color: task.faelligAm < today ? 'error.main' : 'primary.main' }}>
                      {task.faelligAm < today ? <WarningAmberRoundedIcon fontSize="small" /> : <TaskAltRoundedIcon fontSize="small" />}
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography fontWeight={780} noWrap>{task.titel || 'Aufgabe ohne Titel'}</Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {categoryNames[task.kategorieId] || 'Allgemein'}{task.verantwortlich ? ` · ${task.verantwortlich}` : ''}
                      </Typography>
                    </Box>
                    <DueStatus date={task.faelligAm} />
                  </Stack>
                ))}
              </Stack>
            )}
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, border: '1px solid #e4e9f1' }}>
          <Typography variant="h6">Systemstatus</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>Konto und Datensynchronisierung.</Typography>
          <Stack spacing={2.2} sx={{ mt: 2.5 }}>
            <Stack direction="row" spacing={1.4} alignItems="center">
              <Avatar sx={{ width: 46, height: 46, bgcolor: 'primary.light', color: 'primary.main', fontWeight: 850 }}>{initialsFor(user)}</Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={800}>{displayNameFor(user)}</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>{user.email}</Typography>
              </Box>
            </Stack>
            <Divider />
            <Stack direction="row" spacing={1.3} alignItems="center">
              <Box sx={{ width: 38, height: 38, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: '#eaf8f3', color: 'success.main' }}><CloudDoneRoundedIcon fontSize="small" /></Box>
              <Box><Typography fontWeight={780}>Firebase aktiv</Typography><Typography variant="body2" color="text.secondary">Daten werden online gespeichert</Typography></Box>
            </Stack>
            <Stack direction="row" spacing={1.3} alignItems="center">
              <Box sx={{ width: 38, height: 38, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: '#eef3ff', color: 'primary.main' }}><GroupsRoundedIcon fontSize="small" /></Box>
              <Box><Typography fontWeight={780}>{data.employees.status === 'ready' ? activeEmployees.length : '–'} Mitarbeiter</Typography><Typography variant="body2" color="text.secondary">Aktive Datensätze im Modul</Typography></Box>
            </Stack>
          </Stack>
        </Paper>
      </Box>

    </Stack>
  )
}

function PageContent({ page, user, setPage, initialNegotiationId, openNegotiation, clearInitialNegotiation }) {
  if (page === 'Dashboard') {
    return (
      <Dashboard
        user={user}
        openPage={setPage}
      />
    )
  }

  if (page === 'Aufgaben') {
    return <Aufgaben />
  }


  if (page === 'Verhandlungen') {
    return (
      <Verhandlungen
        initialNegotiationId={initialNegotiationId}
        onInitialNegotiationOpened={clearInitialNegotiation}
      />
    )
  }

  if (page === 'Verhandlungen – Wettbewerb') {
    return <VerhandlungenWettbewerb />
  }

  if (page === 'CRM') {
    return <CRM onOpenNegotiation={openNegotiation} />
  }

  if (page === 'Mitarbeiter') {
    return <Mitarbeiter />
  }

  if (page === 'Firebase Monitor') {
    return <FirebaseMonitor />
  }

  return null
}

function NavigationContent({ page, setPage, user, logout, closeMobile, mobile = false }) {
  const choose = (title) => {
    setPage(title)
    closeMobile?.()
  }

  return (
    <Stack sx={{ height: '100%', bgcolor: 'background.paper' }}>
      <Box sx={{ px: 2.4, py: 2.25, minHeight: headerHeight, display: 'flex', alignItems: 'center' }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box sx={{ width: 43, height: 43, flexShrink: 0, borderRadius: 3, display: 'grid', placeItems: 'center', color: 'white', background: 'linear-gradient(145deg,#173c8d,#2d67e4)', boxShadow: '0 8px 18px rgba(36,87,214,.22)' }}>
            <ShieldRoundedIcon />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={880} lineHeight={1.1} noWrap>Sven Business</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '.08em' }}>SUITE 5.0</Typography>
          </Box>
        </Stack>
        {mobile && (
          <IconButton onClick={closeMobile} aria-label="Navigation schließen"><CloseRoundedIcon /></IconButton>
        )}
      </Box>

      <Divider />

      <Box sx={{ px: 2.5, pt: 2.5, pb: 0.8 }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontSize: '.68rem' }}>ARBEITSBEREICHE</Typography>
      </Box>
      <List sx={{ px: 1.35, py: 0.5 }}>
        {navigation.map((item) => {
          const Icon = item.icon
          const selected =
  page === (item.page || item.title)
          return (
            <ListItemButton
              key={item.title}
              selected={selected}
              onClick={() =>
  choose(item.page || item.title)
}
              sx={{
                position: 'relative',
                mb: 0.45,
                borderRadius: 2.5,
                minHeight: 52,
                px: 1.35,
                color: selected ? 'primary.main' : 'text.secondary',
                '&::before': selected ? { content: '""', position: 'absolute', left: -1, top: 11, bottom: 11, width: 3, borderRadius: 4, bgcolor: 'primary.main' } : undefined,
                '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.main' },
                '&.Mui-selected:hover': { bgcolor: 'primary.light' },
                '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 42, color: 'inherit' }}><Icon fontSize="small" /></ListItemIcon>
              <ListItemText
                primary={item.title}
                secondary={item.description}
                primaryTypographyProps={{ fontWeight: selected ? 820 : 700, fontSize: '.94rem' }}
                secondaryTypographyProps={{ fontSize: '.72rem', color: selected ? 'primary.main' : 'text.secondary', sx: { opacity: selected ? 0.72 : 0.8 } }}
              />
            </ListItemButton>
          )
        })}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <Box sx={{ px: 2, pb: 1.5 }}>
        <Paper elevation={0} sx={{ p: 1.4, border: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 34, height: 34, borderRadius: 2.3, display: 'grid', placeItems: 'center', bgcolor: '#e9f8f2', color: 'success.main' }}><CloudDoneRoundedIcon sx={{ fontSize: 19 }} /></Box>
            <Box>
              <Typography variant="body2" fontWeight={800}>Synchronisierung aktiv</Typography>
              <Typography variant="caption" color="text.secondary">Firebase verbunden</Typography>
            </Box>
          </Stack>
        </Paper>
      </Box>

      <Divider />
      <Box sx={{ p: 1.75 }}>
        <Stack direction="row" spacing={1.15} alignItems="center">
          <Avatar sx={{ width: 41, height: 41, bgcolor: 'primary.light', color: 'primary.main', fontWeight: 850 }}>{initialsFor(user)}</Avatar>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="body2" fontWeight={820} noWrap>{displayNameFor(user)}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">{user?.email}</Typography>
          </Box>
          <Tooltip title="Abmelden">
            <IconButton onClick={logout} size="small" aria-label="Abmelden"><LogoutRoundedIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Stack>
  )
}

function FixedHeader({ page, user, openMobileNavigation, logout, colorMode, toggleColorMode }) {
  const current = pageMeta[page] || pageMeta.Dashboard

  return (
    <AppBar
      position="fixed"
      elevation={0}
      color="inherit"
      sx={{
        width: { lg: `calc(100% - ${drawerWidth}px)` },
        ml: { lg: `${drawerWidth}px` },
        bgcolor: colorMode === 'dark' ? 'rgba(23,31,45,.94)' : 'rgba(255,255,255,.92)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        backdropFilter: 'blur(16px)',
        zIndex: (muiTheme) => muiTheme.zIndex.drawer - 1,
      }}
    >
      <Toolbar sx={{ minHeight: `${headerHeight}px !important`, px: { xs: 1.5, sm: 2.5, lg: 4 } }}>
        <IconButton
          edge="start"
          onClick={openMobileNavigation}
          aria-label="Navigation öffnen"
          sx={{ display: { lg: 'none' }, mr: 1 }}
        >
          <MenuRoundedIcon />
        </IconButton>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, fontWeight: 750 }}>
            Sven Business Suite / {current.title}
          </Typography>
          <Typography variant="h6" noWrap sx={{ fontSize: { xs: '1rem', sm: '1.18rem' } }}>{current.title}</Typography>
        </Box>

        <Stack direction="row" spacing={{ xs: 0.5, sm: 1.2 }} alignItems="center">
          <Chip
            icon={<CloudDoneRoundedIcon />}
            label="Online"
            size="small"
            sx={{ display: { xs: 'none', sm: 'flex' }, bgcolor: '#eaf8f3', color: '#147a58', '& .MuiChip-icon': { color: '#16865f' } }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' }, px: 0.5 }}>
            {formatDate(todayIso(), { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
          </Typography>
          <Divider orientation="vertical" flexItem sx={{ mx: { xs: 0.3, sm: 0.8 } }} />
          <Tooltip title={colorMode === 'dark' ? 'Normalmodus einschalten' : 'Darkmode einschalten'}>
            <IconButton onClick={toggleColorMode} aria-label={colorMode === 'dark' ? 'Normalmodus einschalten' : 'Darkmode einschalten'}>
              {colorMode === 'dark' ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
            </IconButton>
          </Tooltip>
          <Avatar sx={{ width: 38, height: 38, bgcolor: 'primary.light', color: 'primary.main', fontSize: '.82rem', fontWeight: 850 }}>{initialsFor(user)}</Avatar>
          <Tooltip title="Abmelden">
            <IconButton onClick={logout} aria-label="Abmelden" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}><LogoutRoundedIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
  )
}

function MobileNavigation({ page, setPage, openMore }) {
  const quickPages = ['Dashboard', 'Aufgaben', 'CRM']
  const value = quickPages.includes(page) ? page : 'Mehr'

  function navigate(_event, nextValue) {
    if (nextValue === 'Mehr') {
      openMore()
      return
    }
    setPage(nextValue)
  }

  return (
    <Paper
      elevation={10}
      square
      sx={{
        display: { xs: 'block', md: 'none' },
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (muiTheme) => muiTheme.zIndex.drawer + 2,
        borderTop: '1px solid #e2e8f0',
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      <BottomNavigation
        value={value}
        onChange={navigate}
        showLabels
        sx={{ height: 68, '& .MuiBottomNavigationAction-root': { minWidth: 0, color: '#7a8495' }, '& .Mui-selected': { color: 'primary.main' }, '& .MuiBottomNavigationAction-label': { fontSize: '.68rem', fontWeight: 750 } }}
      >
        <BottomNavigationAction label="Dashboard" value="Dashboard" icon={<DashboardRoundedIcon />} />
        <BottomNavigationAction label="Aufgaben" value="Aufgaben" icon={<TaskAltRoundedIcon />} />
        <BottomNavigationAction label="Lieferanten" value="CRM" icon={<BusinessRoundedIcon />} />
        <BottomNavigationAction label="Mehr" value="Mehr" icon={<MoreHorizRoundedIcon />} />
      </BottomNavigation>
    </Paper>
  )
}

function AuthenticatedArea({ user, colorMode, toggleColorMode }) {
  const [page, setPage] = useState('Dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [initialNegotiationId, setInitialNegotiationId] = useState('')

  function openNegotiation(id) {
    setInitialNegotiationId(id || '')
    setPage('Verhandlungen')
  }

  function clearInitialNegotiation() {
    setInitialNegotiationId('')
  }

  useEffect(() => {
    document.title = `${page} | Sven Business Suite 5.0`
  }, [page])

  async function logout() {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Abmelden fehlgeschlagen:', error)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box component="nav" aria-label="Hauptnavigation">
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', lg: 'block' },
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              borderRight: '1px solid #e5eaf2',
            },
          }}
        >
          <NavigationContent page={page} setPage={setPage} user={user} logout={logout} />
        </Drawer>

        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', lg: 'none' },
            '& .MuiDrawer-paper': {
              width: { xs: 'min(88vw, 320px)', sm: 320 },
              boxSizing: 'border-box',
            },
          }}
        >
          <NavigationContent
            page={page}
            setPage={setPage}
            user={user}
            logout={logout}
            closeMobile={() => setMobileOpen(false)}
            mobile
          />
        </Drawer>
      </Box>

      <FixedHeader
        page={page}
        user={user}
        openMobileNavigation={() => setMobileOpen(true)}
        logout={logout}
        colorMode={colorMode}
        toggleColorMode={toggleColorMode}
      />

      <Box
        component="main"
        sx={{
          ml: { lg: `${drawerWidth}px` },
          pt: `${headerHeight}px`,
          minHeight: '100vh',
        }}
      >
        <Box
          sx={{
            maxWidth: 1540,
            mx: 'auto',
            px: { xs: 1.75, sm: 3, lg: 4 },
            py: { xs: 2, sm: 3, lg: 3.5 },
            pb: { xs: 11, md: 4 },
          }}
        >
          <PageContent
            page={page}
            user={user}
            setPage={setPage}
            initialNegotiationId={initialNegotiationId}
            openNegotiation={openNegotiation}
            clearInitialNegotiation={clearInitialNegotiation}
          />
        </Box>
      </Box>

      <MobileNavigation page={page} setPage={setPage} openMore={() => setMobileOpen(true)} />
    </Box>
  )
}

function LoadingScreen() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default' }}>
      <Stack spacing={2} alignItems="center">
        <Box sx={{ width: 56, height: 56, borderRadius: 4, display: 'grid', placeItems: 'center', color: 'white', bgcolor: 'primary.main', boxShadow: '0 14px 30px rgba(36,87,214,.25)' }}>
          <ShieldRoundedIcon />
        </Box>
        <CircularProgress size={28} />
        <Typography variant="body2" color="text.secondary">Business Suite wird geladen …</Typography>
      </Stack>
    </Box>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [colorMode, setColorMode] = useState(() => localStorage.getItem('sven-suite-color-mode') === 'dark' ? 'dark' : 'light')
  const [checkingAuth, setCheckingAuth] = useState(true)

  const theme = useMemo(() => createAppTheme(colorMode), [colorMode])

  function toggleColorMode() {
    setColorMode((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      localStorage.setItem('sven-suite-color-mode', next)
      return next
    })
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setCheckingAuth(false)
    })
    return unsubscribe
  }, [])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {checkingAuth ? <LoadingScreen /> : user ? <AuthenticatedArea user={user} colorMode={colorMode} toggleColorMode={toggleColorMode} /> : <Login />}
    </ThemeProvider>
  )
}

export default App
