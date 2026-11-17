import { Shell } from "./components/shell/Shell";
import { AppDataProvider } from "./store/AppDataContext";
import { PreferencesProvider } from "./store/PreferencesContext";
import { AtlasProvider } from "./features/atlas/AtlasContext";

function App() {
  return (
    <PreferencesProvider>
      <AppDataProvider>
        <AtlasProvider>
          <Shell />
        </AtlasProvider>
      </AppDataProvider>
    </PreferencesProvider>
  );
}

export default App;
