import React, { useContext } from 'react';
import { AppContext } from '../App';


function Letter({letterPosition, attemptValue}) {
    const {display} = useContext(AppContext);
    const letter = display[attemptValue][letterPosition];
    return <div className="letter">{letter}</div>;
}

export default Letter;