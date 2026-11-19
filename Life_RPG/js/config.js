/* =======================================================================
   CONFIG.JS — Default settings, daily quests, mobile layout order & quotes
   ======================================================================= */

const QUOTES = [
    "“The secret of getting ahead is getting started.” — Mark Twain",
    "“It does not matter how slowly you go as long as you do not stop.” — Confucius",
    "“Everything you’ve ever wanted is on the other side of fear.” — George Addair",
    "“Amateurs sit and wait for inspiration, the rest of us just get up and go to work.” — Stephen King",
    "“We are what we repeatedly do. Excellence, then, is not an act, but a habit.” — Will Durant",
    "“You don’t have to be great to start, but you have to start to be great.” — Zig Ziglar",
    "“Action is the foundational key to all success.” — Pablo Picasso",
    "“Do what you can, with what you have, where you are.” — Theodore Roosevelt"
];

const CHUNK_META = {
    todo:            { label: 'To-Do List',          hasRows: true,  defaultRows: 8 },
    focusChamber:    { label: 'Focus Chamber',       hasRows: false },
    blindBox:        { label: 'Blind Box Challenge', hasRows: false },
    dailyQuests:     { label: 'Daily Quests',        hasRows: true,  defaultRows: 3 },
    wallet:          { label: 'Wallet Balance',      hasRows: false },
    focusGoal:       { label: "Today's Focus Goal",  hasRows: false },
    studyRecords:    { label: 'Study Records',       hasRows: true,  defaultRows: 6 },
    walletLedger:    { label: 'Wallet Ledger',       hasRows: true,  defaultRows: 6 },
    blindBoxHistory: { label: 'Blind Box History',   hasRows: true,  defaultRows: 4 },
    character:       { label: 'Character Profile',   hasRows: false }
};

const DEFAULT_MOBILE_ORDER = [
    'todo',
    'focusChamber',
    'blindBox',
    'dailyQuests',
    'wallet',
    'focusGoal',
    'studyRecords',
    'walletLedger',
    'blindBoxHistory',
    'character'
];

const DEFAULT_MOBILE_COLLAPSED = {
    todo: false,
    focusChamber: false,
    blindBox: false,
    dailyQuests: true,
    wallet: true,
    focusGoal: true,
    studyRecords: true,
    walletLedger: true,
    blindBoxHistory: true,
    character: true
};

const DEFAULT_CHUNK_ROWS = {
    todo: 8,
    dailyQuests: 3,
    studyRecords: 6,
    walletLedger: 6,
    blindBoxHistory: 4
};

const DEFAULT_SETTINGS = {
    theme: 'elegant-dark',
    fontSize: 'normal',
    dailyCap: 160,
    monthlyCap: 4500,
    initialReserve: 500,
    baseWorkHours: 4,
    stretchWorkHours: 8,
    focusBlockMinutes: 40,
    focusBlockReward: 15,
    extraFocusMinutes: 10,
    extraFocusReward: 3,
    todoRewardMode: 'fixed', // 'fixed' | 'blindbox'
    todoRewardAmount: 1,     // HK$ when mode === 'fixed'
    walletCollapsedMetric: 'earning', // 'earning' | 'spent' | 'month' | 'none'
    mobileOrder: [...DEFAULT_MOBILE_ORDER],
    mobileDefaultCollapsed: { ...DEFAULT_MOBILE_COLLAPSED },
    chunkRows: { ...DEFAULT_CHUNK_ROWS },
    quests: [
        { id: 'q1', icon: '💧', category: 'Essentials', name: 'Drink water', xp: 1, limit: 8, hasInput: false },
        { id: 'q2', icon: '🚶', category: 'Essentials', name: 'Move your body', xp: 1, limit: 4, hasInput: false },
        { id: 'q3', icon: '🏊', category: 'Essentials', name: 'Swim / exercise (20m)', xp: 5, limit: 2, hasInput: false },
        { id: 'q4', icon: '👀', category: 'Essentials', name: 'Eye break', xp: 1, limit: 3, hasInput: false },
        { id: 'q5', icon: '🧘', category: 'Essentials', name: 'Morning core training', xp: 2, limit: 1, hasInput: false },
        { id: 'q6', icon: '⏰', category: 'Essentials', name: 'Get up on time', xp: 8, limit: 1, hasInput: true },
        { id: 'q7', icon: '🌙', category: 'Essentials', name: 'Go to bed on time', xp: 8, limit: 1, hasInput: true },
        { id: 'q8', icon: '📱', category: 'Essentials', name: 'Meet phone-use goal', xp: 8, limit: 1, hasInput: true },
        { id: 'q9', icon: '📖', category: 'Essentials', name: 'Read before bed (10m)', xp: 3, limit: 1, hasInput: false },
        { id: 'q10', icon: '✅', category: 'Essentials', name: 'Write a Done List', xp: 2, limit: 1, hasInput: false },
        { id: 'q11', icon: '🎒', category: 'Essentials', name: 'Prepare for tomorrow', xp: 3, limit: 1, hasInput: false },
        { id: 's1', icon: '📄', category: 'Scholar', name: 'Read a research paper (15m)', xp: 3, limit: 2, hasInput: false },
        { id: 's2', icon: '📝', category: 'Scholar', name: 'Write research notes (10m)', xp: 3, limit: 2, hasInput: false },
        { id: 's3', icon: '📊', category: 'Scholar', name: 'Study stats / methods (15m)', xp: 4, limit: 2, hasInput: false },
        { id: 's4', icon: '💻', category: 'Scholar', name: 'Practice technical skills (20m)', xp: 5, limit: 2, hasInput: false },
        { id: 's5', icon: '🗣️', category: 'Scholar', name: 'Practice academic English (10m)', xp: 3, limit: 1, hasInput: false },
        { id: 's6', icon: '🎯', category: 'Scholar', name: 'Complete MIT', xp: 20, limit: 1, hasInput: false },
        { id: 's7', icon: '📓', category: 'Scholar', name: 'Write Research Log', xp: 3, limit: 1, hasInput: false },
        { id: 's8', icon: '🗓️', category: 'Scholar', name: "Plan tomorrow's MIT", xp: 3, limit: 1, hasInput: false }
    ]
};
