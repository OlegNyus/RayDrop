import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider } from './context/AppContext';
import { router } from './router';
import { EasterEggs } from './components/features/easter-eggs/EasterEggs';

function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <RouterProvider router={router} />
        <EasterEggs />
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
