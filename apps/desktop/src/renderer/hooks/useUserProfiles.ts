import { useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import {
  USER_PROFILES,
  EXPENSE_CATEGORIES,
  type UserProfileCategory,
} from '@shared/types';

export function useUserProfiles() {
  const { preferences, updatePreferences } = useSettings();

  const enabledProfiles = preferences.userProfiles || [];

  const customExpenseCategories = preferences.customExpenseCategories || {};

  // Merge all expense categories from enabled profiles + base categories + custom
  const allExpenseCategories = useMemo(() => {
    const merged: Record<string, { label: string; icon: string; color: string }> = {
      ...EXPENSE_CATEGORIES,
    };
    for (const profileId of enabledProfiles) {
      const profile = USER_PROFILES[profileId];
      if (profile) {
        Object.assign(merged, profile.expenseCategories);
      }
    }
    Object.assign(merged, customExpenseCategories);
    return merged;
  }, [enabledProfiles, customExpenseCategories]);

  // Merge task tag suggestions
  const suggestedTaskTags = useMemo(() => {
    const tags = new Set<string>();
    for (const profileId of enabledProfiles) {
      const profile = USER_PROFILES[profileId];
      if (profile) {
        profile.taskTags.forEach(t => tags.add(t));
      }
    }
    return Array.from(tags);
  }, [enabledProfiles]);

  // Merge template suggestions
  const suggestedTemplateNames = useMemo(() => {
    const names = new Set<string>();
    for (const profileId of enabledProfiles) {
      const profile = USER_PROFILES[profileId];
      if (profile) {
        profile.templateSuggestions.forEach(n => names.add(n));
      }
    }
    return Array.from(names);
  }, [enabledProfiles]);

  // Merge snippet suggestions
  const suggestedSnippets = useMemo(() => {
    const snippets: { name: string; shortcut: string; content: string }[] = [];
    const seen = new Set<string>();
    for (const profileId of enabledProfiles) {
      const profile = USER_PROFILES[profileId];
      if (profile) {
        for (const s of profile.snippetSuggestions) {
          if (!seen.has(s.shortcut)) {
            seen.add(s.shortcut);
            snippets.push(s);
          }
        }
      }
    }
    return snippets;
  }, [enabledProfiles]);

  const isProfileEnabled = (profileId: UserProfileCategory) =>
    enabledProfiles.includes(profileId);

  const toggleProfile = async (profileId: UserProfileCategory) => {
    const current = enabledProfiles;
    const updated = current.includes(profileId)
      ? current.filter(p => p !== profileId)
      : [...current, profileId];
    await updatePreferences({ userProfiles: updated });
  };

  return {
    enabledProfiles,
    isProfileEnabled,
    toggleProfile,
    allExpenseCategories,
    suggestedTaskTags,
    suggestedTemplateNames,
    suggestedSnippets,
    hasAnyProfile: enabledProfiles.length > 0,
  };
}
