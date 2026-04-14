import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ErrorPage({ code = 404, message = "ENTITY DESTROYED" }) {
    const [countdown, setCountdown] = useState(3);
    const navigate = useNavigate();

    useEffect(() => {
        document.title = `${code} Void - RewardHacking`;
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    navigate('/', { replace: true });
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [navigate, code]);

    return (
        <div className="glitch-void-container">
            <div className="glitch-wrapper">
                <div className="glitch" data-glitch={`${code} - ${message}`}>{code} - {message}</div>
            </div>
            <div className="terminal-escape">
                <span className="blinking-cursor">_</span>
                System recalibrating and escaping in <span className="countdown-number">{countdown}</span> ...
            </div>
        </div>
    );
}
