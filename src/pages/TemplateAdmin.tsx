import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Trash2, Eye, Edit2, Check, X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface Template {
    id: string;
    name: string;
    category_id: string;
    template_file_url: string;
    field_definitions: any[];
    created_at: string;
    content_profile?: {
        documentType?: string;
        formatIndicators?: { version?: string };
        extraction_instructions?: Record<string, string>;
        pdf_mappings?: Record<string, string[]>;
        pdfFields?: string[];
        extractionInstructionCount?: number;
        mappingCount?: number;
    };
}


const TemplateAdmin = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [templateName, setTemplateName] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editCategoryId, setEditCategoryId] = useState('');
    const [reanalyzing, setReanalyzing] = useState<string | null>(null);
    const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);


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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !templateName || !selectedCategory) {
            alert('Please fill all fields');
            return;
        }

        setUploading(true);

        try {
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `templates/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, selectedFile);

            if (uploadError) throw uploadError;

            const { data: urlData, error: urlError } = await supabase.storage
                .from('documents')
                .createSignedUrl(filePath, 3600);

            if (urlError) throw urlError;

            const templateUrl = urlData.signedUrl;

            const { error: functionError } = await supabase.functions
                .invoke('analyze-template', {
                    body: {
                        templateUrl,
                        templateName,
                        categoryId: selectedCategory,
                        openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY || undefined,
                    }
                });

            if (functionError) throw functionError;

            alert('Template uploaded and analyzed successfully!');
            setSelectedFile(null);
            setTemplateName('');
            setSelectedCategory('');
            fetchTemplates();

        } catch (error: any) {
            console.error('Upload error:', error);
            alert(`Upload failed: ${error.message}`);
        } finally {
            setUploading(false);
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

            {/* Upload Section */}
            <div className="bg-white p-6 rounded-lg shadow mb-8">
                <h2 className="text-xl font-semibold mb-4">Upload New Template</h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Template Name</label>
                        <input
                            type="text"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            className="w-full p-2 border rounded"
                            placeholder="e.g., Birth Certificate - Old Format"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Category</label>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full p-2 border rounded"
                        >
                            <option value="">Select category...</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">PDF Template</label>
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileChange}
                            className="w-full p-2 border rounded"
                        />
                        {selectedFile && (
                            <p className="text-sm text-gray-600 mt-1">{selectedFile.name}</p>
                        )}
                    </div>

                    <button
                        onClick={handleUpload}
                        disabled={uploading || !selectedFile || !templateName || !selectedCategory}
                        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
                    >
                        {uploading ? 'Uploading & Analyzing...' : 'Upload Template'}
                    </button>
                </div>
            </div>

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
                                    <div className="w-full">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-4">
                                                <FileText className="w-8 h-8 text-blue-600" />
                                                <div>
                                                    <h3 className="font-medium">{template.name}</h3>
                                                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                                                        <span>{categories.find(c => c.id === template.category_id)?.name || 'Unknown Category'}</span>
                                                        <span>•</span>
                                                        <span>{template.field_definitions?.length || 0} fields</span>
                                                        <span>•</span>
                                                        <span className={template.content_profile?.extraction_instructions ? 'text-green-600' : 'text-yellow-600'}>
                                                            {Object.keys(template.content_profile?.extraction_instructions || {}).length} extraction instructions
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-400">
                                                        {template.content_profile?.documentType} • {template.content_profile?.formatIndicators?.version || 'unknown'} format • {new Date(template.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => setExpandedTemplateId(expandedTemplateId === template.id ? null : template.id)}
                                                    className="p-2 text-purple-600 hover:bg-purple-50 rounded"
                                                    title="View Extraction Instructions"
                                                >
                                                    {expandedTemplateId === template.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                </button>
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
                                        </div>

                                        {/* Expandable Extraction Instructions Panel */}
                                        {expandedTemplateId === template.id && (
                                            <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                                                <h4 className="font-semibold text-sm mb-3 text-purple-700">Extraction Instructions</h4>
                                                {template.content_profile?.extraction_instructions && Object.keys(template.content_profile.extraction_instructions).length > 0 ? (
                                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                                        {Object.entries(template.content_profile.extraction_instructions).map(([field, instruction]) => (
                                                            <div key={field} className="text-xs bg-white p-2 rounded border">
                                                                <span className="font-mono font-semibold text-blue-600">{field}:</span>
                                                                <span className="ml-2 text-gray-600">{instruction}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-yellow-600">
                                                        No extraction instructions generated. Click "Re-analyze Template" to generate them.
                                                    </p>
                                                )}

                                                {/* PDF Field Names (Source of Truth) */}
                                                {template.content_profile?.pdfFields && template.content_profile.pdfFields.length > 0 && (
                                                    <div className="mt-4">
                                                        <h4 className="font-semibold text-sm mb-2 text-blue-700">PDF Form Fields ({template.content_profile.pdfFields.length})</h4>
                                                        <p className="text-xs text-gray-500 mb-2">These are the actual field names in the PDF. Mappings are handled by code.</p>
                                                        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                                                            {template.content_profile.pdfFields.slice(0, 30).map((field: string) => (
                                                                <span key={field} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-mono">{field}</span>
                                                            ))}
                                                            {template.content_profile.pdfFields.length > 30 && (
                                                                <span className="text-xs text-gray-400">+{template.content_profile.pdfFields.length - 30} more</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Notice about code-driven mappings */}
                                                <div className="mt-4 p-2 bg-amber-50 border border-amber-200 rounded">
                                                    <p className="text-xs text-amber-700">
                                                        <strong>Note:</strong> Field mappings are now code-driven for reliability. The system reads PDF fields dynamically and maps them using <code className="bg-amber-100 px-1 rounded">direct-mapper.ts</code>.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
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
