import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Users, Mail, Phone, MoreHorizontal, Pencil, Trash2, Upload, Download, FolderOpen, Clock } from 'lucide-react';
import type { Contact } from '@shared/types';
import ContactEditor from '../components/ContactEditor';
import ContactGroups from '../components/ContactGroups';
import ContactTimeline from '../components/ContactTimeline';
import { useActivityLog } from '../hooks/useActivityLog';
import { useToast } from '../contexts/ToastContext';

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupFilteredIds, setGroupFilteredIds] = useState<string[] | null>(null);
  const [showGroups, setShowGroups] = useState(true);
  const [timelineContact, setTimelineContact] = useState<Contact | null>(null);

  const { logContactCreated, logContactUpdated, logContactDeleted, logContactImported } = useActivityLog();
  const toast = useToast();

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    try {
      setLoading(true);
      const data = await window.envoy.contacts.list();
      setContacts(data);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleGroupFilterChange = useCallback((contactIds: string[] | null) => {
    setGroupFilteredIds(contactIds);
  }, []);

  const filteredContacts = contacts.filter((c) => {
    if (groupFilteredIds !== null && !groupFilteredIds.includes(c.id)) {
      return false;
    }
    return (
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.company?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleCreateContact = () => {
    setEditingContact(null);
    setShowEditor(true);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setShowEditor(true);
    setOpenMenuId(null);
  };

  const handleDeleteContact = async (contact: Contact) => {
    if (!confirm(`Delete contact "${contact.name}"?`)) return;
    try {
      await window.envoy.contacts.delete(contact.id);
      setContacts(contacts.filter((c) => c.id !== contact.id));
      logContactDeleted(contact.id, contact.name);
      toast.success('Contact deleted', `"${contact.name}" has been removed`);
    } catch (error) {
      console.error('Failed to delete contact:', error);
      toast.error('Delete failed', 'Could not delete the contact');
    }
    setOpenMenuId(null);
  };

  const handleSaveContact = (savedContact: Contact) => {
    if (editingContact) {
      setContacts(contacts.map((c) => (c.id === savedContact.id ? savedContact : c)));
      logContactUpdated(savedContact.id, savedContact.name);
      toast.success('Contact saved', `"${savedContact.name}" has been updated`);
    } else {
      setContacts([savedContact, ...contacts]);
      logContactCreated(savedContact.id, savedContact.name);
      toast.success('Contact added', `"${savedContact.name}" has been created`);
    }
    setShowEditor(false);
    setEditingContact(null);
  };

  const handleImportCSV = async () => {
    try {
      const filePath = await window.envoy.dialog.openFile({
        title: 'Import Contacts from CSV',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      });
      if (!filePath) return;
      setImporting(true);
      const result = await window.envoy.contacts.import(filePath);
      if (result.imported > 0) {
        toast.success('Import complete', `${result.imported} contacts have been imported`);
        logContactImported(result.imported);
        await loadContacts();
      } else {
        toast.warning('No contacts imported', 'Please check your CSV format');
      }
    } catch (error) {
      console.error('Failed to import CSV:', error);
      toast.error('Import failed', 'Could not read the CSV file');
    } finally {
      setImporting(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const filePath = await window.envoy.dialog.saveFile({
        title: 'Export Contacts to CSV',
        defaultPath: `contacts-${new Date().toISOString().split('T')[0]}.csv`,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      });
      if (!filePath) return;
      setExporting(true);
      await window.envoy.contacts.export(filePath);
      toast.success('Export complete', 'Contacts have been saved to file');
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast.error('Export failed', 'Could not save contacts to file');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-full bg-white dark:bg-gray-900">
      {/* Contact Groups Sidebar */}
      {showGroups && (
        <ContactGroups
          contacts={contacts}
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
          onContactsFiltered={handleGroupFilterChange}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Contacts
              </h1>
              {selectedGroupId && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {filteredContacts.length} in group
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGroups(!showGroups)}
                className={`p-2 rounded-lg transition-colors ${
                  showGroups
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                title={showGroups ? 'Hide groups' : 'Show groups'}
              >
                <FolderOpen className="w-4 h-4" />
              </button>
              <button
                onClick={handleImportCSV}
                disabled={importing}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Import CSV"
              >
                <Upload className="w-4 h-4" />
              </button>
              <button
                onClick={handleExportCSV}
                disabled={contacts.length === 0 || exporting}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Export CSV"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleCreateContact}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add contact
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border-0 rounded-lg focus:ring-2 focus:ring-primary-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
          {loading ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
          ) : filteredContacts.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-medium mb-1">
                {selectedGroupId ? 'No contacts in this group' : 'No contacts yet'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                {selectedGroupId
                  ? 'Add contacts to this group'
                  : 'Add contacts to start sending messages'}
              </p>
              <button
                onClick={handleCreateContact}
                className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
              >
                Add a contact
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="group flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  onClick={() => handleEditContact(contact)}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-primary-100 dark:bg-[var(--primary-tint-50)] rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-700 dark:text-primary-300 font-medium text-sm">
                      {contact.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {contact.name}
                      </h3>
                      {contact.title && (
                        <span className="text-sm text-gray-400 dark:text-gray-500 truncate hidden sm:inline">
                          {contact.title}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-0.5">
                      {contact.email && (
                        <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                          <Mail className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[200px]">{contact.email}</span>
                        </span>
                      )}
                      {contact.phone && (
                        <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hidden md:flex">
                          <Phone className="w-3.5 h-3.5" />
                          {contact.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Company & Tags */}
                  <div className="hidden lg:flex items-center gap-4 flex-shrink-0">
                    {contact.company && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {contact.company}
                      </span>
                    )}
                    {contact.tags.length > 0 && (
                      <div className="flex gap-1">
                        {contact.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {contact.tags.length > 2 && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">+{contact.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === contact.id ? null : contact.id);
                      }}
                      className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="w-4 h-4 text-gray-500" />
                    </button>

                    {openMenuId === contact.id && (
                      <div className="absolute right-0 top-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-10 min-w-[140px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTimelineContact(contact);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-gray-700 dark:text-gray-300"
                        >
                          <Clock className="w-4 h-4" />
                          Timeline
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditContact(contact);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-gray-700 dark:text-gray-300"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteContact(contact);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contact Editor Modal */}
      {showEditor && (
        <ContactEditor
          contact={editingContact}
          onSave={handleSaveContact}
          onClose={() => {
            setShowEditor(false);
            setEditingContact(null);
          }}
        />
      )}

      {/* Contact Timeline Modal */}
      {timelineContact && (
        <ContactTimeline
          contact={timelineContact}
          onClose={() => setTimelineContact(null)}
        />
      )}

      {/* Click outside to close menu */}
      {openMenuId && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setOpenMenuId(null)}
        />
      )}
    </div>
  );
}
