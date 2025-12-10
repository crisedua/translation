import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';

interface Category {
    id: string;
    name: string;
    description: string;
    created_at: string;
}

const CategoryManagement = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Form states
    const [newCategory, setNewCategory] = useState({ name: '', description: '' });
    const [editForm, setEditForm] = useState({ name: '', description: '' });

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('document_categories')
            .select('*')
            .order('name', { ascending: true });

        if (!error && data) {
            setCategories(data);
        }
        setLoading(false);
    };

    const handleCreate = async () => {
        if (!newCategory.name.trim()) {
            alert('Category name is required');
            return;
        }

        const { error } = await supabase
            .from('document_categories')
            .insert([{
                name: newCategory.name,
                description: newCategory.description
            }]);

        if (error) {
            alert(`Error creating category: ${error.message}`);
        } else {
            setNewCategory({ name: '', description: '' });
            setIsCreating(false);
            fetchCategories();
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editForm.name.trim()) {
            alert('Category name is required');
            return;
        }

        const { error } = await supabase
            .from('document_categories')
            .update({
                name: editForm.name,
                description: editForm.description
            })
            .eq('id', id);

        if (error) {
            alert(`Error updating category: ${error.message}`);
        } else {
            setEditingId(null);
            fetchCategories();
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete category "${name}"? This will affect all templates using this category.`)) {
            return;
        }

        const { error } = await supabase
            .from('document_categories')
            .delete()
            .eq('id', id);

        if (error) {
            alert(`Error deleting category: ${error.message}`);
        } else {
            fetchCategories();
        }
    };

    const startEdit = (category: Category) => {
        setEditingId(category.id);
        setEditForm({
            name: category.name,
            description: category.description
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({ name: '', description: '' });
    };

    if (loading) {
        return <div className="p-8">Loading...</div>;
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Category Management</h1>
                <button
                    onClick={() => setIsCreating(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Add Category
                </button>
            </div>

            {/* Create New Category Form */}
            {isCreating && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">Create New Category</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Category Name *</label>
                            <input
                                type="text"
                                value={newCategory.name}
                                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                                className="w-full p-2 border rounded"
                                placeholder="e.g., Driver's License"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Description</label>
                            <textarea
                                value={newCategory.description}
                                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                                className="w-full p-2 border rounded"
                                rows={3}
                                placeholder="Brief description of this category"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleCreate}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                Create Category
                            </button>
                            <button
                                onClick={() => {
                                    setIsCreating(false);
                                    setNewCategory({ name: '', description: '' });
                                }}
                                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 flex items-center gap-2"
                            >
                                <X className="w-5 h-5" />
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Categories List */}
            <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-semibold">Existing Categories ({categories.length})</h2>
                </div>

                <div className="divide-y">
                    {categories.length === 0 ? (
                        <p className="p-6 text-gray-500">No categories yet. Create one to get started!</p>
                    ) : (
                        categories.map(category => (
                            <div key={category.id} className="p-6 hover:bg-gray-50">
                                {editingId === category.id ? (
                                    // Edit Mode
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Category Name *</label>
                                            <input
                                                type="text"
                                                value={editForm.name}
                                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                className="w-full p-2 border rounded"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Description</label>
                                            <textarea
                                                value={editForm.description}
                                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                                className="w-full p-2 border rounded"
                                                rows={3}
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleUpdate(category.id)}
                                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                                            >
                                                <Save className="w-4 h-4" />
                                                Save
                                            </button>
                                            <button
                                                onClick={cancelEdit}
                                                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 flex items-center gap-2"
                                            >
                                                <X className="w-4 h-4" />
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // View Mode
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-medium">{category.name}</h3>
                                            <p className="text-gray-600 mt-1">{category.description || 'No description'}</p>
                                            <p className="text-xs text-gray-400 mt-2">
                                                Created: {new Date(category.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => startEdit(category)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                                title="Edit category"
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(category.id, category.name)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                                                title="Delete category"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
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

export default CategoryManagement;
