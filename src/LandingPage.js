import { Link } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
    return(
        <div className='main-div'>
            <div class='nav-bar'>
                <button class='nav-btns' id='signup-btn'>Sign Up</button>
                <button class='nav-btns' id='login-btn'>Login</button>
            </div>
            <div class="dialogue-box">
                <h1>Welcome to Wordle Game!</h1>
                <Link to="/game">
                    <button>Play</button>
                </Link>
            </div>
        </div>
    )
}