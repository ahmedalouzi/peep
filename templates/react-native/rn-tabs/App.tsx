import { StyleSheet, View, Text, SafeAreaView, Pressable } from 'react-native';
import { useState } from 'react';

const TABS = ['Home', 'Search', 'Profile'] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Home');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        <Text style={styles.screenTitle}>{activeTab}</Text>
        <Text style={styles.screenSub}>This is the {activeTab} screen</Text>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            style={styles.tabItem}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {tab === 'Home' ? '🏠' : tab === 'Search' ? '🔍' : '👤'}
            </Text>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f0f6fc',
    marginBottom: 8,
  },
  screenSub: {
    fontSize: 14,
    color: '#6e7681',
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    backgroundColor: '#161b22',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  tabLabel: {
    fontSize: 20,
    opacity: 0.5,
  },
  tabLabelActive: {
    opacity: 1,
  },
  tabText: {
    fontSize: 10,
    color: '#6e7681',
  },
  tabTextActive: {
    color: '#a78bfa',
    fontWeight: '600',
  },
});
