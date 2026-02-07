import { useState, useEffect } from 'react';
import {
  Plus,
  Users,
  MoreVertical,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Folder,
  FolderOpen,
} from 'lucide-react';
import type { ContactGroup, Contact } from '@shared/types';
import { useToast } from '../../contexts/ToastContext';

// Predefined colors for groups
const GROUP_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Yellow', value: '#EAB308' },
];

interface ContactGroupsProps {
  contacts: Contact[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  onContactsFiltered?: (contactIds: string[] | null) => void;
}

export default function ContactGroups({
  contacts,
  selectedGroupId,
  onSelectGroup,
  onContactsFiltered,
}: ContactGroupsProps) {
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ContactGroup | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      const group = groups.find((g) => g.id === selectedGroupId);
      if (group) {
        onContactsFiltered?.(group.contactIds);
      }
    } else {
      onContactsFiltered?.(null);
    }
  }, [selectedGroupId, groups, onContactsFiltered]);

  async function loadGroups() {
    try {
      setLoading(true);
      const data = await window.envoy.groups.list();
      setGroups(data);
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateGroup = () => {
    setEditingGroup(null);
    setShowEditor(true);
  };

  const handleEditGroup = (group: ContactGroup) => {
    setEditingGroup(group);
    setShowEditor(true);
    setOpenMenuId(null);
  };

  const handleDeleteGroup = async (group: ContactGroup) => {
    if (!confirm(`Delete group "${group.name}"? Contacts will not be deleted.`)) {
      return;
    }
    try {
      await window.envoy.groups.delete(group.id);
      setGroups(groups.filter((g) => g.id !== group.id));
      if (selectedGroupId === group.id) {
        onSelectGroup(null);
      }
      toast.success('Group deleted', `"${group.name}" has been removed`);
    } catch (error) {
      console.error('Failed to delete group:', error);
      toast.error('Failed to delete group', 'Please try again');
    }
    setOpenMenuId(null);
  };

  const handleSaveGroup = async (data: {
    name: string;
    description?: string;
    color: string;
    contactIds: string[];
  }) => {
    try {
      if (editingGroup) {
        const updated = await window.envoy.groups.update(editingGroup.id, data);
        setGroups(groups.map((g) => (g.id === updated.id ? updated : g)));
        toast.success('Group updated', `"${updated.name}" has been saved`);
      } else {
        const created = await window.envoy.groups.create(data);
        setGroups([...groups, created]);
        toast.success('Group created', `"${created.name}" has been added`);
      }
      setShowEditor(false);
      setEditingGroup(null);
    } catch (error) {
      console.error('Failed to save group:', error);
      toast.error('Failed to save group', 'Please try again');
    }
  };

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const getGroupContacts = (group: ContactGroup) => {
    return contacts.filter((c) => group.contactIds.includes(c.id));
  };

  if (loading) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
        Loading groups...
      </div>
    );
  }

  return (
    <div className="border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 w-64 flex-shrink-0 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Groups
          </h3>
          <button
            onClick={handleCreateGroup}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="Create group"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* All Contacts */}
      <div className="flex-1 overflow-y-auto">
        <button
          onClick={() => onSelectGroup(null)}
          className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
            selectedGroupId === null
              ? 'bg-primary-50 dark:bg-[var(--primary-tint-20)] text-primary-700 dark:text-primary-300'
              : 'text-gray-700 dark:text-gray-200'
          }`}
        >
          <Users className={`w-4 h-4 ${selectedGroupId === null ? '' : 'text-gray-500 dark:text-gray-300'}`} />
          <span className="font-medium">All Contacts</span>
          <span className="ml-auto text-xs text-gray-500 dark:text-gray-300">
            {contacts.length}
          </span>
        </button>

        {/* Groups List */}
        {groups.length === 0 ? (
          <div className="p-4 text-center">
            <Folder className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No groups yet
            </p>
            <button
              onClick={handleCreateGroup}
              className="mt-2 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              Create your first group
            </button>
          </div>
        ) : (
          <div className="py-1">
            {groups.map((group) => {
              const groupContacts = getGroupContacts(group);
              const isExpanded = expandedGroups.has(group.id);
              const isSelected = selectedGroupId === group.id;

              return (
                <div key={group.id}>
                  <div
                    className={`flex items-center gap-1 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      isSelected
                        ? 'bg-primary-50 dark:bg-[var(--primary-tint-20)]'
                        : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleGroupExpanded(group.id)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                    </button>

                    <button
                      onClick={() => onSelectGroup(group.id)}
                      className="flex-1 flex items-center gap-2 text-left text-sm"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      {isExpanded ? (
                        <FolderOpen className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                      ) : (
                        <Folder className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                      )}
                      <span
                        className={
                          isSelected
                            ? 'text-primary-700 dark:text-primary-300 font-medium'
                            : 'text-gray-700 dark:text-gray-300'
                        }
                      >
                        {group.name}
                      </span>
                      <span className="ml-auto text-xs text-gray-500 dark:text-gray-300">
                        {groupContacts.length}
                      </span>
                    </button>

                    <div className="relative">
                      <button
                        onClick={() =>
                          setOpenMenuId(openMenuId === group.id ? null : group.id)
                        }
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === group.id && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                          <button
                            onClick={() => handleEditGroup(group)}
                            className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(group)}
                            className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 flex items-center gap-2"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded contacts */}
                  {isExpanded && groupContacts.length > 0 && (
                    <div className="ml-8 py-1">
                      {groupContacts.slice(0, 5).map((contact) => (
                        <div
                          key={contact.id}
                          className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 truncate"
                        >
                          {contact.name}
                        </div>
                      ))}
                      {groupContacts.length > 5 && (
                        <div className="px-3 py-1 text-xs text-gray-500 italic">
                          +{groupContacts.length - 5} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Group Editor Modal */}
      {showEditor && (
        <GroupEditorModal
          group={editingGroup}
          contacts={contacts}
          onSave={handleSaveGroup}
          onClose={() => {
            setShowEditor(false);
            setEditingGroup(null);
          }}
        />
      )}
    </div>
  );
}

// Group Editor Modal Component
interface GroupEditorModalProps {
  group: ContactGroup | null;
  contacts: Contact[];
  onSave: (data: {
    name: string;
    description?: string;
    color: string;
    contactIds: string[];
  }) => void;
  onClose: () => void;
}

function GroupEditorModal({
  group,
  contacts,
  onSave,
  onClose,
}: GroupEditorModalProps) {
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [color, setColor] = useState(group?.color || '#3B82F6');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(
    new Set(group?.contactIds || [])
  );
  const [contactSearch, setContactSearch] = useState('');

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.email?.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const handleToggleContact = (contactId: string) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      contactIds: Array.from(selectedContacts),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {group ? 'Edit Group' : 'Create Group'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 space-y-4 overflow-y-auto">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Group Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input w-full"
                placeholder="e.g., VIP Clients"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input w-full"
                placeholder="Optional description..."
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Color
              </label>
              <div className="flex gap-2 flex-wrap">
                {GROUP_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`w-8 h-8 rounded-full border-2 ${
                      color === c.value
                        ? 'border-gray-900 dark:border-white'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {/* Contacts */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Contacts ({selectedContacts.size} selected)
              </label>
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="input w-full mb-2"
                placeholder="Search contacts..."
              />
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                {filteredContacts.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500 text-center">
                    No contacts found
                  </div>
                ) : (
                  filteredContacts.map((contact) => (
                    <label
                      key={contact.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedContacts.has(contact.id)}
                        onChange={() => handleToggleContact(contact.id)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {contact.name}
                        </div>
                        {contact.email && (
                          <div className="text-xs text-gray-500 truncate">
                            {contact.email}
                          </div>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              {group ? 'Save Changes' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
