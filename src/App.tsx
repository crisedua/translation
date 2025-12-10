import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Index from './pages/Index';
import AdminPanel from './pages/AdminPanel';
import AdminRequests from './pages/AdminRequests';
import AdminRequestReview from './pages/AdminRequestReview';
import TemplateAdmin from './pages/TemplateAdmin';
import CategoryManagement from './pages/CategoryManagement';
import UserManagement from './pages/UserManagement';

function App() {
    return (
        <Router>
            <Layout>
                <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/admin" element={<AdminPanel />} />
                    <Route path="/admin/requests" element={<AdminRequests />} />
                    <Route path="/admin/requests/:id" element={<AdminRequestReview />} />
                    <Route path="/admin/templates" element={<TemplateAdmin />} />
                    <Route path="/admin/categories" element={<CategoryManagement />} />
                    <Route path="/admin/users" element={<UserManagement />} />
                </Routes>
            </Layout>
        </Router>
    );
}

export default App;

