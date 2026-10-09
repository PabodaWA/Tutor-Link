import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeatureShell } from '@/components/feature-shell';
import { useAuth } from '@/context/auth-context';
import { useAppTheme } from '@/context/theme-context';
import { apiRequest } from '@/services/api';
import { SavedSearch, SavedSearchPayload, savedSearchApi } from './saved-searches';
import { Priority, ShortlistEntry, tutorShortlistApi } from './tutor-shortlist';
import { Tutor } from './types';

type Sort = 'rating' | 'rate_low' | 'rate_high' | 'newest';
type Availability = 'any' | 'today' | 'week';
type Experience = 'any' | 'New tutor' | '1-2 years' | '3+ years';
type Rating = 0 | 3 | 4 | 4.5;
type Filters = { minRate: string; maxRate: string; minRating: Rating; availability: Availability; experience: Experience };
type TutorResponse = { tutors: Tutor[]; pagination: { page: number; pages: number; total: number } };
const emptyFilters: Filters = { minRate: '', maxRate: '', minRating: 0, availability: 'any', experience: 'any' };

function availabilityLabel(value?: string) {
  if (!value) return 'No open slots';
  const date = new Date(value);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (left: Date, right: Date) => left.toDateString() === right.toDateString();
  const day = sameDay(date, today) ? 'Today' : sameDay(date, tomorrow) ? 'Tomorrow' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${day}, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

const featuredSubjects = ['Java', 'Mathematics', 'Databases', 'Web Dev'];

function savedSearchSummary(item: SavedSearch) {
  const details = [item.subject !== 'All' ? item.subject : 'All subjects'];
  if (item.query) details.push(`“${item.query}”`);
  if (item.filters.minRate || item.filters.maxRate) details.push(`Rs.${item.filters.minRate || 0}–${item.filters.maxRate || 'any'}`);
  if (item.filters.minRating) details.push(`${item.filters.minRating}+ stars`);
  if (item.filters.availability !== 'any') details.push(item.filters.availability === 'today' ? 'Today' : 'This week');
  if (item.filters.experience !== 'any') details.push(item.filters.experience);
  return details.join(' · ');
}

export function TutorDiscovery() {
  const { colors } = useAppTheme();
  const { token, user } = useAuth();
  const { subject: initialSubject, q: initialQuery } = useLocalSearchParams<{ subject?: string; q?: string }>();
  const queryParam = Array.isArray(initialQuery) ? initialQuery[0] : initialQuery || '';
  const [query, setQuery] = useState(queryParam);
  const [subject, setSubject] = useState(initialSubject || 'All');
  const [sort, setSort] = useState<Sort>('rating');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [refreshKey, setRefreshKey] = useState(0);
  const [shortlist, setShortlist] = useState<ShortlistEntry[]>([]);
  const [shortlistForToken, setShortlistForToken] = useState<string | null>(null);
  const [shortlistLoading, setShortlistLoading] = useState(true);
  const [shortlistError, setShortlistError] = useState('');
  const [shortlistBusy, setShortlistBusy] = useState(false);
  const [shortlistOpen, setShortlistOpen] = useState(false);
  const [shortlistMessage, setShortlistMessage] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savedSearchesForToken, setSavedSearchesForToken] = useState<string | null>(null);
  const [savedSearchesLoading, setSavedSearchesLoading] = useState(true);
  const [savedSearchesBusy, setSavedSearchesBusy] = useState(false);
  const [savedSearchesError, setSavedSearchesError] = useState('');
  const [savedSearchesMessage, setSavedSearchesMessage] = useState('');
  const [savedSearchesOpen, setSavedSearchesOpen] = useState(false);
  const [savedSearchName, setSavedSearchName] = useState('');
  const [editSavedSearchId, setEditSavedSearchId] = useState<string | null>(null);
  const [removeSavedSearchId, setRemoveSavedSearchId] = useState<string | null>(null);
  const visibleShortlist = shortlistForToken === token ? shortlist : [];
  const visibleSavedSearches = savedSearchesForToken === token ? savedSearches : [];
  const listedSubjects = subjects.length ? subjects : featuredSubjects;
  const browseSubjects = subject !== 'All' && !listedSubjects.includes(subject) ? [subject, ...listedSubjects] : listedSubjects;
  const activeFilterCount = useMemo(() => [!!filters.minRate, !!filters.maxRate, filters.minRating > 0, filters.availability !== 'any', filters.experience !== 'any'].filter(Boolean).length, [filters]);

  useEffect(() => {
    apiRequest<{ subjects: string[] }>('/tutors/subjects').then((data) => setSubjects(data.subjects)).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (user?.role !== 'student' || !token) return;
    let active = true;
    tutorShortlistApi.list(token)
      .then((data) => { if (active) { setShortlist(data.shortlist); setShortlistForToken(token); setShortlistError(''); } })
      .catch((requestError) => { if (active) setShortlistError(requestError instanceof Error ? requestError.message : 'Could not load shortlist.'); })
      .finally(() => { if (active) setShortlistLoading(false); });
    return () => { active = false; };
  }, [token, user?.role]);
  useEffect(() => {
    if (user?.role !== 'student' || !token) return;
    let active = true;
    savedSearchApi.list(token)
      .then((data) => { if (active) { setSavedSearches(data.savedSearches); setSavedSearchesForToken(token); setSavedSearchesError(''); } })
      .catch((requestError) => { if (active) setSavedSearchesError(requestError instanceof Error ? requestError.message : 'Could not load saved searches.'); })
      .finally(() => { if (active) setSavedSearchesLoading(false); });
    return () => { active = false; };
  }, [token, user?.role]);
  useEffect(() => {
    if (!initialSubject) return;
    const request = setTimeout(() => setSubject(initialSubject), 0);
    return () => clearTimeout(request);
  }, [initialSubject]);
  useEffect(() => {
    if (!queryParam) return;
    const request = setTimeout(() => setQuery(queryParam), 0);
    return () => clearTimeout(request);
  }, [queryParam]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true); setError('');
      const params = new URLSearchParams({ q: query.trim(), subject, sort });
      if (filters.minRate) params.set('minRate', filters.minRate);
      if (filters.maxRate) params.set('maxRate', filters.maxRate);
      if (filters.minRating) params.set('minRating', String(filters.minRating));
      if (filters.availability !== 'any') params.set('available', filters.availability);
      if (filters.experience !== 'any') params.set('experience', filters.experience);
      apiRequest<TutorResponse>(`/tutors?${params}`)
        .then((data) => { if (active) { setTutors(data.tutors); setPage(1); setPages(data.pagination.pages); setTotal(data.pagination.total); } })
        .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : 'Could not load tutors.'); })
        .finally(() => { if (active) setLoading(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [filters, query, refreshKey, sort, subject]);

  function toggleCompare(id: string) {
    setCompare((items) => {
      if (items.includes(id)) return items.filter((item) => item !== id);
      if (items.length === 3) {
        Alert.alert('Comparison full', 'You can compare up to three tutors. Remove one before adding another.');
        return items;
      }
      return [...items, id];
    });
  }
  function openFilters() { setDraft(filters); setFiltersOpen(true); }
  function applyFilters() {
    const min = draft.minRate ? Number(draft.minRate) : 0;
    const max = draft.maxRate ? Number(draft.maxRate) : 0;
    if (min < 0 || max < 0 || min > 100000 || max > 100000 || (min && max && min > max)) {
      Alert.alert('Invalid price range', 'Enter valid rates, with the minimum lower than the maximum.');
      return;
    }
    setFilters(draft); setFiltersOpen(false);
  }
  function clearAll() { setQuery(''); setSubject('All'); setFilters(emptyFilters); setDraft(emptyFilters); }
  function closeShortlist() { setShortlistOpen(false); setEditId(null); setRemoveId(null); }
  function startEdit(entry: ShortlistEntry) {
    setEditId(entry._id);
    setEditNote(entry.note);
    setEditPriority(entry.priority);
    setRemoveId(null);
    setShortlistError('');
  }
  async function addTutorToShortlist(tutorId: string) {
    if (!token || shortlistBusy) return;
    setShortlistBusy(true); setShortlistError('');
    try {
      const { entry } = await tutorShortlistApi.add(tutorId, token);
      setShortlist((items) => shortlistForToken === token ? [entry, ...items] : [entry]);
      setShortlistForToken(token);
      setShortlistMessage(`${entry.tutor?.name || 'Tutor'} added to your shortlist.`);
      setShortlistOpen(true);
    } catch (requestError) {
      setShortlistError(requestError instanceof Error ? requestError.message : 'Could not add tutor.');
      setShortlistOpen(true);
    } finally { setShortlistBusy(false); }
  }
  async function updateShortlistEntry() {
    if (!token || !editId || shortlistBusy) return;
    setShortlistBusy(true); setShortlistError('');
    try {
      const { entry } = await tutorShortlistApi.update(editId, editNote.trim(), editPriority, token);
      setShortlist((items) => [entry, ...items.filter((item) => item._id !== entry._id)]);
      setEditId(null);
      setShortlistMessage('Tutor note and priority updated.');
    } catch (requestError) { setShortlistError(requestError instanceof Error ? requestError.message : 'Could not update shortlist item.'); }
    finally { setShortlistBusy(false); }
  }
  async function removeShortlistEntry() {
    if (!token || !removeId || shortlistBusy) return;
    setShortlistBusy(true); setShortlistError('');
    try {
      await tutorShortlistApi.remove(removeId, token);
      setShortlist((items) => items.filter((item) => item._id !== removeId));
      setRemoveId(null);
      setEditId(null);
      setShortlistMessage('Tutor removed from your shortlist.');
    } catch (requestError) { setShortlistError(requestError instanceof Error ? requestError.message : 'Could not remove tutor.'); }
    finally { setShortlistBusy(false); }
  }
  function currentSavedSearchPayload(name: string): SavedSearchPayload {
    return {
      name: name.trim(),
      query: query.trim(),
      subject,
      sort,
      filters: {
        minRate: filters.minRate ? Number(filters.minRate) : 0,
        maxRate: filters.maxRate ? Number(filters.maxRate) : 0,
        minRating: filters.minRating,
        availability: filters.availability,
        experience: filters.experience,
      },
    };
  }
  function openSavedSearches(createMode = false) {
    setSavedSearchesMessage('');
    setSavedSearchesError('');
    setEditSavedSearchId(null);
    setRemoveSavedSearchId(null);
    setSavedSearchName(createMode ? `${subject === 'All' ? 'Tutor' : subject} search` : '');
    setSavedSearchesOpen(true);
  }
  function closeSavedSearches() {
    setSavedSearchesOpen(false);
    setEditSavedSearchId(null);
    setRemoveSavedSearchId(null);
    setSavedSearchName('');
  }
  async function saveCurrentSearch() {
    if (!token || savedSearchesBusy) return;
    if (!savedSearchName.trim()) {
      setSavedSearchesError('Enter a name for this search.');
      return;
    }
    setSavedSearchesBusy(true); setSavedSearchesError(''); setSavedSearchesMessage('');
    try {
      if (editSavedSearchId) {
        const { savedSearch } = await savedSearchApi.update(editSavedSearchId, currentSavedSearchPayload(savedSearchName), token);
        setSavedSearches((items) => [savedSearch, ...items.filter((item) => item._id !== savedSearch._id)]);
        setSavedSearchesMessage('Saved search updated with your current filters.');
      } else {
        const { savedSearch } = await savedSearchApi.create(currentSavedSearchPayload(savedSearchName), token);
        setSavedSearches((items) => savedSearchesForToken === token ? [savedSearch, ...items] : [savedSearch]);
        setSavedSearchesForToken(token);
        setSavedSearchesMessage('Current search saved.');
      }
      setEditSavedSearchId(null);
      setSavedSearchName('');
    } catch (requestError) { setSavedSearchesError(requestError instanceof Error ? requestError.message : 'Could not save this search.'); }
    finally { setSavedSearchesBusy(false); }
  }
  function applySavedSearch(item: SavedSearch) {
    const nextFilters: Filters = {
      minRate: item.filters.minRate ? String(item.filters.minRate) : '',
      maxRate: item.filters.maxRate ? String(item.filters.maxRate) : '',
      minRating: item.filters.minRating,
      availability: item.filters.availability,
      experience: item.filters.experience,
    };
    setQuery(item.query);
    setSubject(item.subject);
    setSort(item.sort);
    setFilters(nextFilters);
    setDraft(nextFilters);
    closeSavedSearches();
  }
  function editSavedSearch(item: SavedSearch) {
    setEditSavedSearchId(item._id);
    setSavedSearchName(item.name);
    setRemoveSavedSearchId(null);
    setSavedSearchesError('');
    setSavedSearchesMessage('Adjust the search on Discover if needed, then update it here.');
  }
  async function removeSavedSearch() {
    if (!token || !removeSavedSearchId || savedSearchesBusy) return;
    setSavedSearchesBusy(true); setSavedSearchesError(''); setSavedSearchesMessage('');
    try {
      await savedSearchApi.remove(removeSavedSearchId, token);
      setSavedSearches((items) => items.filter((item) => item._id !== removeSavedSearchId));
      setRemoveSavedSearchId(null);
      setEditSavedSearchId(null);
      setSavedSearchName('');
      setSavedSearchesMessage('Saved search removed.');
    } catch (requestError) { setSavedSearchesError(requestError instanceof Error ? requestError.message : 'Could not remove saved search.'); }
    finally { setSavedSearchesBusy(false); }
  }
  function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    const params = new URLSearchParams({ q: query.trim(), subject, sort, page: String(nextPage) });
    if (filters.minRate) params.set('minRate', filters.minRate);
    if (filters.maxRate) params.set('maxRate', filters.maxRate);
    if (filters.minRating) params.set('minRating', String(filters.minRating));
    if (filters.availability !== 'any') params.set('available', filters.availability);
    if (filters.experience !== 'any') params.set('experience', filters.experience);
    apiRequest<TutorResponse>(`/tutors?${params}`)
      .then((data) => { setTutors((items) => [...items, ...data.tutors]); setPage(data.pagination.page); setPages(data.pagination.pages); setTotal(data.pagination.total); })
      .catch((requestError) => Alert.alert('Couldn’t load more tutors', requestError instanceof Error ? requestError.message : 'Please try again.'))
      .finally(() => setLoadingMore(false));
  }

  return <FeatureShell activeTab="discover" title="Discover great tutors" subtitle="Search, filter and compare verified university tutors.">
    <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name="search" size={19} color="#665CF2" />
      <TextInput accessibilityLabel="Search tutors or subjects" value={query} onChangeText={setQuery} placeholder="Tutor or subject..." placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text }]} returnKeyType="search" />
      {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={20} color={colors.textMuted} /></Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel={`Open filters${activeFilterCount ? `, ${activeFilterCount} active` : ''}`} onPress={openFilters} style={styles.filterIcon}><Ionicons name="options" size={17} color="#FFFFFF" />{!!activeFilterCount && <View style={styles.filterCount}><Text style={styles.filterCountText}>{activeFilterCount}</Text></View>}</Pressable>
    </View>
    <View style={styles.categoryBlock}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {['All', ...browseSubjects].map((item) => {
          const selected = subject === item;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={item === 'All' ? 'Show all tutors' : `Show ${item} tutors`}
              onPress={() => setSubject(selected && item !== 'All' ? 'All' : item)}
              style={[styles.categoryPill, { backgroundColor: colors.surface, borderColor: colors.border }, selected && styles.categoryPillActive]}
            >
              <Text numberOfLines={1} style={[styles.categoryLabel, { color: colors.textMuted }, selected && styles.categoryLabelActive]}>{item}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
    {user?.role === 'student' && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.libraryActions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Save current tutor search" onPress={() => openSavedSearches(true)} style={styles.saveCurrentChip}><Ionicons name="add-circle-outline" size={15} color="#FFFFFF" /><Text style={styles.saveCurrentChipText}>Save search</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open saved searches, ${visibleSavedSearches.length} saved`} onPress={() => openSavedSearches()} style={[styles.savedTopChip, { backgroundColor: colors.surface, borderColor: colors.border }]}><Ionicons name="search-circle-outline" size={16} color="#665CF2" /><Text style={styles.savedTopChipText}>Saved ({visibleSavedSearches.length})</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open tutor shortlist, ${visibleShortlist.length} tutors`} onPress={() => { setShortlistMessage(''); setShortlistOpen(true); }} style={[styles.savedTopChip, { backgroundColor: colors.surface, borderColor: colors.border }]}><Ionicons name="bookmark-outline" size={14} color="#665CF2" /><Text style={styles.savedTopChipText}>Shortlist ({visibleShortlist.length})</Text></Pressable>
    </ScrollView>}
    <View style={styles.sortRow}><Text style={[styles.result, { color: colors.textMuted }]}>{loading ? 'SEARCHING...' : `${total} VERIFIED TUTORS`}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{([['rating', 'Top rated'], ['rate_low', 'Price: low'], ['rate_high', 'Price: high'], ['newest', 'Newest']] as [Sort, string][]).map(([key, label]) => <Pressable key={key} onPress={() => setSort(key)} style={[styles.sort, { backgroundColor: colors.surfaceMuted }, sort === key && styles.sortActive]}><Text style={[styles.sortText, { color: colors.textMuted }, sort === key && styles.sortTextActive]}>{label}</Text></Pressable>)}</ScrollView></View>
    {compare.length > 0 && <View style={styles.compareBar}><View><Text style={styles.compareTitle}>Compare tutors</Text><Text style={styles.compareText}>{compare.length}/3 selected</Text></View><View style={styles.compareActions}><Pressable onPress={() => setCompare([])}><Text style={styles.clearCompare}>Clear</Text></Pressable><Pressable disabled={compare.length < 2} onPress={() => router.push({ pathname: '/compare', params: { ids: compare.join(',') } })} style={[styles.compareButton, compare.length < 2 && styles.disabled]}><Text style={styles.compareButtonText}>Compare now</Text></Pressable></View></View>}
    {loading && <ActivityIndicator style={styles.loader} color="#655CF2" />}
    {!loading && !!error && <View style={[styles.state, { backgroundColor: colors.surface }]}><Ionicons name="cloud-offline-outline" size={30} color="#C6536C" /><Text style={[styles.stateTitle, { color: colors.text }]}>Couldn’t load tutors</Text><Text style={[styles.stateText, { color: colors.textMuted }]}>{error}</Text><Pressable style={styles.stateButton} onPress={() => setRefreshKey((value) => value + 1)}><Text style={styles.stateButtonText}>Try again</Text></Pressable></View>}
    {!loading && !error && tutors.length === 0 && <View style={[styles.state, { backgroundColor: colors.surface }]}><Ionicons name="search-outline" size={31} color="#655CF2" /><Text style={[styles.stateTitle, { color: colors.text }]}>No tutors match</Text><Text style={[styles.stateText, { color: colors.textMuted }]}>Try a wider price range, another subject, or clear your filters.</Text><Pressable style={styles.stateButton} onPress={clearAll}><Text style={styles.stateButtonText}>Clear filters</Text></Pressable></View>}
    {!loading && !error && tutors.map((tutor, index) => {
      const selected = compare.includes(tutor._id);
      const shortlisted = visibleShortlist.some((item) => item.tutor?._id === tutor._id);
      return <View key={tutor._id} style={[styles.card, { backgroundColor: colors.surface, borderColor: selected ? '#665CF2' : colors.border }, selected && styles.cardSelected]}>
        <View style={[styles.avatar, { backgroundColor: ['#6154E8', '#D76A8A', '#218E80'][index % 3] }]}><Text style={styles.initials}>{tutor.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</Text><View style={styles.verified}><Ionicons name="checkmark" size={9} color="#FFFFFF" /></View></View>
        <View style={styles.copy}><Pressable accessibilityRole="button" accessibilityLabel={`View ${tutor.name}'s profile`} onPress={() => router.push({ pathname: '/tutor/[id]', params: { id: tutor._id } })}><Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{tutor.name}</Text><Text numberOfLines={1} style={[styles.subject, { color: colors.textMuted }]}>{tutor.profile?.subjects?.join(' • ') || 'University Tutor'}</Text><View style={styles.meta}><Text style={styles.rating}>★ {tutor.averageRating ? tutor.averageRating.toFixed(1) : 'New'}</Text><Text style={[styles.reviewCount, { color: colors.textMuted }]}>{tutor.reviewCount} reviews</Text></View><View style={styles.availability}><Ionicons name="calendar-outline" size={12} color={tutor.nextAvailableAt ? '#12956C' : colors.textMuted} /><Text style={[styles.available, !tutor.nextAvailableAt && { color: colors.textMuted }]}>{availabilityLabel(tutor.nextAvailableAt)}</Text></View></Pressable>{user?.role === 'student' && <View style={styles.cardActions}><Pressable accessibilityRole="button" accessibilityLabel={`See why ${tutor.name} matches you`} onPress={() => router.push({ pathname: '/tutor/[id]/why', params: { id: tutor._id } })} style={styles.whyTutorAction}><Ionicons name="help-circle-outline" size={14} color="#665CF2" /><Text style={styles.whyTutorText}>Why this tutor?</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={shortlisted ? `Open shortlist for ${tutor.name}` : `Add ${tutor.name} to shortlist`} disabled={shortlistBusy || shortlistLoading} onPress={() => { if (shortlisted) { setShortlistMessage(''); setShortlistOpen(true); } else addTutorToShortlist(tutor._id); }} style={styles.shortlistCardAction}><Ionicons name={shortlisted ? 'bookmark' : 'bookmark-outline'} size={14} color="#665CF2" /><Text style={styles.shortlistCardText}>{shortlisted ? 'Shortlisted' : 'Shortlist'}</Text></Pressable></View>}</View>
        <View style={styles.right}><Text style={[styles.price, { color: colors.text }]}>Rs.{tutor.profile?.hourlyRate?.toLocaleString() || '—'}</Text><Text style={[styles.hour, { color: colors.textMuted }]}>/ hour</Text><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${tutor.name} ${selected ? 'from' : 'to'} comparison`} onPress={(event) => { event.stopPropagation(); toggleCompare(tutor._id); }} style={[styles.compareCheck, { backgroundColor: colors.softPurple }, selected && styles.compareCheckActive]}><Ionicons name={selected ? 'checkmark' : 'git-compare'} size={14} color={selected ? '#FFFFFF' : '#675BEA'} /></Pressable><Text style={styles.compareLabel}>{selected ? 'Selected' : 'Compare'}</Text></View>
      </View>;
    })}
    {!loading && !error && page < pages && <Pressable disabled={loadingMore} onPress={loadMore} style={[styles.loadMore, { backgroundColor: colors.surface, borderColor: colors.border }]}>{loadingMore ? <ActivityIndicator color="#655CF2" /> : <><Text style={styles.loadMoreText}>Load more tutors</Text><Ionicons name="chevron-down" size={16} color="#655CF2" /></>}</Pressable>}
    <FilterSheet visible={filtersOpen} draft={draft} onChange={setDraft} onClose={() => setFiltersOpen(false)} onReset={() => setDraft(emptyFilters)} onApply={applyFilters} />
    <Modal visible={savedSearchesOpen} transparent animationType="slide" onRequestClose={closeSavedSearches}><View style={styles.modalBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={closeSavedSearches} accessibilityLabel="Close saved searches" /><SafeAreaView edges={['bottom']} style={[styles.savedSheet, { backgroundColor: colors.surface }]}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View style={styles.savedHeaderCopy}><Text style={[styles.sheetTitle, { color: colors.text }]}>Saved searches</Text><Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>Reuse your favourite tutor filters anytime.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close saved searches" onPress={closeSavedSearches} style={[styles.closeButton, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="close" size={20} color={colors.text} /></Pressable></View>
      <View style={[styles.savedSearchComposer, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}><Text style={[styles.savedComposerTitle, { color: colors.text }]}>{editSavedSearchId ? 'Update saved search' : 'Save current search'}</Text><Text style={[styles.savedItemDetail, { color: colors.textMuted }]}>Stores the current keywords, subject, filters and sort order.</Text><TextInput accessibilityLabel="Saved search name" maxLength={60} value={savedSearchName} onChangeText={setSavedSearchName} placeholder="For example, Affordable Java tutors" placeholderTextColor={colors.textMuted} style={[styles.savedSearchNameInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} /><View style={styles.savedComposerActions}>{editSavedSearchId && <Pressable onPress={() => { setEditSavedSearchId(null); setSavedSearchName(''); setSavedSearchesMessage(''); }} style={styles.dialogCancel}><Text style={{ color: colors.text }}>Cancel edit</Text></Pressable>}<Pressable accessibilityRole="button" disabled={savedSearchesBusy} onPress={() => void saveCurrentSearch()} style={[styles.savedPrimary, savedSearchesBusy && styles.disabled]}>{savedSearchesBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <><Ionicons name={editSavedSearchId ? 'refresh' : 'save-outline'} size={14} color="#FFFFFF" /><Text style={styles.savedPrimaryText}>{editSavedSearchId ? 'Update' : 'Save'}</Text></>}</Pressable></View></View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.savedPanel}>
        {!!savedSearchesMessage && <Text style={styles.savedMessage}>{savedSearchesMessage}</Text>}
        {!!savedSearchesError && <Text style={styles.savedError}>{savedSearchesError}</Text>}
        {savedSearchesLoading && <ActivityIndicator color="#665CF2" style={{ marginTop: 10 }} />}
        {!savedSearchesLoading && visibleSavedSearches.length === 0 && <Text style={[styles.savedEmpty, { color: colors.textMuted }]}>No searches saved yet. Choose your filters, then tap “Save search”.</Text>}
        {visibleSavedSearches.map((item) => <View key={item._id} style={[styles.shortlistItem, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}><View style={styles.shortlistItemHeading}><View style={styles.savedSearchIcon}><Ionicons name="search" size={15} color="#665CF2" /></View><View style={styles.savedItemCopy}><Text numberOfLines={1} style={[styles.savedItemName, { color: colors.text }]}>{item.name}</Text><Text numberOfLines={2} style={[styles.savedItemDetail, { color: colors.textMuted }]}>{savedSearchSummary(item)}</Text></View></View><View style={styles.shortlistActions}><Pressable accessibilityRole="button" accessibilityLabel={`Apply ${item.name}`} onPress={() => applySavedSearch(item)}><Text style={styles.savedActionText}>Apply</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`} onPress={() => editSavedSearch(item)}><Text style={styles.savedActionText}>Edit</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`} onPress={() => { setRemoveSavedSearchId(item._id); setEditSavedSearchId(null); setSavedSearchName(''); setSavedSearchesError(''); }}><Text style={styles.removeText}>Remove</Text></Pressable></View>{removeSavedSearchId === item._id && <View style={styles.savedConfirm}><Text style={[styles.savedConfirmText, { color: colors.text }]}>Delete this saved search?</Text><View style={styles.dialogActions}><Pressable onPress={() => setRemoveSavedSearchId(null)} style={styles.dialogCancel}><Text style={{ color: colors.text }}>Keep it</Text></Pressable><Pressable disabled={savedSearchesBusy} onPress={() => void removeSavedSearch()} style={[styles.savedPrimary, { backgroundColor: '#BE5268' }, savedSearchesBusy && styles.disabled]}><Text style={styles.savedPrimaryText}>{savedSearchesBusy ? 'Removing...' : 'Delete'}</Text></Pressable></View></View>}</View>)}
      </ScrollView>
    </SafeAreaView></View></Modal>
    <Modal visible={shortlistOpen} transparent animationType="slide" onRequestClose={closeShortlist}><View style={styles.modalBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={closeShortlist} accessibilityLabel="Close tutor shortlist" /><SafeAreaView edges={['bottom']} style={[styles.savedSheet, { backgroundColor: colors.surface }]}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View style={styles.savedHeaderCopy}><Text style={[styles.sheetTitle, { color: colors.text }]}>My tutor shortlist</Text><Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>Keep track of tutors you want to consider.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close tutor shortlist" onPress={closeShortlist} style={[styles.closeButton, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="close" size={20} color={colors.text} /></Pressable></View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.savedPanel}>
        {!!shortlistMessage && <Text style={styles.savedMessage}>{shortlistMessage}</Text>}
        {!!shortlistError && <Text style={styles.savedError}>{shortlistError}</Text>}
        {shortlistLoading && <ActivityIndicator color="#665CF2" style={{ marginTop: 10 }} />}
        {!shortlistLoading && visibleShortlist.length === 0 && <Text style={[styles.savedEmpty, { color: colors.textMuted }]}>No tutors shortlisted yet. Tap “Add to shortlist” on a tutor card.</Text>}
        {visibleShortlist.map((item) => <View key={item._id} style={[styles.shortlistItem, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
          <View style={styles.shortlistItemHeading}><View style={styles.savedItemCopy}><Text numberOfLines={1} style={[styles.savedItemName, { color: colors.text }]}>{item.tutor?.name || 'Tutor no longer available'}</Text><Text numberOfLines={1} style={[styles.savedItemDetail, { color: colors.textMuted }]}>{item.tutor?.profile?.subjects?.join(' • ') || 'Tutor'} · {item.priority} priority</Text></View><Ionicons name="bookmark" size={18} color="#665CF2" /></View>
          {!!item.note && <Text style={[styles.shortlistNote, { color: colors.textMuted }]}>{item.note}</Text>}
          <View style={styles.shortlistActions}>{item.tutor?.status === 'active' && item.tutor.isVerified && <Pressable accessibilityRole="button" onPress={() => { closeShortlist(); router.push({ pathname: '/tutor/[id]', params: { id: item.tutor!._id } }); }}><Text style={styles.savedActionText}>View profile</Text></Pressable>}<Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.tutor?.name || 'tutor'} note and priority`} onPress={() => startEdit(item)}><Text style={styles.savedActionText}>Edit</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.tutor?.name || 'tutor'} from shortlist`} onPress={() => { setRemoveId(item._id); setEditId(null); setShortlistError(''); }}><Text style={styles.removeText}>Remove</Text></Pressable></View>
          {editId === item._id && <View style={styles.shortlistEditor}><Text style={[styles.fieldLabel, { color: colors.text }]}>Your note (optional)</Text><TextInput accessibilityLabel={`Note for ${item.tutor?.name || 'tutor'}`} multiline maxLength={300} value={editNote} onChangeText={setEditNote} placeholder="Why do you like this tutor?" placeholderTextColor={colors.textMuted} style={[styles.shortlistNoteInput, { color: colors.text, borderColor: colors.border }]} /><Text style={[styles.fieldLabel, { color: colors.text }]}>Priority</Text><View style={styles.choiceRow}>{(['high', 'medium', 'low'] as Priority[]).map((value) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: editPriority === value }} key={value} onPress={() => setEditPriority(value)} style={[styles.choice, { borderColor: colors.border, backgroundColor: colors.surface }, editPriority === value && styles.choiceActive]}><Text style={[styles.choiceText, { color: colors.textMuted }, editPriority === value && styles.choiceTextActive]}>{value[0].toUpperCase() + value.slice(1)}</Text></Pressable>)}</View><View style={styles.dialogActions}><Pressable onPress={() => setEditId(null)} style={styles.dialogCancel}><Text style={{ color: colors.text }}>Cancel</Text></Pressable><Pressable disabled={shortlistBusy} onPress={updateShortlistEntry} style={[styles.savedPrimary, shortlistBusy && styles.disabled]}><Text style={styles.savedPrimaryText}>{shortlistBusy ? 'Saving...' : 'Save changes'}</Text></Pressable></View></View>}
          {removeId === item._id && <View style={styles.savedConfirm}><Text style={[styles.savedConfirmText, { color: colors.text }]}>Remove this tutor from your shortlist?</Text><View style={styles.dialogActions}><Pressable onPress={() => setRemoveId(null)} style={styles.dialogCancel}><Text style={{ color: colors.text }}>Cancel</Text></Pressable><Pressable disabled={shortlistBusy} onPress={removeShortlistEntry} style={[styles.savedPrimary, { backgroundColor: '#BE5268' }, shortlistBusy && styles.disabled]}><Text style={styles.savedPrimaryText}>{shortlistBusy ? 'Removing...' : 'Remove'}</Text></Pressable></View></View>}
        </View>)}
      </ScrollView>
    </SafeAreaView></View></Modal>
  </FeatureShell>;
}

function FilterSheet({ visible, draft, onChange, onClose, onReset, onApply }: { visible: boolean; draft: Filters; onChange: (filters: Filters) => void; onClose: () => void; onReset: () => void; onApply: () => void }) {
  const { colors } = useAppTheme();
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close filters" /><SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: colors.surface }]}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={[styles.sheetTitle, { color: colors.text }]}>Filter tutors</Text><Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>Find the right match for your needs</Text></View><Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="close" size={20} color={colors.text} /></Pressable></View>
    <Text style={[styles.fieldLabel, { color: colors.text }]}>Hourly rate (Rs.)</Text><View style={styles.priceInputs}><TextInput keyboardType="number-pad" value={draft.minRate} onChangeText={(value) => onChange({ ...draft, minRate: value.replace(/[^0-9]/g, '') })} placeholder="Minimum" placeholderTextColor={colors.textMuted} style={[styles.priceInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]} /><Text style={{ color: colors.textMuted }}>to</Text><TextInput keyboardType="number-pad" value={draft.maxRate} onChangeText={(value) => onChange({ ...draft, maxRate: value.replace(/[^0-9]/g, '') })} placeholder="Maximum" placeholderTextColor={colors.textMuted} style={[styles.priceInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]} /></View>
    <FilterChoices label="Minimum rating" values={[[0, 'Any'], [3, '3+ ★'], [4, '4+ ★'], [4.5, '4.5+ ★']] as [Rating, string][]} selected={draft.minRating} onSelect={(value) => onChange({ ...draft, minRating: value })} />
    <FilterChoices label="Availability" values={([['any', 'Any time'], ['today', 'Today'], ['week', 'This week']] as [Availability, string][])} selected={draft.availability} onSelect={(value) => onChange({ ...draft, availability: value })} />
    <FilterChoices label="Experience" values={([['any', 'Any'], ['New tutor', 'New tutor'], ['1-2 years', '1–2 years'], ['3+ years', '3+ years']] as [Experience, string][])} selected={draft.experience} onSelect={(value) => onChange({ ...draft, experience: value })} />
    <View style={styles.sheetActions}><Pressable onPress={onReset} style={[styles.resetButton, { borderColor: colors.border }]}><Text style={[styles.resetText, { color: colors.text }]}>Reset</Text></Pressable><Pressable onPress={onApply} style={styles.applyButton}><Text style={styles.applyText}>Apply filters</Text></Pressable></View>
  </SafeAreaView></View></Modal>;
}

function FilterChoices<T extends string | number>({ label, values, selected, onSelect }: { label: string; values: [T, string][]; selected: T; onSelect: (value: T) => void }) {
  const { colors } = useAppTheme();
  return <View><Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text><View style={styles.choiceRow}>{values.map(([value, text]) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: selected === value }} key={String(value)} onPress={() => onSelect(value)} style={[styles.choice, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }, selected === value && styles.choiceActive]}><Text style={[styles.choiceText, { color: colors.textMuted }, selected === value && styles.choiceTextActive]}>{text}</Text></Pressable>)}</View></View>;
}

const styles = StyleSheet.create({
  search: { height: 58, borderRadius: 19, paddingHorizontal: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#2D2855', shadowOpacity: 0.09, shadowRadius: 14, elevation: 3 }, input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 16 }, filterIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#665CF2', alignItems: 'center', justifyContent: 'center' }, filterCount: { position: 'absolute', right: -5, top: -5, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#E55370', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' }, filterCountText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 9 },
  categoryBlock: { marginTop: 16 },
  categoryRow: { alignItems: 'center', gap: 8, paddingRight: 4 },
  categoryPill: { height: 38, paddingHorizontal: 16, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  categoryPillActive: { backgroundColor: '#6254E8', borderColor: '#6254E8' },
  categoryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  categoryLabelActive: { color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  libraryActions: { gap: 8, paddingTop: 12, paddingRight: 2 }, saveCurrentChip: { height: 35, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#665CF2', flexDirection: 'row', alignItems: 'center', gap: 5 }, saveCurrentChipText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 12 }, savedTopChip: { height: 35, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }, savedTopChipText: { color: '#665CF2', fontFamily: 'Inter_700Bold', fontSize: 12 },
  sortRow: { marginTop: 20, marginBottom: 10, gap: 8 }, result: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1 }, sort: { height: 29, paddingHorizontal: 10, borderRadius: 9, justifyContent: 'center', marginRight: 6 }, sortActive: { backgroundColor: '#DED9FF' }, sortText: { fontFamily: 'Inter_700Bold', fontSize: 11 }, sortTextActive: { color: '#584DD1' },
  savedSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, maxHeight: '75%' },
  savedHeaderCopy: { flex: 1 }, savedPanel: { paddingBottom: 12 },
  savedConfirm: { borderRadius: 12, padding: 12, marginTop: 10, backgroundColor: '#F3F0F9' },
  savedConfirmText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  savedPrimary: { backgroundColor: '#665CF2', borderRadius: 10, minHeight: 38, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  savedPrimaryText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 12 },
  savedMessage: { color: '#198465', fontFamily: 'Inter_400Regular', fontSize: 11, marginBottom: 7 },
  savedError: { color: '#BE5268', fontFamily: 'Inter_400Regular', fontSize: 11, marginBottom: 7 },
  savedEmpty: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 11 },
  savedItemCopy: { flex: 1, minWidth: 0 }, savedItemName: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  savedItemDetail: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 15, marginTop: 3 },
  savedActionText: { color: '#665CF2', fontFamily: 'Inter_700Bold', fontSize: 12 },
  savedSearchComposer: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 6 }, savedComposerTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 }, savedSearchNameInput: { height: 43, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, marginTop: 10, fontFamily: 'Inter_400Regular', fontSize: 13 }, savedComposerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 9 }, savedSearchIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#EAE7FF', alignItems: 'center', justifyContent: 'center' },
  shortlistItem: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 10 },
  shortlistItemHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shortlistNote: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 9 },
  shortlistActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 13 },
  shortlistEditor: { marginTop: 7 }, shortlistNoteInput: { borderWidth: 1, borderRadius: 12, minHeight: 75, padding: 10, textAlignVertical: 'top', fontFamily: 'Inter_400Regular', fontSize: 13 },
  removeText: { color: '#BE5268', fontFamily: 'Inter_700Bold', fontSize: 12 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 6 },
  whyTutorAction: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 29 },
  whyTutorText: { color: '#665CF2', fontFamily: 'Inter_700Bold', fontSize: 11 },
  shortlistCardAction: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 29 },
  shortlistCardText: { color: '#665CF2', fontFamily: 'Inter_700Bold', fontSize: 11 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 15, marginTop: 14 }, dialogCancel: { padding: 8 },
  compareBar: { minHeight: 67, borderRadius: 18, padding: 12, backgroundColor: '#211C50', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, compareTitle: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 15 }, compareText: { color: '#C9C3EF', fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 }, compareActions: { flexDirection: 'row', alignItems: 'center', gap: 12 }, clearCompare: { color: '#D6D1FF', fontFamily: 'Inter_700Bold', fontSize: 12 }, compareButton: { height: 36, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#7568F2', justifyContent: 'center' }, disabled: { opacity: 0.45 }, compareButtonText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 12 },
  loader: { marginTop: 50 }, state: { padding: 27, borderRadius: 22, alignItems: 'center', marginTop: 10 }, stateTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 17, marginTop: 10 }, stateText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 5 }, stateButton: { backgroundColor: '#665CF2', borderRadius: 12, paddingHorizontal: 17, height: 40, justifyContent: 'center', marginTop: 15 }, stateButtonText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 13 },
  card: { minHeight: 142, padding: 13, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', marginBottom: 11, shadowColor: '#302B59', shadowOpacity: 0.07, shadowRadius: 12, elevation: 2 }, cardSelected: { borderWidth: 2 }, avatar: { width: 56, height: 56, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, initials: { color: '#FFFFFF', fontFamily: 'Manrope_700Bold', fontSize: 18 }, verified: { position: 'absolute', right: -3, bottom: 3, width: 17, height: 17, borderRadius: 9, backgroundColor: '#1AAF7D', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' }, copy: { flex: 1, marginLeft: 11 }, name: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16 }, subject: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 }, meta: { marginTop: 7, flexDirection: 'row', gap: 7 }, rating: { color: '#D98A1F', fontFamily: 'Inter_700Bold', fontSize: 12 }, reviewCount: { fontFamily: 'Inter_400Regular', fontSize: 11 }, availability: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }, available: { color: '#12956C', fontFamily: 'Inter_700Bold', fontSize: 10 }, right: { alignItems: 'flex-end', marginLeft: 5 }, price: { fontFamily: 'Manrope_800ExtraBold', fontSize: 14 }, hour: { fontFamily: 'Inter_400Regular', fontSize: 11 }, compareCheck: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, compareCheckActive: { backgroundColor: '#665CF2' }, compareLabel: { color: '#655CF2', fontFamily: 'Inter_700Bold', fontSize: 9, marginTop: 3 },
  loadMore: { height: 47, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 3 }, loadMoreText: { color: '#655CF2', fontFamily: 'Inter_700Bold', fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(12, 12, 28, 0.55)', justifyContent: 'flex-end' }, sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 }, sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#C8C5D4', alignSelf: 'center', marginBottom: 14 }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, sheetTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 22 }, sheetSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 }, closeButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, fieldLabel: { fontFamily: 'Inter_700Bold', fontSize: 13, marginTop: 14, marginBottom: 8 }, priceInputs: { flexDirection: 'row', alignItems: 'center', gap: 9 }, priceInput: { flex: 1, height: 45, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontFamily: 'Inter_400Regular', fontSize: 14 }, choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, choice: { minHeight: 36, borderRadius: 11, borderWidth: 1, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' }, choiceActive: { backgroundColor: '#665CF2', borderColor: '#665CF2' }, choiceText: { fontFamily: 'Inter_700Bold', fontSize: 12 }, choiceTextActive: { color: '#FFFFFF' }, sheetActions: { flexDirection: 'row', gap: 10, marginTop: 22 }, resetButton: { height: 48, borderRadius: 15, borderWidth: 1, paddingHorizontal: 24, justifyContent: 'center' }, resetText: { fontFamily: 'Inter_700Bold', fontSize: 14 }, applyButton: { flex: 1, height: 48, borderRadius: 15, backgroundColor: '#665CF2', alignItems: 'center', justifyContent: 'center' }, applyText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 14 },
});
