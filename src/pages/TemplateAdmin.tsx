import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Trash2, Eye, Edit2, Check, X, RefreshCw } from 'lucide-react';

interface Template {
    id: string;
    name: string;
    category_id: string;
    template_file_url: string;
    field_definitions: any[];
    created_at: string;
}

const TemplateAdmin = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editCategoryId, setEditCategoryId] = useState('');
    const [reanalyzing, setReanalyzing] = useState<string | null>(null);

    useEffect(() => {
        fetchTemplates();
        fetchCategories();
    }, []);

    const fetchTemplates = async () => {
        const { data, error } = await supabase
            .from('document_templates')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setTemplates(data);
        }
        setLoading(false);
    };

    const fetchCategories = async () => {
        const { data, error } = await supabase
            .from('document_categories')
            .select('*');

        if (!error && data) {
            setCategories(data);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this template?')) return;

        try {
            const { error } = await supabase.functions.invoke('delete-template', {
                body: { templateId: id }
            });

            if (error) throw error;

            fetchTemplates();
        } catch (error: any) {
            console.error('Delete error:', error);
            alert(`Failed to delete template: ${error.message}`);
        }
    };

    const startEditing = (template: Template) => {
        setEditingId(template.id);
        setEditName(template.name);
        setEditCategoryId(template.category_id);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditName('');
        setEditCategoryId('');
    };

    const handleUpdate = async () => {
        if (!editingId || !editName || !editCategoryId) return;

        const { error } = await supabase
            .from('document_templates')
            .update({
                name: editName,
                category_id: editCategoryId
            })
            .eq('id', editingId);

        if (error) {
            alert('Error updating template: ' + error.message);
        } else {
            fetchTemplates();
            setEditingId(null);
            setEditName('');
            setEditCategoryId('');
        }
    };

    const handleReanalyze = async (templateId: string) => {
        if (!confirm('Re-analyze this template? This will update the field mappings.')) return;

        setReanalyzing(templateId);
        try {
            const { data, error } = await supabase.functions.invoke('recheck-template', {
                body: { templateId }
            });

            if (error) throw error;

            alert(`Template re-analyzed!\n\nPDF Fields: ${data.pdfFieldCount}\nMappings: ${data.mappingCount}`);
            fetchTemplates();
        } catch (error: any) {
            console.error('Re-analyze error:', error);
            alert(`Re-analyze failed: ${error.message}`);
        } finally {
            setReanalyzing(null);
        }
    };

    if (loading) {
        return <div className="p-8">Loading...</div>;
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Template Management</h1>

            {/* Templates List */}
            <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-semibold">Existing Templates</h2>
                </div>

                <div className="divide-y">
                    {templates.length === 0 ? (
                        <p className="p-6 text-gray-500">No templates uploaded yet.</p>
                    ) : (
                        templates.map(template => (
                            <div key={template.id} className={`p-6 flex items-center justify-between ${editingId === template.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                {editingId === template.id ? (
                                    // Editing Mode
                                    <>
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 mr-8">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="w-full p-2 border rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                                                <select
                                                    value={editCategoryId}
                                                    onChange={(e) => setEditCategoryId(e.target.value)}
                                                    className="w-full p-2 border rounded text-sm"
                                                >
                                                    <option value="">Select category...</option>
                                                    {categories.map(cat => (
                                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={handleUpdate}
                                                className="p-2 text-green-600 hover:bg-green-100 rounded"
                                                title="Save Changes"
                                            >
                                                <Check className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={cancelEditing}
                                                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                                                title="Cancel"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    // View Mode
                                    <>
                                        <div className="flex items-center space-x-4">
                                            <FileText className="w-8 h-8 text-blue-600" />
                                            <div>
                                                <h3 className="font-medium">{template.name}</h3>
                                                <div className="flex items-center space-x-2 text-sm text-gray-500">
                                                    <span>{categories.find(c => c.id === template.category_id)?.name || 'Unknown Category'}</span>
                                                    <span>•</span>
                                                    <span>{template.field_definitions?.length || 0} fields</span>
                                                </div>
                                                <p className="text-xs text-gray-400">
                                                    {new Date(template.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => startEditing(template)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </button>
                                            <a
                                                href={template.template_file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                                title="View PDF"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </a>
                                            <button
                                                onClick={() => handleReanalyze(template.id)}
                                                disabled={reanalyzing === template.id}
                                                className="p-2 text-orange-600 hover:bg-orange-50 rounded disabled:opacity-50"
                                                title="Re-analyze Template"
                                            >
                                                <RefreshCw className={`w-5 h-5 ${reanalyzing === template.id ? 'animate-spin' : ''}`} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(template.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default TemplateAdmin;
