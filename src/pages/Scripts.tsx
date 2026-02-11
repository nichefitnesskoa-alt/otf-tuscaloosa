import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useScriptTemplates, ScriptTemplate } from '@/hooks/useScriptTemplates';
import { TemplateCategoryTabs } from '@/components/scripts/TemplateCategoryTabs';
import { TemplateCard } from '@/components/scripts/TemplateCard';
import { TemplateEditor } from '@/components/scripts/TemplateEditor';
import { MessageGenerator } from '@/components/scripts/MessageGenerator';
import { ClientSearchScriptPicker } from '@/components/scripts/ClientSearchScriptPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Wand2 } from 'lucide-react';

export default function Scripts() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ScriptTemplate | null>(null);
  const [generatorTemplate, setGeneratorTemplate] = useState<ScriptTemplate | null>(null);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const { data: templates = [], isLoading } = useScriptTemplates();

  const filtered = templates.filter((t) => {
    if (selectedCategory && t.category !== selectedCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.body.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleCardClick = (template: ScriptTemplate) => {
    if (isAdmin) {
      setEditingTemplate(template);
      setEditorOpen(true);
    } else {
      setGeneratorTemplate(template);
    }
  };

  const handleAdd = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Scripts</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="default" onClick={() => setShowClientSearch(true)}>
            <Wand2 className="w-4 h-4 mr-1" /> Generate
          </Button>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          )}
        </div>
      </div>

      <TemplateCategoryTabs selected={selectedCategory} onSelect={setSelectedCategory} />

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search scripts..."
          className="pl-8"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No templates found</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              isAdmin={isAdmin}
              onClick={() => handleCardClick(t)}
            />
          ))}
        </div>
      )}

      {isAdmin && (
        <TemplateEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          template={editingTemplate}
        />
      )}

      {generatorTemplate && (
        <MessageGenerator
          open={!!generatorTemplate}
          onOpenChange={(o) => { if (!o) setGeneratorTemplate(null); }}
          template={generatorTemplate}
        />
      )}

      <ClientSearchScriptPicker
        open={showClientSearch}
        onOpenChange={setShowClientSearch}
      />
    </div>
  );
}
