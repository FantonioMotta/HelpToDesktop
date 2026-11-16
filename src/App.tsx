import { Shell } from "./components/shell/Shell";
import { AppDataProvider } from "./store/AppDataContext";
import { PreferencesProvider } from "./store/PreferencesContext";

function App() {
  return (
    <PreferencesProvider>
      <AppDataProvider>
        <Shell />
      </AppDataProvider>
    </PreferencesProvider>
  );
}

export default App;
