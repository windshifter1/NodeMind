import { StickyNote, Lightbulb, Star, Heart, Folder, Brain, Rocket, Palette, BookOpen, Code } from 'lucide-react';

export const WORKSPACE_ICONS = {
  note: StickyNote,
  lightbulb: Lightbulb,
  star: Star,
  heart: Heart,
  folder: Folder,
  brain: Brain,
  rocket: Rocket,
  palette: Palette,
  book: BookOpen,
  code: Code,
};

export const WORKSPACE_ICON_KEYS = Object.keys(WORKSPACE_ICONS);

export const WORKSPACE_COLORS = [
  '#6366f1', '#ef4444', '#f59e0b', '#10b981', '#06b6d4',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b',
];