import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PrinterProvider } from './context/PrinterContext';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <AuthProvider>
      <PrinterProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </PrinterProvider>
    </AuthProvider>
  );
}
