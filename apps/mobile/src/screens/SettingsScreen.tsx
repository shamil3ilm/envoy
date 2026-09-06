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
import { collectMobileBackup } from '../services/BackupService';
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
                <Text style={styles.sectionSubtitle}>Export a JSON snapshot of your data</Text>
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
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
