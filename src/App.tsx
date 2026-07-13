import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import PasswordGate from './components/PasswordGate';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DataEntry from './pages/DataEntry';
import History from './pages/History';
import Products from './pages/Products';
import Supermarket from './pages/Supermarket';
import Billiard from './pages/Billiard';
import Distributors from './pages/Distributors';
import DistributorDetail from './pages/DistributorDetail';
import Expense from './pages/Expense';

export default function App() {
  return (
    <AppProvider>
      <PasswordGate>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/entry" element={<DataEntry />} />
            <Route path="/history" element={<History />} />
            <Route path="/products" element={<Products />} />
            <Route path="/supermarket" element={<Supermarket />} />
            <Route path="/billiard" element={<Billiard />} />
            <Route path="/expense" element={<Expense />} />
            <Route path="/distributors" element={<Distributors />} />
            <Route path="/distributor/:id" element={<DistributorDetail />} />
          </Route>
        </Routes>
      </HashRouter>
      </PasswordGate>
    </AppProvider>
  );
}
