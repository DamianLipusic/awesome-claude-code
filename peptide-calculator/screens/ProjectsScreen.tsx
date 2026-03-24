import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal, StyleSheet, Alert,
} from 'react-native';
import { Project, ProjectStatus, SynthesisStep } from '../types';
import ProjectCard from '../components/ProjectCard';
import SynthesisTracker from '../components/SynthesisTracker';
import { newProject } from '../lib/storage';
import { COLORS, SPACING, FONT_SIZE, RADIUS, SHADOW } from '../constants/theme';

interface Props {
  projects: Project[];
  dark: boolean;
  onUpsert: (p: Project) => void;
  onDelete: (id: string) => void;
  onLoadIntoCalc: (sequence: string) => void;
}

const STATUSES: ProjectStatus[] = ['planning', 'synthesis', 'done'];
const STATUS_LABELS: Record<ProjectStatus, string> = { planning: 'Planning', synthesis: 'In Synthesis', done: 'Done' };
const STATUS_COLORS: Record<ProjectStatus, string> = { planning: COLORS.warning, synthesis: COLORS.primary, done: COLORS.success };

export default function ProjectsScreen({ projects, dark, onUpsert, onDelete, onLoadIntoCalc }: Props) {
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSeq, setNewSeq] = useState('');

  const bg     = dark ? COLORS.bgDark    : COLORS.bgLight;
  const card   = dark ? COLORS.cardDark  : COLORS.cardLight;
  const text   = dark ? COLORS.textDark  : COLORS.textLight;
  const muted  = dark ? COLORS.mutedDark : COLORS.mutedLight;
  const border = dark ? COLORS.borderDark: COLORS.borderLight;
  const surface= dark ? COLORS.surfaceDark: COLORS.surfaceLight;

  const createProject = () => {
    if (!newSeq.trim() || !newName.trim()) { Alert.alert('Required', 'Please enter name and sequence.'); return; }
    const p = newProject(newName.trim(), newSeq.trim().toUpperCase());
    onUpsert(p);
    setShowNew(false);
    setNewName('');
    setNewSeq('');
  };

  const toggleStep = (proj: Project, idx: number) => {
    const steps = proj.synthesisSteps.map((s, i) => i !== idx ? s : {
      ...s,
      done: !s.done,
      completedAt: !s.done ? new Date().toISOString() : null,
    });
    const updatedProj = { ...proj, synthesisSteps: steps, updatedAt: new Date().toISOString() };
    onUpsert(updatedProj);
    setActiveProject(updatedProj);
  };

  const setStatus = (proj: Project, status: ProjectStatus) => {
    const updated = { ...proj, status, updatedAt: new Date().toISOString() };
    onUpsert(updated);
    setActiveProject(updated);
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView contentContainerStyle={styles.content}>
        {STATUSES.map(status => {
          const group = projects.filter(p => p.status === status);
          return (
            <View key={status} style={styles.column}>
              <View style={[styles.columnHeader, { borderColor: STATUS_COLORS[status] }]}>
                <View style={[styles.dot, { backgroundColor: STATUS_COLORS[status] }]} />
                <Text style={[styles.columnTitle, { color: text }]}>{STATUS_LABELS[status]}</Text>
                <Text style={[styles.count, { color: muted }]}>{group.length}</Text>
              </View>
              {group.map(p => (
                <ProjectCard key={p.id} project={p} dark={dark} onPress={() => setActiveProject(p)} />
              ))}
              {group.length === 0 && (
                <Text style={[styles.emptyCol, { color: muted }]}>No projects</Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowNew(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* New project modal */}
      <Modal visible={showNew} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: bg }]}>
          <Text style={[styles.modalTitle, { color: text }]}>New Project</Text>
          <TextInput
            style={[styles.input, { backgroundColor: surface, color: text, borderColor: border }]}
            value={newName}
            onChangeText={setNewName}
            placeholder="Project name"
            placeholderTextColor={muted}
          />
          <TextInput
            style={[styles.input, styles.seqInput, { backgroundColor: surface, color: text, borderColor: border }]}
            value={newSeq}
            onChangeText={setNewSeq}
            placeholder="Peptide sequence (e.g. ACDEFGH)"
            placeholderTextColor={muted}
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
          />
          <View style={styles.modalBtns}>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: border }]} onPress={() => setShowNew(false)}>
              <Text style={[styles.cancelText, { color: muted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createBtn} onPress={createProject}>
              <Text style={styles.createText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Project detail modal */}
      <Modal visible={!!activeProject} animationType="slide" presentationStyle="pageSheet">
        {activeProject && (
          <ScrollView style={{ backgroundColor: bg }} contentContainerStyle={styles.content}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={() => setActiveProject(null)}>
                <Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.md }}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                Alert.alert('Delete Project?', 'This cannot be undone.', [
                  { text: 'Cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => { onDelete(activeProject.id); setActiveProject(null); } },
                ]);
              }}>
                <Text style={{ color: COLORS.danger, fontSize: FONT_SIZE.md }}>Delete</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalTitle, { color: text }]}>{activeProject.name}</Text>
            <Text style={[styles.seqPreview, { color: muted }]}>{activeProject.sequence}</Text>

            {/* Status selector */}
            <View style={styles.statusRow}>
              {STATUSES.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusBtn, {
                    backgroundColor: activeProject.status === s ? STATUS_COLORS[s] : 'transparent',
                    borderColor: STATUS_COLORS[s],
                  }]}
                  onPress={() => setStatus(activeProject, s)}
                >
                  <Text style={[styles.statusBtnText, {
                    color: activeProject.status === s ? '#fff' : STATUS_COLORS[s],
                  }]}>
                    {STATUS_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Load into calculator */}
            <TouchableOpacity
              style={styles.loadBtn}
              onPress={() => { onLoadIntoCalc(activeProject.sequence); setActiveProject(null); }}
            >
              <Text style={styles.loadBtnText}>Open in Calculator</Text>
            </TouchableOpacity>

            <SynthesisTracker
              steps={activeProject.synthesisSteps}
              onToggle={(idx) => toggleStep(activeProject, idx)}
              dark={dark}
            />
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.md, paddingBottom: 100 },
  column: { marginBottom: SPACING.xl },
  columnHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderLeftWidth: 3, paddingLeft: SPACING.sm, marginBottom: SPACING.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  columnTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', flex: 1 },
  count: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  emptyCol: { fontSize: FONT_SIZE.sm, fontStyle: 'italic', paddingVertical: SPACING.sm },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  modal: { flex: 1, padding: SPACING.xl },
  modalTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '700', marginBottom: SPACING.lg },
  input: { borderRadius: RADIUS.md, borderWidth: 1, padding: SPACING.sm + 2, fontSize: FONT_SIZE.md, marginBottom: SPACING.md },
  seqInput: { fontFamily: 'monospace' },
  modalBtns: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
  cancelBtn: { flex: 1, padding: SPACING.sm + 2, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center' },
  cancelText: { fontSize: FONT_SIZE.md, fontWeight: '600' },
  createBtn: { flex: 1, padding: SPACING.sm + 2, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  createText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md },
  seqPreview: { fontFamily: 'monospace', fontSize: FONT_SIZE.sm, marginBottom: SPACING.md },
  statusRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  statusBtn: { flex: 1, padding: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1.5, alignItems: 'center' },
  statusBtnText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  loadBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, padding: SPACING.sm + 2, alignItems: 'center', marginBottom: SPACING.md },
  loadBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
});
