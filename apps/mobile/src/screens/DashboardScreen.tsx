import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.center}>
          <Text style={styles.emoji}>🏠</Text>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>
            Overview, stats, recent activity
          </Text>
          <Text style={styles.version}>Envoy Mobile v1.0.0</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.actionEmoji}>⚙️</Text>
            <Text style={styles.actionText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emoji: { fontSize: 48 },
  title: { marginTop: 16, fontSize: 24, fontWeight: 'bold', color: '#111827' },
  subtitle: { marginTop: 8, fontSize: 14, color: '#6b7280', textAlign: 'center' },
  version: { marginTop: 24, fontSize: 12, color: '#9ca3af' },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionEmoji: { fontSize: 24 },
  actionText: { marginTop: 8, fontSize: 13, fontWeight: '500', color: '#374151' },
});
