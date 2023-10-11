import './App.css';
import Display from "./AppParts/Display";
import Keyboard from "./AppParts/Keyboard";
import {createContext, useState} from "react";
import { displayDefault } from './Words';


export const AppContext = createContext();

function App() {
  const [display, setDisplay] = useState(displayDefault);
  return (
    <div className="App">
      <nav>
        <h1>Wordle</h1>
      </nav>
      <AppContext.Provider value={{display, setDisplay}}>
        <Display />
        <Keyboard />
      </AppContext.Provider>
    </div>
  );
}

export default App;
