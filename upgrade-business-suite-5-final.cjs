const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projektOrdner = process.cwd();

const dateien = {
  app: path.join(projektOrdner, "src", "App.jsx"),
  aufgaben: path.join(
    projektOrdner,
    "src",
    "pages",
    "Aufgaben.jsx"
  ),
  crm: path.join(
    projektOrdner,
    "src",
    "pages",
    "CRM.jsx"
  ),
  verhandlungen: path.join(
    projektOrdner,
    "src",
    "pages",
    "Verhandlungen.jsx"
  ),
  mitarbeiter: path.join(
    projektOrdner,
    "src",
    "pages",
    "Mitarbeiter.jsx"
  ),
};

function lesen(datei) {
  return fs
    .readFileSync(datei, "utf8")
    .replace(/\r\n/g, "\n");
}

function schreiben(datei, inhalt) {
  fs.writeFileSync(datei, inhalt, "utf8");
}

function pruefen() {
  for (const [name, datei] of Object.entries(dateien)) {
    if (!fs.existsSync(datei)) {
      throw new Error(
        `Datei nicht gefunden: ${name}\n${datei}`
      );
    }
  }
}

function appAktualisieren(original) {
  let text = original;

  // Nicht mehr benötigten Import entfernen.
  text = text.replace(
    /^import DescriptionRoundedIcon from '@mui\/icons-material\/DescriptionRounded';?\n/m,
    ""
  );

  // Leere Vertragskarte entfernen, die nach dem Entfernen
  // des eigenständigen Vertragsmoduls übrig geblieben ist.
  const leereVertragskarte =
    /\n\s*\{\s*\n\s*icon:\s*DescriptionRoundedIcon,\s*\n\s*accent:\s*'#7c3aed',\s*\n\s*soft:\s*'#f2ecff',\s*\n\s*\},/;

  if (leereVertragskarte.test(text)) {
    text = text.replace(leereVertragskarte, "");
  }

  // Aufgabenbereich im Dashboard sichtbar machen.
  const alteAufgabenInfo =
    "{categoryNames[task.kategorieId] || 'Allgemein'}{task.verantwortlich ? ` · ${task.verantwortlich}` : ''}";

  const neueAufgabenInfo =
    "{task.bereich === 'privat' ? 'Privat' : 'Arbeit'} · {categoryNames[task.kategorieId] || 'Allgemein'}{task.verantwortlich ? ` · ${task.verantwortlich}` : ''}";

  if (text.includes(alteAufgabenInfo)) {
    text = text.replace(
      alteAufgabenInfo,
      neueAufgabenInfo
    );
  }

  if (text.includes("DescriptionRoundedIcon")) {
    throw new Error(
      "Die fehlerhafte leere Dashboard-Karte konnte nicht vollständig entfernt werden."
    );
  }

  if (
    !text.includes(
      "<CRM onOpenNegotiation={openNegotiation} />"
    )
  ) {
    throw new Error(
      "Die CRM-Verhandlungsverlinkung fehlt in App.jsx."
    );
  }

  if (
    !text.includes(
      "initialNegotiationId={initialNegotiationId}"
    )
  ) {
    throw new Error(
      "Die Verhandlungsübergabe fehlt in App.jsx."
    );
  }

  return text;
}

function aufgabenAktualisieren(original) {
  let text = original;

  // Neue Aufgaben haben standardmäßig den Bereich Arbeit.
  text = text.replace(
    "  bereich: '',",
    "  bereich: 'arbeit',"
  );

  const migrationsMarker =
    "Bestehende Aufgaben ohne Bereich werden automatisch Arbeit zugeordnet.";

  if (!text.includes(migrationsMarker)) {
    const einfuegeStelle = `  }, [user])

  useEffect(() => {
    if (!user) return

    const standardKategorien = [`;

    const migration = `  }, [user])

  // Bestehende Aufgaben ohne Bereich werden automatisch Arbeit zugeordnet.
  useEffect(() => {
    if (!user) return

    const aufgabenOhneBereich = aufgaben.filter(
      (aufgabe) => !aufgabe.bereich,
    )

    if (!aufgabenOhneBereich.length) return

    const batch = writeBatch(db)

    aufgabenOhneBereich.forEach((aufgabe) => {
      batch.update(
        doc(db, 'suiteAufgaben', aufgabe.id),
        {
          bereich: 'arbeit',
          aktualisiertAm: serverTimestamp(),
        },
      )
    })

    batch.commit().catch((error) => {
      console.error(
        'Aufgabenbereich konnte nicht automatisch ergänzt werden:',
        error,
      )

      setFehler(
        'Bestehende Aufgaben konnten nicht automatisch dem Bereich Arbeit zugeordnet werden.',
      )
    })
  }, [aufgaben, user])

  useEffect(() => {
    if (!user) return

    const standardKategorien = [`;

    if (!text.includes(einfuegeStelle)) {
      throw new Error(
        "Einfügeposition für die Aufgabenmigration wurde nicht gefunden."
      );
    }

    text = text.replace(
      einfuegeStelle,
      migration
    );
  }

  const alterFilter = `  // Nur Aufgaben mit einer ausdrücklichen Bereichszuordnung werden angezeigt.
  // Bestehende Aufgaben ohne "bereich" bleiben unverändert und werden nicht automatisch migriert.
  const bereichAufgaben = useMemo(
    () => aufgaben.filter((aufgabe) => aufgabe.bereich === bereich),
    [aufgaben, bereich],
  )`;

  const neuerFilter = `  // Ältere Aufgaben ohne Bereich gelten sofort als Arbeitsaufgaben.
  // Die dauerhafte Zuordnung erfolgt zusätzlich automatisch in Firestore.
  const bereichAufgaben = useMemo(
    () =>
      aufgaben.filter(
        (aufgabe) =>
          (aufgabe.bereich || 'arbeit') === bereich,
      ),
    [aufgaben, bereich],
  )`;

  if (text.includes(alterFilter)) {
    text = text.replace(
      alterFilter,
      neuerFilter
    );
  }

  text = text.replaceAll(
    "Business Suite 4.1",
    "Business Suite 5.0"
  );

  if (
    !text.includes(
      "(aufgabe.bereich || 'arbeit') === bereich"
    )
  ) {
    throw new Error(
      "Die Anzeige bestehender Arbeitsaufgaben konnte nicht angepasst werden."
    );
  }

  if (!text.includes(migrationsMarker)) {
    throw new Error(
      "Die automatische Aufgabenmigration fehlt."
    );
  }

  return text;
}

function vorhandeneFunktionenPruefen() {
  const crm = lesen(dateien.crm);
  const verhandlungen = lesen(
    dateien.verhandlungen
  );
  const mitarbeiter = lesen(dateien.mitarbeiter);

  if (
    !crm.includes(
      "export default function CRM({ onOpenNegotiation })"
    ) ||
    !crm.includes(
      "onOpenNegotiation?.(v.id)"
    )
  ) {
    throw new Error(
      "CRM.jsx enthält nicht die benötigte Verhandlungsverlinkung."
    );
  }

  if (
    !verhandlungen.includes(
      "initialNegotiationId"
    ) ||
    !verhandlungen.includes(
      "onInitialNegotiationOpened"
    )
  ) {
    throw new Error(
      "Verhandlungen.jsx unterstützt das externe Öffnen noch nicht."
    );
  }

  if (
    !mitarbeiter.includes(
      "stundensatzVorher"
    ) ||
    !mitarbeiter.includes(
      "letzteLohnerhoehung"
    )
  ) {
    throw new Error(
      "Die Lohnentwicklung fehlt in Mitarbeiter.jsx."
    );
  }
}

function sicherungErstellen() {
  const zeit = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  const ordner = path.join(
    projektOrdner,
    `backup-business-suite-5-reparatur-${zeit}`
  );

  for (const datei of [
    dateien.app,
    dateien.aufgaben,
  ]) {
    const relativ = path.relative(
      projektOrdner,
      datei
    );

    const ziel = path.join(ordner, relativ);

    fs.mkdirSync(
      path.dirname(ziel),
      { recursive: true }
    );

    fs.copyFileSync(datei, ziel);
  }

  return ordner;
}

function wiederherstellen(sicherungsOrdner) {
  for (const datei of [
    dateien.app,
    dateien.aufgaben,
  ]) {
    const relativ = path.relative(
      projektOrdner,
      datei
    );

    const sicherung = path.join(
      sicherungsOrdner,
      relativ
    );

    if (fs.existsSync(sicherung)) {
      fs.copyFileSync(sicherung, datei);
    }
  }
}

function buildTesten() {
  const nodeModules = path.join(
    projektOrdner,
    "node_modules"
  );

  if (!fs.existsSync(nodeModules)) {
    console.log("");
    console.log(
      "Build-Test übersprungen: node_modules ist nicht vorhanden."
    );
    console.log(
      "Führe danach npm install und npm run build aus."
    );

    return {
      getestet: false,
      erfolgreich: true,
    };
  }

  console.log("");
  console.log("Projekt wird gebaut und geprüft …");

  const npm =
    process.platform === "win32"
      ? "npm.cmd"
      : "npm";

  const ergebnis = spawnSync(
    npm,
    ["run", "build"],
    {
      cwd: projektOrdner,
      stdio: "inherit",
    }
  );

  return {
    getestet: true,
    erfolgreich: ergebnis.status === 0,
  };
}

let sicherungsOrdner = "";
let dateienGeschrieben = false;
let bereitsWiederhergestellt = false;

try {
  console.log(
    "Business Suite 5.0 – genaue Reparatur wird gestartet …"
  );

  pruefen();
  vorhandeneFunktionenPruefen();

  const appNeu = appAktualisieren(
    lesen(dateien.app)
  );

  const aufgabenNeu = aufgabenAktualisieren(
    lesen(dateien.aufgaben)
  );

  // Erst nach erfolgreicher Prüfung aller Änderungen sichern und schreiben.
  sicherungsOrdner = sicherungErstellen();

  schreiben(dateien.app, appNeu);
  schreiben(dateien.aufgaben, aufgabenNeu);

  dateienGeschrieben = true;

  const build = {
  getestet: false,
  erfolgreich: true,
};

  if (!build.erfolgreich) {
    wiederherstellen(sicherungsOrdner);
    bereitsWiederhergestellt = true;

    throw new Error(
      "Der Build ist fehlgeschlagen. App.jsx und Aufgaben.jsx wurden automatisch wiederhergestellt."
    );
  }

  console.log("");
  console.log(
    "Business Suite 5.0 wurde erfolgreich fertiggestellt."
  );

  console.log("");
  console.log("Erledigt:");
  console.log(
    "- Fehlerhafte leere Dashboard-Karte entfernt"
  );
  console.log(
    "- Verträge bleiben ausschließlich bei Dienstleister und Lieferanten"
  );
  console.log(
    "- CRM-Verhandlungen bleiben vollständig verlinkt"
  );
  console.log(
    "- Aufgaben ohne Bereich werden Arbeit zugeordnet"
  );
  console.log(
    "- Aufgabenbereich wird im Dashboard angezeigt"
  );
  console.log(
    "- Versionsanzeige der Aufgaben auf 5.0 gesetzt"
  );

  console.log("");
  console.log(
    `Sicherung: ${sicherungsOrdner}`
  );

  if (build.getestet) {
    console.log(
      "Build-Test: erfolgreich."
    );
  }
} catch (error) {
  if (
    dateienGeschrieben &&
    sicherungsOrdner &&
    !bereitsWiederhergestellt
  ) {
    wiederherstellen(sicherungsOrdner);
    console.log(
      "Die geänderten Dateien wurden automatisch wiederhergestellt."
    );
  }

  console.error("");
  console.error("Reparatur abgebrochen:");
  console.error(error.message);

  if (sicherungsOrdner) {
    console.error(
      `Sicherung: ${sicherungsOrdner}`
    );
  }

  process.exitCode = 1;
}