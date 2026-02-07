import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Settings2, Trash2, Coffee, Brain, X } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { format } from 'date-fns';

type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

interface TimerSettings {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  autoStartBreaks: boolean;
  sessionsBeforeLong: number;
}

interface FocusSession {
  id: string;
  startedAt: string;
  endedAt: string;
  mode: TimerMode;
  durationMinutes: number;
  completed: boolean;
}

const DEFAULT_SETTINGS: TimerSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  autoStartBreaks: false,
  sessionsBeforeLong: 4,
};

const SETTINGS_KEY = 'envoy-focus-timer-settings';
const SESSIONS_KEY = 'envoy-focus-timer-sessions';

const MODE_CONFIG: Record<TimerMode, { label: string; color: string; icon: React.ReactNode }> = {
  focus: { label: 'Focus', color: 'text-primary-600 dark:text-primary-400', icon: <Brain className="w-4 h-4" /> },
  shortBreak: { label: 'Short Break', color: 'text-green-600 dark:text-green-400', icon: <Coffee className="w-4 h-4" /> },
  longBreak: { label: 'Long Break', color: 'text-blue-600 dark:text-blue-400', icon: <Coffee className="w-4 h-4" /> },
};

export default function FocusTimer() {
  const toast = useToast();

  // Settings
  const [timerSettings, setTimerSettings] = useState<TimerSettings>(() => {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });
  const [showSettings, setShowSettings] = useState(false);

  // Timer state
  const [currentMode, setCurrentMode] = useState<TimerMode>('focus');
  const [timeRemaining, setTimeRemaining] = useState(timerSettings.focusDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);

  // Sessions
  const [sessions, setSessions] = useState<FocusSession[]>(() => {
    try {
      const data = localStorage.getItem(SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  });

  // Timer ref for visibility handling
  const expectedEndRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const getDuration = useCallback((mode: TimerMode) => {
    switch (mode) {
      case 'focus': return timerSettings.focusDuration * 60;
      case 'shortBreak': return timerSettings.shortBreakDuration * 60;
      case 'longBreak': return timerSettings.longBreakDuration * 60;
    }
  }, [timerSettings]);

  // Save settings
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(timerSettings));
  }, [timerSettings]);

  // Save sessions
  useEffect(() => {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }, [sessions]);

  // Timer countdown
  useEffect(() => {
    if (isRunning && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Handle timer complete
  useEffect(() => {
    if (timeRemaining === 0 && !isRunning) {
      handleTimerComplete();
    }
  }, [timeRemaining, isRunning]);

  // Handle visibility change (recalculate when tab becomes visible again)
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && isRunning && expectedEndRef.current) {
        const remaining = Math.max(0, Math.round((expectedEndRef.current - Date.now()) / 1000));
        setTimeRemaining(remaining);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isRunning]);

  // Track expected end time
  useEffect(() => {
    if (isRunning) {
      expectedEndRef.current = Date.now() + timeRemaining * 1000;
    } else {
      expectedEndRef.current = null;
    }
  }, [isRunning, timeRemaining]);

  const handleTimerComplete = () => {
    const config = MODE_CONFIG[currentMode];

    // Log session
    if (sessionStartedAt) {
      const session: FocusSession = {
        id: `session-${Date.now()}`,
        startedAt: sessionStartedAt,
        endedAt: new Date().toISOString(),
        mode: currentMode,
        durationMinutes: currentMode === 'focus' ? timerSettings.focusDuration
          : currentMode === 'shortBreak' ? timerSettings.shortBreakDuration
          : timerSettings.longBreakDuration,
        completed: true,
      };
      setSessions(prev => [session, ...prev.slice(0, 49)]);
      setSessionStartedAt(null);
    }

    if (currentMode === 'focus') {
      const newCount = completedSessions + 1;
      setCompletedSessions(newCount);
      toast.success(`${config.label} complete!`, `Session ${newCount} done. Time for a break!`);

      // Switch to break
      const nextMode: TimerMode = newCount % timerSettings.sessionsBeforeLong === 0 ? 'longBreak' : 'shortBreak';
      setCurrentMode(nextMode);
      setTimeRemaining(getDuration(nextMode));

      if (timerSettings.autoStartBreaks) {
        setTimeout(() => {
          setIsRunning(true);
          setSessionStartedAt(new Date().toISOString());
        }, 500);
      }
    } else {
      toast.success(`${config.label} over!`, 'Ready to focus again?');
      setCurrentMode('focus');
      setTimeRemaining(getDuration('focus'));
    }
  };

  const handleStart = () => {
    setIsRunning(true);
    if (!sessionStartedAt) {
      setSessionStartedAt(new Date().toISOString());
    }
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeRemaining(getDuration(currentMode));
    setSessionStartedAt(null);
  };

  const handleSkip = () => {
    setIsRunning(false);

    // Log as incomplete
    if (sessionStartedAt) {
      const session: FocusSession = {
        id: `session-${Date.now()}`,
        startedAt: sessionStartedAt,
        endedAt: new Date().toISOString(),
        mode: currentMode,
        durationMinutes: 0,
        completed: false,
      };
      setSessions(prev => [session, ...prev.slice(0, 49)]);
      setSessionStartedAt(null);
    }

    if (currentMode === 'focus') {
      const nextMode: TimerMode = (completedSessions + 1) % timerSettings.sessionsBeforeLong === 0 ? 'longBreak' : 'shortBreak';
      setCurrentMode(nextMode);
      setTimeRemaining(getDuration(nextMode));
    } else {
      setCurrentMode('focus');
      setTimeRemaining(getDuration('focus'));
    }
  };

  const switchMode = (mode: TimerMode) => {
    if (isRunning) return;
    setCurrentMode(mode);
    setTimeRemaining(getDuration(mode));
    setSessionStartedAt(null);
  };

  const clearSessions = () => {
    setSessions([]);
    localStorage.removeItem(SESSIONS_KEY);
  };

  // Format time
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const totalDuration = getDuration(currentMode);
  const progress = totalDuration > 0 ? ((totalDuration - timeRemaining) / totalDuration) * 100 : 0;

  // Today's stats
  const today = new Date().toDateString();
  const todaySessions = sessions.filter(s => new Date(s.startedAt).toDateString() === today);
  const todayFocusSessions = todaySessions.filter(s => s.mode === 'focus' && s.completed);
  const todayFocusMinutes = todayFocusSessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  const hasPanel = sessions.length > 0;

  return (
    <div className="min-h-full bg-white dark:bg-gray-900">
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Focus Timer</h1>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
          >
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
        <div className={`flex gap-8 ${hasPanel ? 'items-start' : 'justify-center'}`}>
        {/* Left: Timer */}
        <div className="w-full max-w-sm flex-shrink-0">
          {/* Mode tabs */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-8">
            {(['focus', 'shortBreak', 'longBreak'] as TimerMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => switchMode(mode)}
                disabled={isRunning}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  currentMode === mode
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50'
                }`}
              >
                {MODE_CONFIG[mode].icon}
                <span className="hidden sm:inline">{MODE_CONFIG[mode].label}</span>
              </button>
            ))}
          </div>

          {/* Timer display */}
          <div className="text-center mb-8">
            {/* Progress ring */}
            <div className="relative w-56 h-56 mx-auto mb-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="90" fill="none" strokeWidth="6"
                  className="stroke-gray-200 dark:stroke-gray-700" />
                <circle cx="100" cy="100" r="90" fill="none" strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 90}`}
                  strokeDashoffset={`${2 * Math.PI * 90 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  className={currentMode === 'focus' ? 'stroke-primary-500' : currentMode === 'shortBreak' ? 'stroke-green-500' : 'stroke-blue-500'}
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-mono font-bold text-gray-900 dark:text-white tabular-nums">
                  {timeDisplay}
                </span>
                <span className={`text-sm font-medium mt-1 ${MODE_CONFIG[currentMode].color}`}>
                  {MODE_CONFIG[currentMode].label}
                </span>
              </div>
            </div>

            {/* Session counter */}
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Session {completedSessions % timerSettings.sessionsBeforeLong + 1} of {timerSettings.sessionsBeforeLong}
            </p>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleReset}
                className="p-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
                title="Reset"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                onClick={isRunning ? handlePause : handleStart}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors shadow-lg ${
                  isRunning
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                }`}
              >
                {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>

              <button
                onClick={handleSkip}
                className="p-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
                title="Skip"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Timer Settings</h3>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {[
                { label: 'Focus (min)', key: 'focusDuration' as const },
                { label: 'Short break (min)', key: 'shortBreakDuration' as const },
                { label: 'Long break (min)', key: 'longBreakDuration' as const },
                { label: 'Sessions before long break', key: 'sessionsBeforeLong' as const },
              ].map(({ label, key }) => (
                <div key={key} className="flex items-center justify-between">
                  <label className="text-sm text-gray-600 dark:text-gray-400">{label}</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={timerSettings[key]}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1);
                      const updated = { ...timerSettings, [key]: val };
                      setTimerSettings(updated);
                      if (!isRunning) {
                        if (key === 'focusDuration' && currentMode === 'focus') setTimeRemaining(val * 60);
                        if (key === 'shortBreakDuration' && currentMode === 'shortBreak') setTimeRemaining(val * 60);
                        if (key === 'longBreakDuration' && currentMode === 'longBreak') setTimeRemaining(val * 60);
                      }
                    }}
                    className="w-16 px-2 py-1 text-sm text-right text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ))}

              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-600 dark:text-gray-400">Auto-start breaks</label>
                <button
                  onClick={() => setTimerSettings({ ...timerSettings, autoStartBreaks: !timerSettings.autoStartBreaks })}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    timerSettings.autoStartBreaks ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    timerSettings.autoStartBreaks ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Sessions history */}
        {hasPanel && (
          <div className="flex-1 min-w-0 max-w-md">
            {/* Today's stats */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Today</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{todayFocusSessions.length}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Sessions</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {todayFocusMinutes >= 60 ? `${Math.floor(todayFocusMinutes / 60)}h ${todayFocusMinutes % 60}m` : `${todayFocusMinutes}m`}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Focus time</div>
                </div>
              </div>
            </div>

            {/* Session history */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">History</h3>
              {sessions.length > 0 && (
                <button
                  onClick={clearSessions}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {sessions.slice(0, 20).map(session => {
                const config = MODE_CONFIG[session.mode];
                return (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className={config.color}>{config.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {config.label}
                        {!session.completed && (
                          <span className="text-xs text-gray-400 ml-1">(skipped)</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(session.startedAt), 'MMM d, h:mm a')}
                        {session.completed && ` · ${session.durationMinutes}min`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
