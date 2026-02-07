import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

export default function ContactsScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.center}>
          <Text style={styles.emoji}>👥</Text>
          <Text style={styles.title}>Contacts</Text>
          <Text style={styles.subtitle}>Contact management</Text>
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
});
