export const SUPPORTED_LANGUAGES = [
  "EN",
  "JP",
  "TH",
  "VN",
  "FR",
  "ES",
  "DE",
  "ZH",
  "KR",
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: LanguageCode = "EN";
export const LANGUAGE_STORAGE_KEY = "jutsu-play-language-v1";

export const LANGUAGE_OPTIONS: Array<{ code: LanguageCode; label: string }> = [
  { code: "EN", label: "English" },
  { code: "JP", label: "日本語" },
  { code: "TH", label: "ไทย" },
  { code: "VN", label: "Tiếng Việt" },
  { code: "FR", label: "Français" },
  { code: "ES", label: "Español" },
  { code: "DE", label: "Deutsch" },
  { code: "ZH", label: "中文" },
  { code: "KR", label: "한국어" },
];

const HTML_LANG_BY_CODE: Record<LanguageCode, string> = {
  EN: "en",
  JP: "ja",
  TH: "th",
  VN: "vi",
  FR: "fr",
  ES: "es",
  DE: "de",
  ZH: "zh",
  KR: "ko",
};

interface TranslationNode {
  [key: string]: string | TranslationNode;
}

export const TRANSLATIONS: Record<LanguageCode, TranslationNode> = {
  EN: {
    menu: {
      languageLabel: "Language",
      trainMasterRankUp: "TRAIN • MASTER • RANK UP",
      syncingAccount: "SYNCING ACCOUNT...",
      accountLinkRequired: "ACCOUNT LINK REQUIRED",
      enterAcademy: "ENTER ACADEMY",
      settings: "SETTINGS",
      tutorial: "TUTORIAL",
      about: "ABOUT",
      signOut: "SIGN OUT",
      quit: "QUIT",
      muteMenuMusic: "Mute Menu Music",
      unmuteMenuMusic: "Unmute Menu Music",
    },
    modeSelect: {
      title: "SELECT YOUR PATH",
      subtitle: "CHOOSE YOUR TRAINING",
      freeObstaclePlay: "FREE OBSTACLE / PLAY",
      rankMode: "RANK MODE",
      jutsuLibrary: "JUTSU LIBRARY",
      multiplayerLocked: "MULTIPLAYER (LOCKED)",
      questBoard: "QUEST BOARD",
      leaderboard: "LEADERBOARD",
      back: "BACK",
    },
    common: {
      back: "BACK",
      backToMenu: "Back to Menu",
      backToSelectPath: "BACK TO SELECT PATH",
      cancel: "CANCEL",
      continue: "Continue",
      done: "DONE",
      next: "NEXT",
      prev: "PREV",
      retry: "RETRY",
    },
    calibration: {
      requiredTitle: "CALIBRATION REQUIRED",
      requiredSubtitle: "Complete one calibration to unlock Free Play and Rank Mode.",
      noCameraFeed: "NO CAMERA FEED",
      cameraUnavailableFallback: "Camera unavailable for calibration.",
      lightLabel: "LIGHT",
      modelLabel: "MODEL",
      detectedLabel: "DETECTED",
      confidenceLabel: "CONF",
      samplesLabel: "SAMPLES",
      progressLabel: "PROGRESS",
      statusLabel: "Calibration status",
      ready: "READY",
      missing: "MISSING",
      serverClockSynced: "Server clock synced",
      localFallbackClock: "Using local fallback clock",
      cameraLabel: "Camera",
      scan: "SCAN",
      scanBusy: "SCAN...",
      startCalibration: "START CALIBRATION",
      retryCamera: "RETRY CAMERA",
      keepHandsVisible: "Keep both hands visible and move naturally.",
      pressScanIfNoFeed: "Press SCAN if no camera feed appears.",
      lightState: {
        good: "GOOD",
        low_light: "LOW LIGHT",
        overexposed: "OVEREXPOSED",
        low_contrast: "LOW CONTRAST",
      },
    },
    settings: {
      title: "SETTINGS",
      subtitle: "Menu settings mirror the pygame controls.",
      musicVolume: "Music Volume",
      sfxVolume: "SFX Volume",
      cameraSetup: "Camera Setup",
      scanning: "SCANNING...",
      scanCameras: "SCAN CAMERAS",
      cameraDevice: "Camera Device",
      cameraLabel: "Camera",
      cameraPreview: "Camera Preview",
      showHandSkeleton: "Show Hand Skeleton",
      restrictedSignsAlwaysOn: "Restricted Signs (Require 2 Hands) - Always On",
      fullscreen: "Fullscreen",
      runCalibration: "RUN CALIBRATION",
      saveAndBack: "SAVE & BACK",
    },
    tutorial: {
      step: "STEP",
      skip: "SKIP",
      finish: "FINISH",
    },
    leaderboard: {
      speedrunTitleLine: "SPEEDRUN LEADERBOARD",
      levelTitleLine: "LEVEL LEADERBOARD",
      fastestVerifiedClearsFor: "Fastest verified clears for",
      levelSubtitle: "Top shinobi ranked by LV and XP.",
      hallOfFame: "HALL OF FAME",
      speedrunTab: "SPEEDRUN",
      levelTab: "LEVEL",
      previousMode: "Previous leaderboard mode",
      nextMode: "Next leaderboard mode",
      colRank: "Rank",
      colShinobi: "Shinobi",
      colTime: "Time",
      colTitle: "Title",
      colLv: "LV",
      colXp: "XP",
      loading: "Summoning scrolls...",
      noRecordsFor: "No",
      recordsFound: "records found.",
      noLevelRecordsFound: "No level leaderboard records found yet.",
      page: "PAGE",
      entries: "ENTRIES",
    },
    announcement: {
      title: "Announcement",
    },
    maintenance: {
      label: "Maintenance",
      title: "Jutsu Academy Temporarily Offline",
      statusDiscord: "STATUS / DISCORD",
    },
    update: {
      label: "Mandatory Update",
      title: "Client Update Required",
      current: "Current",
      required: "Required",
      latest: "latest",
      getUpdate: "GET UPDATE",
      reload: "RELOAD",
    },
    mastery: {
      masteryUnlocked: "MASTERY UNLOCKED",
      newBest: "NEW BEST",
      firstRecord: "FIRST RECORD",
      newBestTime: "NEW BEST TIME",
      unranked: "UNRANKED",
      unlocked: "Unlocked!",
      up: "UP",
      down: "DOWN",
      bronze: "BRONZE",
      silver: "SILVER",
      gold: "GOLD",
      toGo: "to go",
    },
    levelUp: {
      title: "LEVEL UP",
      newJutsuUnlocked: "New Jutsu Unlocked",
      more: "more",
      awesome: "Awesome",
    },
    logout: {
      title: "Sign Out?",
      subtitle: "Sign out and clear this Discord session?",
      helper: "You can log back in anytime.",
    },
    connection: {
      title: "Connection Lost",
      configMissing: "Configuration Missing",
      supabaseUnavailable: "Supabase environment is unavailable.",
      lineNetworkInterrupted: "Network connection interrupted.",
      lineSessionTerminated: "Session has been terminated.",
      exitToLogin: "EXIT TO LOGIN",
    },
    quit: {
      title: "Leaving so soon?",
      subtitle: "QUIT in web signs out your Discord session and returns you to login.",
      confirm: "YES, QUIT",
      stay: "STAY",
    },
    multiplayer: {
      lockedDescription: "Online multiplayer matchmaking and anti-cheat flow are not enabled in this web build yet.",
      joinDiscordForUpdates: "JOIN DISCORD FOR UPDATES",
    },
  },
  JP: {
    menu: {
      languageLabel: "言語",
      trainMasterRankUp: "鍛錬 • 極める • 昇格",
      syncingAccount: "アカウント同期中...",
      accountLinkRequired: "アカウント連携が必要",
      enterAcademy: "アカデミーに入る",
      settings: "設定",
      tutorial: "チュートリアル",
      about: "概要",
      signOut: "サインアウト",
      quit: "終了",
      muteMenuMusic: "メニュー音楽をミュート",
      unmuteMenuMusic: "メニュー音楽のミュート解除",
    },
    modeSelect: {
      title: "進む道を選べ",
      subtitle: "修行を選択",
      freeObstaclePlay: "フリー障害物 / プレイ",
      rankMode: "ランクモード",
      jutsuLibrary: "術ライブラリ",
      multiplayerLocked: "マルチプレイ (ロック)",
      questBoard: "クエストボード",
      leaderboard: "リーダーボード",
      back: "戻る",
    },
  },
  TH: {
    menu: {
      languageLabel: "ภาษา",
      trainMasterRankUp: "ฝึก • เชี่ยวชาญ • เลื่อนแรงก์",
      syncingAccount: "กำลังซิงก์บัญชี...",
      accountLinkRequired: "ต้องเชื่อมบัญชี",
      enterAcademy: "เข้าอะคาเดมี",
      settings: "ตั้งค่า",
      tutorial: "สอนเล่น",
      about: "เกี่ยวกับ",
      signOut: "ออกจากระบบ",
      quit: "ออกเกม",
      muteMenuMusic: "ปิดเสียงเพลงเมนู",
      unmuteMenuMusic: "เปิดเสียงเพลงเมนู",
    },
    modeSelect: {
      title: "เลือกเส้นทางของคุณ",
      subtitle: "เลือกการฝึกของคุณ",
      freeObstaclePlay: "ฟรีอุปสรรค / เล่น",
      rankMode: "โหมดแรงก์",
      jutsuLibrary: "คลังคาถา",
      multiplayerLocked: "หลายผู้เล่น (ล็อก)",
      questBoard: "กระดานเควสต์",
      leaderboard: "ลีดเดอร์บอร์ด",
      back: "ย้อนกลับ",
    },
  },
  VN: {
    menu: {
      languageLabel: "Ngôn ngữ",
      trainMasterRankUp: "LUYỆN • TINH THÔNG • THĂNG HẠNG",
      syncingAccount: "ĐANG DONG BO TAI KHOAN...",
      accountLinkRequired: "CAN LIEN KET TAI KHOAN",
      enterAcademy: "VAO HOC VIEN",
      settings: "CAI DAT",
      tutorial: "HUONG DAN",
      about: "THONG TIN",
      signOut: "DANG XUAT",
      quit: "THOAT",
      muteMenuMusic: "Tat nhac menu",
      unmuteMenuMusic: "Bat nhac menu",
    },
    modeSelect: {
      title: "CHON CON DUONG CUA BAN",
      subtitle: "CHON KHOA LUYEN",
      freeObstaclePlay: "TU DO VAT CAN / CHOI",
      rankMode: "CHE DO XEP HANG",
      jutsuLibrary: "THU VIEN JUTSU",
      multiplayerLocked: "NHIỀU NGƯỜI CHƠI (KHÓA)",
      questBoard: "BANG NHIEM VU",
      leaderboard: "BANG XEP HANG",
      back: "QUAY LAI",
    },
  },
  FR: {
    menu: {
      languageLabel: "Langue",
      trainMasterRankUp: "ENTRAINE • MAITRISE • MONTE EN RANG",
      syncingAccount: "SYNCHRONISATION DU COMPTE...",
      accountLinkRequired: "LIEN DU COMPTE REQUIS",
      enterAcademy: "ENTRER DANS L ACADEMIE",
      settings: "PARAMETRES",
      tutorial: "TUTORIEL",
      about: "A PROPOS",
      signOut: "SE DECONNECTER",
      quit: "QUITTER",
      muteMenuMusic: "Couper la musique du menu",
      unmuteMenuMusic: "Activer la musique du menu",
    },
    modeSelect: {
      title: "CHOISIS TON VOIE",
      subtitle: "CHOISIS TON ENTRAINEMENT",
      freeObstaclePlay: "OBSTACLE LIBRE / JOUER",
      rankMode: "MODE CLASSEMENT",
      jutsuLibrary: "BIBLIOTHEQUE JUTSU",
      multiplayerLocked: "MULTIJOUEUR (VERROUILLE)",
      questBoard: "TABLEAU DES QUETES",
      leaderboard: "CLASSEMENT",
      back: "RETOUR",
    },
  },
  ES: {
    menu: {
      languageLabel: "Idioma",
      trainMasterRankUp: "ENTRENA • DOMINA • SUBE DE RANGO",
      syncingAccount: "SINCRONIZANDO CUENTA...",
      accountLinkRequired: "SE REQUIERE VINCULO DE CUENTA",
      enterAcademy: "ENTRAR A LA ACADEMIA",
      settings: "AJUSTES",
      tutorial: "TUTORIAL",
      about: "ACERCA DE",
      signOut: "CERRAR SESION",
      quit: "SALIR",
      muteMenuMusic: "Silenciar musica del menu",
      unmuteMenuMusic: "Activar musica del menu",
    },
    modeSelect: {
      title: "SELECCIONA TU CAMINO",
      subtitle: "ELIGE TU ENTRENAMIENTO",
      freeObstaclePlay: "OBSTACULO LIBRE / JUGAR",
      rankMode: "MODO RANGO",
      jutsuLibrary: "BIBLIOTECA JUTSU",
      multiplayerLocked: "MULTIJUGADOR (BLOQUEADO)",
      questBoard: "TABLON DE MISIONES",
      leaderboard: "CLASIFICACION",
      back: "ATRAS",
    },
  },
  DE: {
    menu: {
      languageLabel: "Sprache",
      trainMasterRankUp: "TRAINIEREN • MEISTERN • AUFSTEIGEN",
      syncingAccount: "KONTO WIRD SYNCHRONISIERT...",
      accountLinkRequired: "KONTOVERKNUPFUNG ERFORDERLICH",
      enterAcademy: "AKADEMIE BETRETEN",
      settings: "EINSTELLUNGEN",
      tutorial: "TUTORIAL",
      about: "INFO",
      signOut: "ABMELDEN",
      quit: "BEENDEN",
      muteMenuMusic: "Menumusik stummschalten",
      unmuteMenuMusic: "Menumusik einschalten",
    },
    modeSelect: {
      title: "WAHLE DEINEN PFAD",
      subtitle: "WAHLE DEIN TRAINING",
      freeObstaclePlay: "FREIES HINDERNIS / SPIELEN",
      rankMode: "RANGMODUS",
      jutsuLibrary: "JUTSU BIBLIOTHEK",
      multiplayerLocked: "MEHRSPIELER (GESPERRT)",
      questBoard: "QUEST BOARD",
      leaderboard: "BESTENLISTE",
      back: "ZURUCK",
    },
  },
  ZH: {
    menu: {
      languageLabel: "语言",
      trainMasterRankUp: "训练 • 精通 • 晋级",
      syncingAccount: "正在同步账号...",
      accountLinkRequired: "需要账号绑定",
      enterAcademy: "进入学院",
      settings: "设置",
      tutorial: "教程",
      about: "关于",
      signOut: "退出登录",
      quit: "退出",
      muteMenuMusic: "静音菜单音乐",
      unmuteMenuMusic: "取消静音菜单音乐",
    },
    modeSelect: {
      title: "选择你的道路",
      subtitle: "选择你的训练",
      freeObstaclePlay: "自由障碍 / 游玩",
      rankMode: "排位模式",
      jutsuLibrary: "忍术库",
      multiplayerLocked: "多人模式 (锁定)",
      questBoard: "任务板",
      leaderboard: "排行榜",
      back: "返回",
    },
  },
  KR: {
    menu: {
      languageLabel: "언어",
      trainMasterRankUp: "훈련 • 숙련 • 승급",
      syncingAccount: "계정 동기화 중...",
      accountLinkRequired: "계정 연동 필요",
      enterAcademy: "아카데미 입장",
      settings: "설정",
      tutorial: "튜토리얼",
      about: "정보",
      signOut: "로그아웃",
      quit: "종료",
      muteMenuMusic: "메뉴 음악 음소거",
      unmuteMenuMusic: "메뉴 음악 음소거 해제",
    },
    modeSelect: {
      title: "진로 선택",
      subtitle: "훈련을 선택하세요",
      freeObstaclePlay: "자유 장애물 / 플레이",
      rankMode: "랭크 모드",
      jutsuLibrary: "술법 라이브러리",
      multiplayerLocked: "멀티플레이어 (잠김)",
      questBoard: "퀘스트 보드",
      leaderboard: "리더보드",
      back: "뒤로",
    },
  },
};

function readTranslationPath(tree: TranslationNode, keyPath: string): string {
  const tokens = keyPath.split(".").map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0) return "";

  let cursor: TranslationNode | string = tree;
  for (const token of tokens) {
    if (typeof cursor === "string") return "";
    const next: string | TranslationNode | undefined = cursor[token];
    if (typeof next === "undefined") return "";
    cursor = next;
  }

  return typeof cursor === "string" ? cursor : "";
}

export function isLanguageCode(value: unknown): value is LanguageCode {
  const normalized = String(value || "").trim().toUpperCase();
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(normalized);
}

export function toLanguageCode(value: unknown): LanguageCode {
  const normalized = String(value || "").trim().toUpperCase();
  if (isLanguageCode(normalized)) return normalized as LanguageCode;
  return DEFAULT_LANGUAGE;
}

export function toHtmlLanguage(value: LanguageCode): string {
  return HTML_LANG_BY_CODE[value] || "en";
}

export function tFromLanguage(language: LanguageCode, keyPath: string, fallback = ""): string {
  const primary = readTranslationPath(TRANSLATIONS[language], keyPath);
  if (primary) return primary;
  const english = readTranslationPath(TRANSLATIONS.EN, keyPath);
  if (english) return english;
  if (fallback) return fallback;
  return keyPath;
}
