import React, { useState, useCallback } from 'react';
import {
  Alert,
  View,
  Text,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Vibration,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useSettings } from '../contexts/SettingsContext';
import { useDatabase, useDatabaseReady } from '../contexts/DatabaseContext';
import {
  collectMobileBackup,
  parseBackupEnvelope,
  restoreMobileBackup,
  type ParsedBackupSummary,
} from '../services/BackupService';
import { TextInput } from 'react-native';
import type {
  NotificationSoundType,
  NotificationSound,
  VibrationPattern,
} from '@envoy/shared';
import { VIBRATION_OPTIONS } from '@envoy/shared';

const SOUND_OPTIONS: { value: NotificationSound; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'chime', label: 'Chime' },
  { value: 'alert', label: 'Alert' },
  { value: 'alarm', label: 'Alarm' },
  { value: 'gentle', label: 'Gentle' },
  { value: 'silent', label: 'Silent' },
];

const NOTIFICATION_TYPES: {
  type: NotificationSoundType;
  label: string;
  description: string;
  emoji: string;
}[] = [
  { type: 'reminders', label: 'General Reminders', description: 'Follow-ups, tasks, and custom reminders', emoji: '🔔' },
  { type: 'medical', label: 'Medical Reminders', description: 'Medication and health-related alerts', emoji: '💊' },
  { type: 'scheduled', label: 'Scheduled Messages', description: 'When a scheduled message is sent', emoji: '📤' },
];

// Vibration patterns in milliseconds [wait, vibrate, wait, vibrate, ...]
const VIBRATION_PATTERNS: Record<VibrationPattern, number | number[]> = {
  default: 400,
  short: 100,
  long: 800,
  double: [0, 150, 100, 150],
  urgent: [0, 200, 100, 200, 100, 200],
  off: 0,
};

type SettingsSection = 'notifications' | 'vibration';

export default function SettingsScreen() {
  const { settings, updatePreferences } = useSettings();
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [expandedSection, setExpandedSection] = useState<SettingsSection | null>(null);
  const [exporting, setExporting] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreJson, setRestoreJson] = useState('');
  const [restoreSummary, setRestoreSummary] = useState<ParsedBackupSummary | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const exportBackup = useCallback(async () => {
    if (!ready || !db) {
      Alert.alert('Database not ready yet');
      return;
    }
    setExporting(true);
    try {
      const envelope = await collectMobileBackup(db, '1.0.0');
      const json = JSON.stringify(envelope, null, 2);
      const total = Object.values(envelope.counts).reduce((sum, n) => sum + n, 0);
      await Share.share(
        {
          title: 'Envoy backup',
          message: json,
        },
        { subject: `envoy-backup-${envelope.exportedAt.slice(0, 10)}.json` }
      );
      Toast.show({
        type: 'success',
        text1: `Exported ${total} records`,
        text2: 'Save the JSON somewhere safe.',
      });
    } catch (err) {
      console.error('Export backup failed', err);
      Alert.alert('Could not export data');
    } finally {
      setExporting(false);
    }
  }, [db, ready]);

  const previewRestore = useCallback(() => {
    setRestoreError(null);
    setRestoreSummary(null);
    const trimmed = restoreJson.trim();
    if (!trimmed) {
      setRestoreError('Paste a backup JSON first');
      return;
    }
    try {
      const { summary } = parseBackupEnvelope(trimmed);
      setRestoreSummary(summary);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Invalid backup');
    }
  }, [restoreJson]);

  const runRestore = useCallback(async () => {
    if (!ready || !db) {
      Alert.alert('Database not ready yet');
      return;
    }
    if (!restoreSummary) {
      Alert.alert('Preview the backup first');
      return;
    }
    Alert.alert(
      'Restore backup?',
      `Merge ${restoreSummary.totalRecords} records into the current database?` +
        '\n\nRows with a matching id will update in place. Nothing will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setRestoring(true);
            try {
              const { envelope } = parseBackupEnvelope(restoreJson.trim());
              const result = await restoreMobileBackup(db as any, envelope);
              Toast.show({
                type: 'success',
                text1: `Restored ${result.totalApplied} records`,
                text2:
                  Object.values(result.skipped).reduce((s, n) => s + n, 0) > 0
                    ? 'Some rows were skipped (check console)'
                    : undefined,
              });
              setRestoreOpen(false);
              setRestoreJson('');
              setRestoreSummary(null);
            } catch (err) {
              console.error('Restore failed', err);
              Alert.alert('Restore failed', err instanceof Error ? err.message : 'Unknown error');
            } finally {
              setRestoring(false);
            }
          },
        },
      ]
    );
  }, [db, ready, restoreJson, restoreSummary]);

  const [checkingIntegrity, setCheckingIntegrity] = useState(false);
  const runIntegrityCheck = useCallback(async () => {
    if (!ready || !db) {
      Alert.alert('Database not ready yet');
      return;
    }
    setCheckingIntegrity(true);
    try {
      const result = await db.checkIntegrity();
      if (result.ok) {
        Toast.show({ type: 'success', text1: 'Database integrity OK' });
      } else {
        Alert.alert(
          'Integrity issues found',
          result.issues.length > 0
            ? result.issues.slice(0, 5).join('\n')
            : 'PRAGMA integrity_check reported problems.'
        );
      }
    } catch (err) {
      console.error('Integrity check failed', err);
      Alert.alert('Integrity check failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCheckingIntegrity(false);
    }
  }, [db, ready]);

  const toggleSection = useCallback((section: SettingsSection) => {
    setExpandedSection(prev => prev === section ? null : section);
  }, []);

  const currentSounds = settings.preferences?.notificationSounds || {
    reminders: 'default',
    medical: 'alarm',
    scheduled: 'default',
  };

  const currentVibration = settings.preferences?.notificationVibration || {
    reminders: 'default',
    medical: 'urgent',
    scheduled: 'short',
  };

  const handleSoundChange = useCallback((type: NotificationSoundType, value: NotificationSound) => {
    updatePreferences({
      notificationSounds: { ...currentSounds, [type]: value },
    });
  }, [currentSounds, updatePreferences]);

  const handleVibrationChange = useCallback((type: NotificationSoundType, value: VibrationPattern) => {
    updatePreferences({
      notificationVibration: { ...currentVibration, [type]: value },
    });
    // Trigger a preview vibration
    const pattern = VIBRATION_PATTERNS[value];
    if (pattern && value !== 'off') {
      if (Array.isArray(pattern)) {
        Vibration.vibrate(pattern);
      } else {
        Vibration.vibrate(pattern);
      }
    }
  }, [currentVibration, updatePreferences]);

  const testVibration = useCallback((pattern: VibrationPattern) => {
    const vibPattern = VIBRATION_PATTERNS[pattern];
    if (vibPattern && pattern !== 'off') {
      if (Array.isArray(vibPattern)) {
        Vibration.vibrate(vibPattern);
      } else {
        Vibration.vibrate(vibPattern);
      }
    }
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>App preferences and configuration</Text>
        </View>

        {/* Notification Sounds Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection('notifications')}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#dbeafe' }]}>
                <Text style={styles.iconEmoji}>🔊</Text>
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Notification Sounds</Text>
                <Text style={styles.sectionSubtitle}>Choose sounds for each notification type</Text>
              </View>
            </View>
            <Text style={styles.chevron}>
              {expandedSection === 'notifications' ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {expandedSection === 'notifications' && (
            <View style={styles.sectionContent}>
              {NOTIFICATION_TYPES.map(({ type, label, description, emoji }) => {
                const currentSound = currentSounds[type] || 'default';
                return (
                  <View key={type} style={styles.settingCard}>
                    <View style={styles.settingCardHeader}>
                      <Text style={styles.settingEmoji}>{emoji}</Text>
                      <View style={styles.settingCardText}>
                        <Text style={styles.settingLabel}>{label}</Text>
                        <Text style={styles.settingDescription}>{description}</Text>
                      </View>
                    </View>
                    <View style={styles.optionRow}>
                      {SOUND_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            styles.optionChip,
                            currentSound === opt.value && styles.optionChipActive,
                          ]}
                          onPress={() => handleSoundChange(type, opt.value)}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              currentSound === opt.value && styles.optionChipTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Vibration Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection('vibration')}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#f3e8ff' }]}>
                <Text style={styles.iconEmoji}>📳</Text>
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Vibration</Text>
                <Text style={styles.sectionSubtitle}>Vibration patterns for notifications</Text>
              </View>
            </View>
            <Text style={styles.chevron}>
              {expandedSection === 'vibration' ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {expandedSection === 'vibration' && (
            <View style={styles.sectionContent}>
              {NOTIFICATION_TYPES.map(({ type, label, description, emoji }) => {
                const currentPattern = currentVibration[type] || 'default';
                return (
                  <View key={type} style={styles.settingCard}>
                    <View style={styles.settingCardHeader}>
                      <Text style={styles.settingEmoji}>{emoji}</Text>
                      <View style={styles.settingCardText}>
                        <Text style={styles.settingLabel}>{label}</Text>
                        <Text style={styles.settingDescription}>{description}</Text>
                      </View>
                    </View>
                    <View style={styles.optionRow}>
                      {VIBRATION_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            styles.optionChip,
                            currentPattern === opt.value && styles.optionChipActiveVibration,
                          ]}
                          onPress={() => handleVibrationChange(type, opt.value)}
                          onLongPress={() => testVibration(opt.value)}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              currentPattern === opt.value && styles.optionChipTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {currentPattern !== 'off' && (
                      <TouchableOpacity
                        style={styles.testButton}
                        onPress={() => testVibration(currentPattern)}
                      >
                        <Text style={styles.testButtonText}>Test Vibration</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              <View style={styles.hintCard}>
                <Text style={styles.hintText}>
                  Tap a pattern to select it. Press "Test Vibration" to preview.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Data & Backup Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
                <Text style={styles.iconEmoji}>💾</Text>
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Data & Backup</Text>
                <Text style={styles.sectionSubtitle}>Export or restore a JSON snapshot</Text>
              </View>
            </View>
          </View>
          <View style={styles.sectionContent}>
            <TouchableOpacity
              style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
              onPress={exportBackup}
              disabled={exporting}
            >
              <Text style={styles.exportButtonText}>
                {exporting ? 'Exporting…' : 'Export data'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.exportHint}>
              Uses the system share sheet — send the JSON to iCloud Drive, Google Drive,
              email, or a messaging app. Email account credentials are not included.
            </Text>

            <View style={styles.restoreDivider} />

            {!restoreOpen ? (
              <TouchableOpacity
                style={styles.restoreOpenButton}
                onPress={() => setRestoreOpen(true)}
              >
                <Text style={styles.restoreOpenText}>Restore from JSON…</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <Text style={styles.restoreLabel}>Paste backup JSON</Text>
                <TextInput
                  style={styles.restoreInput}
                  value={restoreJson}
                  onChangeText={(v) => {
                    setRestoreJson(v);
                    setRestoreSummary(null);
                    setRestoreError(null);
                  }}
                  placeholder='{"version":1,"exportedAt":"…","entities":{…}}'
                  placeholderTextColor="#9ca3af"
                  multiline
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {restoreError && <Text style={styles.restoreError}>{restoreError}</Text>}
                {restoreSummary && (
                  <View style={styles.restorePreview}>
                    <Text style={styles.restorePreviewTitle}>Preview</Text>
                    <Text style={styles.restorePreviewLine}>
                      Exported: {new Date(restoreSummary.exportedAt).toLocaleString()}
                    </Text>
                    <Text style={styles.restorePreviewLine}>
                      From app version: {restoreSummary.appVersion}
                    </Text>
                    <Text style={styles.restorePreviewLine}>
                      Records: {restoreSummary.totalRecords}
                    </Text>
                  </View>
                )}
                <View style={styles.restoreActions}>
                  <TouchableOpacity
                    style={styles.restoreCancelButton}
                    onPress={() => {
                      setRestoreOpen(false);
                      setRestoreJson('');
                      setRestoreSummary(null);
                      setRestoreError(null);
                    }}
                  >
                    <Text style={styles.restoreCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.restorePreviewButton}
                    onPress={previewRestore}
                  >
                    <Text style={styles.restorePreviewButtonText}>Preview</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.restoreApplyButton,
                      (!restoreSummary || restoring) && styles.restoreApplyDisabled,
                    ]}
                    onPress={runRestore}
                    disabled={!restoreSummary || restoring}
                  >
                    <Text style={styles.restoreApplyText}>
                      {restoring ? 'Restoring…' : 'Restore'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Diagnostics Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#fef3c7' }]}>
                <Text style={styles.iconEmoji}>🩺</Text>
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Diagnostics</Text>
                <Text style={styles.sectionSubtitle}>Check that the on-device DB is healthy</Text>
              </View>
            </View>
          </View>
          <View style={styles.sectionContent}>
            <TouchableOpacity
              style={[styles.restoreOpenButton, checkingIntegrity && styles.exportButtonDisabled]}
              onPress={runIntegrityCheck}
              disabled={checkingIntegrity}
            >
              <Text style={styles.restoreOpenText}>
                {checkingIntegrity ? 'Checking…' : 'Run integrity check'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.exportHint}>
              Runs PRAGMA integrity_check on the SQLite file. If issues surface,
              restore from a recent backup and report the details.
            </Text>
          </View>
        </View>

        {/* Version Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Envoy Mobile v1.0.0</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconEmoji: {
    fontSize: 20,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  chevron: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 8,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  settingCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  settingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  settingEmoji: {
    fontSize: 20,
    marginRight: 10,
  },
  settingCardText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  settingDescription: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  optionChipActive: {
    backgroundColor: '#3b82f6',
  },
  optionChipActiveVibration: {
    backgroundColor: '#8b5cf6',
  },
  optionChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  optionChipTextActive: {
    color: '#ffffff',
  },
  testButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  testButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8b5cf6',
  },
  hintCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
  },
  hintText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  exportButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonDisabled: {
    backgroundColor: '#a7f3d0',
  },
  exportButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  exportHint: {
    marginTop: 8,
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 15,
  },
  restoreDivider: {
    marginVertical: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
  },
  restoreOpenButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  restoreOpenText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  restoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  restoreInput: {
    minHeight: 120,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    padding: 12,
    fontSize: 12,
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlignVertical: 'top',
  },
  restoreError: {
    marginTop: 8,
    fontSize: 12,
    color: '#dc2626',
  },
  restorePreview: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
  },
  restorePreviewTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338ca',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  restorePreviewLine: {
    fontSize: 12,
    color: '#1e1b4b',
    marginBottom: 2,
  },
  restoreActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  restoreCancelButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreCancelText: { color: '#6b7280', fontSize: 13, fontWeight: '500' },
  restorePreviewButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  restorePreviewButtonText: { color: 'white', fontSize: 13, fontWeight: '600' },
  restoreApplyButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreApplyDisabled: {
    backgroundColor: '#d1d5db',
  },
  restoreApplyText: { color: 'white', fontSize: 13, fontWeight: '600' },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
